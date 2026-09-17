// ============================================================================
// shippedMarks.ts — ★★ הסימון "נשלח", ומה שקורה כשמסמנים שישים בבת אחת.
//
// ---------------------------------------------------------------------------
// ★★ למה ההיגיון כאן ולא בתוך ה-`onCall`
// ---------------------------------------------------------------------------
// אותו נימוק שכתוב על `runPurge` ב-`purgePolicy.ts`: **היגיון שיושב בתוך
// פונקציית ענן הוא היגיון לא-נבדק.** אי אפשר לקרוא ל-`onCall` ממבחן בלי
// להרים אמולטור, ולכן כל מה שאפשר לטעות בו — ולידציה, דילוגים, וצורת
// הכתיבה — יושב כאן, מול Firestore מזויף.
//
// ב-`index.ts` נשארה עטיפה בת שלוש שורות שכל מה שהיא עושה הוא לתרגם
// `MarkShippedError` ל-`HttpsError`.
//
// ---------------------------------------------------------------------------
// ★★ מסלול קוד אחד — לאחת ולשישים
// ---------------------------------------------------------------------------
// אין כאן `markOne` ו-`markMany`. הצ׳קבוקס הבודד שולח מערך באורך 1, וכפתור
// "סימון הכל" שולח מערך באורך 60 — **אותן ולידציות, אותם דילוגים, אותה
// כתיבה**. שתי פונקציות היו נפרדות ביום הראשון ומתפצלות בשקט בחודש השלישי,
// ואז "מה שמותר בבודד" ו"מה שקורה בהמוני" מפסיקים להיות אותו דבר. וזה
// בדיוק המקום שבו פעולה המונית עושה מה שהפעולה הבודדת אוסרת.
//
// ---------------------------------------------------------------------------
// ★★ הזמנה שסומנה "צריך שתסתכלי" — **מדולגת**
// ---------------------------------------------------------------------------
// `BlockedOrderCard` במסך לא מציג עליה צ׳קבוקס בכלל: אי אפשר לסמן אותה
// כנשלחה ביחיד. ולכן היא לא תיסמן גם בהמוני — אחרת כפתור אחד היה עוקף
// החלטה שהמסך קיבל בכוונה, והספירה הייתה אומרת "סימנתי 60" על 58 שסומנו
// ושתיים שאיש לא הסתכל עליהן.
//
// היא נספרת ב-`skippedBlocked` ונאמרת במסך במשפט משלה. דילוג שקט הוא גרוע
// מכישלון גלוי.
//
// ---------------------------------------------------------------------------
// ★ ומה **לא** נכתב כאן: השעון של המחיקה
// ---------------------------------------------------------------------------
// `markShipped` / `unmarkShipped` מ-`shared/lib/orderRetention.ts` הן
// שמחשבות את `shippedAt` ואת `purgeAfter` — כולל רצפת 180 הימים. הפונקציה
// הזאת לא מחשבת תאריכים בעצמה ולא "רק מעדכנת סטטוס": חישוב שני של מדיניות
// המחיקה, שנראה נכון ביום שנכתב, הוא הדרך הבטוחה ביותר שהמדיניות תתפצל.
// ============================================================================

import { type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS, docPath } from '../shared/lib/firestorePaths';
import { markShipped, unmarkShipped } from '../shared/lib/orderRetention';
import type { Order } from '../shared/types/order';

/**
 * ★ תקרה לבקשה אחת.
 *
 * 200 ולא "בלי הגבלה": בקשה אחת מתורגמת לקריאה וכתיבה של כל מזהה, ומערך
 * בגודל שרירותי הוא הדרך להפיל את הפונקציה מהמסך. המספר גדול בהרבה ממה
 * שרשימת אריזה אמיתית מגיעה אליו (~60), כך שהוא לא נתקל בשימוש רגיל.
 */
export const MAX_MESSAGE_IDS = 200;

/** תקרת המסמכים ב-batch של Firestore. */
export const BATCH_LIMIT = 500;

export type MarkShippedErrorCode = 'unauthenticated' | 'invalid-argument';

/**
 * שגיאה עם קוד, בדיוק כמו `OAuthFlowError` ו-`TokenStoreError`.
 *
 * ★ הטעם: הלוגיקה לא מייבאת `firebase-functions`, ולכן אפשר לבדוק אותה בלי
 * להרים סביבת ענן. התרגום ל-`HttpsError` קורה ב-`index.ts` בלבד.
 */
export class MarkShippedError extends Error {
  readonly code: MarkShippedErrorCode;
  readonly messageHe: string;

  constructor(code: MarkShippedErrorCode, messageHe: string) {
    super(messageHe);
    this.name = 'MarkShippedError';
    this.code = code;
    this.messageHe = messageHe;
  }
}

export interface MarkShippedInput {
  uid: string;
  /** מזהי ההודעות, אחרי דדופ. לא ריק, ולא מעל `MAX_MESSAGE_IDS`. */
  messageIds: string[];
  shipped: boolean;
}

export interface MarkShippedResult {
  /** כמה הזמנות נמצאות עכשיו במצב שהתבקש. */
  updated: number;
  /** מזהים שאין להם מסמך. */
  skippedMissing: number;
  /** ★★ הזמנות שסומנו "צריך שתסתכלי" ולכן לא נגענו בהן. */
  skippedBlocked: number;
}

/**
 * ולידציה של הבקשה. **כל מה שמגיע מהקליינט נחשב עוין עד שנבדק.**
 *
 * ★ ה-uid נלקח מהאסימון ואי אפשר לשלוח אותו כפרמטר — אותה הכרעה בדיוק כמו
 * ב-`setSupportMode`. פרמטר `uid` בבקשה היה הופך את הפונקציה לכלי לכתיבה
 * אצל מישהי אחרת.
 */
