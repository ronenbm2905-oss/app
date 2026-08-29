// ============================================================================
// orderPipeline.ts — צינור ההזמנות. מחבר את המודולים הטהורים לסדר אחד.
//
//   הודעה → אימות מקור (שולח ∧ נושא ∧ חתימה ∧ מבנה) → פענוח → Order
//          → applyRetention → שלוש רשימות למסך
//
// ---------------------------------------------------------------------------
// ★ מה **אין** כאן, וזה העיקר
// ---------------------------------------------------------------------------
// אין `sanitize` לפני מודל, אין `mockAgentClassify`, ואין `modelId`. הצינור
// הזה נגמר בפונקציה טהורה. זה לא חיסכון — זו ההבטחה: **כתובת המגורים של
// הלקוחה לא עוזבת את המחשב.** בפרוסה 1 שום דבר כאן לא מתחלף בקריאת רשת,
// בניגוד לצינור החשבוניות ולצינור הטריאז'.
//
// ---------------------------------------------------------------------------
// ★★ `applyRetention` רצה **בטעינה**, לא "בתהליך רקע שיהיה"
// ---------------------------------------------------------------------------
// ההערה ב-`Output/hachzarei-mas/functions/src/index.ts` מתעדת את הכשל
// המדויק: `purgeAfter` נכתב, ואף אחד לא קרא אותו. כלומר המדיניות הצהירה על
// מחיקה שלא קרתה מעולם. כאן המחיקה היא **חלק מהמסלול שמייצר את המסך** — אי
// אפשר לראות הזמנה בלי שהמדיניות רצה עליה קודם.
//
// ★ ומכאן גם התשובה למלכודת שסקירת עדי הצביעה עליה: "מסך ההזמנות של היום"
// אינו אוסף נפרד עם עותק של אותן כתובות. הוא **נגזר** מ-`orders` שכבר עברו
// מחיקה, ולכן אין מצב שבו נמחק המקור ונשאר עותק. הרשימות למטה הן `filter`
// על אותו מערך, לא מבנה שני.
// ============================================================================

import { parseOrderMessage } from '../../shared/lib/orderParse';
import {
  applyRetention,
  expiringSoon,
  purgeDateFor,
  purgeRecipient,
} from '../../shared/lib/orderRetention';
import { domainOf } from '../../shared/lib/addresses';
import {
  ORDER_SOURCE_QUERY,
  readOrderBodies,
  type OrderBodyPart,
  type OrderSourceCandidate,
} from '../../shared/lib/orderSource';
import { isOrderSubject } from '../../shared/lib/orderParse';
import type { Order, OrderIssue } from '../../shared/types';
import { LOCAL_USER_ID } from '../constants';

// ---------------------------------------------------------------------------
// קלט
// ---------------------------------------------------------------------------

/**
 * ★ הטיפוס מוגדר ב-`orderSource.ts` ומיוצא מכאן מחדש.
 *
 * לא סגנון: השדה `bodyHtml` מוגדר במקום אחד בלבד — במודול שהוא אתר הקריאה
 * היחיד. הגדרה שנייה כאן הייתה מזמינה גישה ישירה אליו מכאן.
 */
export type OrderFixtureMessage = OrderSourceCandidate;

/**
 * מה שנשמר בין רענונים.
 *
 * ★ **מזהה + חותמת זמן, ותו לא.** אין כאן שם, אין כתובת ואין סכום. כל השאר
 * נגזר מחדש מההודעה בכל טעינה, ולכן `localStorage` אינו מאגר שני שצריך
 * למחוק בנפרד — וזו בדיוק המלכודת שאני רוצה להימנע ממנה.
 */
export interface ShipmentMark {
  shippedAt: string;
}

export interface OrderRunOptions {
  /** סימוני "נשלח", לפי `messageId`. */
  shipments?: Record<string, ShipmentMark>;
  /** מזהי הזמנות שנמחקו ידנית לבקשת לקוחה. ראה `purgeByRequest`. */
  manuallyPurgedIds?: readonly string[];
  /** "עכשיו". מוזרק תמיד. */
  now?: Date | string;
}

