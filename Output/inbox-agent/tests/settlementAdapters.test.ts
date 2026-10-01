// ============================================================================
// settlementAdapters.test.ts — ★★ שני האדפטרים, מול הצורה שנמדדה.
//
// ---------------------------------------------------------------------------
// שלוש הטענות שהמבחן הזה נושא
// ---------------------------------------------------------------------------
//  1. **זיהוי לפי צירוף כותרות** — ולכן אפשר להעלות את שני הקבצים בכל סדר,
//     והכלי מסדר לבד.
//  2. **★★ עסקה שנדחתה יוצאת לקטגוריה משלה** — לא "חסרה בדוח השני". זה
//     ההבדל שמונע ממנה לחפש כסף שמעולם לא נגבה.
//  3. **★★ מזעור** — ת.ז, מספר כרטיס, IP ושם בעל הכרטיס יושבים בקובץ,
//     והאדפטר לא נושא אותם הלאה. לא "לא קראנו" — **בדוק**.
//
// ⛔ הנתונים כאן מסונתזים לגמרי. ראו `tests/fixtures/xlsxBuilder.ts`.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { readSheetGrid } from '../shared/lib/xlsx';
import {
  ADAPTERS,
  countDetections,
  detectAdapter,
} from '../shared/lib/reportAdapters';
import {
  declinedOf,
  deductionsOf,
  formatAgorot,
  MINIMIZED_FIELD_NAMES,
  sumAgorot,
  type SettlementReport,
  type SettlementRow,
} from '../shared/lib/settlement';
import {
  buildGammaXlsx,
  buildTranzilaXlsx,
  nodeInflateRaw,
  type FakeGammaRow,
  type FakeTranzilaRow,
} from './fixtures/xlsxBuilder';

// ---------------------------------------------------------------------------
// עזר: קובץ → דוח, דרך המסלול המלא
// ---------------------------------------------------------------------------

async function parse(bytes: Uint8Array): Promise<SettlementReport> {
  const grid = await readSheetGrid(bytes, nodeInflateRaw);
  const adapter = detectAdapter(grid);
  if (adapter === null) throw new Error('לא זוהה');
  return adapter.parse(grid);
}

/** שלוש עסקאות שעברו, ואחת שנדחתה — בדיוק הצורה שנמדדה. */
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
  // ★ שידור אחד = שתי עסקאות בטרנזילה מול **שורה אחת** בגמא.
  { date: '2026-08-06', shekels: 730, settlement: '90000001' },
  // ★ ושידור אחר = שתי עסקאות מול **שתי שורות**, כי המותג שונה.
  { date: '2026-08-13', shekels: 85, settlement: '90000002', brand: 'ויזה~' },
  { date: '2026-08-13', shekels: 265, settlement: '90000002', brand: 'מסטר~' },
];

// ---------------------------------------------------------------------------

describe('★★ זיהוי הקובץ — לפי כותרות, ובכל סדר', () => {
  it('כל קובץ מזוהה על ידי אדפטר אחד בדיוק', async () => {
    const tranzila = await readSheetGrid(buildTranzilaXlsx(TRANZILA_ROWS), nodeInflateRaw);
    const gamma = await readSheetGrid(buildGammaXlsx(GAMMA_ROWS), nodeInflateRaw);

    expect(detectAdapter(tranzila)?.source).toBe('tranzila');
    expect(detectAdapter(gamma)?.source).toBe('gamma');

    // ★ יותר מאחד = באג באדפטרים, ולא בחירה. ראו `countDetections`.
    expect(countDetections(tranzila)).toBe(1);
    expect(countDetections(gamma)).toBe(1);
  });

  it('★★ הזיהוי אינו תלוי בשם הקובץ — אין בו שם קובץ בכלל', () => {
    // הממשק עצמו הוא ההוכחה: `detect` מקבל גיליון, ולא מחרוזת שם. מי
    // שירצה להוסיף זיהוי לפי שם יצטרך לשנות את החתימה, וזה ייראה.
    for (const adapter of ADAPTERS) {
      expect(adapter.detect.length).toBe(1);
    }
  });

  it('★ קובץ שאינו אחד מהשניים אינו מזוהה — ולא "מנוחש"', async () => {
    const grid = await readSheetGrid(
      (await import('./fixtures/xlsxBuilder')).buildXlsx([
        ['תאריך', 'סכום', 'הערה'],
        ['2026-08-01', 10, 'משהו אחר'],
      ]),
      nodeInflateRaw,
    );
    expect(detectAdapter(grid)).toBeNull();
  });

  it('★ סדר העמודות אינו קובע — רק קיומן', async () => {
    const { buildXlsx } = await import('./fixtures/xlsxBuilder');
    const reversed = buildXlsx([
      ['סטטוס', 'מספר אישור', 'מספר שידור', 'סכום', 'תאריך ושעה'],
      [null, '7654321', '90000003', 50, '2026-08-05'],
    ]);
    const grid = await readSheetGrid(reversed, nodeInflateRaw);
    expect(detectAdapter(grid)?.source).toBe('tranzila');

    const report = await parse(reversed);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].amount).toBe(5000);
    expect(report.rows[0].reference).toBe('90000003');
  });
});

