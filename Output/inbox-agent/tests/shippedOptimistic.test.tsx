// @vitest-environment jsdom
// ============================================================================
// shippedOptimistic.test.tsx — ★★ הסימון מרגיש מיידי, וכשהוא נכשל הוא חוזר.
//
// ---------------------------------------------------------------------------
// למה זה מבחן ולא "נראה בסדר על המסך"
// ---------------------------------------------------------------------------
// הכתיבה עוברת קריאה לשרת, ולכן בין הלחיצה לבין ה-`onSnapshot` יש חלון שבו
// הצ׳קבוקס עדיין ריק. על הזמנה אחת זה נראה כמו עצבנות; על שישים זה מה שגורם
// למישהי ללחוץ פעמיים על כל שורה, או לוותר.
//
// ★★ והצד השני של אותה החלטה, שהוא החשוב: **עדכון אופטימי שלא יודע לחזור
// הוא שקר.** אם הקריאה נכשלה והמסך ממשיך להראות "נשלח", דורית מאמינה
// שהחבילה סומנה — ומחר בבוקר ההזמנה תחזור לרשימה בלי הסבר. לכן שני
// המבחנים כאן הם זוג: ההצגה המיידית, והחזרה המלאה.
//
// ★ מה ממוקה: `firebase/functions` (הקריאה) ו-`firebase/firestore`
// (ה-`onSnapshot`). שום דבר בהם אינו נבדק — הם השקע שאליו ה-hook מתחבר.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Order } from '../shared/types/order';
import type { BulkShippedResult, UseCloudOrders } from '../src/hooks/useCloudOrders';

const NOW_ISO = '2026-09-17T09:00:00.000Z';
const RECEIVED = '2026-09-15T06:00:00.000Z';

/** ההזמנות שה-`onSnapshot` המזויף מחזיר. */
let seeded: Order[] = [];
/** הקריאות שיצאו לשרת. */
let calls: Array<{ name: string; payload: unknown }>;
/** להפיל את הקריאה הבאה. */
let failNext = false;

vi.mock('../src/firebase', () => ({
  isFirebaseConfigured: true,
  db: {},
  auth: {},
  functions: {},
  googleProvider: {},
  region: 'me-west1',
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  doc: (_db: unknown, path: string) => ({ path }),
  query: (target: unknown) => target,
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: (target: { path?: string }, next: (snap: unknown) => void) => {
    const isOrders = (target.path ?? '').endsWith('/orders');
    next({
      data: () => ({}),
      docs: isOrders ? seeded.map((o) => ({ id: o.id, data: () => o })) : [],
    });
    return () => {};
  },
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: (_fns: unknown, name: string) => async (payload: unknown) => {
    calls.push({ name, payload });
    if (failNext) throw new Error('הקריאה נפלה');
    const ids = (payload as { messageIds?: string[] }).messageIds ?? [];
    return { data: { updated: ids.length, skippedMissing: 0, skippedBlocked: 0 } };
  },
}));

const { useCloudOrders } = await import('../src/hooks/useCloudOrders');

function makeOrder(over: Partial<Order> = {}): Order {
  const messageId = over.sourceMessageId ?? 'msg-1';
  return {
    userId: 'u-test',
    id: `ord-${messageId}`,
    sourceMessageId: messageId,
    threadId: `t-${messageId}`,
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
    items: [
      { productName: 'פריט דוגמה', quantity: 1, unitPrice: 10, isPackable: true, lineTotal: 10 },
    ],
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
    updatedAt: NOW_ISO,
    ...over,
  } as Order;
}

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let cloud: UseCloudOrders;

function Probe() {
  cloud = useCloudOrders({ uid: 'u-test', email: null, displayName: null, local: false });
  return null;
}

