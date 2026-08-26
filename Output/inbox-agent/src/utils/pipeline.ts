// ============================================================================
// pipeline.ts — הצינור. מחבר את שלושת המודולים הטהורים לסדר אחד.
//
//   fixtures → triageFilter → [רעש עוצר כאן] → sanitize → mockAgent → TriageItem
//
// הקובץ הזה הוא **התרגום של סעיף 3 בתוכנית לקוד**, ולכן הסדר בו אינו נוחות
// אלא הטענה עצמה: הסינון קודם. פריט שנפסל בשלב 1 לא מגיע ל-`sanitize`, לא
// מגיע למודל, ולא עולה טוקן אחד. בפרוסה 1 מוחלפים שני המקורות בלבד — המקור
// (`fixtures` → Gmail) והמסווג (`mockAgentClassify` → Cloud Function, שמחזירה
// בדיוק את אותו `AgentOutput`).
// ============================================================================

import {
  prepareContext,
  triageFilter,
  normalizeAddress,
  domainOf,
} from '../../shared/lib/triageFilter';
import { sanitizeEmailBody } from '../../shared/lib/sanitize';
import { redactSensitive } from '../../shared/lib/redactSensitive';
import { mockAgentClassify, MOCK_MODEL_ID } from './mockAgent';
import { parseOrderMessage } from '../../shared/lib/orderParse';
import {
  isClassified,
  type AgentOutput,
  type BriefLevel,
  type ClassifiedItem,
  type MessageMeta,
  type NoiseItem,
  type OrderTriageItem,
  type RunStats,
  type SenderLedgerEntry,
  type TriageDecision,
  type TriageItem,
  type UserSenderRule,
  type Verdict,
} from '../../shared/types';
import { EST_COST_PER_LLM_CALL_USD, LOCAL_USER_ID, RETENTION_DAYS } from '../constants';

// ---------------------------------------------------------------------------
// צורת ה-fixture
// ---------------------------------------------------------------------------

export interface FixtureMessage extends MessageMeta {
  /** כותרת האימות, ל-fixtures של הזמנות. ראה orderParse. */
  authenticationResults?: string | null;

  /**
   * גוף המייל. **קיים ב-fixture בלבד.** הוא לא נשמר ב-`TriageItem` ולא
   * ב-localStorage — ראה `toItem` למטה. זהו העיקרון "מצביעים ונגזרות, לא
   * תוכן", מיושם כבר בפרוסה המקומית: מבנה שנבנה עם `body` בפנים לא נגמל ממנו
   * אחר כך, והשאלה הזאת תישאל בשער המשפטי מילה במילה.
   */
  bodyHtml: string;
}

export interface InboxFixture {
  meta?: Record<string, string | number>;
  owner?: { address: string; displayName: string };
  sentAddresses?: string[];
  signalThreadIds?: string[];
  userRules?: UserSenderRule[];
  senders?: Record<string, Partial<SenderLedgerEntry>>;
  messages: FixtureMessage[];
}

/** תוצאת ריצה מלאה — פריטים + ספירות + הגוף המנוקה לתצוגה בלבד. */
export interface PipelineResult {
  items: TriageItem[];
  stats: RunStats;
  /**
   * `messageId` → הגוף המנוקה. **בזיכרון בלבד**, נמחק עם רענון הדף.
   * המקבילה המדויקת של "הגוף נשלף חי מ-Gmail לתצוגה ומת עם ה-Function".
   */
  bodies: Map<string, string>;
}

// ---------------------------------------------------------------------------
// עזר
// ---------------------------------------------------------------------------

const nowIso = (): string => new Date().toISOString();

