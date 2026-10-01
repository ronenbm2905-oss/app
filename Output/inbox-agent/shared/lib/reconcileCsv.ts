// ============================================================================
// reconcileCsv.ts — הורדת תוצאת ההשוואה כקובץ שנפתח נכון באקסל.
//
// ---------------------------------------------------------------------------
// ★★ למה `csvCell` כתוב כאן שוב, ולא מיובא
// ---------------------------------------------------------------------------
// התבנית המקורית יושבת ב-`frozen/utils/accountantExport.ts`. ייבוא ממנה היה
// הדבר הנכון — אלמלא ש-`scripts/check-no-model.mjs` מפיל את הבנייה על כל
// קובץ מ-`frozen/` שנכנס לגרף. ההקפאה היא החלטה, לא שכחה, ופתיחת חריג בה
// עבור שורה אחת הייתה עולה יותר ממה שהיא חוסכת.
//
// ★ ולכן העותק אינו נשאר בלי שמירה: `tests/reconcileCsv.test.ts` מריץ את שתי
// המימושים על אותם קלטים ודורש תוצאה זהה. עותק בלי מבחן כזה הוא עותק
// שיזחל; עם המבחן, הזחילה נופלת ב-CI.
//
// ---------------------------------------------------------------------------
// שלושת הדברים שאקסל דורש (מתוך הקובץ המקורי, ותקפים כאן במלואם)
// ---------------------------------------------------------------------------
//  1. **BOM אחד בתחילת הקובץ** — בלעדיו כל העברית ג׳יבריש. ו**אחד בלבד**:
//     שני סימנים כאלה מייצרים תא ראשון פגום.
//  2. **CRLF** בסוף שורה.
//  3. **מפריד פסיק**, שעם ה-BOM נקרא נכון גם באקסל בעברית.
//
// ---------------------------------------------------------------------------
// ★ הזרקת נוסחאות — אותה התקפה, אותו נטרול
// ---------------------------------------------------------------------------
// תא שמתחיל בסימן שווה, פלוס, מינוס או שטרודל נפתח באקסל **כנוסחה**. כאן
// זה חמור במיוחד: התיאור בא מקובץ של צד שלישי. **כל ערך עובר דרך `csvCell`,
// בלי יוצא מן הכלל.**
// ============================================================================

import { formatAgorot, formatDateHe, type SettlementRow } from './settlement';
import { membersOf } from './settlementGroup';
import type { AmbiguousMatch, DeclinedEntry, MatchedPair, ReconcileResult } from './reconcile';

/** תווים שהופכים תא לנוסחה באקסל. */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/** ה-BOM. מוגדר פעם אחת כדי שלא יתווסף שוב במקום אחר. */
export const CSV_BOM = '﻿';

/**
 * תא CSV בטוח. **הפונקציה היחידה שכותבת ערך לקובץ.**
 * זהה בהתנהגותה ל-`csvCell` שב-`frozen/utils/accountantExport.ts` — ראו
 * ההסבר בראש הקובץ, ואת המבחן שמקבע את הזהות.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  let s = String(value);
  s = s.replace(/[\r\n]+/g, ' ');
  if (FORMULA_PREFIXES.some((p) => s.startsWith(p))) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * ★ שמות הקבוצות בקובץ זהים לשמות על המסך, ובאותו סדר.
 * הרו״ח והמשתמשת מסתכלים על אותו דבר בשני מקומות; שני שמות לאותה קבוצה הם
 * הדרך הבטוחה לגרום להם לחשוב שמדובר בשני דברים.
 */
export const GROUP_HE = {
  // ★★ ראשונה בקובץ כמו שהיא ראשונה במסך, ובניסוח שאומר מה קרה: העסקה לא
  // עברה. "חסר" היה שולח את רואה החשבון לחפש כסף שמעולם לא נגבה.
  declined: 'עסקה שלא עברה',
  unmatched: 'לא הצלחתי להתאים',
  unusual: 'התאמה עם פער חריג',
  matched: 'התאמה',
} as const;

function headers(result: ReconcileResult): string[] {
  return [
    'קבוצה',
    `תאריך — ${result.sourceHeA}`,
    `סכום — ${result.sourceHeA}`,
    `תאריך — ${result.sourceHeB}`,
    `סכום — ${result.sourceHeB}`,
    'הפרש בסכום',
    'הפרש בימים',
    'אסמכתא',
    'תיאור',
    'הערה',
  ];
}

function money(agorot: number | null): string {
  return agorot === null ? '' : formatAgorot(agorot);
}

function pairRow(pair: MatchedPair, group: string): string[] {
  return [
    group,
    formatDateHe(pair.a.date),
    money(pair.a.amount),
    formatDateHe(pair.b.date),
    money(pair.b.amount),
    money(pair.amountDelta),
    String(pair.dayDelta),
    pair.a.reference ?? pair.b.reference ?? '',
    pair.a.label ?? pair.b.label ?? '',
    pair.matchedBy === 'reference' ? 'התאמה לפי אסמכתא' : 'התאמה לפי תאריך וסכום',
  ];
}

