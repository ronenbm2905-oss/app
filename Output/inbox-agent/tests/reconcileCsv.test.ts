// ============================================================================
// reconcileCsv.test.ts — הקובץ שנפתח באקסל, ו★★ המבחן ששומר על העותק.
//
// ---------------------------------------------------------------------------
// למה יש כאן מבחן שמשווה שתי פונקציות זהות
// ---------------------------------------------------------------------------
// `csvCell` קיימת פעמיים בריפו: המקור ב-`frozen/utils/accountantExport.ts`,
// והעותק ב-`shared/lib/reconcileCsv.ts`. הכפילות אינה רשלנות — ייבוא מ-
// `frozen/` מפיל את `check-no-model`, וההקפאה היא החלטה.
//
// אבל עותק בלי מבחן הוא עותק שיזחל: מישהו יתקן תו מסוכן בצד אחד, הקובץ השני
// יישאר מאחור, ואף אחד לא ישים לב עד שרו״ח יפתח קובץ עם נוסחה שרצה. המבחן
// הראשון כאן מריץ את שתיהן על אותה סוללת קלטים ודורש תוצאה **זהה**.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { csvCell as frozenCsvCell } from '../frozen/utils/accountantExport';
import { buildReconcileCsv, CSV_BOM, csvCell, reconcileFileName } from '../shared/lib/reconcileCsv';
import { reconcile } from '../shared/lib/reconcile';
import { groupBySettlement } from '../shared/lib/settlementGroup';
import { toAgorot, type SettlementReport, type SettlementRow } from '../shared/lib/settlement';

function row(rowIndex: number, date: string, shekels: number, reference: string | null = null, label: string | null = null): SettlementRow {
  return { rowIndex, date, amount: toAgorot(shekels), reference, label };
}

const tranzila: SettlementReport = {
  source: 'tranzila',
  rows: [
    row(1, '2026-08-02', 1000, 'REF-1'),
    row(2, '2026-08-05', 1200),
    row(3, '2026-08-09', 800),
    row(4, '2026-08-13', 1500),
    row(5, '2026-08-17', 2000),
    row(6, '2026-08-21', 950),
    row(7, '2026-08-25', 1000),
    row(8, '2026-08-28', 640, null, '=HYPERLINK("http://example.invalid")'),
  ],
  unreadableRows: [],
};

const gamma: SettlementReport = {
  source: 'gamma',
  rows: [
    row(1, '2026-08-03', 985, 'REF-1'),
    row(2, '2026-08-06', 1182),
    row(3, '2026-08-10', 788),
    row(4, '2026-08-14', 1477.5),
    row(5, '2026-08-18', 1970),
    row(6, '2026-08-22', 935.75),
    row(7, '2026-08-26', 960),
    row(9, '2026-09-04', 410),
  ],
  unreadableRows: [],
};

const result = reconcile(tranzila, gamma);
const csv = buildReconcileCsv(result);

// ---------------------------------------------------------------------------

describe('★★ העותק של csvCell לא זחל', () => {
  const inputs = [
    'טקסט רגיל',
    '=SUM(A1:A9)',
    '+1',
    '-5',
    '@here',
    '\tטאב',
    'עם "מרכאות" בפנים',
    'שורה\nחדשה',
    'שורה\r\nעם CRLF',
    '',
    null,
    undefined,
    0,
    -12.5,
  ];

  it('שתי המימושים מחזירים בדיוק אותו דבר, על כל קלט', () => {
    for (const input of inputs) {
      expect(csvCell(input), `נבדל על ${JSON.stringify(input)}`).toBe(frozenCsvCell(input));
    }
  });
});