beforeEach(async () => {
  calls = [];
  failNext = false;
  seeded = [
    makeOrder({ sourceMessageId: 'msg-1' }),
    makeOrder({ sourceMessageId: 'msg-2' }),
    makeOrder({ sourceMessageId: 'msg-3', needsHumanReview: true }),
  ];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<Probe />);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const byId = (messageId: string) => cloud.orders.find((o) => o.sourceMessageId === messageId);

// ---------------------------------------------------------------------------

describe('★★ הסימון הבודד', () => {
  it('★★ עובר **באותה קריאה** כמו ההמונית — מערך באורך 1', async () => {
    await act(async () => {
      await cloud.toggleShipped('msg-1');
    });

    expect(calls).toEqual([
      { name: 'markOrderShipped', payload: { messageIds: ['msg-1'], shipped: true } },
    ]);
  });

  it('★★ המסך מראה "נשלח" מיד, עם תאריך המחיקה שנגזר ממנו', async () => {
    await act(async () => {
      await cloud.toggleShipped('msg-1');
    });

    expect(byId('msg-1')?.status).toBe('shipped');
    expect(byId('msg-1')?.shippedAt).toBeTypeOf('string');
    expect(byId('msg-1')?.purgeAfter).toBeTypeOf('string');
    // ★ ומה שלא זז: שאר ההזמנות.
    expect(byId('msg-2')?.status).toBe('new');
  });

  it('לחיצה שנייה מבטלת — ושולחת `false`', async () => {
    await act(async () => {
      await cloud.toggleShipped('msg-1');
    });
    await act(async () => {
      await cloud.toggleShipped('msg-1');
    });

    expect(calls[1].payload).toEqual({ messageIds: ['msg-1'], shipped: false });
    expect(byId('msg-1')?.status).toBe('new');
  });
});

describe('★★ כשהשמירה נכשלת', () => {
  it('★★ המצב חוזר למה שהיה, והמשפט נאמר בעברית של בן אדם', async () => {
    failNext = true;

    await act(async () => {
      await cloud.toggleShipped('msg-1');
    });

    expect(byId('msg-1')?.status).toBe('new');
    expect(cloud.shippedErrorHe).toContain('לא הצלחתי לשמור את הסימון');
    expect(cloud.shippedErrorHe).toContain('הרשימה חזרה למה שהיא הייתה');
  });

  it('★ ואין בו קוד שגיאה, שם פונקציה או פרט טכני', async () => {
    failNext = true;
    await act(async () => {
      await cloud.markManyShipped(['msg-1', 'msg-2'], true);
    });

    const text = cloud.shippedErrorHe ?? '';
    for (const banned of ['markOrderShipped', 'Error', 'internal', 'Firestore', 'שרת', 'קוד']) {
      expect(text).not.toContain(banned);
    }
    expect(byId('msg-2')?.status).toBe('new');
  });
});

describe('★ הסימון ההמוני', () => {
  it('שולח את המזהים אחרי דדופ, ומחזיר את מה שהשרת ספר', async () => {
    const out: { res: BulkShippedResult | null } = { res: null };
    await act(async () => {
      out.res = await cloud.markManyShipped(['msg-1', 'msg-1', 'msg-2'], true);
    });

    expect(calls[0].payload).toEqual({ messageIds: ['msg-1', 'msg-2'], shipped: true });
    expect(out.res?.updated).toBe(2);
    expect(byId('msg-1')?.status).toBe('shipped');
    expect(byId('msg-2')?.status).toBe('shipped');
  });

  it('★★ הזמנה שצריך להסתכל עליה אינה מוצגת כנשלחה — כי השרת מדלג עליה', async () => {
    await act(async () => {
      await cloud.markManyShipped(['msg-3'], true);
    });

    // המסך לא מקדים את השרת בדבר שהשרת יסרב לו.
    expect(byId('msg-3')?.status).toBe('new');
  });

  it('רשימה ריקה אינה יוצאת לרשת בכלל', async () => {
    await act(async () => {
      await cloud.markManyShipped([], true);
    });
    expect(calls).toHaveLength(0);
  });
});
