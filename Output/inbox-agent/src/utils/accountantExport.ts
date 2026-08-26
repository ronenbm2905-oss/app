// ============================================================================
// accountantExport.ts — ★ "הורדת קובץ לרו״ח". כפתור אחד, בלי אשף ובלי בחירות.
//
// ---------------------------------------------------------------------------
// הקריטריון הוא שזה ייפתח נכון באקסל — לא שזה תקני
// ---------------------------------------------------------------------------
// שלושה דברים שאקסל דורש ושאף אחד מהם אינו "התקן", ואם מוותרים עליהם הקובץ
// נפתח מקולקל והמשתמשת מסיקה שהכלי לא עובד:
//
//  1. **BOM בתחילת הקובץ.** בלעדיו אקסל בחלונות קורא UTF-8 כ-ANSI, וכל
//     העברית הופכת לג׳יבריש. זו התקלה הראשונה שתקרה, והיא נראית קטלנית.
//  2. **CRLF בסוף שורה.**
//  3. **מפריד `,`** ולא `;` — עם BOM, אקסל בעברית מזהה פסיק נכון.
//
// ---------------------------------------------------------------------------
// ★ הזרקת נוסחאות ל-CSV — התקפה אמיתית, בקובץ שהולך לרו״ח
// ---------------------------------------------------------------------------
// תא שמתחיל ב-`=`, `+`, `-`, `@` או טאב נפתח באקסל **כנוסחה**. ספק עוין ששם
// `=HYPERLINK(...)` או `=cmd|...` בשם העסק שלו מקבל קוד שרץ במחשב של הרו״ח,
// לא במחשב שלנו. זו הסיבה שהמודול הזה קיים כקובץ נפרד ולא כשלוש שורות בתוך
// הרכיב: **כל ערך עובר דרך `csvCell`, בלי יוצא מן הכלל.**
//
// הנטרול הוא גרש מוביל (`'`) — אקסל בולע אותו ומציג את הטקסט כמו שהוא.
//
// ---------------------------------------------------------------------------
// ★ מה שלא נכנס לעמודת סכום
// ---------------------------------------------------------------------------
// שורה שלא אומתה יוצאת עם **עמודות סכום ריקות**. המספר שכן ראינו יושב
// בעמודה נפרדת ששמה "סכום שקראתי ולא הצלחתי לוודא", לצד עמודת הסבר.
// הרו״ח שיפתח את הקובץ לא יכול לטעות: או שהמספר בעמודת הסכום, או שהוא לא
// שם ויש הסבר למה. אין מצב ביניים שנראה כמו נתון.
// ============================================================================

import type { Invoice, MonthlySummary } from '../../shared/types';
import { CURRENCY_SYMBOL } from './invoicePipeline';
import { monthLabelHe } from '../../shared/lib/invoiceFiling';

/** תווים שהופכים תא לנוסחה באקסל / Google Sheets. */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * ★ תא CSV בטוח. **הפונקציה היחידה שכותבת ערך לקובץ.**
 * מנטרלת נוסחה, ואז עוטפת במרכאות ומכפילה מרכאות פנימיות.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  let s = String(value);

  // תווי בקרה ושורות חדשות בתוך תא — מוחלפים ברווח, לא נשמרים.
  s = s.replace(/[\r\n]+/g, ' ');

  if (FORMULA_PREFIXES.some((p) => s.startsWith(p))) s = `'${s}`;

  return `"${s.replace(/"/g, '""')}"`;
}

/** כותרות. בעברית, כי מי שפותח את הקובץ הוא רו״ח ישראלי. */
const HEADERS = [
  'חודש',
  'תאריך החשבונית',
  'ספק',
  'מספר עוסק',
  'מספר חשבונית',
  'סוג המסמך',
  'מטבע',
  'סכום לפני מע״מ',
  'מע״מ',
  'סה״כ',
  'סטטוס',
  'סכום שקראתי ולא הצלחתי לוודא',
  'מה לא הצלחתי לקרוא',
  'שם הקובץ',
  'איפה הקובץ נשמר',
] as const;

const KIND_HE: Record<string, string> = {
  invoice: 'חשבונית מס',
  receipt: 'קבלה',
  invoiceReceipt: 'חשבונית מס/קבלה',
  creditNote: 'חשבונית זיכוי',
  proforma: 'דרישת תשלום',
  unknown: 'לא ידוע',
};

function rowFor(inv: Invoice): string[] {
  const ok = !inv.needsHumanReview;
  const issues = inv.issues.map((i) => i.messageHe).join(' · ');

  return [
    monthLabelHe(inv.monthKey),
    // ★ עמודות הנתונים ריקות כשלא אומת. זה לא חיסכון — זו כל הנקודה.
    ok ? (inv.fields.issueDate ?? '') : '',
    ok ? (inv.fields.supplierName ?? '') : '',
    ok ? (inv.fields.supplierTaxId ?? '') : '',
    ok ? (inv.fields.invoiceNumber ?? '') : '',
    KIND_HE[inv.fields.documentKind] ?? 'לא ידוע',
    ok && inv.fields.currency ? CURRENCY_SYMBOL[inv.fields.currency] : '',
    ok && inv.fields.subtotal !== null ? String(inv.fields.subtotal) : '',
    ok && inv.fields.vatAmount !== null ? String(inv.fields.vatAmount) : '',
    ok && inv.fields.total !== null ? String(inv.fields.total) : '',
    ok ? 'נבדק' : 'צריך בדיקה שלך',
    // העמודה הזאת קיימת רק כדי לחסוך פתיחה של המסמך, והשם שלה אומר בדיוק
    // מה היא. היא לעולם לא מכילה ערך כששאר השורה תקינה.
    ok ? '' : (inv.unverified.total !== null ? String(inv.unverified.total) : ''),
    ok ? '' : issues,
    inv.attachment.fileName,
    inv.filePath,
  ];
}

/**
 * בונה את תוכן ה-CSV. **פונקציה טהורה** — מופרדת מההורדה כדי שתהיה
 * ניתנת לבדיקה בלי דפדפן. אותה הפרדה בדיוק כמו ב-`calendar.ts`.
 */
export function buildAccountantCsv(invoices: readonly Invoice[]): string {
  const lines = [
    HEADERS.map(csvCell).join(','),
    ...[...invoices]
      .sort((a, b) => (b.fields.issueDate ?? b.receivedAt).localeCompare(a.fields.issueDate ?? a.receivedAt))
      .map((inv) => rowFor(inv).map(csvCell).join(',')),
  ];
  // BOM + CRLF. ראה ההערה בראש הקובץ.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/**
 * שם הקובץ. בעברית, **עם החודש בפנים**, כדי שבתיקיית ההורדות יהיה ברור
 * מיד מה זה — ושתי הורדות של חודשים שונים לא ידרסו זו את זו.
 */
export function accountantFileName(months: readonly MonthlySummary[]): string {
  if (months.length === 1) return `חשבוניות ${months[0].monthLabelHe}.csv`;
  if (months.length === 0) return 'חשבוניות.csv';
  const sorted = [...months].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  return `חשבוניות ${sorted[0].monthLabelHe} עד ${sorted[sorted.length - 1].monthLabelHe}.csv`;
}

/** ההורדה בפועל. מופרדת מהבנייה — הבנייה טהורה, זו נוגעת ב-DOM. */
export function downloadAccountantCsv(
  invoices: readonly Invoice[],
  months: readonly MonthlySummary[],
): void {
  const blob = new Blob([buildAccountantCsv(invoices)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = accountantFileName(months);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
