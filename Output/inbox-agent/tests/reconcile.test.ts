// ============================================================================
// reconcile.test.ts — ★★ המנוע. הלב של הפיצ׳ר, ולכן רוב המבחנים כאן.
//
// ---------------------------------------------------------------------------
// ★ כל הנתונים כאן **מסונתזים**, והריפו ציבורי
// ---------------------------------------------------------------------------
// אין כאן שם של לקוחה, אין ספרת כרטיס אשראי, ואין ח.פ. אמיתי. האסמכתאות הן
// מחרוזות שהומצאו, והסכומים עגולים. זה לא ניקיון — זה תנאי: קובץ מבחן הוא
// המקום הכי קל בעולם לשכוח בו נתון אמיתי, והוא גם המקום שאיש לא חוזר לקרוא.
//
// ---------------------------------------------------------------------------
// מה נבדק כאן, ולמה דווקא זה
// ---------------------------------------------------------------------------
// שלוש טענות שאם אחת מהן תישבר הכלי יזיק במקום לעזור:
//   1. **אסמכתא גוברת** על תאריך+סכום, וגם כשהתאריכים רחוקים.
//   2. **ריבוי מועמדות אינו בחירה** — הוא יוצא כ"לא ברור", תמיד.
//   3. **פער עמלה עקבי אינו שגיאה** — הוא ממצא אחד, ולא 60 שורות אדומות.
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  emptyReport,
  formatAgorot,
  daysBetween,
  filterByPeriod,
  monthPeriod,
  previousMonthKey,
  sumAgorot,
  toAgorot,
  type SettlementReport,
  type SettlementRow,
  type SettlementSource,
} from '../shared/lib/settlement';
import { reconcile } from '../shared/lib/reconcile';

// ---------------------------------------------------------------------------
// עזרי בנייה — סכומים בשקלים בקריאה, אגורות בפנים.
// ---------------------------------------------------------------------------

function row(
  rowIndex: number,
  date: string,
  shekels: number,
  reference: string | null = null,
  label: string | null = null,
): SettlementRow {
  return { rowIndex, date, amount: toAgorot(shekels), reference, label };
}

function report(
  source: SettlementSource,
  rows: SettlementRow[],
  unreadableRows: { rowIndex: number; reasonHe: string }[] = [],
): SettlementReport {
  return { source, rows, unreadableRows };
}

const A = (rows: SettlementRow[], unreadable: { rowIndex: number; reasonHe: string }[] = []) =>
  report('tranzila', rows, unreadable);
const B = (rows: SettlementRow[], unreadable: { rowIndex: number; reasonHe: string }[] = []) =>
  report('gamma', rows, unreadable);

// ---------------------------------------------------------------------------

describe('★ כסף — אגורות כמספר שלם', () => {
  it('המרה משקלים מעגלת ולא קוצצת', () => {
    expect(toAgorot(12.34)).toBe(1234);
    expect(toAgorot(0.1 + 0.2)).toBe(30);
    expect(toAgorot(-45.5)).toBe(-4550);
  });

  it('★ חיבור של אגורות מדויק — זה כל הטעם', () => {
    const rows = [row(1, '2026-08-01', 0.1), row(2, '2026-08-01', 0.2)];
    expect(sumAgorot(rows)).toBe(30);
  });

  it('תצוגה: אלפים מופרדים, אגורות תמיד שתי ספרות, מינוס נשמר', () => {
    expect(formatAgorot(123456)).toBe('1,234.56 ₪');
    expect(formatAgorot(5)).toBe('0.05 ₪');
    expect(formatAgorot(-4550)).toBe('-45.50 ₪');
  });
});

