// ============================================================================
// settlementGroup.test.ts — ★★ הקיבוץ לפי מספר שידור, ומה שהוא פותר.
//
// ---------------------------------------------------------------------------
// למה זה המבחן שקובע אם הכלי עובד
// ---------------------------------------------------------------------------
// טרנזילה נותנת שורה לעסקה, וגמא נותנת שורה ל(שידור × מותג). שני המבנים לא
// מתיישרים: שידור אחד יכול להיות שתי עסקאות מול **שורה אחת**, ושידור אחר
// אותן שתי עסקאות מול **שתי שורות**. בלי קיבוץ, ההשוואה מדווחת פערים על
// עסקאות שהכול בסדר איתן — כלומר מייצרת בדיוק את הרעש שהכלי נועד למנוע.
//
// שני המקרים האלה נמדדו בקבצים האמיתיים, ושניהם נבדקים כאן.
//
// ⛔ הנתונים מסונתזים. המבנה הוא מה שנלקח מהמדידה, לא המספרים.
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  groupBySettlement,
  isGrouped,
  membersOf,
} from '../shared/lib/settlementGroup';
import { reconcile } from '../shared/lib/reconcile';
import {
  sumAgorot,
  toAgorot,
  type SettlementReport,
  type SettlementRow,
} from '../shared/lib/settlement';

function row(
  rowIndex: number,
  date: string,
  shekels: number,
  reference: string | null,
): SettlementRow {
  return { rowIndex, date, amount: toAgorot(shekels), reference, label: null };
}

function report(source: 'tranzila' | 'gamma', rows: SettlementRow[]): SettlementReport {
  return { source, rows, unreadableRows: [], declinedRows: [] };
}

// ★ בדיוק המבנה שנמדד, במספרים מומצאים.
const TRANZILA = report('tranzila', [
  row(2, '2026-08-04', 310, '90000001'),
  row(3, '2026-08-05', 420, '90000001'),
  row(4, '2026-08-11', 85, '90000002'),
  row(5, '2026-08-11', 265, '90000002'),
]);

const GAMMA = report('gamma', [
  // שידור אחד = שורה אחת מצטברת.
  row(2, '2026-08-06', 730, '90000001'),
  // ושידור אחר = שתי שורות, לפי מותג.
  row(3, '2026-08-13', 85, '90000002'),
  row(4, '2026-08-13', 265, '90000002'),
]);

// ---------------------------------------------------------------------------

describe('★★ שתי עסקאות מול שורה אחת', () => {
  const grouped = groupBySettlement(TRANZILA);

  it('הופכות לשורה אחת, בסכום המצטבר', () => {
    const one = grouped.rows.find((r) => r.reference === '90000001');
    expect(one?.amount).toBe(73_000);
  });

  it('★ התאריך של הקבוצה הוא המוקדם שבה', () => {
    // ★ המוקדם ולא האחרון: זה התאריך שבו העסקה הראשונה באמת קרתה, והוא זה
    //   שצריך לעמוד מול חלון הסבילות של המנוע מול תאריך השידור בגמא.
    const one = grouped.rows.find((r) => r.reference === '90000001');
    expect(one?.date).toBe('2026-08-04');
  });

  it('★★ ושורות המקור נשמרות, כדי שאפשר יהיה לפרט קבוצה שלא תאמה', () => {
    const one = grouped.rows.find((r) => r.reference === '90000001');
    expect(one && isGrouped(one)).toBe(true);
    expect(membersOf(one!).map((m) => m.amount)).toEqual([31_000, 42_000]);
    // ומה שהיא רואה מיד: שהמספר שלמעלה אינו עסקה אחת.
    expect(one?.label).toBe('2 עסקאות באותו שידור');
  });

  it('הסכום הכולל לא משתנה מהקיבוץ', () => {
    expect(sumAgorot(grouped.rows)).toBe(sumAgorot(TRANZILA.rows));
  });
});

// ---------------------------------------------------------------------------

