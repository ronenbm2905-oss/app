// @vitest-environment jsdom
// ============================================================================
// reconcileUpload.test.tsx — ★★ המבחן שבאמת בוחר קובץ, ועכשיו קובץ אמיתי.
//
// ---------------------------------------------------------------------------
// למה זה לא יכול להיות `renderToString`
// ---------------------------------------------------------------------------
// אותו לקח כמו ב-`tests/refreshControl.test.tsx`: HTML שנכתב יפה ולא מחובר
// לכלום נראה זהה ל-HTML מחובר. הטענות כאן הן טענות על **מה שקורה אחרי
// פעולה** — בחירת קובץ, קריאתו, זיהויו, וההשוואה שרצה בעקבותיה.
//
// ---------------------------------------------------------------------------
// ★★ ומה שהשתנה: זה כבר לא כפיל
// ---------------------------------------------------------------------------
// עד עכשיו ישב כאן אדפטר מומצא שקרא פורמט שהמצאנו, כי לא ראינו קובץ. עכשיו
// המבחן בונה **קובץ xlsx אמיתי** — ZIP, sharedStrings, סריאל תאריך — במבנה
// שנמדד בשני הקבצים, ומריץ עליו את האדפטרים האמיתיים.
//
// ⛔ הנתונים בתוכו מסונתזים לגמרי: "עסק לדוגמה", סכומים מומצאים, אפס ת.ז
// ואפס מספרי כרטיס. הקבצים האמיתיים אינם בריפו ולא יהיו.
//
// ★ ונקודת ההחלפה היחידה היא `inflateRaw`: ב-jsdom אין `DecompressionStream`,
// ולכן מוזרק `zlib.inflateRawSync`. כל השאר — פרסור ה-ZIP, ה-XML, הזיהוי,
// הפרסור, הקיבוץ וההשוואה — הוא בדיוק הקוד שרץ בדפדפן.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ReconcileView } from '../src/components/ReconcileView';
import {
  buildGammaXlsx,
  buildTranzilaXlsx,
  nodeInflateRaw,
  type FakeGammaRow,
  type FakeTranzilaRow,
} from './fixtures/xlsxBuilder';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// --- שני הקבצים, בצורתם המדודה ובנתונים מומצאים ------------------------------

const TRANZILA_ROWS: FakeTranzilaRow[] = [
  { date: '2026-08-04', hours: 9.25, shekels: 310, settlement: '90000001' },
  { date: '2026-08-04', hours: 18.75, shekels: 420, settlement: '90000001' },
  { date: '2026-08-11', hours: 12.5, shekels: 85, settlement: '90000002' },
  { date: '2026-08-11', hours: 13.5, shekels: 265, settlement: '90000002' },
  {
    date: '2026-08-19',
    hours: 20.5,
    shekels: 612,
    settlement: '',
    approval: '0000000',
    status: '303 - אין הרשאת סולק לעסקה כשהכרטיס לא נוכח',
  },
];

const GAMMA_ROWS: FakeGammaRow[] = [
  { date: '2026-08-06', shekels: 730, settlement: '90000001' },
  { date: '2026-08-13', shekels: 85, settlement: '90000002', brand: 'ויזה~' },
  { date: '2026-08-13', shekels: 265, settlement: '90000002', brand: 'מסטר~' },
];

const TRANZILA_FILE = buildTranzilaXlsx(TRANZILA_ROWS);
const GAMMA_FILE = buildGammaXlsx(GAMMA_ROWS);

// --- תשתית רינדור, כמו ב-refreshControl --------------------------------------

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render() {
  return act(async () =>
    root.render(<ReconcileView today="2026-09-29" inflateRaw={nodeInflateRaw} />),
  );
}

function fileInputs(): HTMLInputElement[] {
  return Array.from(container.querySelectorAll('input[type="file"]'));
}

/**
 * בחירת קובץ. `files` מוגדר ידנית כי ב-jsdom אין דרך אחרת למלא פקד קובץ —
 * זו התשתית, לא עקיפה של הלוגיקה: מה שנבדק הוא מה שהרכיב עושה אחרי האירוע.
 */