describe('תאריכים', () => {
  it('הפרש ימים, בלי אזור זמן ובלי שעון קיץ', () => {
    expect(daysBetween('2026-08-01', '2026-08-04')).toBe(3);
    expect(daysBetween('2026-08-04', '2026-08-01')).toBe(-3);
    // סוף מרץ — המעבר לשעון קיץ בישראל. חישוב מקומי היה נותן כאן 0 או 2.
    expect(daysBetween('2026-03-26', '2026-03-28')).toBe(2);
  });

  it('החודש שעבר, כולל מעבר שנה', () => {
    expect(previousMonthKey('2026-09-29')).toBe('2026-08');
    expect(previousMonthKey('2026-01-03')).toBe('2025-12');
  });

  it('חודש שלם כולל היום האחרון בו', () => {
    expect(monthPeriod('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthPeriod('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(monthPeriod('2026-08')).toEqual({ from: '2026-08-01', to: '2026-08-31' });
  });

  it('★ סינון לתקופה משאיר את השורות שלא נקראו — אין להן תאריך להישפט לפיו', () => {
    const source = A(
      [row(1, '2026-07-31', 10), row(2, '2026-08-15', 20), row(3, '2026-09-01', 30)],
      [{ rowIndex: 9, reasonHe: 'לא הצלחתי לקרוא את הסכום' }],
    );
    const filtered = filterByPeriod(source, monthPeriod('2026-08'));
    expect(filtered.rows.map((r) => r.rowIndex)).toEqual([2]);
    expect(filtered.unreadableRows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------

describe('★★ שלב א׳ — התאמה לפי אסמכתא', () => {
  it('אסמכתא גוברת על תאריך+סכום, וגם כשהתאריכים רחוקים', () => {
    const a = A([row(1, '2026-08-01', 100, 'ABC-1')]);
    const b = B([
      // אותה אסמכתא, אבל שמונה ימים אחר כך — מחוץ לחלון התאריכים.
      row(1, '2026-08-09', 100, 'ABC-1'),
      // ומולה שורה שהיא התאמה מושלמת של תאריך וסכום, עם אסמכתא אחרת.
      row(2, '2026-08-01', 100, 'ZZZ-9'),
    ]);

    const result = reconcile(a, b);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].matchedBy).toBe('reference');
    expect(result.matched[0].b.rowIndex).toBe(1);
    expect(result.matched[0].dayDelta).toBe(8);
    expect(result.onlyInB.map((r) => r.rowIndex)).toEqual([2]);
  });

  it('רווחים ואותיות גדולות/קטנות אינם הבדל', () => {
    const result = reconcile(A([row(1, '2026-08-01', 100, ' abc-1 ')]), B([row(1, '2026-08-01', 100, 'ABC-1')]));
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].matchedBy).toBe('reference');
  });

  it('אסמכתא ריקה אינה אסמכתא', () => {
    const result = reconcile(A([row(1, '2026-08-01', 100, '   ')]), B([row(1, '2026-08-01', 100, '')]));
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].matchedBy).toBe('dateAmount');
  });

  it('★ אסמכתא כפולה אינה מזהה — היא יוצאת ל"לא ברור" ולא מצורפת לפי סדר', () => {
    const a = A([row(1, '2026-08-01', 100, 'DUP')]);
    const b = B([row(1, '2026-08-01', 100, 'DUP'), row(2, '2026-08-02', 100, 'DUP')]);

    const result = reconcile(a, b);
    expect(result.matched).toHaveLength(0);
    expect(result.ambiguous).toHaveLength(1);
    expect(result.ambiguous[0].candidates).toHaveLength(2);
    expect(result.ambiguous[0].reasonHe).toContain('DUP');
    expect(result.findings.map((f) => f.code)).toContain('duplicateReference');
  });
});

// ---------------------------------------------------------------------------

describe('★★ שלב ב׳ — תאריך וסכום, וחוק "לא בוחרים"', () => {
  it('התאמה פשוטה בתוך חלון התאריכים', () => {
    const result = reconcile(A([row(1, '2026-08-01', 100)]), B([row(1, '2026-08-04', 100)]));
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].matchedBy).toBe('dateAmount');
    expect(result.matched[0].dayDelta).toBe(3);
    expect(result.matched[0].amountDelta).toBe(0);
  });

  it('★ מעבר לחלון — אין התאמה, ושתי השורות מדווחות כל אחת בצד שלה', () => {
    const result = reconcile(A([row(1, '2026-08-01', 100)]), B([row(1, '2026-08-05', 100)]));
    expect(result.matched).toHaveLength(0);
    expect(result.onlyInA).toHaveLength(1);
    expect(result.onlyInB).toHaveLength(1);
  });

  it('חלון רחב יותר לפי בקשה', () => {
    const result = reconcile(A([row(1, '2026-08-01', 100)]), B([row(1, '2026-08-10', 100)]), {
      dateToleranceDays: 14,
    });
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].dayDelta).toBe(9);
  });

  it('★★ שתי מועמדות — לא בוחרים. גם לא את הקרובה יותר.', () => {
    const a = A([row(1, '2026-08-01', 50)]);
    const b = B([row(1, '2026-08-01', 50), row(2, '2026-08-02', 50)]);

    const result = reconcile(a, b);
    expect(result.matched).toHaveLength(0);
    expect(result.ambiguous).toHaveLength(1);
    expect(result.ambiguous[0].row.rowIndex).toBe(1);
    expect(result.ambiguous[0].candidates.map((c) => c.row.rowIndex)).toEqual([1, 2]);
    // ★ והשורות שהיו מועמדות אינן מדווחות שוב כ"קיים רק בצד אחד" — אחרת
    // אותה עסקה הייתה מופיעה פעמיים ונספרת פעמיים.
    expect(result.onlyInA).toHaveLength(0);
    expect(result.onlyInB).toHaveLength(0);
  });

  it('★ סכום זהה בדיוק קודם לסכום קרוב', () => {
    // b1 זהה בדיוק, b2 קרוב. בלי העדפה לוודאי — שניהם היו מועמדים, והשורה
    // הייתה יוצאת "לא ברור" למרות שיש התאמה מושלמת.
    const a = A([row(1, '2026-08-01', 100)]);
    const b = B([row(1, '2026-08-01', 100), row(2, '2026-08-01', 99)]);

    const result = reconcile(a, b);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].b.rowIndex).toBe(1);
    expect(result.onlyInB.map((r) => r.rowIndex)).toEqual([2]);
  });

  it('★★ זיכוי אינו מתאים לחיוב, גם כשהסכום והתאריך זהים', () => {
    const result = reconcile(A([row(1, '2026-08-01', -100)]), B([row(1, '2026-08-01', 100)]));
    expect(result.matched).toHaveLength(0);
    expect(result.onlyInA[0].amount).toBe(-10000);
    expect(result.onlyInB[0].amount).toBe(10000);
  });

  it('זיכוי מול זיכוי — מתאים כרגיל', () => {
    const result = reconcile(A([row(1, '2026-08-01', -100)]), B([row(1, '2026-08-02', -100)]));
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].a.amount).toBe(-10000);
  });

  it('★ שתי שורות זהות מול שתי שורות זהות — אין תשובה נכונה, ולכן אין בחירה', () => {
    const a = A([row(1, '2026-08-01', 70), row(2, '2026-08-01', 70)]);
    const b = B([row(1, '2026-08-01', 70), row(2, '2026-08-01', 70)]);

    const result = reconcile(a, b);
    expect(result.matched).toHaveLength(0);
    expect(result.ambiguous).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------

describe('★★ פער עמלה עקבי — ממצא אחד, לא 60 שגיאות', () => {
  /** שמונה עסקאות, בכולן הצד השני נמוך באחוז וחצי. */
  function feeReports() {
    const amounts = [1000, 1200, 800, 1500, 2000, 950, 1100, 1750];
    const aRows = amounts.map((amount, i) => row(i + 1, `2026-08-${String(i * 3 + 1).padStart(2, '0')}`, amount));
    const bRows = amounts.map((amount, i) =>
      row(i + 1, `2026-08-${String(i * 3 + 2).padStart(2, '0')}`, amount * 0.985),
    );
    return { a: A(aRows), b: B(bRows) };
  }

  it('כל השורות מתאימות למרות שהסכומים שונים', () => {
    const { a, b } = feeReports();
    const result = reconcile(a, b);
    expect(result.matched).toHaveLength(8);
    expect(result.onlyInA).toHaveLength(0);
    expect(result.onlyInB).toHaveLength(0);
  });

  it('★★ הדפוס מזוהה כעמלה, והוא ממצא אחד ברמת "מידע"', () => {
    const { a, b } = feeReports();
    const result = reconcile(a, b);

    expect(result.feePattern).not.toBeNull();
    expect(result.feePattern?.percent).toBeCloseTo(1.5, 5);
    expect(result.feePattern?.matchCount).toBe(8);

    const fee = result.findings.filter((f) => f.code === 'consistentFeePattern');
    expect(fee).toHaveLength(1);
    expect(fee[0].severity).toBe('info');
    expect(fee[0].messageHe).toContain('עמלת סליקה');
  });

  it('★★ ואף שורה מהן אינה מסומנת כחריגה', () => {
    const { a, b } = feeReports();
    const result = reconcile(a, b);
    expect(result.matched.filter((m) => m.deltaIsUnusual)).toHaveLength(0);
    expect(result.findings.map((f) => f.code)).not.toContain('unusualDelta');
  });

  it('★★ אבל שורה שחורגת מהדפוס — כן, והיא היחידה', () => {
    const { a, b } = feeReports();
    // שורה תשיעית: פער של 4% במקום אחוז וחצי.
    const a9 = A([...a.rows, row(9, '2026-08-28', 1000)]);
    const b9 = B([...b.rows, row(9, '2026-08-29', 960)]);

    const result = reconcile(a9, b9);
    const unusual = result.matched.filter((m) => m.deltaIsUnusual);
    expect(unusual).toHaveLength(1);
    expect(unusual[0].a.rowIndex).toBe(9);

    const finding = result.findings.find((f) => f.code === 'unusualDelta');
    expect(finding?.severity).toBe('warn');
    expect(finding?.count).toBe(1);
  });

  it('מדגם קטן אינו דפוס', () => {
    const a = A([row(1, '2026-08-01', 1000), row(2, '2026-08-10', 2000)]);
    const b = B([row(1, '2026-08-01', 985), row(2, '2026-08-10', 1970)]);
    expect(reconcile(a, b).feePattern).toBeNull();
  });

  it('חציון הפערים מדווח גם כשאין דפוס', () => {
    const a = A([row(1, '2026-08-01', 100)]);
    const b = B([row(1, '2026-08-01', 99)]);
    expect(reconcile(a, b).medianDeltaAgorot).toBe(100);
  });

  it('אין התאמות — אין חציון ואין דפוס, ולא אפס מטעה', () => {
    const result = reconcile(A([]), B([]));
    expect(result.medianDeltaAgorot).toBeNull();
    expect(result.feePattern).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('מצבי קצה של הדוחות עצמם', () => {
  it('שני דוחות ריקים — נאמר במפורש, ולא מסך ריק', () => {
    const result = reconcile(emptyReport('tranzila'), emptyReport('gamma'));
    expect(result.totals).toEqual({ countA: 0, countB: 0, sumA: 0, sumB: 0, sumDelta: 0 });
    expect(result.findings.map((f) => f.code)).toContain('bothEmpty');
  });

  it('דוח אחד ריק — הממצא מזכיר את הדוח בשמו בעברית', () => {
    const result = reconcile(A([]), B([row(1, '2026-08-01', 100)]));
    const finding = result.findings.find((f) => f.code === 'emptyReport');
    // ★ הצורה הנטולה, כי ההודעה משרשרת תחילית: "בדוח טרנזילה", ולא
    //   "בהדוח מטרנזילה". ראו `SOURCE_HE_BARE`.
    expect(finding?.messageHe).toContain('בדוח טרנזילה');
  });

  it('★★ דוח שכולו לא נקרא הוא ממצא חוסם — אחרת נציג רשימה של צד אחד כהשוואה', () => {
    const unreadable = [1, 2, 3].map((rowIndex) => ({ rowIndex, reasonHe: 'לא הצלחתי לקרוא את השורה' }));
    const result = reconcile(A([row(1, '2026-08-01', 100)]), B([], unreadable));

    const finding = result.findings.find((f) => f.code === 'allUnreadable');
    expect(finding?.severity).toBe('block');
    expect(finding?.count).toBe(3);
    expect(finding?.messageHe).toContain('בדוח גמא');
  });

  it('★ שורות בודדות שלא נקראו — מדווחות, ונאמר שהסכום אינו כולל אותן', () => {
    const result = reconcile(
      A([row(1, '2026-08-01', 100)], [{ rowIndex: 7, reasonHe: 'לא הצלחתי לקרוא את הסכום' }]),
      B([row(1, '2026-08-01', 100)]),
    );
    const finding = result.findings.find((f) => f.code === 'unreadableRows');
    expect(finding?.severity).toBe('warn');
    expect(finding?.messageHe).toContain('לא כוללים אותן');
  });

  it('הכול התאים — נאמר, כדי שהשקט לא ייראה כמו תקלה', () => {
    const result = reconcile(A([row(1, '2026-08-01', 100)]), B([row(1, '2026-08-01', 100)]));
    expect(result.findings.map((f) => f.code)).toContain('allMatched');
  });

  it('הסיכומים נספרים על הדוח המלא, ומדווח ההפרש', () => {
    const a = A([row(1, '2026-08-01', 100), row(2, '2026-08-02', 50)]);
    const b = B([row(1, '2026-08-01', 100)]);
    const result = reconcile(a, b);
    expect(result.totals.sumA).toBe(15000);
    expect(result.totals.sumB).toBe(10000);
    expect(result.totals.sumDelta).toBe(5000);
    expect(result.totals.countA).toBe(2);
  });
});

// ---------------------------------------------------------------------------

describe('★★ דטרמיניזם', () => {
  /** תערובת: התאמת אסמכתא, התאמת תאריך+סכום, פער עמלה, ריבוי מועמדות, וחד-צדדיות. */
  function messy() {
    const a = A([
      row(3, '2026-08-05', 250, 'REF-3', 'שלישית'),
      row(1, '2026-08-01', 100, 'REF-1', 'ראשונה'),
      row(5, '2026-08-11', 60),
      row(2, '2026-08-03', 175.4),
      row(4, '2026-08-07', 60),
      row(6, '2026-08-20', -80, null, 'זיכוי'),
    ]);
    const b = B([
      row(2, '2026-08-04', 172.75),
      row(5, '2026-08-12', 60),
      row(1, '2026-08-02', 100, 'REF-1'),
      row(4, '2026-08-08', 60),
      row(7, '2026-08-25', 999),
      row(6, '2026-08-21', -80),
    ]);
    return { a, b };
  }

  it('אותו קלט פעמיים — אותו פלט בדיוק, כולל הסדר', () => {
    const { a, b } = messy();
    expect(JSON.stringify(reconcile(a, b))).toBe(JSON.stringify(reconcile(a, b)));
  });

  it('★ וגם כשסדר השורות בקלט מתהפך — הפלט זהה', () => {
    const { a, b } = messy();
    const flipped = reconcile(
      A([...a.rows].reverse()),
      B([...b.rows].reverse()),
    );
    expect(JSON.stringify(flipped)).toBe(JSON.stringify(reconcile(a, b)));
  });

  it('הרשימות ממוינות בסדר קנוני — תאריך, סכום, ואז מיקום בקובץ', () => {
    const a = A([row(3, '2026-08-09', 10), row(1, '2026-08-02', 30), row(2, '2026-08-02', 20)]);
    const result = reconcile(a, B([]));
    expect(result.onlyInA.map((r) => r.rowIndex)).toEqual([2, 1, 3]);
  });
});
