// ============================================================================
// triageFilter.ts — שלב 1 של הצינור. פונקציה טהורה, בלי רשת, בלי I/O.
//
// ---------------------------------------------------------------------------
// למה זה הרכיב החשוב בתוכנית כולה
// ---------------------------------------------------------------------------
// הבעיה אינה "לקרוא מיילים" אלא להחזיר סיגנל שנקבר תחת רעש. הטריאז' של מאיה
// מדד 95%+ רעש ממספר קטן וקבוע של דומיינים, ו-48 שעות שבהן 16 מיילים היו 100%
// רעש. המסקנה שנרשמה שם היא עמוד השדרה: **הסינון הוא שלב ראשון, לא אחרון.**
//
// מספרית: ~3,600 מיילים בחודש. בלי מסנן ≈ $83/חודש למודל; עם מסנן ≈ $8.
// הרכיב שחוסך ~90% מהעלות הוא פונקציה טהורה של כמה עשרות שורות, בלי תלויות
// ובלי רשת — היחס בין עלות הבנייה לתועלת הוא הגבוה בכל התוכנית.
//
// ---------------------------------------------------------------------------
// ★ הסדר הוא הלוגיקה
// ---------------------------------------------------------------------------
// הבדיקות למטה אינן רשימת תנאים שאפשר לסדר מחדש. כל בדיקה **מפסיקה** את
// הריצה, ולכן הקדימות היא כל המשמעות. שתי נקודות שנשברות אם משנים סדר:
//
//  (א) כתובת שהתכתבנו איתה נבדקת **לפני** כל בדיקת דומיין. לכן לקוחה שכותבת
//      מ-gmail, מדומיין ששאר העולם מציף ממנו — היא סיגנל. זו התובנה הראשונה
//      של מאיה: `in:sent` הוא חלק מהטריאז', לא תוספת.
//
//  (ב) מילות מפתח נבדקות **אחרונות**, ורק **מקדמות** `noise → unknown`.
//      הן לעולם לא מורידות ל-`noise` ולעולם לא מקדמות ל-`signal`. הסיבה:
//      "דחוף!", "החשבונית שלך", "פעולה נדרשת" — אלה בדיוק המילים ששיווק
//      אגרסיבי מזייף. דומיין הוא עובדה על השולח; מילת מפתח היא טענה שלו
//      על עצמו.
// ============================================================================

import type {
  MessageMeta,
  TriageDecision,
  TriageReason,
  Verdict,
} from '../types/triage';
import type { SenderLedgerEntry, UserSenderRule } from '../types/sender';
import { domainOf, normalizeAddress } from '../../shared/lib/addresses';
import { isOrderMessage } from '../../shared/lib/orderParse';

// ---------------------------------------------------------------------------
// נרמול
// ---------------------------------------------------------------------------
// שתי הפונקציות עברו ל-`addresses.ts` ומיוצאות מכאן מחדש. הסיבה כתובה שם:
// `orderParse` צריך אותן, והקובץ הזה צריך את `orderParse` — ושכפול הנרמול
// היה מייצר שתי הגדרות שונות ל"אותו שולח".
export { domainOf, normalizeAddress };

/**
 * מועמדי התאמה בפנקס, מהספציפי לכללי:
 * `market-updates.zilo.example` → `['market-updates.zilo.example', 'zilo.example']`
 *
 * למה זה נחוץ ולא ייעול: הרעש שנמדד מגיע מפלטפורמה אחת שמפזרת אותו על עשרות
 * תת-דומיינים (`market-updates.`, `my-saved-home.`, `zmail.`...). התאמה
 * מדויקת בלבד הייתה מחייבת רשומת פנקס לכל תת-דומיין, ורשומה חדשה בכל פעם
 * שהפלטפורמה ממציאה אחד. עצירה בשתי תוויות מונעת התאמה על TLD בלבד.
 */
export function domainCandidates(domain: string): string[] {
  const parts = String(domain || '')
    .toLowerCase()
    .split('.')
    .filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i + 2 <= parts.length; i++) out.push(parts.slice(i).join('.'));
  return out;
}

// ---------------------------------------------------------------------------
// הקשר הריצה
// ---------------------------------------------------------------------------

