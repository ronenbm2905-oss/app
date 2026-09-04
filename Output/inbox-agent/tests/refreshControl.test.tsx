// @vitest-environment jsdom
// ============================================================================
// refreshControl.test.tsx — ★★ המבחן שלוחץ על הכפתור באמת.
//
// ---------------------------------------------------------------------------
// למה `renderToString` לא היה מספיק, ולמה זה הקובץ היחיד עם DOM
// ---------------------------------------------------------------------------
// שאר המבחנים כאן מרנדרים ל-HTML (`react-dom/server`) ובודקים **מה כתוב**.
// זו הייתה הכרעה נכונה, והיא בדיוק מה שהחמיץ את הבאג הזה: `refreshNow` היה
// מוגדר ומיוצא, ואף רכיב לא קרא לו. HTML שנכתב יפה ולא מחובר לכלום נראה
// במבחן כזה **זהה** ל-HTML מחובר.
//
// ולכן — ורק כאן — `jsdom`: כי הטענה שצריך להוכיח היא לא "יש כפתור עם
// הטקסט הנכון" אלא **"לחיצה גורמת לקריאה לצאת"**. מבחן שמחפש טקסט היה
// עובר גם על כפתור עם `onClick={() => {}}`.
//
// ---------------------------------------------------------------------------
// ★ מה ממוקה ומה לא
// ---------------------------------------------------------------------------
// `useCloudOrders` ממוקה — **וזו הנקודה**, לא ויתור. הריגול הוא על
// `refreshNow` שה-hook מחזיר, והטענה היא שהמסך מחבר אותו לפקד. אם מחר
// מישהו ימחק את הכפתור מ-`App.tsx`, המבחן ייפול. זה מה שלא היה קיים.
//
// `firebase` ו-`useAuth` ממוקים רק כדי להגיע למסלול הענן בלי `.env` ובלי
// רשת. שום דבר בהם אינו נבדק כאן.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { STORAGE_KEYS } from '../src/constants';
import { lastCheckedHe, refreshResultHe } from '../src/utils/refreshCopy';
import type { UseCloudOrders } from '../src/hooks/useCloudOrders';

// --- מוקים -----------------------------------------------------------------

vi.mock('../src/firebase', () => ({
  isFirebaseConfigured: true,
  db: {},
  auth: {},
  functions: {},
  googleProvider: {},
}));

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'u-dorit', email: null, displayName: null, local: false },
    authLoading: false,
    authError: null,
    signIn: async () => {},
    signOut: async () => {},
    isFirebaseConfigured: true,
  }),
}));

/** ה-state שה-hook הממוקה מחזיר. משתנה בין מבחנים. */
let cloud: UseCloudOrders;

vi.mock('../src/hooks/useCloudOrders', () => ({
  useCloudOrders: () => cloud,
}));

// ★ מיובא **אחרי** ה-mocks — `vi.mock` מורם, אבל הייבוא הזה חייב להיות
// דינמי כדי ש-`App` ייטען כשהמוקים כבר במקום.
const { App } = await import('../src/App');

// --- תשתית רינדור -----------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function makeCloud(over: Partial<UseCloudOrders> = {}): UseCloudOrders {
  return {
    loading: false,
    orders: [],
    accessLog: [],
    connection: 'connected',
    supportMode: { enabled: false, enabledAt: null, expiresAt: null },
    supportModeActive: false,
    lastReadCount: 4,
    lastReadSources: ['tranzila.com'],
    // ★ ברירת המחדל: כבר רץ סנכרון. כך ההרצה האוטומטית **לא** מופעלת,
    // ומבחני הלחיצה מודדים את הלחיצה בלבד.
    lastSyncAt: '2026-08-30T05:14:00.000Z',
    errorHe: null,
    connectGoogle: async () => null,
    setSupportMode: async () => {},
    refreshNow: async () => ({
      messagesRead: 0,
      readSources: [],
      written: 0,
      errorHe: null,
    }),
    ...over,
  } as UseCloudOrders;
}

async function render() {
  await act(async () => {
    root.render(<App />);
  });
}