/** הודעה שנראתה כמו הזמנה ולא הפכה לכרטיס — ולמה. **בלי שום פרט ממנה.** */
export interface OrderOpenQuestion {
  messageId: string;
  fromDomain: string;
  receivedAt: string;
  reasonHe: string;
}

export interface OrderRunResult {
  /** כל ההזמנות, אחרי המדיניות. */
  orders: Order[];
  /** ★ צריך שתסתכלי — פענוח שנחסם. אין מהן כתובת להעתקה. */
  needsAttention: Order[];
  /** ★ לארוז ולשלוח. */
  toShip: Order[];
  /** כבר יצא. */
  shipped: Order[];
  /** ★ עומדות להימחק בקרוב ועדיין לא סומנו כנשלחו. */
  expiringSoon: Order[];
  openQuestions: OrderOpenQuestion[];
  stats: {
    scanned: number;
    orders: number;
    unitsToPack: number;
    needsAttention: number;
    /** נמחקו בריצה הזאת. */
    purged: number;
    /**
     * ★ כמה הודעות נקרא מהן גוף, ומאיזה מקור. מוצג במסך (M18).
     * `readSources` נגזר ממה שנקרא בפועל — לא נכתב כמחרוזת קבועה.
     */
    messagesRead: number;
    readSources: string[];
    /**
     * ★ מאיזה חלק MIME נקרא בפועל. אמור להיות `['text']` — כלומר מהטקסט
     * הנקי ולא מה-HTML. נגזר ממה שקרה, לא נכתב כקבוע.
     */
    readParts: string[];
    /** ★★ כמה הודעות היה בהן תוכן שנוסף אחרי החתימה, ונחתך. */
    unsignedTail: number;
    /** השאילתה הקבועה שממנה יגיעו ההודעות בפרוסה 1. מוצגת כמות שהיא. */
    sourceQuery: string;
  };
}

const nowIso = (v: Date | string | undefined): string =>
  (v instanceof Date ? v : v ? new Date(v) : new Date()).toISOString();

// ---------------------------------------------------------------------------
// ★ בניית רשומה אחת
// ---------------------------------------------------------------------------

/**
 * ★★ `body` מגיע כפרמטר, ולא נשלף מההודעה.
 *
 * זו הנקודה שבה B12 הופך ממדיניות למבנה: הפונקציה הזאת **לא יודעת** לקרוא
 * גוף. מי שיודע הוא `readOrderBodies`, שבודק את השולח לפני שהוא נוגע בשדה,
 * והוא היחיד. הודעה שלא עברה שם מגיעה לכאן בלי גוף, והפענוח מסמן אותה
 * "לא הצלחתי לקרוא" — שהוא בדיוק המסלול הנכון בשבילה.
 */
export function buildOrder(
  msg: OrderFixtureMessage,
  opts: OrderRunOptions = {},
  part?: OrderBodyPart,
): Order | null {
  return buildOrderEntry(msg, opts, part)?.order ?? null;
}

/** הזמנה + מפתח התוכן שלה. המפתח לא נשמר ברשומה — ראה `markDuplicates`. */
interface OrderEntry {
  order: Order;
  contentKey: string | null;
}

