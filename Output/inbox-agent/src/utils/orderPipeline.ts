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
import { isOrderSubject } from '../../shared/lib/orderParse';
import type { MessageMeta, Order } from '../../shared/types';
import { LOCAL_USER_ID } from '../constants';

// ---------------------------------------------------------------------------
// קלט
// ---------------------------------------------------------------------------

export interface OrderFixtureMessage extends MessageMeta {
  bodyHtml?: string;
  authenticationResults?: string | null;
}

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
  };
}

const nowIso = (v: Date | string | undefined): string =>
  (v instanceof Date ? v : v ? new Date(v) : new Date()).toISOString();

// ---------------------------------------------------------------------------
// ★ בניית רשומה אחת
// ---------------------------------------------------------------------------

export function buildOrder(
  msg: OrderFixtureMessage,
  opts: OrderRunOptions = {},
): Order | null {
  const parsed = parseOrderMessage({
    fromAddress: msg.fromAddress,
    subject: msg.subject,
    bodyHtml: msg.bodyHtml,
    authenticationResults: msg.authenticationResults,
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

  return { ...base, purgeAfter: purgeDateFor(base, opts) };
}

// ---------------------------------------------------------------------------
// ★ הריצה
// ---------------------------------------------------------------------------

export function runOrderPipeline(
  messages: readonly OrderFixtureMessage[],
  opts: OrderRunOptions = {},
): OrderRunResult {
  const built: Order[] = [];
  const openQuestions: OrderOpenQuestion[] = [];

  for (const msg of messages) {
    const order = buildOrder(msg, opts);
    if (order) {
      built.push(order);
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
    },
  };
}