function singleRow(row: SettlementRow, side: 'a' | 'b', noteHe: string): string[] {
  const dateCell = formatDateHe(row.date);
  const amountCell = money(row.amount);
  return [
    GROUP_HE.unmatched,
    side === 'a' ? dateCell : '',
    side === 'a' ? amountCell : '',
    side === 'b' ? dateCell : '',
    side === 'b' ? amountCell : '',
    '',
    '',
    row.reference ?? '',
    row.label ?? '',
    noteHe,
  ];
}

/**
 * ★ שורה שנדחתה. הסיבה נכנסת כמות שהיא מהקובץ — היא זאת שתקריא אותה
 * בטלפון, ומילה שלנו במקומה תבלבל.
 */
function declinedRow(entry: DeclinedEntry): string[] {
  const dateCell = formatDateHe(entry.row.date);
  const amountCell = money(entry.row.amount);
  const isA = entry.source === 'tranzila';
  return [
    GROUP_HE.declined,
    isA ? dateCell : '',
    isA ? amountCell : '',
    isA ? '' : dateCell,
    isA ? '' : amountCell,
    '',
    '',
    entry.row.reference ?? '',
    '',
    `העסקה לא עברה — ${entry.row.reasonHe}`,
  ];
}

/**
 * ★★ שורות המקור של קבוצה.
 *
 * שידור אחד יכול להיות שתי עסקאות בטרנזילה מול שורה אחת בגמא. קבוצה שלא
 * תאמה, בלי החברים שלה, היא מספר שאי אפשר לבדוק — ולכן הפירוט נכנס גם
 * לקובץ, ולא רק למסך.
 */
function memberRows(row: SettlementRow, side: 'a' | 'b'): string[][] {
  const members = membersOf(row);
  if (members.length < 2) return [];
  return members.map((member) => [
    GROUP_HE.unmatched,
    side === 'a' ? formatDateHe(member.date) : '',
    side === 'a' ? money(member.amount) : '',
    side === 'b' ? formatDateHe(member.date) : '',
    side === 'b' ? money(member.amount) : '',
    '',
    '',
    member.reference ?? '',
    member.label ?? '',
    'עסקה בתוך אותו שידור',
  ]);
}

function ambiguousRows(item: AmbiguousMatch): string[][] {
  const head = singleRow(item.row, item.side, item.reasonHe);
  const candidates = item.candidates.map((candidate) => [
    GROUP_HE.unmatched,
    '',
    '',
    formatDateHe(candidate.row.date),
    money(candidate.row.amount),
    money(candidate.amountDelta),
    String(candidate.dayDelta),
    candidate.row.reference ?? '',
    candidate.row.label ?? '',
    'אפשרות שיכולה להתאים לשורה שמעליה',
  ]);
  return [head, ...candidates];
}

/**
 * בונה את תוכן ה-CSV. **פונקציה טהורה** — מופרדת מההורדה כדי שתהיה ניתנת
 * לבדיקה בלי דפדפן, ובלי DOM (הקובץ הזה נצרך גם בסביבה בלי DOM).
 *
 * ★ הסדר בקובץ = הסדר על המסך: קודם מה שלא הצליח להתאים, אחר כך התאמות עם
 * פער חריג, ורק בסוף מה שהתאים. מי שפותח את הקובץ באקסל רואה למעלה בדיוק
 * את מה שהוא ראה למעלה במסך.
 */
export function buildReconcileCsv(result: ReconcileResult): string {
  const rows: string[][] = [headers(result)];

  for (const entry of result.declined) rows.push(declinedRow(entry));

  for (const row of result.onlyInA) {
    rows.push(singleRow(row, 'a', `מופיע רק ב${result.sourceBareA}`));
    rows.push(...memberRows(row, 'a'));
  }
  for (const row of result.onlyInB) {
    rows.push(singleRow(row, 'b', `מופיע רק ב${result.sourceBareB}`));
    rows.push(...memberRows(row, 'b'));
  }
  for (const item of result.ambiguous) rows.push(...ambiguousRows(item));

  for (const pair of result.matched) {
    if (pair.deltaIsUnusual) rows.push(pairRow(pair, GROUP_HE.unusual));
  }
  for (const pair of result.matched) {
    if (!pair.deltaIsUnusual) rows.push(pairRow(pair, GROUP_HE.matched));
  }

  const lines = rows.map((cells) => cells.map(csvCell).join(','));
  return `${CSV_BOM}${lines.join('\r\n')}\r\n`;
}

/** שם הקובץ, עם התקופה בפנים כדי ששתי הורדות לא ידרסו זו את זו. */
export function reconcileFileName(periodLabelHe: string): string {
  return `השוואת דוחות ${periodLabelHe}.csv`;
}