export function parseMarkShippedInput(
  auth: { uid?: string } | null | undefined,
  data: unknown,
): MarkShippedInput {
  const uid = auth?.uid;
  if (typeof uid !== 'string' || uid.length === 0) {
    throw new MarkShippedError('unauthenticated', 'צריך להתחבר קודם');
  }

  const body = (data ?? {}) as { messageIds?: unknown; shipped?: unknown };

  if (!Array.isArray(body.messageIds)) {
    throw new MarkShippedError('invalid-argument', 'לא קיבלתי רשימת הזמנות לסמן');
  }

  // ★ `shipped` חייב להיות בוליאני מפורש. ערך חסר שמתפרש כ-`true` היה הופך
  // בקשה פגומה לסימון המוני — כלומר טעות שמשנה נתונים במקום להיכשל.
  if (typeof body.shipped !== 'boolean') {
    throw new MarkShippedError('invalid-argument', 'לא קיבלתי מה לעשות עם ההזמנות האלה');
  }

  const clean: string[] = [];
  const seen = new Set<string>();
  for (const raw of body.messageIds) {
    if (typeof raw !== 'string' || raw.length === 0) {
      throw new MarkShippedError('invalid-argument', 'אחד המזהים שקיבלתי אינו תקין');
    }
    // ★ דדופ. אותו מזהה פעמיים באותה בקשה הוא כתיבה כפולה על אותו מסמך
    // ובספירה מנופחת — ו-`batch` של Firestore בכלל מסרב לו.
    if (seen.has(raw)) continue;
    seen.add(raw);
    clean.push(raw);
  }

  if (clean.length === 0) {
    throw new MarkShippedError('invalid-argument', 'לא קיבלתי רשימת הזמנות לסמן');
  }
  if (clean.length > MAX_MESSAGE_IDS) {
    throw new MarkShippedError('invalid-argument', 'יותר מדי הזמנות בבת אחת');
  }

  return { uid, messageIds: clean, shipped: body.shipped };
}

/**
 * ★ האם ההזמנה כבר במצב שהתבקש.
 *
 * ★★ ולמה זה לא אופטימיזציה אלא בקרה: כתיבה חוזרת של `markShipped` על הזמנה
 * שכבר סומנה מאפסת את `shippedAt` לעכשיו — כלומר **דוחה את מועד המחיקה
 * קדימה**. פעולה המונית שנשלחת פעמיים הייתה מאריכה בשקט את השמירה של פרטי
 * הנמענת, וזה בדיוק סוג הדבר שמדיניות המחיקה נבנתה כדי שלא יקרה.
 */
function alreadyInState(order: Partial<Order>, shipped: boolean): boolean {
  const isShipped = order.status === 'shipped';
  if (shipped) return isShipped && typeof order.shippedAt === 'string' && order.shippedAt.length > 0;
  return !isShipped && (order.shippedAt === null || order.shippedAt === undefined);
}

/** חלוקה לקבוצות, כדי לא לעבור את תקרת ה-batch. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * ★★ הכתיבה עצמה.
 *
 * **קריאה אחת ל-`getAll`** ולא 60 קריאות סדרתיות, ו-`batch` אחד (או כמה,
 * לפי התקרה) ולא 60 `set` ברצף. לולאה סדרתית על שישים מסמכים היא שישים
 * הלוך-ושוב לרשת — כלומר משתמשת שלוחצת כפתור ומסתכלת על מסך תקוע.
 *
 * ★ נכתבים **ארבעה שדות בלבד**, עם `{merge:true}`: מה שהמשתמשת שינתה
 * (`status`, `shippedAt`), מה שנגזר ממנו (`purgeAfter`), ומתי (`updatedAt`).
 * כתיבה של הרשומה המלאה הייתה יכולה להחזיר לחיים שדה ישן שנקרא לפני רגע —
 * ובמסמך הזה יש כתובת מגורים.
 */
export async function applyShippedMarks(
  db: Firestore,
  input: MarkShippedInput,
  now: () => Date = () => new Date(),
): Promise<MarkShippedResult> {
  const refs: DocumentReference[] = input.messageIds.map((messageId) =>
    db.doc(docPath(input.uid, COLLECTIONS.orders, `ord-${messageId}`)),
  );

  const snaps = await db.getAll(...refs);
  const stamp = now();

  const result: MarkShippedResult = { updated: 0, skippedMissing: 0, skippedBlocked: 0 };
  const writes: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];

  for (let i = 0; i < snaps.length; i++) {
    const snap = snaps[i];
    if (!snap || snap.exists !== true) {
      // מזהה בלי מסמך: הזמנה שנמחקה, או מסך שמחזיק רשימה ישנה. לא שגיאה.
      result.skippedMissing++;
      continue;
    }

    const order = (snap.data() ?? {}) as Order;

    // ★★ הדילוג שמחזיק את העקביות מול המסך. ראה ההערה בראש הקובץ.
    if (order.needsHumanReview === true) {
      result.skippedBlocked++;
      continue;
    }

    if (alreadyInState(order, input.shipped)) {
      result.updated++;
      continue;
    }

    const next = input.shipped
      ? markShipped(order, { now: stamp })
      : unmarkShipped(order, { now: stamp });

    writes.push({
      ref: refs[i],
      data: {
        status: next.status,
        shippedAt: next.shippedAt,
        purgeAfter: next.purgeAfter,
        updatedAt: next.updatedAt,
      },
    });
    result.updated++;
  }

  for (const group of chunk(writes, BATCH_LIMIT)) {
    const batch = db.batch();
    for (const write of group) batch.set(write.ref, write.data, { merge: true });
    await batch.commit();
  }

  return result;
}