function buildOrderEntry(
  msg: OrderFixtureMessage,
  opts: OrderRunOptions = {},
  part?: OrderBodyPart,
): OrderEntry | null {
  const parsed = parseOrderMessage({
    fromAddress: msg.fromAddress,
    subject: msg.subject,
    // ★ החלק שנבחר מועבר **כסוגו**: טקסט נקרא כטקסט, HTML כ-HTML. מיזוג
    // השניים לשדה אחד היה מחזיר אותנו להפעלת ניקוי HTML על טקסט נקי.
    bodyText: part?.kind === 'text' ? part.body : undefined,
    bodyHtml: part && part.kind !== 'text' ? part.body : undefined,
    authenticationResults: msg.authenticationResults,
    dkimSignature: msg.dkimSignature,
    unsignedTailBytes: part?.unsignedBytes ?? 0,
  });

  // הודעה שאינה מתיימרת להיות הזמנה כלל אינה עניינו של המסך הזה.
  if (!parsed.isOrderCandidate) return null;

  const mark = opts.shipments?.[msg.messageId];
  const ts = nowIso(opts.now);
  const base = {
    userId: LOCAL_USER_ID,
    id: `ord-${msg.messageId}`,
    sourceMessageId: msg.messageId,
    threadId: msg.threadId,
    fromDomain: domainOf(msg.fromAddress),
    receivedAt: msg.receivedAt,
    recipient: parsed.recipient,
    items: parsed.items,
    paidTotal: parsed.paidTotal,
    currency: parsed.currency,
    installments: parsed.installments,
    status: (mark ? 'shipped' : 'new') as Order['status'],
    shippedAt: mark?.shippedAt ?? null,
    recipientPurged: false,
    needsHumanReview: parsed.needsHumanReview,
    issues: parsed.issues,
    createdAt: ts,
    updatedAt: ts,
  };

  return {
    order: { ...base, purgeAfter: purgeDateFor(base, opts) },
    contentKey: parsed.contentKey,
  };
}

// ---------------------------------------------------------------------------
// ★★ כפילות — לפי תוכן חתום, לא לפי מזהה
// ---------------------------------------------------------------------------

/**
 * מסמן הזמנות שהתוכן החתום שלהן זהה להזמנה מוקדמת יותר.
 *
 * ---------------------------------------------------------------------------
 * למה זה לא מיותר, ולמה `Message-ID` לא היה עוזר
 * ---------------------------------------------------------------------------
 * תג ה-`h=` של הספק מכסה `Received:From:To:Subject` בלבד. `Message-ID`
 * **אינו חתום**, ולכן אפשר לקחת הודעת עסקה אמיתית, לשנות בה את המזהה
 * ולשלוח אותה שוב — והחתימה תמשיך לעבור. מנגנון שסופר לפי מזהה רואה שתי
 * הזמנות, ובעלת העסק אורזת חבילה שנייה שאיש לא שילם עליה.
 *
 * ★ **הראשונה נשארת נקייה, השנייה נעצרת.** לא מיזוג ולא מחיקה: המערכת לא
 * יודעת מי מהן אמיתית, ולכן היא לא בוחרת — היא מראה, ומשאירה את ההכרעה
 * לבעלת העסק. "הראשונה" נקבעת לפי זמן הקליטה שלנו, שהוא הדבר היחיד כאן
 * שאף אחד מבחוץ לא קובע.
 */
function markDuplicates(entries: readonly OrderEntry[]): Order[] {
  const firstSeen = new Set<string>();
  const duplicateIds = new Set<string>();

  const byArrival = [...entries].sort((a, b) =>
    a.order.receivedAt.localeCompare(b.order.receivedAt),
  );
  for (const entry of byArrival) {
    if (!entry.contentKey) continue;
    if (firstSeen.has(entry.contentKey)) duplicateIds.add(entry.order.id);
    else firstSeen.add(entry.contentKey);
  }

  if (duplicateIds.size === 0) return entries.map((e) => e.order);

  const duplicateIssue: OrderIssue = {
    field: 'document',
    code: 'duplicateOrder',
    severity: 'block',
    messageHe:
      'ההזמנה הזאת זהה לגמרי להזמנה אחרת שכבר קיבלת, עד הפרט האחרון. לא הצגתי ממנה כתובת — ייתכן שאותה הודעה נשלחה פעמיים, וכדאי לוודא לפני שאורזים חבילה נוספת',
  };

  return entries.map((e) =>
    duplicateIds.has(e.order.id)
      ? {
          ...e.order,
          issues: [...e.order.issues, duplicateIssue],
          needsHumanReview: true,
        }
      : e.order,
  );
}

