// @vitest-environment jsdom
// ============================================================================
// reconcileNav.test.tsx — ★★ המסך **מחובר**, ולא רק קיים.
//
// ---------------------------------------------------------------------------
// למה זה מבחן בפני עצמו
// ---------------------------------------------------------------------------
// זה בדיוק הכשל של `cloud.refreshNow`: הוא היה מוגדר, מיוצא, ולא נקרא מאף
// מקום — דורית חיברה את התיבה ולא ראתה כלום עד למחרת בבוקר. הקוד היה נכון
// בכל שורה, ולא היה דרך להגיע אליו.
//
// מסך השוואת הדוחות היה באותו מצב בדיוק: שלושה מודולים, מנוע, ייצוא, שער
// CI — ואפס דרכים לפתוח אותו. הטענה כאן צרה ומדויקת: **יש לשונית, לחיצה
// עליה פותחת את המסך, וההזמנות נשארות ברירת המחדל.**
//
// ---------------------------------------------------------------------------
// ★ ולמה `vi.mock` על Firebase
// ---------------------------------------------------------------------------
// אותו נימוק שכתוב ב-`tests/screens.test.tsx`: המצב המקומי הוא **החלטה
// מוצהרת**, ולכן המבחן עליו מקבע אותה במפורש ולא יורש אותה מ-`.env` שקיים
// אצל אחד ולא אצל השני.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('../src/firebase', () => ({
  isFirebaseConfigured: false,
  db: null,
  auth: null,
  functions: null,
  googleProvider: null,
}));

import { App } from '../src/App';
import { STORAGE_KEYS } from '../src/constants';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  // ★ ההסבר כבר נקרא. בלי זה המסך שעולה הוא מסך ההסבר, וזה מצב אחר.
  localStorage.setItem(STORAGE_KEYS.explainerSeen, '1');
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
});

async function mount() {
  await act(async () => root.render(<App />));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const text = () => container.textContent ?? '';

function tabNamed(label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find(
    (button) => (button.textContent ?? '').trim() === label,
  );
}

// ---------------------------------------------------------------------------

describe('★★ המסך מחובר לניווט הראשי', () => {
  it('יש לשונית, וההזמנות הן ברירת המחדל', async () => {
    await mount();

    expect(tabNamed('השוואת דוחות גבייה'), 'הלשונית לא נמצאה').toBeTruthy();
    expect(tabNamed('ההזמנות')?.getAttribute('aria-pressed')).toBe('true');
    // ★ ברירת המחדל נשארת מה שהיא פותחת כל בוקר. מסך של פעם בחודש לא
    //   מתחרה עליו על תשומת הלב.
    expect(text()).not.toContain('מעלים את שני הדוחות על אותה תקופה');
  });

  it('★★ ולחיצה עליה באמת פותחת את מסך ההשוואה', async () => {
    await mount();
    const tab = tabNamed('השוואת דוחות גבייה');
    await act(async () => tab?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(text()).toContain('הקבצים נשארים במחשב שלך');
    expect(text()).toContain('צריך את שני הדוחות');
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(2);
  });

  it('★ ואפשר לחזור חזרה להזמנות', async () => {
    await mount();
    await act(async () =>
      tabNamed('השוואת דוחות גבייה')?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );
    await act(async () =>
      tabNamed('ההזמנות')?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );

    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(0);
    expect(text()).toContain('מצב הדגמה');
  });

  it('★ הלשונית הפעילה מסומנת גם לקורא מסך, ולא רק בצבע', async () => {
    await mount();
    await act(async () =>
      tabNamed('השוואת דוחות גבייה')?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );

    expect(tabNamed('השוואת דוחות גבייה')?.getAttribute('aria-pressed')).toBe('true');
    expect(tabNamed('ההזמנות')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('★ ובאנר ההדגמה נשאר על המסך גם כשעוברים לשונית', async () => {
    // הוא לא ניתן לסגירה מסיבה: משתמשת שתשכח שאלה נתוני דוגמה עלולה להסיק
    // מהמסך מסקנות על העסק האמיתי שלה.
    await mount();
    await act(async () =>
      tabNamed('השוואת דוחות גבייה')?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );
    expect(text()).toContain('מצב הדגמה');
  });
});