// ---------------------------------------------------------------------------

describe('★★ טרנזילה — שורה לכל עסקה', () => {
  it('העסקאות שעברו נקראות, עם מספר השידור כאסמכתא', async () => {
    const report = await parse(buildTranzilaXlsx(TRANZILA_ROWS));
    expect(report.source).toBe('tranzila');
    expect(report.rows).toHaveLength(4);
    expect(report.rows.map((r) => r.reference)).toEqual([
      '90000001',
      '90000001',
      '90000002',
      '90000002',
    ]);
  });

  it('★ הסכומים באגורות כמספר שלם', async () => {
    const report = await parse(
      buildTranzilaXlsx([{ date: '2026-08-02', shekels: 1.83, settlement: '1' }]),
    );
    // 1.83 × 100 ב-float נופל טיפה **מתחת** ל-183. עיגול מפורש הוא מה
    // שעושה מזה 183; קיצוץ היה נותן 182, כלומר אגורה שנעלמה.
    expect(report.rows[0].amount).toBe(183);
    expect(Number.isInteger(report.rows[0].amount)).toBe(true);
  });

  it('★★ השעה שבתאריך נחתכת, והתאריך הוא היום שבו זה קרה', async () => {
    const report = await parse(TRANZILA_FILE);
    expect(report.rows[0].date).toBe('2026-08-04');
    expect(report.rows[1].date).toBe('2026-08-04');
  });

  it('שורות לא נעלמות: מה שלא נקרא יוצא לרשימה עם סיבה', async () => {
    const report = await parse(
      buildTranzilaXlsx([
        { date: '2026-08-02', shekels: 10, settlement: '' },
        { date: '2026-08-03', shekels: 20, settlement: '5', movement: 'זיכוי' },
      ]),
    );
    expect(report.rows).toHaveLength(0);
    expect(report.unreadableRows).toHaveLength(2);
    expect(report.unreadableRows[0].reasonHe).toContain('מספר שידור');
    // ★ הערך הלא-מוכר נאמר בהודעה. בלעדיו הדיווח שלה יגיע בלי המידע שדרוש
    //   כדי להוסיף תמיכה, ונצטרך לבקש ממנה את הקובץ.
    expect(report.unreadableRows[1].reasonHe).toContain('זיכוי');
  });
});

const TRANZILA_FILE = buildTranzilaXlsx(TRANZILA_ROWS);

// ---------------------------------------------------------------------------

describe('★★ עסקה שנדחתה — הקטגוריה השלישית', () => {
  it('יוצאת ל-`declinedRows`, ולא לשורות הרגילות', async () => {
    const report = await parse(TRANZILA_FILE);
    const declined = declinedOf(report);

    expect(declined).toHaveLength(1);
    expect(declined[0].amount).toBe(61_200);
    // ★★ והיא **אינה** בין השורות שנכנסות להשוואה. אילו הייתה, המנוע היה
    //    מדווח עליה "מופיע רק בטרנזילה" — כלומר "הכסף לא הגיע".
    expect(report.rows.some((row) => row.amount === 61_200)).toBe(false);
    expect(report.unreadableRows).toHaveLength(0);
  });

  it('★★ הסיבה נשמרת כפי שהיא כתובה בקובץ, בלי תרגום', async () => {
    const declined = declinedOf(await parse(TRANZILA_FILE));
    expect(declined[0].reasonHe).toBe('303 - אין הרשאת סולק לעסקה כשהכרטיס לא נוכח');
  });

  it('★★ והיא מסבירה בדיוק את הפער בין שני הדוחות', async () => {
    const tranzila = await parse(TRANZILA_FILE);
    const gamma = await parse(buildGammaXlsx(GAMMA_ROWS));

    const collected = sumAgorot(tranzila.rows);
    const declined = sumAgorot(declinedOf(tranzila));
    const settled = sumAgorot(gamma.rows);

    // זו התבנית שנמדדה: הברוטו בשני הדוחות זהה, וכל מה שנראה כמו "חוסר"
    // הוא בדיוק הסכום שנדחה.
    expect(collected).toBe(settled);
    expect(collected + declined).toBe(settled + declined);
    expect(formatAgorot(declined)).toBe('612.00 ₪');
  });
});