export interface TriageContext {
  /** הוראות מפורשות של המשתמשת. גוברות על הכול. */
  userRules?: readonly UserSenderRule[];

  /** הפנקס, לפי `domainKey`. */
  senders?: Readonly<Record<string, SenderLedgerEntry>>;

  /**
   * ★ כתובות שהמשתמשת **כתבה אליהן** ב-90 הימים האחרונים (`in:sent`).
   * זה לא "נתון נוסף" אלא בדיקה שקודמת לכל בדיקת דומיין.
   */
  sentAddresses?: readonly string[] | ReadonlySet<string>;

  /** שרשורים שכבר הוכרעו כסיגנל — תשובה בשרשור פתוח היא סיגנל בהגדרה. */
  signalThreadIds?: readonly string[] | ReadonlySet<string>;

  /** דריסה של רשימת מילות המפתח (לבדיקות). */
  promoteKeywords?: readonly string[];
}

// ---------------------------------------------------------------------------
// קבועים
// ---------------------------------------------------------------------------

/**
 * תיבות דואר שמצהירות על עצמן שאין מאחוריהן אדם.
 * שים לב שהבדיקה הזו יושבת **אחרי** `neverAutoNoise` — התראת Drive מגיעה
 * מ-`no-reply@`, ובכל זאת מאחוריה אדם שערך קובץ.
 */
const NOREPLY_LOCAL_PARTS = [
  'noreply',
  'no-reply',
  'no_reply',
  'donotreply',
  'do-not-reply',
  'notifications',
  'notification',
  'mailer-daemon',
  'bounce',
  'bounces',
  'newsletter',
  'marketing',
  'campaign',
  'mailer',
];

/**
 * מילות מפתח שמצדיקות **מבט שני בלבד** על מייל שסווג רעש.
 * הן לא הופכות אותו לסיגנל — רק מוציאות אותו מהערמה השקטה אל 🟡.
 */
const DEFAULT_PROMOTE_KEYWORDS = [
  'הצעת מחיר',
  'הצעה למחיר',
  'חוזה',
  'הסכם',
  'חשבונית',
  'קבלה',
  'פגישה',
  'תיאום',
  'ייעוץ',
  'שאלה',
  'בקשה',
  'הזמנה',
  'לקוח',
  'לקוחה',
  'מועד',
  'סדנה',
  'הרצאה',

  // ★ אנגלית, מפרוסה 0.5. ספק בינלאומי (אחסון, סטוק, כלי SaaS) שולח
  // חשבונית באנגלית **עם** `List-Unsubscribe`, כלומר שלב 5 קובע עליה רעש.
  // בלי המילים האלה דווקא החשבוניות מהספקים האלה היו נקברות — וזה הפוך
  // בדיוק ממה שהמודול נבנה בשבילו.
  'invoice',
  'receipt',
  'billing',
];

// ---------------------------------------------------------------------------
// עזרי בדיקה
// ---------------------------------------------------------------------------

/**
 * `Set` שמגיע מבחוץ נחשב **מנורמל מראש** ומוחזר כמות שהוא; מערך מנורמל כאן.
 * ההבחנה חוסכת בנייה מחדש של ה-Set בכל הודעה — ראה `prepareContext`, שמנרמל
 * פעם אחת לפני אצווה שלמה.
 */
function asSet(v: readonly string[] | ReadonlySet<string> | undefined): ReadonlySet<string> {
  if (!v) return new Set<string>();
  if (v instanceof Set) return v;
  return new Set(Array.from(v as readonly string[], (x) => normalizeAddress(x)));
}

function localPartOf(address: string): string {
  const at = address.indexOf('@');
  return at === -1 ? address : address.slice(0, at);
}

/** `Precedence: bulk|list|junk` (RFC 2076) או `Auto-Submitted` שאינו `no`. */
function hasBulkHeaders(msg: MessageMeta): boolean {
  if (msg.listUnsubscribe && String(msg.listUnsubscribe).trim()) return true;

  const prec = String(msg.precedence ?? '').trim().toLowerCase();
  if (prec === 'bulk' || prec === 'list' || prec === 'junk') return true;

  const auto = String(msg.autoSubmitted ?? '').trim().toLowerCase();
  // RFC 3834: `no` פירושו מפורשות "נכתב בידי אדם". כל ערך אחר הוא אוטומטי.
  if (auto && auto !== 'no') return true;

  return false;
}

