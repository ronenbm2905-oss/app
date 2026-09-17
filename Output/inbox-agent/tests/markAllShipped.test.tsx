// @vitest-environment jsdom
// ============================================================================
// markAllShipped.test.tsx — ★★ "סימון הכל כנשלח", והבקרה שמצדיקה אותו.
//
// ---------------------------------------------------------------------------
// למה DOM ולא `renderToString`
// ---------------------------------------------------------------------------
// אותו נימוק בדיוק כמו ב-`refreshControl.test.tsx`: הטענה שצריך להוכיח היא
// לא "יש כפתור עם הטקסט הנכון" אלא **"לחיצה שולחת את המזהים הנכונים"** —
// ובמיוחד כאן, שבו לחיצה אחת נוגעת בשישים רשומות.
//
// ---------------------------------------------------------------------------
// ★★ מה נבדק, ולמה כל אחד מהם הוא בקרה ולא עיטור
// ---------------------------------------------------------------------------
//  1. **הכפתור לא קיים על הזמנה אחת.** "סימון הכל" על פריט יחיד הוא
//     הצ׳קבוקס שכבר על הכרטיס, עם שלב אישור מיותר ובניסוח מבלבל.
//  2. **אישור דו-שלבי.** הלחיצה הראשונה **לא שולחת כלום**.
//  3. ★★ **הביטול מחזיר בדיוק את אותם מזהים** — ולא "מה שמסומן עכשיו".
//  4. ★★ **הבאנר שורד את היעלמות הרשימה.** ברגע שהסימון נכנס, ההזמנות
//     עוברות ל"כבר יצא" והרשימה מתרוקנת. באנר שנעלם יחד איתן הוא ביטול
//     שקיים רק כל עוד אין בו צורך.
//
// ⚠️ אין כאן שום נתון אמיתי: `msg-1`, "לקוחה לדוגמה", "רחוב הדוגמה".
// ============================================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { OrdersView } from '../src/components/OrdersView';
import { cloudRunResult } from '../src/utils/cloudView';
import { HE, t, type TranslationKey } from '../src/i18n';
import type { BulkShippedResult } from '../src/hooks/useCloudOrders';
import type { Order } from '../shared/types/order';

const NOW = new Date('2026-09-17T09:00:00.000Z');
const RECEIVED = '2026-09-15T06:00:00.000Z';

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
    updatedAt: RECEIVED,
    ...over,
  } as Order;
}

const STATS = { messagesRead: 3, readSources: ['tranzila.com'], diagnostics: null };

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

/** מה שנשלח למסלול ההמוני. הריגול הוא על **המזהים**, לא על הטקסט. */
let calls: Array<{ ids: string[]; shipped: boolean }>;
/** מה שהשרת "מחזיר" בקריאה הבאה. משתנה בין מבחנים. */
let reply: BulkShippedResult | null;

const onMarkAll = async (ids: string[], shipped: boolean) => {
  calls.push({ ids: [...ids], shipped });
  return reply;
};