// ---------------------------------------------------------------------------

describe('★★ גמא — שורה לכל שידור ומותג, עם הניכויים', () => {
  it('הברוטו הוא מה שנקרא כסכום', async () => {
    const report = await parse(buildGammaXlsx(GAMMA_ROWS));
    expect(report.source).toBe('gamma');
    expect(report.rows.map((r) => r.amount)).toEqual([73_000, 8_500, 26_500]);
  });

  it('★ ברוטו פחות עמלה ומע"מ = נטו, על כל שורה', async () => {
    const report = await parse(buildGammaXlsx(GAMMA_ROWS));
    for (const row of report.rows) {
      expect(row.amount - (row.feeAgorot ?? 0) - (row.vatAgorot ?? 0)).toBe(row.netAgorot);
    }
  });

  it('★★ "נגבו X, נוכו Y, נכנסו Z" — שלושת המספרים שהיא מחפשת', async () => {
    const summary = deductionsOf(await parse(buildGammaXlsx(GAMMA_ROWS)));
    expect(summary).not.toBeNull();
    expect(summary?.grossAgorot).toBe(108_000);
    expect(summary?.feeAgorot).toBe(1_296);
    // ★ המע"מ מעוגל **בכל שורה בנפרד**, כמו שדוח חברת האשראי כותב אותו.
    //   עיגול של הסכום הכולל היה נותן מספר אחר מזה שבדף החשבון שלה.
    expect(summary?.vatAgorot).toBe(233);
    expect(summary?.netAgorot).toBe(108_000 - 1_296 - 233);
  });

  it('★ דוח בלי ניכויים מחזיר `null`, ולא סיכום של אפסים', async () => {
    // "לא נוכה כלום" ו"אין כאן מושג כזה" הן שתי אמירות שונות, ורק אחת
    // מהן ראויה להופיע על המסך.
    expect(deductionsOf(await parse(TRANZILA_FILE))).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('★★ מזעור — מה שאסור לשאת, אי אפשר לשאת', () => {
  const SENSITIVE = ['000000000', '458123XXXXXX9012', '203.0.113.7', 'לקוחה לדוגמה', '9012'];

  it('★★ שום ערך רגיש מהקובץ אינו מגיע לדוח', async () => {
    const report = await parse(TRANZILA_FILE);
    const serialized = JSON.stringify(report);
    for (const value of SENSITIVE) {
      expect(serialized, `"${value}" נשא הלאה`).not.toContain(value);
    }
  });

  it('★ גם לא שם העסק מהדוח של גמא', async () => {
    const serialized = JSON.stringify(await parse(buildGammaXlsx(GAMMA_ROWS)));
    expect(serialized).not.toContain('עסק לדוגמה');
  });

  it('★★ ואף מפתח של שדה ממוזער אינו קיים במבנה', async () => {
    const report = await parse(TRANZILA_FILE);
    const all = [...report.rows, ...declinedOf(report)];
    expect(all.length).toBeGreaterThan(0);
    for (const row of all) {
      for (const field of MINIMIZED_FIELD_NAMES) {
        expect(Object.keys(row), `${field} קיים בשורה`).not.toContain(field);
      }
    }
  });

  it('★★ והטיפוס עצמו אוסר — לא רק האדפטר', async () => {
    const report = await parse(TRANZILA_FILE);
    const base = report.rows[0];

    // ★★ זו ההוכחה, והיא בזמן **קומפילציה**: `?: never` פירושו שאפשר
    // להשמיט את השדה, ואי אפשר לתת לו ערך. כל שורת `@ts-expect-error` כאן
    // תיכשל ברגע שמישהו ירחיב את הטיפוס — כלומר השער נופל אם ההגנה מוסרת.
    // @ts-expect-error — ת.ז לא יכולה להיות מושמת על שורה.
    const withId: SettlementRow = { ...base, idNumber: '000000000' };
    // @ts-expect-error — וגם לא מספר כרטיס.
    const withCard: SettlementRow = { ...base, cardNumber: '458123XXXXXX9012' };
    // @ts-expect-error — וגם לא כתובת IP.
    const withIp: SettlementRow = { ...base, ipAddress: '203.0.113.7' };
    // @ts-expect-error — וגם לא שם בעל הכרטיס.
    const withName: SettlementRow = { ...base, holderName: 'לקוחה לדוגמה' };

    // הערכים נקראים כדי שהמשתנים לא יימחקו, והטענה עצמה נשארת על הטיפוס.
    expect([withId, withCard, withIp, withName]).toHaveLength(4);
  });
});
