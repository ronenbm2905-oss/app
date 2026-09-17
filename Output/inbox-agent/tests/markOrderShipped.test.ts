// ============================================================================
// markOrderShipped.test.ts — ★★ הסימון "נשלח" בצד השרת.
//
// ---------------------------------------------------------------------------
// מה נבדק כאן, ומה **לא**
// ---------------------------------------------------------------------------
// `markShipped` / `unmarkShipped` כבר מכוסות ב-`orderRetention.test.ts` —
// שני השעונים, הרצפה, וההפיכות. אין כאן שכפול שלהן. מה שנבדק זה מה
// ש`shippedMarks.ts` הוסיף מעליהן:
//
//  1. **מי מורשה** — בלי משתמש מחובר אין שום מסלול.
//  2. **מה מותר לשלוח** — מערך, תקרה של 200, דדופ.
//  3. ★★ **על מה מדלגים** — הזמנה שסומנה "צריך שתסתכלי", ומזהה בלי מסמך.
//  4. ★★ **שהבודדת והמרובה הן אותו מסלול** — אותה כתיבה בדיוק.
//  5. **צורת הכתיבה** — ארבעה שדות, `merge`, ובלי קריאה סדרתית לכל מזהה.
//
// ★ Firestore מזויף ולא אמולטור, מאותה סיבה כמו `syncRunRecord.test.ts`:
// מה שנבדק הוא **מה נכתב**, ולא ש-Firestore יודע לקבל כתיבה.
//
// ⚠️ ואין כאן שום נתון אמיתי: המזהים הם `msg-1`, והכתובת היא "רחוב הדוגמה".
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  applyShippedMarks,
  MarkShippedError,
  MAX_MESSAGE_IDS,
  parseMarkShippedInput,
  type MarkShippedInput,
} from '../functions/src/lib/shippedMarks';
import { MAX_RETENTION_DAYS, POST_SHIPMENT_DAYS } from '../shared/lib/orderRetention';
import type { Order } from '../shared/types/order';

const UID = 'u-test';
const NOW = new Date('2026-09-17T09:00:00.000Z');
const RECEIVED = '2026-09-10T06:00:00.000Z';

const pathOf = (messageId: string) => `users/${UID}/orders/ord-${messageId}`;

/** הזמנה מסונתזת. אין כאן שם, כתובת או מייל של אדם אמיתי. */
function makeOrder(over: Partial<Order> = {}): Order {
  return {
    userId: UID,
    id: `ord-${over.sourceMessageId ?? 'msg-1'}`,
    sourceMessageId: 'msg-1',
    threadId: 't-1',
    fromDomain: 'tranzila.com',
    receivedAt: RECEIVED,
    recipient: {
      name: 'לקוחה לדוגמה',
      phone: '050-000-0000',
      email: 'demo@lakoach.example',
      street: 'רחוב הדוגמה 1',
      city: 'עיר הדוגמה',
      postalCode: '1000000',
      countryCode: 'IL',
    },
    items: [{ productName: 'פריט דוגמה', quantity: 1, unitPrice: 10, isPackable: true, lineTotal: 10 }],
    paidTotal: 10,
    currency: 'ILS',
    installments: 1,
    status: 'new',
    shippedAt: null,
    purgeAfter: null,
    recipientPurged: false,
    needsHumanReview: false,
    issues: [],
    createdAt: RECEIVED,
    updatedAt: RECEIVED,
    ...over,
  } as Order;
}

interface Write {
  path: string;
  data: Record<string, unknown>;
  merge: boolean;
}

/** Firestore מזויף — רק `doc`, `getAll` ו-`batch`. */
function fakeDb(docs: Record<string, Order>) {
  const writes: Write[] = [];
  /** כמה פעמים נקרא `getAll`, וכמה מסמכים בכל קריאה. */
  const reads: number[] = [];
  /** כמה `commit` יצאו, וכמה כתיבות בכל אחד. */
  const commits: number[] = [];

  const db = {
    doc: (path: string) => ({ path }),
    getAll: async (...refs: Array<{ path: string }>) => {
      reads.push(refs.length);
      return refs.map((ref) => ({
        exists: Object.prototype.hasOwnProperty.call(docs, ref.path),
        data: () => docs[ref.path],
        ref,
      }));
    },
    batch: () => {
      let count = 0;
      return {
        set: (ref: { path: string }, data: Record<string, unknown>, opts?: { merge?: boolean }) => {
          count++;
          writes.push({ path: ref.path, data, merge: opts?.merge === true });
        },
        commit: async () => {
          commits.push(count);
        },
      };
    },
  };

  return { db, writes, reads, commits };
}