beforeEach(() => {
  calls = [];
  reply = { updated: 2, skippedMissing: 0, skippedBlocked: 0 };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render(orders: Order[], withBulk = true) {
  await act(async () => {
    root.render(
      <OrdersView
        result={cloudRunResult(orders, STATS, NOW)}
        canEdit
        onToggleShipped={() => {}}
        onPurgeRequest={() => ''}
        onMarkAllShipped={withBulk ? onMarkAll : undefined}
      />,
    );
  });
}

/** כפתור לפי הטקסט שדורית רואה — ולא לפי `data-testid`. */
function button(text: string): HTMLButtonElement | null {
  const found = Array.from(container.querySelectorAll('button')).find((b) =>
    (b.textContent ?? '').includes(text),
  );
  return (found as HTMLButtonElement) ?? null;
}

async function click(text: string) {
  const el = button(text);
  if (!el) throw new Error(`לא נמצא כפתור עם הטקסט "${text}"`);
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

const twoOpen = [
  makeOrder({ sourceMessageId: 'msg-1' }),
  makeOrder({ sourceMessageId: 'msg-2' }),
];

// ---------------------------------------------------------------------------

describe('★ מתי הכפתור בכלל מופיע', () => {
  it('★★ הזמנה פתוחה אחת — אין כפתור סימון הכל', async () => {
    await render([makeOrder({ sourceMessageId: 'msg-1' })]);
    expect(button(t('ordersMarkAllAction'))).toBeNull();
  });

  it('שתי הזמנות — מופיע, עם המספר בתוכו', async () => {
    await render(twoOpen);
    expect(button(t('ordersMarkAllAction'))?.textContent).toContain('(2)');
  });

  it('★ במצב הדגמה (אין מסלול המוני) — לא מופיע בכלל', async () => {
    await render(twoOpen, false);
    expect(button(t('ordersMarkAllAction'))).toBeNull();
  });

  it('הזמנה שצריך להסתכל עליה אינה נספרת בכפתור', async () => {
    await render([
      makeOrder({ sourceMessageId: 'msg-1' }),
      makeOrder({ sourceMessageId: 'msg-2' }),
      makeOrder({ sourceMessageId: 'msg-3', needsHumanReview: true }),
    ]);
    expect(button(t('ordersMarkAllAction'))?.textContent).toContain('(2)');
  });
});

describe('★★ אישור דו-שלבי', () => {
  it('★★ הלחיצה הראשונה לא שולחת כלום — היא שואלת', async () => {
    await render(twoOpen);
    await click(t('ordersMarkAllAction'));

    expect(calls).toHaveLength(0);
    expect(container.textContent).toContain(t('ordersMarkAllExplain'));
    expect(button(t('ordersMarkAllConfirmPrefix'))?.textContent).toContain('2');
    expect(button(t('ordersMarkAllCancel'))).not.toBeNull();
  });

  it('"ביטול" מחזיר לכפתור אחד, בלי שום קריאה', async () => {
    await render(twoOpen);
    await click(t('ordersMarkAllAction'));
    await click(t('ordersMarkAllCancel'));

    expect(calls).toHaveLength(0);
    expect(container.textContent).not.toContain(t('ordersMarkAllExplain'));
    expect(button(t('ordersMarkAllAction'))).not.toBeNull();
  });

  it('★★ האישור שולח בדיוק את המזהים של ההזמנות הפתוחות', async () => {
    await render(twoOpen);
    await click(t('ordersMarkAllAction'));
    await click(t('ordersMarkAllConfirmPrefix'));

    expect(calls).toEqual([{ ids: ['msg-1', 'msg-2'], shipped: true }]);
    expect(container.textContent).toContain('סימנתי 2');
  });
});

describe('★★ באנר הביטול', () => {
  it('★★ שורד את היעלמות הרשימה — ומחזיר את אותם מזהים בדיוק', async () => {
    await render(twoOpen);
    await click(t('ordersMarkAllAction'));
    await click(t('ordersMarkAllConfirmPrefix'));

    // הסימון נכנס: שתי ההזמנות עברו ל"כבר יצא", והרשימה התרוקנה.
    await render([
      makeOrder({ sourceMessageId: 'msg-1', status: 'shipped', shippedAt: NOW.toISOString() }),
      makeOrder({ sourceMessageId: 'msg-2', status: 'shipped', shippedAt: NOW.toISOString() }),
    ]);

    expect(container.textContent).toContain(t('ordersToShipEmpty'));
    // ★★ ובכל זאת הבאנר כאן, עם כפתור ההחזרה.
    expect(container.textContent).toContain('סימנתי 2');

    reply = { updated: 2, skippedMissing: 0, skippedBlocked: 0 };
    await click(t('ordersMarkAllUndo'));

    expect(calls[1]).toEqual({ ids: ['msg-1', 'msg-2'], shipped: false });
    expect(container.textContent).toContain(t('ordersMarkAllUndone'));
  });

  it('הוא לא נעלם מעצמו — רק בלחיצה על סגירה', async () => {
    await render(twoOpen);
    await click(t('ordersMarkAllAction'));
    await click(t('ordersMarkAllConfirmPrefix'));
    expect(container.textContent).toContain('סימנתי 2');

    await click(t('ordersMarkAllDismiss'));
    expect(container.textContent).not.toContain('סימנתי 2');
  });

  it('★★ מה שדולג נאמר במפורש, ובלי מונחי מערכת', async () => {
    reply = { updated: 2, skippedMissing: 1, skippedBlocked: 3 };
    await render(twoOpen);
    await click(t('ordersMarkAllAction'));
    await click(t('ordersMarkAllConfirmPrefix'));

    expect(container.textContent).toContain(`3 ${t('ordersMarkAllSkippedSuffix')}`);
  });

  it('★ בלי דילוגים — אין שורה מיותרת', async () => {
    await render(twoOpen);
    await click(t('ordersMarkAllAction'));
    await click(t('ordersMarkAllConfirmPrefix'));

    expect(container.textContent).not.toContain(t('ordersMarkAllSkippedSuffix'));
  });

  it('★ קריאה שלא נשמרה אינה מייצרת באנר של הצלחה', async () => {
    reply = null;
    await render(twoOpen);
    await click(t('ordersMarkAllAction'));
    await click(t('ordersMarkAllConfirmPrefix'));

    expect(calls).toHaveLength(1);
    expect(container.textContent).not.toContain('סימנתי');
    expect(button(t('ordersMarkAllUndo'))).toBeNull();
  });
});

describe('★ הכישלון נאמר על המסך', () => {
  it('ההודעה מוצגת, והיא אומרת שהרשימה חזרה למה שהייתה', async () => {
    await act(async () => {
      root.render(
        <OrdersView
          result={cloudRunResult(twoOpen, STATS, NOW)}
          canEdit
          onToggleShipped={() => {}}
          onPurgeRequest={() => ''}
          onMarkAllShipped={onMarkAll}
          shippedErrorHe={t('ordersMarkFailed')}
        />,
      );
    });

    expect(container.textContent).toContain('לא הצלחתי לשמור את הסימון');
    expect(container.textContent).toContain('הרשימה חזרה למה שהיא הייתה');
  });
});

// ---------------------------------------------------------------------------
// ★★ המילון — הבדיקה שנכתבה כי זה כבר קרה
// ---------------------------------------------------------------------------
// בלוק מחרוזות ב-`i18n.ts` אבד פעם אחת במיזוג, וההתנהגות של `t()` היא
// **להחזיר את שם המפתח** — כלומר המסך ממשיך לעבוד ומציג `ordersMarkAllAction`
// לדורית. מחרוזת חסרה חייבת להיכשל כאן ולא במסך.

const NEW_KEYS: TranslationKey[] = [
  'ordersMarkAllAction',
  'ordersMarkAllExplain',
  'ordersMarkAllConfirmPrefix',
  'ordersMarkAllConfirmSuffix',
  'ordersMarkAllCancel',
  'ordersMarkAllWorking',
  'ordersMarkAllDonePrefix',
  'ordersMarkAllDoneSuffix',
  'ordersMarkAllDoneOne',
  'ordersMarkAllUndo',
  'ordersMarkAllUndone',
  'ordersMarkAllDismiss',
  'ordersMarkAllSkippedSuffix',
  'ordersMarkAllSkippedOne',
  'ordersMarkFailed',
];

describe('★★ כל מחרוזת חדשה קיימת בפועל', () => {
  it('אף מפתח אינו מוחזר כשמו', () => {
    for (const key of NEW_KEYS) {
      expect(HE[key], `המפתח ${key} חסר במילון`).toBeTypeOf('string');
      expect(t(key)).not.toBe(key);
      expect(t(key).length).toBeGreaterThan(1);
    }
  });

  it('★ אין מונחי מערכת במה שנאמר על המסך', () => {
    const banned = [
      'סטטוס',
      'רשומה',
      'שרת',
      'שגיאה',
      'קוד',
      'Firestore',
      'status',
      'null',
      'undefined',
      'ID',
    ];
    for (const key of NEW_KEYS) {
      for (const word of banned) {
        expect(t(key), `"${word}" מופיע ב-${key}`).not.toContain(word);
      }
    }
  });
});
