// ============================================================================
// cloudView.ts — הופך הזמנות שהגיעו מהענן לאותו מבנה שהמסך כבר יודע להציג.
//
// ---------------------------------------------------------------------------
// למה זה קיים, ולמה זה קצר
// ---------------------------------------------------------------------------
// `OrdersView` מקבל `OrderRunResult` ולא יודע מאיפה הוא בא. זו הייתה הכרעה
// נכונה בפרוסה 0, והיא משתלמת עכשיו: המסך לא משתנה בין מצב מקומי לענן, ולכן
// **מה שנבדק במצב המקומי הוא מה שרץ בענן.**
//
// ---------------------------------------------------------------------------
// ★★ `applyRetention` רצה גם כאן, למרות ש-`purgeOrders` רצה בשרת
// ---------------------------------------------------------------------------
// זה נראה כמו כפילות, והוא לא. `purgeOrders` רצה **פעם ביום ב-03:15**;
// הזמנה שמועד המחיקה שלה הגיע ב-10:00 בבוקר תמתין 17 שעות. בלי החישוב כאן
// היא תוצג עם הכתובת בזמן שהמדיניות אומרת שהיא כבר לא אמורה להיות מוצגת.
//
// זה בדיוק העיקרון מפרוסה 0: **אי אפשר לראות הזמנה בלי שהמדיניות רצה עליה
// קודם.** השרת מוחק מהמסד; זה מוודא שהמסך לא מקדים אותו.
//
// ⚠️ ומה שזה **לא**: תחליף למחיקה. זה חישוב תצוגה. המחיקה האמיתית — מחיקת
// שדות ב-Firestore — היא של `purgeOrders`, והיא זו שמקיימת את ההצהרה.
// ============================================================================

import { applyRetention, expiringSoon } from '../../shared/lib/orderRetention';
import { EMPTY_RECIPIENT, type Order } from '../../shared/types';
import { ORDER_SOURCE_QUERY } from '../../shared/lib/orderSource';
import type { OrderRunResult } from './orderPipeline';

export interface CloudStats {
  /** ★ M18 — כמה הודעות נקראו בריצה האחרונה, ומאיפה. */
  messagesRead: number | null;
  readSources: string[];
}

/**
 * ★ משלים שדות חסרים ברשומה שהגיעה מהמסד.
 *
 * `recipient` **נמחק** מהמסמך אחרי purge (`FieldValue.delete()`), ולכן הוא
 * פשוט לא קיים. המסך מצפה לאובייקט, ולכן משלימים ריק — עם `recipientPurged`
 * שכבר `true`, כך שהוא יאמר "נמחק לפי המדיניות" ולא "לא הצלחתי לקרוא".
 */
function hydrate(order: Order): Order {
  return {
    ...order,
    recipient: order.recipient ?? { ...EMPTY_RECIPIENT },
    items: order.items ?? [],
    issues: order.issues ?? [],
  };
}

export function cloudRunResult(
  raw: readonly Order[],
  stats: CloudStats,
  now: Date = new Date(),
): OrderRunResult {
  const hydrated = raw.map(hydrate);

  // ★★ המדיניות, לפני שנבנית ולו רשימה אחת. ראה ההערה למעלה.
  const { orders, purgedIds } = applyRetention(hydrated, { now });

  const byOldest = (a: Order, b: Order) => a.receivedAt.localeCompare(b.receivedAt);
  const byNewest = (a: Order, b: Order) => b.receivedAt.localeCompare(a.receivedAt);

  const needsAttention = orders
    .filter((o) => o.needsHumanReview && o.status === 'new')
    .sort(byOldest);
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
    expiringSoon: expiringSoon(orders, { now }).sort(byOldest),
    // ★ שאלות פתוחות נשמרות בענן כמסמכים נפרדים ומסוננות לפני שהן מגיעות
    // לכאן. הן ייכנסו למסך בסבב הבא — ראה "מה נשאר פתוח" ב-README.
    openQuestions: [],
    stats: {
      scanned: orders.length,
      orders: orders.length,
      unitsToPack,
      needsAttention: needsAttention.length,
      purged: purgedIds.length,
      // ★★ המונה **נגזר ממה שנקרא בפועל** בשרת, ולא נכתב כמחרוזת במסך.
      messagesRead: stats.messagesRead ?? 0,
      readSources: stats.readSources,
      readParts: [],
      unsignedTail: orders.filter((o) =>
        o.issues.some((i) => i.code === 'unsignedBodyTail'),
      ).length,
      sourceQuery: ORDER_SOURCE_QUERY,
    },
  };
}