/** הכפתור לפי הטקסט שדורית רואה — ולא לפי `data-testid`. */
function refreshButton(): HTMLButtonElement {
  const buttons = Array.from(container.querySelectorAll('button'));
  const found = buttons.find((b) => (b.textContent ?? '').includes('הגיעו הזמנות חדשות'));
  if (!found) throw new Error('כפתור הבדיקה לא נמצא במסך');
  return found as HTMLButtonElement;
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

beforeEach(() => {
  // הדגל שמסמן "ההסבר נקרא" — בלעדיו `App` מציג את מסך ההסבר ולא את הרשימה.
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

// ============================================================================
// ★★ הטענה המרכזית
// ============================================================================

describe('הפקד שקורא ל-refreshNow', () => {
  it('★★ לחיצה על הכפתור מוציאה קריאה ל-refreshNow', async () => {
    const refreshNow = vi.fn(async () => ({
      messagesRead: 0,
      readSources: [] as string[],
      written: 0,
      errorHe: null,
    }));
    cloud = makeCloud({ refreshNow });

    await render();
    expect(refreshNow).not.toHaveBeenCalled();

    await click(refreshButton());

    // ★ זו השורה שלא הייתה. לא "הכפתור קיים" — **הקריאה יצאה.**
    expect(refreshNow).toHaveBeenCalledTimes(1);
  });

  it('לחיצה כפולה בזמן ריצה אינה מייצרת קריאה שנייה', async () => {
    let release: (() => void) | null = null;
    const refreshNow = vi.fn(
      () =>
        new Promise<{
          messagesRead: number;
          readSources: string[];
          written: number;
          errorHe: string | null;
        }>((resolve) => {
          release = () =>
            resolve({ messagesRead: 0, readSources: [], written: 0, errorHe: null });
        }),
    );
    cloud = makeCloud({ refreshNow });

    await render();
    await click(refreshButton());

    // בזמן ריצה הכפתור מושבת — וגם אם משהו יעקוף את זה, השומר ב-hook תופס.
    expect(refreshButton().disabled).toBe(true);
    expect(refreshButton().getAttribute('aria-busy')).toBe('true');

    await click(refreshButton());
    expect(refreshNow).toHaveBeenCalledTimes(1);

    await act(async () => {
      release?.();
    });
    expect(refreshButton().disabled).toBe(false);
  });
});

// ============================================================================
// ★ ההרצה שמיד אחרי החיבור — התיקון העיקרי
// ============================================================================

describe('הבדיקה שרצה מעצמה אחרי החיבור', () => {
  it('★★ תיבה שחוברה ומעולם לא נסרקה — נבדקת בלי שנלחץ כלום', async () => {
    const refreshNow = vi.fn(async () => ({
      messagesRead: 0,
      readSources: [] as string[],
      written: 0,
      errorHe: null,
    }));
    // ★ המצב שאחרי `completeAuthorization`: מחובר, ו-`lastSyncAt` עוד לא נכתב.
    cloud = makeCloud({ refreshNow, lastSyncAt: null });

    await render();

    expect(refreshNow).toHaveBeenCalledTimes(1);
  });

  it('תיבה שכבר נסרקה אינה נבדקת מחדש בכל פתיחה של המסך', async () => {
    const refreshNow = vi.fn(async () => ({
      messagesRead: 0,
      readSources: [] as string[],
      written: 0,
      errorHe: null,
    }));
    cloud = makeCloud({ refreshNow, lastSyncAt: '2026-08-30T05:14:00.000Z' });

    await render();

    expect(refreshNow).not.toHaveBeenCalled();
  });

  it('תיבה שאינה מחוברת אינה נבדקת', async () => {
    const refreshNow = vi.fn(async () => null);
    cloud = makeCloud({ refreshNow, connection: 'disconnected', lastSyncAt: null });

    await render();

    expect(refreshNow).not.toHaveBeenCalled();
  });
});

// ============================================================================
// ★ שלושת המצבים על המסך
// ============================================================================

describe('מה כתוב על המסך אחרי הבדיקה', () => {
  it('אפס תוצאות מקבל משפט מפורש, ולא מסך שלא השתנה', async () => {
    cloud = makeCloud({
      refreshNow: async () => ({
        messagesRead: 3,
        readSources: ['tranzila.com'],
        written: 0,
        errorHe: null,
      }),
    });

    await render();
    await click(refreshButton());

    expect(container.textContent).toContain('לא הגיעו הזמנות חדשות');
  });

  it('כישלון נאמר בעברית, בלי קוד שגיאה ובלי מונח פנימי', async () => {
    cloud = makeCloud({
      refreshNow: async () => {
        throw new Error('FirebaseError: functions/internal (invalid_grant)');
      },
    });

    await render();
    await click(refreshButton());

    const text = container.textContent ?? '';
    expect(text).toContain('לא הצלחתי לבדוק עכשיו');
    // ★ מה שנזרק מה-SDK אסור שיגיע למסך.
    for (const banned of ['FirebaseError', 'functions/internal', 'invalid_grant', 'Error']) {
      expect(text).not.toContain(banned);
    }
  });

  it('★ חיבור שפג מפנה לבאנר הקיים ואינו אומר את אותו דבר פעמיים', async () => {
    cloud = makeCloud({
      refreshNow: async () => ({
        messagesRead: 0,
        readSources: [],
        written: 0,
        // הנוסח מגיע כך מ-`functions/src/lib/orderSync.ts`.
        errorHe: 'החיבור לגוגל פג. צריך להתחבר מחדש — שום דבר לא נמחק.',
      }),
    });

    await render();
    await click(refreshButton());

    expect(container.textContent).toContain('ההודעה שלמעלה מסבירה מה לעשות');
  });

  it('"בדקתי לאחרונה" מוצג גם בלי שנלחץ כלום', async () => {
    cloud = makeCloud({ lastSyncAt: '2026-08-30T05:14:00.000Z' });

    await render();

    expect(container.textContent).toContain('בדקתי לאחרונה');
  });
});

// ============================================================================
// הניסוח עצמו — פונקציות טהורות
// ============================================================================

describe('refreshCopy', () => {
  it('אפס/אחת/רבות — שלושה ניסוחים שונים', () => {
    expect(refreshResultHe(0)).toContain('לא הגיעו הזמנות חדשות');
    expect(refreshResultHe(1)).toContain('הזמנה חדשה אחת');
    expect(refreshResultHe(3)).toContain('3');
  });

  it('אותו יום → שעה בלבד; יום אחר → תאריך ושעה', () => {
    const now = new Date('2026-08-30T12:00:00+03:00');
    const today = lastCheckedHe('2026-08-30T08:14:00+03:00', now);
    expect(today).toContain('08:14');
    expect(today).not.toContain('בשעה');

    const older = lastCheckedHe('2026-08-28T08:14:00+03:00', now);
    expect(older).toContain('בשעה');
  });

  it('טרם נבדק — משפט משלו, ולא שעה מזויפת', () => {
    expect(lastCheckedHe(null)).toContain('עוד לא בדקתי');
    expect(lastCheckedHe('לא-תאריך')).toContain('עוד לא בדקתי');
  });
});