describe('★★ שתי עסקאות מול שתי שורות — המקרה שנראה פשוט ואינו', () => {
  it('שני הצדדים מתקבצים לשורה אחת כל אחד, ומתאימים', () => {
    // ★ בלי הקיבוץ, שתי שורות מול שתי שורות **באותו סכום** היו יוצאות
    //   "לא ברור" — כי אין דרך לדעת איזו מול איזו. הקיבוץ מוחק את השאלה:
    //   הגרעין הוא השידור, ושם יש אחד מול אחד.
    const a = groupBySettlement(report('tranzila', TRANZILA.rows.slice(2)));
    const b = groupBySettlement(report('gamma', GAMMA.rows.slice(1)));

    expect(a.rows).toHaveLength(1);
    expect(b.rows).toHaveLength(1);
    expect(a.rows[0].amount).toBe(35_000);
    expect(b.rows[0].amount).toBe(35_000);

    const result = reconcile(a, b);
    expect(result.matched).toHaveLength(1);
    expect(result.ambiguous).toHaveLength(0);
    expect(result.matched[0].amountDelta).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe('★★ הקיבוץ על שני הצדדים — התמונה המלאה', () => {
  const result = reconcile(groupBySettlement(TRANZILA), groupBySettlement(GAMMA));

  it('כל שידור מוצא את המקבילה שלו, בלי פער', () => {
    expect(result.matched).toHaveLength(2);
    expect(result.onlyInA).toHaveLength(0);
    expect(result.onlyInB).toHaveLength(0);
    expect(result.ambiguous).toHaveLength(0);
    expect(result.totals.sumDelta).toBe(0);
  });

  it('★★ וההתאמה היא לפי האסמכתא — כלומר לפי מספר השידור', () => {
    for (const pair of result.matched) {
      expect(pair.matchedBy).toBe('reference');
      expect(pair.amountDelta).toBe(0);
      expect(pair.deltaIsUnusual).toBe(false);
    }
  });

  it('★ ובלי מיפוי מותגים בכלל — הוא לא נדרש כדי להגיע לאפס', () => {
    // שמות המותגים שונים בין שני הקבצים, ומיפוי ביניהם הוא ניחוש. כאן הוא
    // גם מיותר: הקיבוץ לפי שידור בלבד נותן התאמה מלאה.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('מותג');
  });

  it('"הכול מצא את מה שמתאים לו" — הממצא שסוגר את המסך', () => {
    expect(result.findings.some((f) => f.code === 'allMatched')).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('מה שהקיבוץ **לא** עושה', () => {
  it('★★ שורות בלי מספר שידור אינן מתאחדות זו עם זו', () => {
    // אין להן מפתח משותף. איחוד שלהן היה המצאת קבוצה שלא קיימת בשום קובץ,
    // וסכום שאין לו מקור בקובץ הוא בדיוק מה שהיא לא תוכל לאמת.
    const grouped = groupBySettlement(
      report('tranzila', [row(2, '2026-08-01', 10, null), row(3, '2026-08-01', 20, null)]),
    );
    expect(grouped.rows).toHaveLength(2);
    expect(grouped.rows.map((r) => r.amount)).toEqual([1000, 2000]);
  });

  it('★ ואינו מסיר אפסים מובילים מהמפתח', () => {
    // "090000001" ו-"90000001" אולי אותו שידור ואולי שניים. אנחנו לא
    // מנחשים על פורמט — אותו כלל בדיוק כמו במנוע.
    const grouped = groupBySettlement(
      report('tranzila', [row(2, '2026-08-01', 10, '090000001'), row(3, '2026-08-01', 20, '90000001')]),
    );
    expect(grouped.rows).toHaveLength(2);
  });

  it('רווחים מיותרים כן מנורמלים', () => {
    const grouped = groupBySettlement(
      report('tranzila', [row(2, '2026-08-01', 10, ' 777 '), row(3, '2026-08-01', 20, '777')]),
    );
    expect(grouped.rows).toHaveLength(1);
    expect(grouped.rows[0].amount).toBe(3000);
  });

  it('★ שורות שלא נקראו ועסקאות שנדחו עוברות דרכו כמות שהן', () => {
    const source: SettlementReport = {
      source: 'tranzila',
      rows: [row(2, '2026-08-01', 10, 'A')],
      unreadableRows: [{ rowIndex: 9, reasonHe: 'לא הצלחתי לקרוא את הסכום בשורה הזאת.' }],
      declinedRows: [
        { rowIndex: 7, date: '2026-08-03', amount: 500, reference: null, reasonHe: '303 - סירוב' },
      ],
    };
    const grouped = groupBySettlement(source);
    expect(grouped.unreadableRows).toHaveLength(1);
    expect(grouped.declinedRows).toHaveLength(1);
  });

  it('★★ דטרמיניזם: אותו קלט בסדר אחר → אותו פלט בדיוק', () => {
    const forward = groupBySettlement(TRANZILA);
    const backward = groupBySettlement(report('tranzila', [...TRANZILA.rows].reverse()));
    expect(JSON.stringify(backward)).toBe(JSON.stringify(forward));
  });
});