async function choose(input: HTMLInputElement, name: string, content: Uint8Array | string) {
  const file = new File([content as BlobPart], name);
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // ★ `FileReader` מסיים במחזור אירועים נפרד, ולא ב-microtask, והפרסור
  // עצמו אסינכרוני. בלי ההמתנה המבחן היה בודק את המצב "רגע, קוראת…"
  // ומדווח כישלון שמקורו בתשתית ולא בקוד.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const text = () => container.textContent ?? '';

// ---------------------------------------------------------------------------

describe('★★ קובץ בפורמט שלא מכירים', () => {
  it('מגיע למצב מוצר מפורש, ולא לשגיאה', async () => {
    await render();
    await choose(fileInputs()[0], 'דוח.csv', 'משהו שאיננו מכירים');

    expect(text()).toContain('עוד לא מכירים את הפורמט של הקובץ הזה');
    expect(text()).toContain('רונן צריך לראות דוגמה אחת');
  });

  it('★ והסיבה נאמרת בעברית, מתחת להסבר', async () => {
    await render();
    await choose(fileInputs()[0], 'דוח.csv', 'משהו שאיננו מכירים'.repeat(10));
    expect(text()).toContain('אינו קובץ אקסל');
  });

  it('★ שם הקובץ מוצג כמו שהוא, ובלי טקסט טכני סביבו', async () => {
    await render();
    await choose(fileInputs()[0], 'דוח.csv', 'משהו שאיננו מכירים');

    expect(text()).toContain('דוח.csv');
    expect(text()).not.toContain('Error');
    expect(text()).not.toContain('undefined');
  });

  it('★★ קובץ אקסל תקין שאינו אחד משני הדוחות — גם הוא מצב מוצר', async () => {
    const { buildXlsx } = await import('./fixtures/xlsxBuilder');
    await render();
    await choose(
      fileInputs()[0],
      'משהו.xlsx',
      buildXlsx([
        ['תאריך', 'סכום'],
        ['2026-08-01', 10],
      ]),
    );
    expect(text()).toContain('עוד לא מכירים את הפורמט');
  });

  it('קובץ ריק מקבל משפט משלו, ולא את אותו מסר', async () => {
    await render();
    await choose(fileInputs()[0], 'ריק.xlsx', new Uint8Array(0));

    expect(text()).toContain('הקובץ הזה ריק');
    expect(text()).not.toContain('עוד לא מכירים את הפורמט');
  });

  it('עם קובץ אחד בלבד — עדיין מחכים לשני, ולא מציגים חצי השוואה', async () => {
    await render();
    await choose(fileInputs()[0], 'טרנזילה.xlsx', TRANZILA_FILE);
    expect(text()).toContain('צריך את שני הדוחות');
  });
});

// ---------------------------------------------------------------------------

describe('★★ שני קבצים — ההשוואה רצה על המסך', () => {
  it('הקבוצות מוצגות, והזיהוי נאמר', async () => {
    await render();
    const [first, second] = fileInputs();
    await choose(first, 'טרנזילה.xlsx', TRANZILA_FILE);
    await choose(second, 'דוח-אשראי.xlsx', GAMMA_FILE);

    expect(text()).toContain('מה שלא הצלחתי להתאים');
    expect(text()).toContain('מה שהתאים');
    expect(text()).toContain('זיהיתי: הדוח מטרנזילה');
    expect(text()).toContain('זיהיתי: הדוח מגמא');
  });

  it('★★ הקיבוץ לפי שידור עובד מקצה לקצה — אפס פער', async () => {
    await render();
    const [first, second] = fileInputs();
    await choose(first, 'טרנזילה.xlsx', TRANZILA_FILE);
    await choose(second, 'דוח-אשראי.xlsx', GAMMA_FILE);

    // שתי עסקאות מול שורה אחת, ושתי עסקאות מול שתי שורות — ובכל זאת
    // שני הצדדים נפגשים בדיוק.
    expect(text()).toContain('שני הסכומים זהים');
    expect(text()).toContain('הכול מצא את מה שמתאים לו');
    expect(text()).not.toContain('מופיע רק ב');
  });

  it('★★ העסקה שנדחתה מוצגת כ"לא עברה" — ולא כ"חסרה בדוח השני"', async () => {
    await render();
    const [first, second] = fileInputs();
    await choose(first, 'טרנזילה.xlsx', TRANZILA_FILE);
    await choose(second, 'דוח-אשראי.xlsx', GAMMA_FILE);

    expect(text()).toContain('עסקאות שלא עברו');
    expect(text()).toContain('העסקה לא עברה');
    // הסיבה כפי שהיא בקובץ.
    expect(text()).toContain('303 - אין הרשאת סולק לעסקה כשהכרטיס לא נוכח');
    // ★★ וזו הטענה שבאמת נבדקת: היא לא מופיעה בקבוצה של "לא התאים".
    expect(text()).toContain('הכול מצא את מה שמתאים לו');
    expect(text()).not.toContain('מעולם לא נגבתה — זה כסף שאבד');
  });

  it('★ והעמלה מוצגת כמספר שהיא רוצה לראות', async () => {
    await render();
    const [first, second] = fileInputs();
    await choose(first, 'טרנזילה.xlsx', TRANZILA_FILE);
    await choose(second, 'דוח-אשראי.xlsx', GAMMA_FILE);

    expect(text()).toContain('נגבו');
    expect(text()).toContain('נוכו');
    expect(text()).toContain('ונכנסו');
  });

  it('★★ סדר הפוך — הכלי מזהה ומסדר לבד', async () => {
    await render();
    const [first, second] = fileInputs();
    // הקובץ של גמא נגרר לריבוע של טרנזילה, ולהפך.
    await choose(first, 'דוח-אשראי.xlsx', GAMMA_FILE);
    await choose(second, 'טרנזילה.xlsx', TRANZILA_FILE);

    expect(text()).toContain('הקבצים היו הפוכים');
    expect(text()).toContain('שמתי כל אחד במקום שלו לבד');
    // ★ והתוצאה זהה לחלוטין: ההשוואה רצה, ואפס פער.
    expect(text()).toContain('שני הסכומים זהים');
    expect(text()).toContain('הכול מצא את מה שמתאים לו');
  });

  it('★ אותו דוח פעמיים — נאמר, ולא מוצגת השוואה של דוח לעצמו', async () => {
    await render();
    const [first, second] = fileInputs();
    await choose(first, 'א.xlsx', TRANZILA_FILE);
    await choose(second, 'ב.xlsx', TRANZILA_FILE);

    expect(text()).toContain('שני הקבצים הם אותו דוח');
    expect(text()).not.toContain('מה שלא הצלחתי להתאים');
  });

  it('★ התקופה מסננת באמת — חודש שאין בו עסקאות מחזיר את זה במפורש', async () => {
    // ינואר 2027 → "החודש שעבר" הוא דצמבר 2026, שאין בו כלום.
    await act(async () =>
      root.render(<ReconcileView today="2027-01-15" inflateRaw={nodeInflateRaw} />),
    );
    const [first, second] = fileInputs();
    await choose(first, 'טרנזילה.xlsx', TRANZILA_FILE);
    await choose(second, 'דוח-אשראי.xlsx', GAMMA_FILE);

    expect(text()).toContain('אין אף עסקה בתקופה שבחרת');
  });

  it('★ מעבר ל"טווח אחר" חושף שדות תאריך אמיתיים', async () => {
    await render();

    const custom = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('טווח אחר'),
    );
    expect(custom).toBeTruthy();
    await act(async () => custom?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.querySelectorAll('input[type="date"]')).toHaveLength(2);
    expect(text()).toContain('מתאריך');
  });
});

// ---------------------------------------------------------------------------

describe('★★ ומה שלא מגיע למסך', () => {
  it('שום ערך רגיש מהקובץ אינו מופיע בשום מקום במסך', async () => {
    await render();
    const [first, second] = fileInputs();
    await choose(first, 'טרנזילה.xlsx', TRANZILA_FILE);
    await choose(second, 'דוח-אשראי.xlsx', GAMMA_FILE);

    const html = container.innerHTML;
    // ★★ הת.ז ראשונה ברשימה, ולא חסרה ממנה. היא הערך הרגיש ביותר בקובץ,
    //    והיא זו שנשמטה כאן בגרסה הראשונה — כלומר המבחן בדק את כל השאר
    //    ופסח בדיוק על מה שהוא נכתב בשבילו.
    for (const value of [
      '000000000',
      '458123XXXXXX9012',
      '203.0.113.7',
      'לקוחה לדוגמה',
      'עסק לדוגמה',
    ]) {
      expect(html, `"${value}" הגיע למסך`).not.toContain(value);
    }
  });
});