function looksLikeNoreply(address: string): boolean {
  const local = localPartOf(address);
  return NOREPLY_LOCAL_PARTS.some(
    (p) => local === p || local.startsWith(`${p}-`) || local.startsWith(`${p}.`) || local.startsWith(`${p}+`),
  );
}

function decision(
  verdict: Verdict,
  reason: TriageReason,
  reasonHe: string,
  matchedDomainKey?: string,
): TriageDecision {
  return {
    verdict,
    reason,
    reasonHe,
    // ★★ בדיקה חיובית ולא שלילית. ראה ההערה על `needsLlm` ב-`types/triage.ts`:
    // `noise` לא ממשיך כי אין טעם, ו-`order` לא ממשיך כי **אסור**. ניסוח
    // שלילי (`!== 'noise'`) היה מעביר כל מסלול חדש למודל כברירת מחדל — וזו
    // בדיוק הצורה שבה החלטה שנשמעת מובנת מאליה מתבטלת בשקט בסבב הבא.
    needsLlm: verdict === 'signal' || verdict === 'unknown',
    ...(matchedDomainKey ? { matchedDomainKey } : {}),
  };
}

// ---------------------------------------------------------------------------
// ★ הפונקציה
// ---------------------------------------------------------------------------

export function triageFilter(msg: MessageMeta, ctx: TriageContext = {}): TriageDecision {
  const address = normalizeAddress(msg.fromAddress);
  const domain = domainOf(address);
  const candidates = domainCandidates(domain);

  // --- שלב 0: ★★ הודעת הזמנה. לפני הכול, כולל לפני הוראת המשתמשת. ----------
  //
  // זו הבדיקה היחידה שמוצבת מעל הוראת משתמש, ויש לזה נימוק שאני עומד מאחוריו:
  // הוראת משתמש היא **העדפה** ("אני לא רוצה לראות דיוור מהדומיין הזה"),
  // והזמנה היא **עובדה** — מישהי שילמה וממתינה לחבילה. הוראה שנכתבה פעם
  // אחת, אולי בטעות, על הדומיין של ספק הסליקה, הייתה קוברת כל הזמנה שתגיע
  // אחריה. זה כשל שקט שמתגלה רק כשלקוחה מתקשרת לשאול איפה החבילה.
  //
  // ★ והחשוב מכול: הענף הזה מחזיר `needsLlm: false`. הודעת סליקה מכילה את
  // כתובת המגורים של הלקוחה, ומכאן והלאה **אין מסלול בקוד** שמעביר אותה
  // למודל. לא "לא אמור" — לא יכול.
  if (isOrderMessage(msg)) {
    return decision(
      'order',
      'orderMessage',
      'זו הודעה על הזמנה ששולמה. פרטי המשלוח נקראים אצלי במחשב בלבד ולא נשלחים לשום מקום',
    );
  }

  // --- שלב 1: הוראת משתמש. גוברת על הכול, כולל על הפנקס האוטומטי. -----------
  // הספציפי מנצח: כלל על כתובת גובר על כלל על דומיין. משתמשת שאמרה "הכתובת
  // הזאת כן" אחרי שאמרה "הדומיין הזה לא" מתכוונת לחריג, לא לסתירה.
  const rules = ctx.userRules ?? [];
  const addrRule = rules.find(
    (r) => r.scope === 'address' && normalizeAddress(r.value) === address,
  );
  if (addrRule) {
    return decision(addrRule.verdict, 'userRule', 'ככה ביקשת שאתייחס לכתובת הזאת');
  }
  const domainRule = rules.find(
    (r) => r.scope === 'domain' && candidates.includes(String(r.value).toLowerCase()),
  );
  if (domainRule) {
    return decision(domainRule.verdict, 'userRule', 'ככה ביקשת שאתייחס לשולח הזה', String(domainRule.value).toLowerCase());
  }

  // --- שלב 2: השרשור כבר סיגנל ---------------------------------------------
  // תשובה בתוך שיחה פתוחה היא סיגנל גם אם ההודעה עצמה נראית תמימה ("תודה!").
  const signalThreads = ctx.signalThreadIds instanceof Set
    ? ctx.signalThreadIds
    : new Set(Array.from((ctx.signalThreadIds ?? []) as readonly string[]));
  if (msg.threadId && signalThreads.has(msg.threadId)) {
    return decision('signal', 'threadSignal', 'זו שיחה שכבר אמרת שחשובה לך');
  }

  // --- שלב 3: ★ התכתבנו עם הכתובת ב-90 יום ---------------------------------
  // כאן, ולא אחרי בדיקות הדומיין. אם מישהי כתבה לכתובת הזאת — היא לא רעש,
  // **גם אם הדומיין שלה מסומן רעש בפנקס**. תיבה נכנסת "ריקה" לא אומרת ששום
  // דבר לא תלוי; המעקבים הפתוחים יושבים בדיוק כאן.
  const sent = asSet(ctx.sentAddresses);
  if (address && sent.has(address)) {
    return decision('signal', 'correspondent', 'כתבת לכתובת הזאת בשלושת החודשים האחרונים');
  }
  // גם `Reply-To` נחשב: דיוור שנשלח מכתובת מתחלפת ומכוון תשובות לכתובת
  // שהתכתבנו איתה הוא, בפועל, אותה שיחה.
  const replyTo = normalizeAddress(msg.replyTo);
  if (replyTo && sent.has(replyTo)) {
    return decision('signal', 'correspondent', 'התשובה על המייל הזה חוזרת למישהו שאת בקשר איתו');
  }

  // --- שלב 4: `neverAutoNoise` — כלי שיתוף -----------------------------------
  // התראת Dropbox/Drive/Calendly היא בוט לכל דבר: `no-reply@`, עם
  // `List-Unsubscribe`, ושלוש הבדיקות הבאות היו קוברות אותה. אבל מאחוריה אדם
  // שערך קובץ או קבע פגישה. הדגל **לא מקדם לסיגנל** — הוא רק אוסר על ירידה
  // אוטומטית לרעש, ומשאיר את ההכרעה למודל.
  const ledgerKey = candidates.find((c) => ctx.senders?.[c]);
  const ledger: SenderLedgerEntry | undefined = ledgerKey ? ctx.senders?.[ledgerKey] : undefined;
  if (ledger?.neverAutoNoise) {
    return decision('unknown', 'neverAutoNoise', 'הודעה אוטומטית, אבל מאחוריה מישהו שעשה משהו', ledgerKey);
  }

  // מכאן והלאה אפשר להגיע ל-`noise`. כל פסק כזה עדיין חשוף לקידום בשלב 8.
  let verdict: Verdict = 'unknown';
  let reason: TriageReason = 'default';
  let reasonHe = 'לא זיהיתי כאן שום סימן מוכר, אז עדיף שתציצי';
  let matched: string | undefined;

  // --- שלב 5: כותרות דיוור המוני ---------------------------------------------
  // `List-Unsubscribe` היא הראיה החזקה ביותר שקיימת: השולח עצמו מצהיר שזו
  // רשימת תפוצה. אף אדם שכותב מייל אישי לא מוסיף אותה.
  if (hasBulkHeaders(msg)) {
    verdict = 'noise';
    reason = 'bulkHeaders';
    reasonHe = 'זו רשימת תפוצה — כך כתוב במייל עצמו';
  }

  // --- שלב 6: פנקס השולחים האוטומטי -----------------------------------------
  else if (ledger && ledger.defaultVerdict !== 'unknown') {
    verdict = ledger.defaultVerdict;
    reason = 'senderLedger';
    matched = ledgerKey;
    reasonHe =
      ledger.defaultVerdict === 'noise'
        ? `מ-${ledgerKey} הגיעו ${ledger.messageCount} מיילים ולא ענית לאף אחד`
        : `${ledgerKey} הוא שולח שאת בקשר איתו`;
  }

  // --- שלב 7: `noreply@` ------------------------------------------------------
  else if (looksLikeNoreply(address)) {
    verdict = 'noise';
    reason = 'noreplyAddress';
    reasonHe = 'נשלח מכתובת שאי אפשר לענות לה';
  }

  // --- שלב 7.5: ★ ספק שכבר שלח חשבוניות — מקדם בלבד ---------------------------
  //
  // הוספה של פרוסה 0.5, והיא סוגרת חור אמיתי: חשבונית ספק מגיעה כמעט תמיד
  // מ-`billing@`/`noreply@` **עם** `List-Unsubscribe` — כלומר שלב 5 קבע עליה
  // רעש, בצדק לפי הכותרות. התוצאה הייתה שדווקא המיילים שנוגעים בכסף נקברים.
  //
  // הקידום נשען על `invoiceSource` בפנקס, שהוא **נלמד מכותרות או מהמשתמשת
  // בלבד** (`senderLedger.ts`), ולכן הוא לא פותח דלת אחורית לפסיקת מודל.
  // ובדיוק כמו מילות מפתח: הוא מקדם `noise → unknown` ולעולם לא ל-`signal`,
  // כי "ספק ידוע" הוא סיבה למבט ולא הכרעה.
  if (verdict === 'noise' && ledger?.invoiceSource) {
    return decision(
      'unknown',
      'invoiceEvidence',
      `מ-${ledgerKey} כבר הגיעו חשבוניות, אז לא סימנתי את זה כפרסומת`,
      ledgerKey,
    );
  }

  // --- שלב 8: ★ מילות מפתח — מקדמות בלבד -------------------------------------
  // התנאי `verdict === 'noise'` הוא כל ההגנה. מילת מפתח לא יכולה להוריד פריט
  // לרעש, ולא יכולה לקדם אותו לסיגנל — היעד הוא `unknown` ותו לא. מייל שיווקי
  // עם "דחוף! החשבונית שלך" יעלה ל-🟡 ויקבל מבט; הוא לא יגיע ל-🔴.
  if (verdict === 'noise') {
    const keywords = ctx.promoteKeywords ?? DEFAULT_PROMOTE_KEYWORDS;
    const subject = String(msg.subject ?? '');
    // ★ ההשוואה חסרת-רישיות: `Invoice` ו-`invoice` הם אותה מילה, ורק
    // באנגלית זה משנה. בעברית אין רישיות, ולכן זה לא משפיע על שאר הרשימה.
    const lowSubject = subject.toLowerCase();
    const hit = keywords.find((k) => k && lowSubject.includes(k.toLowerCase()));
    if (hit) {
      return decision('unknown', 'keywordPromoted', `זה נראה כמו פרסומת, אבל בכותרת כתוב "${hit}"`, matched);
    }
  }

  return decision(verdict, reason, reasonHe, matched);
}