describe('מה שאקסל דורש', () => {
  it('★ BOM אחד בלבד, ובתחילת הקובץ', () => {
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv.split(CSV_BOM)).toHaveLength(2);
  });

  it('שורות מסתיימות ב-CRLF', () => {
    expect(csv).toContain('\r\n');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('★ נוסחה מנוטרלת בגרש מוביל — הקובץ הזה הולך לרו״ח', () => {
    expect(csv).toContain('"\'=HYPERLINK');
    // וגם: התא לא נשבר לשתי עמודות בגלל התוכן.
    expect(csv).not.toContain('\n=HYPERLINK');
  });

  it('כותרות בעברית, ועם שמות הדוחות בתוכן', () => {
    const header = csv.slice(CSV_BOM.length).split('\r\n')[0];
    expect(header).toContain('הדוח מטרנזילה');
    expect(header).toContain('הדוח מגמא');
    expect(header).toContain('הפרש בסכום');
  });
});

describe('★ הסדר בקובץ = הסדר על המסך', () => {
  it('קודם מה שלא התאים, אחר כך פער חריג, ורק בסוף התאמות', () => {
    const body = csv.slice(CSV_BOM.length);
    const unmatchedAt = body.indexOf('לא הצלחתי להתאים');
    const unusualAt = body.indexOf('התאמה עם פער חריג');
    const matchedAt = body.indexOf('"התאמה"');

    expect(unmatchedAt).toBeGreaterThan(-1);
    expect(unusualAt).toBeGreaterThan(-1);
    expect(matchedAt).toBeGreaterThan(-1);
    expect(unmatchedAt).toBeLessThan(unusualAt);
    expect(unusualAt).toBeLessThan(matchedAt);
  });

  it('כל עסקה בקובץ מופיעה בדיוק פעם אחת', () => {
    const lines = csv.slice(CSV_BOM.length).trim().split('\r\n');
    // כותרת + 6 התאמות רגילות + 1 חריגה + 2 חד-צדדיות.
    expect(lines).toHaveLength(1 + result.matched.length + result.onlyInA.length + result.onlyInB.length);
  });

  it('שם הקובץ נושא את התקופה, כדי ששתי הורדות לא ידרסו זו את זו', () => {
    expect(reconcileFileName('אוגוסט 2026')).toBe('השוואת דוחות אוגוסט 2026.csv');
  });
});

// ---------------------------------------------------------------------------
// ★★ שתי הקבוצות החדשות בקובץ
// ---------------------------------------------------------------------------
// הרו״ח מקבל את הקובץ, לא את המסך. אם ההבחנה בין "לא עברה" ל"חסרה" קיימת
// רק במסך — היא תיעלם בדיוק במקום שבו מקבלים לפיה החלטות.

describe('★★ עסקה שנדחתה, בקובץ', () => {
  const withDeclined = reconcile(
    {
      source: 'tranzila',
      rows: [row(1, '2026-08-02', 1000, 'REF-1')],
      unreadableRows: [],
      declinedRows: [
        {
          rowIndex: 5,
          date: '2026-08-19',
          amount: 61_200,
          reference: null,
          reasonHe: '303 - אין הרשאת סולק לעסקה כשהכרטיס לא נוכח',
        },
      ],
    },
    {
      source: 'gamma',
      rows: [row(1, '2026-08-03', 1000, 'REF-1')],
      unreadableRows: [],
      declinedRows: [],
    },
  );
  const text = buildReconcileCsv(withDeclined);

  it('יש לה קבוצה משלה, ולא "לא הצלחתי להתאים"', () => {
    expect(text).toContain('"עסקה שלא עברה"');
  });

  it('★★ והניסוח בקובץ הוא אותו ניסוח שבמסך', () => {
    expect(text).toContain('העסקה לא עברה — 303 - אין הרשאת סולק לעסקה כשהכרטיס לא נוכח');
  });

  it('★ והיא אינה נספרת כחסרה', () => {
    expect(withDeclined.onlyInA).toHaveLength(0);
    expect(text).not.toContain('מופיע רק ב');
  });
});

describe('★★ קבוצה שלא תאמה — שורות המקור שלה בקובץ', () => {
  const a = groupBySettlement({
    source: 'tranzila',
    rows: [row(2, '2026-08-04', 310, '90000001'), row(3, '2026-08-05', 420, '90000001')],
    unreadableRows: [],
    declinedRows: [],
  });
  const b: SettlementReport = { source: 'gamma', rows: [], unreadableRows: [], declinedRows: [] };
  const text = buildReconcileCsv(reconcile(a, b));

  it('הקבוצה עצמה מופיעה בסכום המצטבר', () => {
    expect(text).toContain('730.00 ₪');
  });

  it('★★ ומתחתיה שתי העסקאות שמרכיבות אותה', () => {
    // הסכום המצטבר לבדו הוא מספר שאי אפשר לבדוק. שתי העסקאות שמרכיבות
    // אותו הן מספרים שאפשר ללכת איתם לקובץ המקורי ולמצוא.
    expect(text).toContain('310.00 ₪');
    expect(text).toContain('420.00 ₪');
    expect(text).toContain('עסקה בתוך אותו שידור');
  });
});

// ---------------------------------------------------------------------------
// ★★ H4 — מבחן דליפה על **הקובץ שיוצא**
// ---------------------------------------------------------------------------
// עדי: *"הקובץ שיורד הוא הדבר היחיד שיוצא מהדפדפן ומגיע לצד שלישי (רואה
// החשבון), ואין עליו אף מבחן דליפה."* הוא יעבור מיד — הפלט מינימלי ממילא —
// **וזו בדיוק הסיבה שהוא זול, ובדיוק הסיבה שהוא יתפוס את היום שבו מישהו
// יוסיף עמודה "כדי שיהיה קל למצוא".**
//
// ★ והוא רץ על המסלול המלא: קובץ xlsx אמיתי (מסונתז) → אדפטר → קיבוץ →
// מנוע → CSV. מבחן שבונה `SettlementRow` ביד לא היה יכול לתפוס דליפה, כי
// הערך הרגיש לא היה נכנס אליו מלכתחילה.

describe('★★ שום ערך רגיש אינו מגיע לקובץ שמורידים', () => {
  it('הקובץ נבנה מהמסלול המלא, ואין בו אף אחד מהם', async () => {
    const { readSheetGrid } = await import('../shared/lib/xlsx');
    const { detectAdapter } = await import('../shared/lib/reportAdapters');
    const { groupBySettlement } = await import('../shared/lib/settlementGroup');
    const { buildTranzilaXlsx, buildGammaXlsx, nodeInflateRaw } = await import(
      './fixtures/xlsxBuilder'
    );

    const read = async (bytes: Uint8Array) => {
      const grid = await readSheetGrid(bytes, nodeInflateRaw);
      const adapter = detectAdapter(grid);
      if (adapter === null) throw new Error('לא זוהה');
      return groupBySettlement(adapter.parse(grid));
    };

    const tranzila = await read(
      buildTranzilaXlsx([
        { date: '2026-08-04', hours: 9.25, shekels: 310, settlement: '90000001' },
        { date: '2026-08-04', hours: 18.75, shekels: 420, settlement: '90000001' },
        {
          date: '2026-08-19',
          hours: 20.5,
          shekels: 612,
          settlement: '',
          approval: '0000000',
          status: '303 - אין הרשאת סולק לעסקה כשהכרטיס לא נוכח',
        },
      ]),
    );
    const gamma = await read(
      buildGammaXlsx([{ date: '2026-08-06', shekels: 730, settlement: '90000001' }]),
    );

    const csv = buildReconcileCsv(reconcile(tranzila, gamma));

    // ★ הערכים האלה **קיימים בקובץ שנקרא**, בעמודות שהאדפטר לא נושא הלאה.
    //   הקובץ נפרס במלואו לזיכרון — ולכן "לא נקרא" אינו טענה שאפשר לבדוק,
    //   ו"לא יצא" כן.
    for (const value of [
      '000000000',
      '458123XXXXXX9012',
      '203.0.113.7',
      'לקוחה לדוגמה',
      'עסק לדוגמה',
      '9012',
    ]) {
      expect(csv, `"${value}" הגיע לקובץ שמורידים`).not.toContain(value);
    }
  });

  it('★ ומה שכן בקובץ הוא מה שרואה החשבון צריך', async () => {
    // בקרה חיובית: מבחן דליפה שעובר על קובץ ריק אינו מבחן.
    expect(csv).toContain('התאמה');
    expect(csv).toContain('₪');
  });
});