function purgeDateFrom(receivedAt: string): string {
  const base = new Date(receivedAt);
  const d = isNaN(base.getTime()) ? new Date() : base;
  return new Date(d.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** משלים רשומת פנקס חלקית מה-fixture לרשומה מלאה ומטופסת. */
export function hydrateLedger(
  raw: Record<string, Partial<SenderLedgerEntry>> | undefined,
): Record<string, SenderLedgerEntry> {
  const out: Record<string, SenderLedgerEntry> = {};
  const ts = nowIso();
  for (const [domainKey, v] of Object.entries(raw ?? {})) {
    out[domainKey] = {
      userId: LOCAL_USER_ID,
      domainKey,
      defaultVerdict: (v.defaultVerdict ?? 'unknown') as Verdict,
      // ברירת המחדל היא `header` ולא `user`: רשומה שנטענה מ-fixture מייצגת
      // מה שנלמד מהכותרות, לא הכרעה מפורשת של המשתמשת. ההבדל משנה — פסק
      // של המשתמשת לא נדרס בלמידה אוטומטית.
      verdictSource: v.verdictSource ?? 'header',
      neverAutoNoise: v.neverAutoNoise ?? false,
      invoiceSource: v.invoiceSource ?? false,
      messageCount: v.messageCount ?? 0,
      repliedCount: v.repliedCount ?? 0,
      lastSeenAt: v.lastSeenAt ?? ts,
      createdAt: ts,
      updatedAt: ts,
    };
  }
  return out;
}

/**
 * הסף להתראה על תווים בלתי-נראים.
 *
 * אחד, ולא אפס — כי אפס הוא כבר המצב הרגיל: `sanitizeEmailBody` מוחק גם soft
 * hyphen וגם סימני כיווניות שנכנסים לטקסט עברי לגיטימי. תו בודד כזה בגוף מייל
 * הוא כבר חריג מספיק כדי להצדיק מבט, ובלי סף כלשהו ההתראה הייתה נדלקת תמיד
 * ולכן לא אומרת דבר.
 */
const INVISIBLE_CHARS_ALARM_THRESHOLD = 1;

/**
 * ★ tripwire של הניקוי.
 *
 * טקסט שהוסתר בכוונה — בלוק `display:none`, לבן-על-לבן, או תווי Bidi שתחובים
 * בגוף — הוא **עובדה על השולח**, לא על התוכן.
 *
 * למה הבדיקה כאן ולא אצל המודל: המודל לעולם לא רואה את החלק המוסתר, כי
 * הסניטייזר מחק אותו לפניו. אילו סמכנו על המודל לדווח על הזרקה, כל הזרקה
 * שהניקוי **הצליח** להסיר הייתה נעלמת בשקט — הכשל הגרוע ביותר, כי אין לו
 * תסמין. הבדיקה חייבת לשבת אצל מי שראה את המקור.
 */
function flagFromSanitizer(
  agent: AgentOutput,
  hiddenBlocksRemoved: number,
  invisibleCharsRemoved: number,
): AgentOutput {
  const suspicious =
    hiddenBlocksRemoved > 0 || invisibleCharsRemoved >= INVISIBLE_CHARS_ALARM_THRESHOLD;
  if (!suspicious) return agent;
  return {
    ...agent,
    needsHumanReview: true,
    // פריט חשוד לא מייצר משימה אוטומטית, גם אם התוכן הגלוי נראה תמים.
    actionRequired: false,
    suggestedTaskTitle: null,
    suggestedDueDate: null,
  };
}

// ---------------------------------------------------------------------------
// ★ הצינור
// ---------------------------------------------------------------------------

export function runPipeline(fixture: InboxFixture): PipelineResult {
  const senders = hydrateLedger(fixture.senders);
  const ctx = prepareContext({
    userRules: fixture.userRules ?? [],
    senders,
    sentAddresses: fixture.sentAddresses ?? [],
    signalThreadIds: fixture.signalThreadIds ?? [],
  });

  const bodies = new Map<string, string>();
  const items: TriageItem[] = [];
  let filteredOut = 0;
  let llmCalls = 0;

  for (const msg of fixture.messages) {
    // --- שלב 1: המסנן. אפס רשת, אפס טוקנים. ---
    const decision = triageFilter(msg, ctx);

    // --- ★★ מסלול ההזמנה. נבדק **לפני** `needsLlm`, בכוונה. ---------------
    //
    // אפשר היה להסתפק ב-`needsLlm === false` שממילא מחזיר `false` כאן, וזה
    // היה עובד — ובדיוק זה מה שלא רציתי: אילו המסלול היה נשען על הענף של
    // הרעש, כל שינוי עתידי בהגדרת `needsLlm` היה יכול לשלוח הזמנה למודל
    // בלי שאף אחד ישים לב. ענף מפורש הוא מה שהופך את ההחלטה לגלויה בקוד.
    //
    // הפריט שנכתב כאן **אינו** נספר ב-`filteredOut`: הזמנה אינה רעש שסוננו,
    // והמונה שמוצג למשתמשת כ"פרסומות שאפשר לדלג עליהן" לא יכיל אותה.
    if (decision.verdict === 'order') {
      const parsed = parseOrderMessage({
        fromAddress: msg.fromAddress,
        subject: msg.subject,
        bodyHtml: msg.bodyHtml,
        authenticationResults: msg.authenticationResults,
      });
      items.push(toOrderItem(msg, decision, parsed.needsHumanReview));
      continue;
    }

    if (!decision.needsLlm) {
      // --- רעש: העיבוד נעצר כאן, ונכתב פריט **בלי כותרת ובלי כתובת**. ---
      filteredOut++;
      items.push(toNoiseItem(msg, decision));
      continue;
    }

    // --- שלב 2: ניקוי. רק ללא-רעש, ותמיד לפני המודל. ---
    const clean = sanitizeEmailBody(msg.bodyHtml ?? '');
    bodies.set(msg.messageId, clean.text);

    // --- שלב 3: המודל (כאן: מוק דטרמיניסטי). קריאה אחת למייל. ---
    // **לא באצווה של כמה מיילים בהקשר אחד** — מייל עוין אחד היה מרעיל את
    // התשובה על התמימים שלידו. המוק שומר על אותה חלוקה, כדי שהמעבר לפרוסה 1
    // לא ישנה את מבנה הקריאות.
    const agent = flagFromSanitizer(
      mockAgentClassify(msg, clean.text),
      clean.hiddenBlocksRemoved,
      clean.invisibleCharsRemoved,
    );
    llmCalls++;

    // --- שלב 4: ★ הפריט נבנה **פעם אחת**, ורק עכשיו. ---
    // זו הנקודה שסקירת עדי דורשת: הכותרת לא נכתבה בשלב הסינון ולא בשלב
    // הניקוי. היא נכנסת לפריט אחרי שידוע `containsSensitive`, ועוברת מיד
    // דרך `redactSensitive`. כתיבה מוקדמת יותר הייתה מניחה את הכותרת
    // הגולמית על הדיסק לפני שהמודל בכלל רץ, והדריסה הייתה מאחרת.
    items.push(redactSensitive(toClassifiedItem(msg, decision, agent, MOCK_MODEL_ID)));
  }

  const fetched = fixture.messages.length;
  return {
    items,
    bodies,
    stats: {
      fetched,
      filteredOut,
      llmCalls,
      filterRate: fetched === 0 ? 0 : filteredOut / fetched,
      estSavedUsd: filteredOut * EST_COST_PER_LLM_CALL_USD,
    },
  };
}

/** שדות שכל פריט נושא, בשני הענפים. */
function baseFields(msg: FixtureMessage, decision: TriageDecision) {
  const ts = nowIso();
  return {
    userId: LOCAL_USER_ID,
    id: msg.messageId,
    threadId: msg.threadId,
    receivedAt: msg.receivedAt,
    fromDomain: domainOf(msg.fromAddress),
    reason: decision.reason,
    reasonHe: decision.reasonHe,
    purgeAfter: purgeDateFrom(msg.receivedAt),
    createdAt: ts,
    updatedAt: ts,
  };
}

/**
 * ★ פריט רעש. שבעה שדות, וזהו.
 *
 * **אין כאן `subject`, אין `fromAddress`, אין `summaryHe`** — והטיפוס
 * `NoiseItem` מסמן אותם `never`, כך שהוספה של אחד מהם היא שגיאת קומפילציה
 * ולא החלטה שמישהו יכול לקבל לבד.
 *
 * זה הטיעון המשפטי החזק ביותר שיהיה לנו, והוא עולה אפס: ~90% מהכותרות בתיבה
 * פשוט לא נכתבות לשום מקום, אף פעם. אין להן retention לנהל, אין מה לדלוף מהן
 * ואין על מה להצהיר.
 *
 * `fromDomain` כן נשמר: הוא הקלט של פנקס השולחים, ובלעדיו המסנן לא לומד
 * ולא משתפר. **דומיין אינו אדם.**
 */
function toNoiseItem(msg: FixtureMessage, decision: TriageDecision): NoiseItem {
  return { ...baseFields(msg, decision), verdict: 'noise' };
}

/**
 * ★★ פריט הזמנה. **אין בו `agent`, כי לא רצה עליו קריאת מודל.**
 *
 * שלוש נקודות שכדאי לשים לב אליהן:
 *  - הוא **כן** נושא כותרת וכתובת שולח, בניגוד לפריט רעש. מותר, כי שתיהן
 *    של מכונה: הכותרת היא מחרוזת קבועה וכתובת השולח היא מערכת סליקה.
 *  - הוא **לא** נושא שום דבר של הלקוחה. שם, טלפון וכתובת חיים ב-`Order`
 *    בלבד, שיש לו מדיניות מחיקה משלו — וזה מה שמאפשר למחוק את הכתובת בלי
 *    לאבד את העקבה שההזמנה הגיעה.
 *  - `needsHumanReview` מגיע מהפרסר הדטרמיניסטי ולא ממודל.
 */
function toOrderItem(
  msg: FixtureMessage,
  decision: TriageDecision,
  needsHumanReview: boolean,
): OrderTriageItem {
  return {
    ...baseFields(msg, decision),
    verdict: 'order',
    fromAddress: normalizeAddress(msg.fromAddress),
    fromName: msg.fromName ?? '',
    subject: msg.subject ?? '',
    orderId: `ord-${msg.messageId}`,
    needsHumanReview,
  };
}

function toClassifiedItem(
  msg: FixtureMessage,
  decision: TriageDecision,
  agent: AgentOutput | null,
  modelId: string,
): ClassifiedItem {
  const address = normalizeAddress(msg.fromAddress);
  return {
    ...baseFields(msg, decision),
    // הטיפוס של `decision.verdict` הוא `Verdict` המלא; כאן כבר ידוע שהוא
    // `signal` או `unknown` — `noise` ו-`order` נעצרו בענפים שלמעלה.
    verdict: decision.verdict === 'signal' ? 'signal' : 'unknown',
    fromAddress: address,
    fromName: msg.fromName ?? '',
    subject: msg.subject ?? '',
    agent,
    modelId,
    handled: false,
    // שים לב מה **אין** כאן: `bodyHtml`, `snippet`, נמענים, קבצים מצורפים.
    // הגוף נשאר ב-`bodies` שבזיכרון בלבד.
  };
}

// ---------------------------------------------------------------------------
// דירוג לשלוש הרמות של המסך
// ---------------------------------------------------------------------------

/**
 * 🔴 / 🟡 / ⚪ — המבנה שהטריאז' של מאיה כבר הוכיח בעבודה ידנית.
 *
 * שתי הכרעות שכדאי לשים לב אליהן:
 *  - רעש הוא ⚪ **תמיד**, בלי קשר לכלום. לא רץ עליו מודל, ואין על מה להסתמך
 *    כדי לקדם אותו; קידום היה מחייב בדיוק את הקריאה שחסכנו.
 *  - `needsHumanReview` **לא** מקפיץ ל-🔴. פריט חשוד הוא לא "דחוף" אלא "אל
 *    תיגעי בלי להסתכל". 🔴 שמור לעניין אמיתי שממתין לתשובה, ואם נמלא אותו
 *    בהתראות פישינג הוא יאבד את המשמעות שלו — והמשמעות הזאת היא כל המוצר.
 *
 *  - ★ פריט שהגיע לכאן **בזכות מילת מפתח** נעצר ב-🟡, גם אם המודל קרא אותו
 *    כדחוף. זה תיקון לבאג אמיתי שנתפס במבחן: דיוור שיווקי בנושא "הצעת מחיר
 *    מיוחדת רק היום" קיבל `urgency: 'high'` ועלה ל-🔴. המסנן דווקא עשה את
 *    שלו — הוא עצר את הקידום ב-`unknown` ולא נתן `signal` — אבל הדירוג ביטל
 *    את התקרה צעד אחד מאוחר יותר.
 *
 *    ההיגיון: "דחוף" נקרא מתוך הטקסט של המייל, כלומר מהערוץ שהשולח שולט בו.
 *    כשהראיה היחידה לחשיבות היא מילה שהשולח בעצמו כתב, היא קונה מבט שני —
 *    לא ראש הרשימה.
 */
export function levelOf(item: TriageItem): BriefLevel {
  // הזמנה אינה רמה בדוח הבוקר — היא שייכת למסך אחר. הבדיקה ראשונה, כי
  // בלעדיה פריט הזמנה היה נופל לענף 'אין agent' ומוצג כפרסומת.
  if (item.verdict === 'order') return 'order';
  if (!isClassified(item) || !item.agent) return 'noise';
  const { urgency, actionRequired, needsHumanReview } = item.agent;
  if (needsHumanReview) return 'review';
  if (item.reason === 'keywordPromoted') return 'review';
  if (urgency === 'high' || (actionRequired && item.verdict === 'signal')) return 'action';
  return 'review';
}

/** האם הפעולות המהירות מושבתות. סעיף 6.5 בתוכנית. */
export function quickActionsBlocked(item: TriageItem): boolean {
  if (!isClassified(item)) return false;
  const a = item.agent;
  if (!a) return false;
  return a.mentionsPayment || a.requestsCredentials || a.needsHumanReview;
}