// ---------------------------------------------------------------------------
// הרצה על אצווה + ספירות
// ---------------------------------------------------------------------------

/**
 * מנרמל את ההקשר פעם אחת. בלי זה כל קריאה ל-`triageFilter` בונה מחדש את
 * רשימת הנמענים — ריבוע במספר ההודעות, וזה בדיוק המקום שבו זה מכאיב.
 */
export function prepareContext(ctx: TriageContext = {}): TriageContext {
  return {
    ...ctx,
    sentAddresses: asSet(ctx.sentAddresses),
    signalThreadIds:
      ctx.signalThreadIds instanceof Set
        ? ctx.signalThreadIds
        : new Set(Array.from((ctx.signalThreadIds ?? []) as readonly string[])),
  };
}

/**
 * מריץ את המסנן על רשימה ומחזיר את הפסקים לצד הספירות.
 * הספירות אינן קישוט: `filteredOut / fetched` הוא המדד שהתוכנית קבעה שצריך
 * לעמוד מעל 0.85, וזה מה שמאמת שהמסנן באמת עובד על תיבה אמיתית.
 */
export function triageBatch(
  messages: readonly MessageMeta[],
  ctx: TriageContext = {},
): { decisions: TriageDecision[]; fetched: number; filteredOut: number; needsLlm: number; filterRate: number } {
  const prepared = prepareContext(ctx);
  const decisions = messages.map((m) => triageFilter(m, prepared));
  const fetched = decisions.length;
  const filteredOut = decisions.filter((d) => !d.needsLlm).length;
  return {
    decisions,
    fetched,
    filteredOut,
    needsLlm: fetched - filteredOut,
    filterRate: fetched === 0 ? 0 : filteredOut / fetched,
  };
}
