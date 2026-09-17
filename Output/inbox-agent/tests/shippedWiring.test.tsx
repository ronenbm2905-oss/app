// @vitest-environment jsdom
// ============================================================================
// shippedWiring.test.tsx — ★★ הצ׳קבוקס מחובר לכתיבה. המבחן שלא היה.
//
// ---------------------------------------------------------------------------
// הבאג שהמבחן הזה נכתב בגללו
// ---------------------------------------------------------------------------
// ב-`App.tsx` ישבה שורה אחת:
//
//     onToggleShipped={() => { /* מסלול הכתיבה הזה נכנס בסבב הבא */ }}
//
// כלומר: הצ׳קבוקס היה שם, הוא נראה בדיוק כמו במצב ההדגמה שבו הוא עובד,
// ולחיצה עליו **לא שמרה כלום**. דורית סימנה, ריעננה, וההזמנה חזרה.
//
// ★★ וזו בדיוק המשפחה ש-`check-hook-wiring.mjs` **לא** תופסת, והיא כתובה שם
// בפירוש: הבדיקה הסטטית מוודאת שערך שה-hook מחזיר נצרך אצל מישהו — היא לא
// יודעת לומר שהוא חובר לפקד שאפשר ללחוץ עליו. `renderToString` לא היה תופס
// את זה גם הוא: HTML של צ׳קבוקס מחובר ושל צ׳קבוקס מת נראה זהה.
//
// ולכן, כמו ב-`refreshControl.test.tsx`: DOM אמיתי, לחיצה אמיתית, והטענה
// היא **שהקריאה יצאה**.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { STORAGE_KEYS } from '../src/constants';
import { t } from '../src/i18n';
import type { Order } from '../shared/types/order';
import type { UseCloudOrders } from '../src/hooks/useCloudOrders';

const RECEIVED = '2026-09-15T06:00:00.000Z';

vi.mock('../src/firebase', () => ({
  isFirebaseConfigured: true,
  db: {},
  auth: {},
  functions: {},
  googleProvider: {},
  region: 'me-west1',
}));

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'u-test', email: null, displayName: null, local: false },
    authLoading: false,
    authError: null,
    signIn: async () => {},
    signOut: async () => {},
    isFirebaseConfigured: true,
  }),
}));

let cloud: UseCloudOrders;

vi.mock('../src/hooks/useCloudOrders', () => ({
  useCloudOrders: () => cloud,
}));

const { App } = await import('../src/App');

function makeOrder(messageId: string, over: Partial<Order> = {}): Order {
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
    updatedAt: RECEIVED,
    ...over,
  } as Order;
}

const toggleShipped = vi.fn(async () => {});
const markManyShipped = vi.fn(async () => ({ updated: 2, skippedMissing: 0, skippedBlocked: 0 }));

function makeCloud(over: Partial<UseCloudOrders> = {}): UseCloudOrders {
  return {
    loading: false,
    orders: [makeOrder('msg-1'), makeOrder('msg-2')],
    accessLog: [],
    connection: 'connected',
    supportMode: { enabled: false, enabledAt: null, expiresAt: null },
    supportModeActive: false,
    lastReadCount: 2,
    lastReadSources: ['tranzila.com'],
    lastDiagnostics: null,
    lastSyncAt: '2026-09-17T05:14:00.000Z',
    errorHe: null,
    shippedErrorHe: null,
    connectGoogle: async () => null,
    setSupportMode: async () => {},
    refreshNow: async () => ({ messagesRead: 0, readSources: [], written: 0, errorHe: null }),
    toggleShipped,
    markManyShipped,
    ...over,
  } as UseCloudOrders;
}

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  toggleShipped.mockClear();
  markManyShipped.mockClear();
  localStorage.setItem(STORAGE_KEYS.explainerSeen, '1');
  cloud = makeCloud();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
});

async function render() {
  await act(async () => {
    root.render(<App />);
  });
}

async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

// ---------------------------------------------------------------------------

describe('★★ מצב ענן — הצ׳קבוקס כותב', () => {
  it('★★ סימון "נשלח" מוציא קריאה, עם מזהה ההודעה', async () => {
    await render();

    const boxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));
    expect(boxes.length).toBeGreaterThan(0);

    // `click()` ולא אירוע ידני: זה מה שהדפדפן עושה, וזה מה שמפעיל את
    // `onChange` של React על צ׳קבוקס.
    await act(async () => {
      (boxes[0] as HTMLInputElement).click();
    });

    // ★ זו השורה שלא הייתה: לא "יש צ׳קבוקס" — **הקריאה יצאה.**
    expect(toggleShipped).toHaveBeenCalledTimes(1);
    expect(toggleShipped).toHaveBeenCalledWith('msg-1');
  });

  it('★★ "סימון הכל" מחובר למסלול ההמוני, אחרי האישור', async () => {
    await render();

    const trigger = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes(t('ordersMarkAllAction')),
    );
    expect(trigger).toBeDefined();
    await click(trigger as HTMLButtonElement);

    expect(markManyShipped).not.toHaveBeenCalled();

    const confirm = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes(t('ordersMarkAllConfirmPrefix')),
    );
    await click(confirm as HTMLButtonElement);

    expect(markManyShipped).toHaveBeenCalledTimes(1);
    expect(markManyShipped).toHaveBeenCalledWith(['msg-1', 'msg-2'], true);
  });

  it('★ כישלון שמירה מגיע למסך', async () => {
    cloud = makeCloud({ shippedErrorHe: t('ordersMarkFailed') });
    await render();
    expect(container.textContent).toContain('לא הצלחתי לשמור את הסימון');
  });
});