const input = (over: Partial<MarkShippedInput> = {}): MarkShippedInput => ({
  uid: UID,
  messageIds: ['msg-1'],
  shipped: true,
  ...over,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (db: unknown, over: Partial<MarkShippedInput> = {}) =>
  applyShippedMarks(db as any, input(over), () => NOW);

// ---------------------------------------------------------------------------

describe('★★ מי מורשה לסמן', () => {
  it('בלי משתמש מחובר — נדחה', () => {
    expect(() => parseMarkShippedInput(undefined, { messageIds: ['msg-1'], shipped: true })).toThrow(
      MarkShippedError,
    );
    try {
      parseMarkShippedInput(undefined, { messageIds: ['msg-1'], shipped: true });
    } catch (err) {
      expect((err as MarkShippedError).code).toBe('unauthenticated');
    }
  });

  it('★ uid ריק אינו משתמש', () => {
    expect(() => parseMarkShippedInput({ uid: '' }, { messageIds: ['msg-1'], shipped: true })).toThrow(
      MarkShippedError,
    );
  });

  it('★★ ה-uid נלקח מהאסימון, ולא ממה שנשלח בבקשה', () => {
    const parsed = parseMarkShippedInput(
      { uid: 'u-real' },
      { messageIds: ['msg-1'], shipped: true, uid: 'u-someone-else' },
    );
    expect(parsed.uid).toBe('u-real');
  });
});

describe('★ מה מותר לשלוח', () => {
  it('מעל 200 מזהים — נדחה', () => {
    const many = Array.from({ length: MAX_MESSAGE_IDS + 1 }, (_, i) => `msg-${i}`);
    try {
      parseMarkShippedInput({ uid: UID }, { messageIds: many, shipped: true });
      throw new Error('היה אמור להיכשל');
    } catch (err) {
      expect(err).toBeInstanceOf(MarkShippedError);
      expect((err as MarkShippedError).code).toBe('invalid-argument');
    }
  });

  it('בדיוק 200 — עובר', () => {
    const many = Array.from({ length: MAX_MESSAGE_IDS }, (_, i) => `msg-${i}`);
    expect(parseMarkShippedInput({ uid: UID }, { messageIds: many, shipped: true }).messageIds).toHaveLength(
      MAX_MESSAGE_IDS,
    );
  });

  it('רשימה ריקה, לא-מערך, ומזהה שאינו מחרוזת — נדחים', () => {
    for (const data of [
      { messageIds: [], shipped: true },
      { messageIds: 'msg-1', shipped: true },
      { messageIds: [1, 2], shipped: true },
      { messageIds: [''], shipped: true },
      {},
    ]) {
      expect(() => parseMarkShippedInput({ uid: UID }, data)).toThrow(MarkShippedError);
    }
  });

  it('★★ `shipped` חייב להיות בוליאני — ערך חסר אינו "כן"', () => {
    expect(() => parseMarkShippedInput({ uid: UID }, { messageIds: ['msg-1'] })).toThrow(
      MarkShippedError,
    );
    expect(() =>
      parseMarkShippedInput({ uid: UID }, { messageIds: ['msg-1'], shipped: 'true' }),
    ).toThrow(MarkShippedError);
  });

  it('★ דדופ — אותו מזהה פעמיים נספר פעם אחת', () => {
    const parsed = parseMarkShippedInput(
      { uid: UID },
      { messageIds: ['msg-1', 'msg-1', 'msg-2'], shipped: true },
    );
    expect(parsed.messageIds).toEqual(['msg-1', 'msg-2']);
  });
});

describe('★★ על מה מדלגים', () => {
  it('★★ הזמנה שסומנה "צריך שתסתכלי" — לא נגעים בה', async () => {
    const { db, writes } = fakeDb({
      [pathOf('msg-1')]: makeOrder({ sourceMessageId: 'msg-1', needsHumanReview: true }),
    });

    const res = await run(db);

    expect(res).toEqual({ updated: 0, skippedMissing: 0, skippedBlocked: 1 });
    // ★ ולא רק שהיא לא נספרה: **לא יצאה עליה כתיבה.**
    expect(writes).toHaveLength(0);
  });

  it('★★ ההמונית מדלגת בדיוק על מה שהבודדת אוסרת — והשאר כן נכתבות', async () => {
    const { db, writes } = fakeDb({
      [pathOf('msg-1')]: makeOrder({ sourceMessageId: 'msg-1' }),
      [pathOf('msg-2')]: makeOrder({ sourceMessageId: 'msg-2', needsHumanReview: true }),
      [pathOf('msg-3')]: makeOrder({ sourceMessageId: 'msg-3' }),
    });

    const res = await run(db, { messageIds: ['msg-1', 'msg-2', 'msg-3'] });

    expect(res).toEqual({ updated: 2, skippedMissing: 0, skippedBlocked: 1 });
    expect(writes.map((w) => w.path)).toEqual([pathOf('msg-1'), pathOf('msg-3')]);
  });

  it('מזהה בלי מסמך — מדולג, ואינו מפיל את השאר', async () => {
    const { db, writes } = fakeDb({ [pathOf('msg-2')]: makeOrder({ sourceMessageId: 'msg-2' }) });

    const res = await run(db, { messageIds: ['msg-1', 'msg-2'] });

    expect(res).toEqual({ updated: 1, skippedMissing: 1, skippedBlocked: 0 });
    expect(writes.map((w) => w.path)).toEqual([pathOf('msg-2')]);
  });

  it('★★ סימון חוזר על הזמנה שכבר יצאה אינו דוחה את מועד המחיקה', async () => {
    const shippedAt = '2026-09-12T08:00:00.000Z';
    const { db, writes } = fakeDb({
      [pathOf('msg-1')]: makeOrder({ status: 'shipped', shippedAt }),
    });

    const res = await run(db);

    // המצב שהתבקש כבר מתקיים, ולכן הוא נספר — **אבל בלי כתיבה**, כי כתיבה
    // הייתה מאפסת את `shippedAt` לעכשיו ומאריכה את השמירה בשקט.
    expect(res.updated).toBe(1);
    expect(writes).toHaveLength(0);
  });
});

describe('★★ מה נכתב', () => {
  it('ארבעה שדות בלבד, עם merge — ובלי שום פרט של הנמענת', async () => {
    const { db, writes } = fakeDb({ [pathOf('msg-1')]: makeOrder() });

    await run(db);

    expect(writes).toHaveLength(1);
    expect(writes[0].merge).toBe(true);
    expect(Object.keys(writes[0].data).sort()).toEqual([
      'purgeAfter',
      'shippedAt',
      'status',
      'updatedAt',
    ]);
    for (const banned of ['recipient', 'items', 'issues', 'userId', 'needsHumanReview']) {
      expect(Object.keys(writes[0].data)).not.toContain(banned);
    }
  });

  it('הסימון מפעיל את השעון של `markShipped` — 60 יום מהסימון', async () => {
    const { db, writes } = fakeDb({ [pathOf('msg-1')]: makeOrder() });

    await run(db);

    expect(writes[0].data.status).toBe('shipped');
    expect(writes[0].data.shippedAt).toBe(NOW.toISOString());
    const expected = new Date(NOW.getTime() + POST_SHIPMENT_DAYS * 24 * 60 * 60 * 1000);
    expect(writes[0].data.purgeAfter).toBe(expected.toISOString());
  });

  it('★ ביטול הסימון מחזיר ל"ממתין" — ונשאר תחת רצפת 180 הימים', async () => {
    const { db, writes } = fakeDb({
      [pathOf('msg-1')]: makeOrder({ status: 'shipped', shippedAt: '2026-09-12T08:00:00.000Z' }),
    });

    const res = await run(db, { shipped: false });

    expect(res.updated).toBe(1);
    expect(writes[0].data.status).toBe('new');
    expect(writes[0].data.shippedAt).toBeNull();
    // ★ ולא `null`: ביטול הסימון מחזיר למסלול הרגיל, לא מוציא מהמדיניות.
    const floor = new Date(
      new Date(RECEIVED).getTime() + MAX_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    expect(writes[0].data.purgeAfter).toBe(floor.toISOString());
  });

  it('★★ הבודדת והמרובה כותבות **בדיוק אותו דבר**', async () => {
    const single = fakeDb({ [pathOf('msg-2')]: makeOrder({ sourceMessageId: 'msg-2' }) });
    await run(single.db, { messageIds: ['msg-2'] });

    const bulk = fakeDb({
      [pathOf('msg-1')]: makeOrder({ sourceMessageId: 'msg-1' }),
      [pathOf('msg-2')]: makeOrder({ sourceMessageId: 'msg-2' }),
      [pathOf('msg-3')]: makeOrder({ sourceMessageId: 'msg-3' }),
    });
    await run(bulk.db, { messageIds: ['msg-1', 'msg-2', 'msg-3'] });

    const fromBulk = bulk.writes.find((w) => w.path === pathOf('msg-2'));
    expect(fromBulk).toBeDefined();
    expect(single.writes[0]).toEqual(fromBulk);
  });

  it('★★ שישים הזמנות — קריאה אחת ו-batch אחד, לא שישים הלוך-ושוב', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `msg-${i}`);
    const docs: Record<string, Order> = {};
    for (const id of ids) docs[pathOf(id)] = makeOrder({ sourceMessageId: id, id: `ord-${id}` });
    const { db, writes, reads, commits } = fakeDb(docs);

    const res = await run(db, { messageIds: ids });

    expect(res.updated).toBe(60);
    expect(writes).toHaveLength(60);
    expect(reads).toEqual([60]);
    expect(commits).toEqual([60]);
  });
});
