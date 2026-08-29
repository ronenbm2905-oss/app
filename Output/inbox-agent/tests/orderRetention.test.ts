// ============================================================================
// orderRetention.test.ts — ★ המבחנים של המחיקה.
//
// כל מבחן כאן בודק **שהמחיקה קורתה**, ולא שהיא הוגדרה. זה ההבדל שהכשל
// ב-`Output/hachzarei-mas/functions/src/index.ts` מתעד: שם `purgeAfter` נכתב
// ואף אחד לא קרא אותו, כלומר המדיניות הצהירה על מחיקה שלא התרחשה מעולם.
// מדיניות בלי מבחן שמריץ אותה היא טקסט.
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  MAX_RETENTION_DAYS,
  POST_SHIPMENT_DAYS,
  applyRetention,
  daysUntilPurge,
  expiringSoon,
  isDueForPurge,
  markShipped,
  matchesDataSubject,
  purgeByRequest,
  purgeDateFor,
  purgeRecipient,
  retentionNoteHe,
  unmarkShipped,
} from '../shared/lib/orderRetention';
import type { Order } from '../shared/types';

const NOW = '2026-08-26T12:00:00.000Z';

function daysBefore(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function makeOrder(over: Partial<Order> = {}): Order {
  const base: Order = {
    userId: 'local-single-user',
    id: 'ord-msg-1',
    sourceMessageId: 'msg-1',
    threadId: 't-1',
    fromDomain: 'tranzila.com',
    receivedAt: daysBefore(NOW, 3),
    recipient: {
      name: 'רונית שדה',
      phone: '050-555-0101',
      email: 'ronit.s@lakoach.example',
      street: 'רחוב הדוגמה 14',
      city: 'תל דוגמה',
      postalCode: '6100200',
      countryCode: 'IL',
    },
    items: [{ productName: 'מדבקות', quantity: 2, unitPrice: 42, isPackable: true, lineTotal: 84 }],
    paidTotal: 84,
    currency: 'ILS',
    installments: 1,
    status: 'new',
    shippedAt: null,
    purgeAfter: null,
    recipientPurged: false,
    needsHumanReview: false,
    issues: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
  const merged = { ...base, ...over } as Order;
  return { ...merged, purgeAfter: over.purgeAfter ?? purgeDateFor(merged) };
}

// ---------------------------------------------------------------------------

describe('שני השעונים', () => {
  it('הזמנה שלא יצאה — נמחקת לפי הרצפה, לא "אף פעם"', () => {
    const o = makeOrder();
    // ★ הכשל שהיה במדיניות הראשונה: כאן היה `null`, כלומר כתובת מגורים
    // שנשמרת לנצח אם אף אחד לא לחץ על צ׳קבוקס.
    expect(o.purgeAfter).not.toBeNull();
    expect(daysUntilPurge(o, { now: NOW })).toBe(MAX_RETENTION_DAYS - 3);
  });

  it('אחרי משלוח — 60 יום מהמשלוח', () => {
    const o = markShipped(makeOrder(), { now: NOW });
    expect(daysUntilPurge(o, { now: NOW })).toBe(POST_SHIPMENT_DAYS);
  });

  it('★ המוקדם מבין השניים קובע', () => {
    // הזמנה שהתקבלה לפני 170 יום ונשלחה אתמול: 60 יום מהמשלוח היו חורגים
    // מהרצפה, ולכן הרצפה גוברת.
    const o = makeOrder({ receivedAt: daysBefore(NOW, 170) });
    const shipped = markShipped(o, { now: NOW });
    expect(daysUntilPurge(shipped, { now: NOW })).toBe(MAX_RETENTION_DAYS - 170);
  });
});

describe('★ המחיקה עצמה', () => {
  it('הזמנה שנשלחה לפני 70 יום — נמחקת', () => {
    const shippedAt = daysBefore(NOW, 70);
    const o = makeOrder({ receivedAt: daysBefore(NOW, 72), status: 'shipped', shippedAt });

    expect(isDueForPurge(o, { now: NOW })).toBe(true);

    const after = purgeRecipient(o, { now: NOW });
    expect(after.recipientPurged).toBe(true);
    for (const v of Object.values(after.recipient)) expect(v).toBeNull();
  });

  it('★ מה שנשאר: תאריך, מוצר, כמות, סכום', () => {
    const o = makeOrder({ status: 'shipped', shippedAt: daysBefore(NOW, 70) });
    const after = purgeRecipient(o, { now: NOW });
    expect(after.receivedAt).toBe(o.receivedAt);
    expect(after.items[0].productName).toBe('מדבקות');
    expect(after.items[0].quantity).toBe(2);
    expect(after.paidTotal).toBe(84);
  });

  it('הזמנה שנשלחה לפני 5 ימים — לא נמחקת', () => {
    const o = makeOrder({ status: 'shipped', shippedAt: daysBefore(NOW, 5) });
    expect(isDueForPurge(o, { now: NOW })).toBe(false);
  });

  it('★★ הזמנה שאיש לא סימן, אחרי 181 יום — נמחקת בכל זאת', () => {
    // זה **הכשל שהרצפה נבנתה בשבילו**. בלעדיה, הרשומה הזאת חיה לנצח.
    const o = makeOrder({ receivedAt: daysBefore(NOW, 181) });
    expect(o.status).toBe('new');
    expect(isDueForPurge(o, { now: NOW })).toBe(true);
  });

  it('המחיקה אידמפוטנטית', () => {
    const o = purgeRecipient(makeOrder({ status: 'shipped', shippedAt: daysBefore(NOW, 70) }), { now: NOW });
    expect(purgeRecipient(o, { now: NOW })).toBe(o);
    expect(isDueForPurge(o, { now: NOW })).toBe(false);
  });

  it('`applyRetention` מוחקת בפועל ומדווחת מה נמחק', () => {
    const due = makeOrder({ id: 'ord-a', status: 'shipped', shippedAt: daysBefore(NOW, 70) });
    const fresh = makeOrder({ id: 'ord-b', status: 'shipped', shippedAt: daysBefore(NOW, 5) });
    const forgotten = makeOrder({ id: 'ord-c', receivedAt: daysBefore(NOW, 200) });

    const run = applyRetention([due, fresh, forgotten], { now: NOW });
    expect(run.purgedIds.sort()).toEqual(['ord-a', 'ord-c']);
    expect(run.orders.find((o) => o.id === 'ord-b')?.recipient.city).toBe('תל דוגמה');
  });

  it('★ `applyRetention` מתקנת `purgeAfter` שאינו עקבי עם המצב', () => {
    // רשומה שנשמרה בגרסה קודמת, עם תאריך שלא תואם את הסטטוס.
    const stale = { ...makeOrder(), purgeAfter: '2099-01-01T00:00:00.000Z' } as Order;
    const run = applyRetention([stale], { now: NOW });
    expect(run.orders[0].purgeAfter).not.toBe('2099-01-01T00:00:00.000Z');
  });
});

describe('★ הפיכות, והגבול שלה', () => {
  it('ביטול סימון מחזיר למצב ממתין', () => {
    const shipped = markShipped(makeOrder(), { now: NOW });
    const back = unmarkShipped(shipped, { now: NOW });
    expect(back.status).toBe('new');
    expect(back.shippedAt).toBeNull();
    expect(back.recipient.city).toBe('תל דוגמה');
  });

  it('★ ביטול סימון **אינו** מבטל את המדיניות', () => {
    // אחרת היה כאן מנגנון פשוט לשמירה לנצח: לסמן, לבטל, ולהישאר בלי תאריך.
    const back = unmarkShipped(markShipped(makeOrder(), { now: NOW }), { now: NOW });
    expect(back.purgeAfter).not.toBeNull();
  });

  it('★★ ביטול סימון אחרי מחיקה **לא מחזיר את הכתובת**', () => {
    // הפיכות שמשחזרת מידע שנמחק פירושה שהוא לא נמחק.
    const purged = purgeRecipient(
      makeOrder({ status: 'shipped', shippedAt: daysBefore(NOW, 70) }),
      { now: NOW },
    );
    const back = unmarkShipped(purged, { now: NOW });
    expect(back.status).toBe('new');
    expect(back.recipient.street).toBeNull();
    expect(back.recipientPurged).toBe(true);
  });

  it('`markShipped` לא משנה את הרשומה הנכנסת', () => {
    const o = makeOrder();
    markShipped(o, { now: NOW });
    expect(o.status).toBe('new');
    expect(o.shippedAt).toBeNull();
  });
});

describe('★ ההתראה מראש', () => {
  it('הזמנה שלא סומנה, 160 יום אחורה — מופיעה ברשימת "יימחקו בקרוב"', () => {
    const soon = makeOrder({ id: 'ord-soon', receivedAt: daysBefore(NOW, 160) });
    const recent = makeOrder({ id: 'ord-recent' });
    expect(expiringSoon([soon, recent], { now: NOW }).map((o) => o.id)).toEqual(['ord-soon']);
  });

  it('★ הזמנה שכבר יצאה לא מופיעה ברשימה', () => {
    // היא **אמורה** להימחק, ואין שום פעולה שהמשתמשת צריכה לעשות. התראה
    // עליה הייתה רעש שמלמד להתעלם מהרשימה.
    const shipped = makeOrder({ status: 'shipped', shippedAt: daysBefore(NOW, 55) });
    expect(expiringSoon([shipped], { now: NOW })).toHaveLength(0);
  });
});

describe('★★ מחיקה לפי בקשת לקוחה', () => {
  const a = makeOrder({ id: 'ord-a' });
  const b = makeOrder({
    id: 'ord-b',
    recipient: { ...a.recipient, name: 'מיכל אלמוג', email: 'michal.a@lakoach.example' },
  });

  it('מתאימה לפי מייל מלא', () => {
    const r = purgeByRequest([a, b], 'ronit.s@lakoach.example', { now: NOW });
    expect(r.purgedCount).toBe(1);
    expect(r.orders.find((o) => o.id === 'ord-a')?.recipient.email).toBeNull();
    expect(r.orders.find((o) => o.id === 'ord-b')?.recipient.email).toBe('michal.a@lakoach.example');
  });

  it('מתאימה לפי שם מלא, בלי תלות באותיות ורווחים', () => {
    expect(purgeByRequest([a, b], '  רונית שדה ', { now: NOW }).purgedCount).toBe(1);
  });

  it('★ התאמה חלקית **אינה** מוחקת', () => {
    // `includes` היה הופך בקשה של אדם אחד למחיקת מידע של אחרים.
    expect(purgeByRequest([a, b], 'רונית', { now: NOW }).purgedCount).toBe(0);
    expect(matchesDataSubject(a, 'רונית')).toBe(false);
    expect(matchesDataSubject(a, 'lakoach.example')).toBe(false);
  });

  it('★ רשומת המכירה נשארת', () => {
    const r = purgeByRequest([a], 'רונית שדה', { now: NOW });
    const after = r.orders[0];
    expect(after.paidTotal).toBe(84);
    expect(after.items[0].quantity).toBe(2);
    expect(after.receivedAt).toBe(a.receivedAt);
  });

  it('שאילתה ריקה לא מוחקת כלום', () => {
    expect(purgeByRequest([a, b], '   ', { now: NOW }).purgedCount).toBe(0);
  });

  it('ההודעה מנוסחת לאדם, ולא מדליפה מי נמצא', () => {
    const r = purgeByRequest([a, b], 'ronit.s@lakoach.example', { now: NOW });
    expect(r.messageHe).not.toContain('רונית');
    expect(r.messageHe).not.toContain('@');
  });
});

describe('מה שהמסך אומר', () => {
  it('הזמנה ממתינה — נאמר שיש תקרה, ולא "נשמר במלואו"', () => {
    const note = retentionNoteHe(makeOrder(), { now: NOW });
    expect(note).toContain('לכל היותר');
  });

  it('הזמנה שנמחקה — נאמר שנמחק, ולא "לא הצלחתי לקרוא"', () => {
    const purged = purgeRecipient(makeOrder({ status: 'shipped', shippedAt: daysBefore(NOW, 70) }), { now: NOW });
    expect(retentionNoteHe(purged, { now: NOW })).toContain('נמחקו');
  });

  it('ההסברים בעברית, בלי מונחים פנימיים', () => {
    for (const o of [makeOrder(), markShipped(makeOrder(), { now: NOW })]) {
      const note = retentionNoteHe(o, { now: NOW });
      expect(note).not.toMatch(/purge|status|null|retention/i);
    }
  });
});