// ---------------------------------------------------------------------------
// ★ הריצה
// ---------------------------------------------------------------------------

export function runOrderPipeline(
  messages: readonly OrderFixtureMessage[],
  opts: OrderRunOptions = {},
): OrderRunResult {
  // ★★ **הקריאה היחידה של גוף הודעה בכל האפליקציה.** ראה `orderSource.ts`.
  // היא רצה פעם אחת, לפני הכול, ומחזירה גם את המונה שמוצג במסך.
  const read = readOrderBodies(messages);

  const entries: OrderEntry[] = [];
  const openQuestions: OrderOpenQuestion[] = [];

  for (const msg of messages) {
    const entry = buildOrderEntry(msg, opts, read.bodies.get(msg.messageId));
    if (entry) {
      entries.push(entry);
      continue;
    }

    // ★ הודעה שנשאה את **הנושא** של הודעת עסקה ולא עברה את אימות השולח.
    //
    // היא לא הופכת לכרטיס ולא מציגה שום פרט — אבל היא גם לא נעלמת בשקט:
    // "מייל שנראה כמו הזמנה ולא מופיע ברשימה" בלי הסבר הוא בדיוק הפער
    // שגורם לחוסר אמון בכלי, ומוביל לכך שהיא תפתח את התיבה ותבדוק לבד.
    if (isOrderSubject(msg.subject)) {
      openQuestions.push({
        messageId: msg.messageId,
        fromDomain: domainOf(msg.fromAddress),
        receivedAt: msg.receivedAt,
        reasonHe:
          'ההודעה הזאת נראית כמו הודעת הזמנה, אבל היא לא הגיעה מכתובת הסליקה. לא קראתי ממנה כלום, וכדאי לא ללחוץ על שום דבר בתוכה',
      });
    }
  }

  // ★ כפילות מסומנת לפני המדיניות ולפני התצוגה — היא משנה את
  // `needsHumanReview`, כלומר את הרשימה שההזמנה נופלת אליה.
  const built = markDuplicates(entries);

  // ★ המדיניות רצה כאן, לפני שנבנית ולו רשימה אחת למסך.
  const retention = applyRetention(built, opts);
  let orders = retention.orders;

  // מחיקה ידנית לבקשת לקוחה — מוחלת אחרי המדיניות האוטומטית ולפני התצוגה.
  const manual = new Set(opts.manuallyPurgedIds ?? []);
  if (manual.size > 0) {
    orders = orders.map((o) => (manual.has(o.id) ? purgeRecipient(o, opts) : o));
  }

  // הישן ראשון: מי שמחכה הכי הרבה זמן צריכה לצאת ראשונה.
  const byOldest = (a: Order, b: Order) => a.receivedAt.localeCompare(b.receivedAt);
  const byNewest = (a: Order, b: Order) => b.receivedAt.localeCompare(a.receivedAt);

  const needsAttention = orders.filter((o) => o.needsHumanReview && o.status === 'new').sort(byOldest);
  const toShip = orders.filter((o) => !o.needsHumanReview && o.status === 'new').sort(byOldest);
  const shipped = orders.filter((o) => o.status === 'shipped').sort(byNewest);

  const unitsToPack = toShip.reduce(
    (sum, o) => sum + o.items.filter((i) => i.isPackable).reduce((s, i) => s + i.quantity, 0),
    0,
  );

  return {
    orders,
    needsAttention,
    toShip,
    shipped,
    expiringSoon: expiringSoon(orders, opts).sort(byOldest),
    openQuestions,
    stats: {
      scanned: messages.length,
      orders: orders.length,
      unitsToPack,
      needsAttention: needsAttention.length,
      purged: retention.purgedIds.length + manual.size,
      messagesRead: read.readCount,
      readSources: read.sources,
      readParts: read.parts,
      unsignedTail: read.unsignedTailCount,
      sourceQuery: ORDER_SOURCE_QUERY,
    },
  };
}
