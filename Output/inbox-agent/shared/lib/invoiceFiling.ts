// ============================================================================
// invoiceFiling.ts — ★ "גם תיקייה". נתיב דטרמיניסטי לקובץ החשבונית.
//
// ---------------------------------------------------------------------------
// למה נתיב הוא לוגיקה ולא מחרוזת
// ---------------------------------------------------------------------------
// בעלת העסק רוצה שני דברים, ושניהם אמיתיים: טבלה שאפשר לשלוח לרו״ח, **וגם**
// תיקייה מסודרת שאפשר לפתוח בלי האפליקציה. הטבלה יכולה להישבר — שדה שלא
// חולץ, גרסה שהשתנתה, כלי שהוחלף. **הקובץ בתיקייה לא נשבר.** לכן הנתיב הוא
// חלק מהתוצר ולא פרט מימוש, והוא נבנה דטרמיניסטית כדי שאותה חשבונית תיפול
// תמיד באותו מקום — גם אם נריץ מחדש.
//
// ---------------------------------------------------------------------------
// ★ שם קובץ שמגיע מבחוץ הוא קלט עוין
// ---------------------------------------------------------------------------
// שם הקובץ נכתב בידי השולח. שלוש התקפות שהפונקציה כאן חוסמת, וכולן ישנות:
//
//  1. **מעבר תיקייה** — `../../.env`. שובר את הבידוד לגמרי.
//  2. **היפוך כיווניות (RLO)** — U+202E באמצע השם גורם ל-`חשבוניתfdp.exe`
//     להיראות על המסך כמו `חשבוניתexe.pdf`. באפליקציה עברית, שבה כיווניות
//     מעורבת היא ברירת המחדל, אף אחד לא מבחין בזה. זו לא פינה תיאורטית —
//     זו הדרך המקובלת להגיש קובץ הפעלה בתור מסמך.
//  3. **סיומת כפולה / שם שמור** — `CON`, `PRN`, `NUL` ב-Windows.
//
// הסיומת **אינה** נלקחת מהשם אלא נגזרת מ-`mimeType`, שמגיע מ-Gmail ולא
// מהשולח. זו ההגנה החזקה בין השלוש: גם אם השם משקר, הסיומת אומרת אמת.
// ============================================================================

import type { Invoice, InvoiceFields } from '../types/invoice';

/** שורש התיקייה. שם אחד, בעברית, כדי שהיא תהיה מזוהה בסייר הקבצים. */
export const INVOICE_ROOT_FOLDER = 'חשבוניות';

const MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
};

/** שמות שמורים ב-Windows. קובץ בשם `CON.pdf` פשוט לא ניתן ליצירה. */
const RESERVED_NAMES =
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

const HE_MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

/**
 * ★ ניקוי שם לשימוש כרכיב נתיב.
 *
 * שמרני בכוונה: מותר עברית, לטינית, ספרות, מקף וקו תחתון. כל השאר הופך למקף.
 * זה גם מוחק תווי כיווניות בלי צורך לזהות אותם אחד-אחד — הם פשוט לא ברשימה
 * המותרת. הגישה הזאת (allowlist ולא denylist) היא ההבדל בין הגנה שמחזיקה
 * מעמד לבין רשימה שצריך לעדכן בכל פעם שמישהו ממציא תו חדש.
 */
export function safePathSegment(raw: string | null | undefined, fallback = 'ללא-שם'): string {
  const s = String(raw ?? '')
    .normalize('NFKC')
    // מעבר תיקייה — לפני הכול, כדי שגם `..%2f` שנפרס לא ישרוד.
    .replace(/[\\/]+/g, '-')
    .replace(/\.{2,}/g, '-')
    // allowlist.
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .trim();

  if (!s) return fallback;
  if (RESERVED_NAMES.test(s)) return `${s}-`;
  return s;
}

/** סיומת מ-`mimeType`, לא מהשם. ראה ההערה בראש הקובץ. */
export function extensionFor(mimeType: string): string {
  return MIME_EXTENSIONS[String(mimeType ?? '').toLowerCase()] ?? 'bin';
}

/** `2026-07` → `יולי 2026`. */
export function monthLabelHe(monthKey: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monthKey ?? ''));
  if (!m) return String(monthKey ?? '');
  const idx = Number(m[2]) - 1;
  return idx >= 0 && idx < 12 ? `${HE_MONTHS[idx]} ${m[1]}` : monthKey;
}

/** `2026-07-13T…` → `2026-07`. */
export function monthKeyOf(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'ללא-תאריך';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}`;
}

export interface FilingInput {
  monthKey: string;
  fields: Pick<InvoiceFields, 'supplierName' | 'invoiceNumber' | 'total' | 'currency'>;
  fromDomain: string;
  attachment: { fileName: string; mimeType: string; attachmentId: string };
  needsHumanReview: boolean;
}

/**
 * ★ הנתיב המלא.
 *
 * `חשבוניות/2026/2026-07/ספק__מספר.pdf`
 * או, כשיש בעיה: `חשבוניות/2026/2026-07/לבדיקה/domain__attachmentId.pdf`
 *
 * שתי החלטות שכדאי לשים לב אליהן:
 *
 *  1. **תיקיית `לבדיקה` נפרדת** לחשבוניות שלא אומתו. הן לא מתערבבות עם
 *     החשבוניות התקינות, כי תיקייה שבה חלק מהשמות אמינים וחלק לא היא
 *     תיקייה שאי אפשר לסמוך על אף שם בה.
 *
 *  2. **שם הספק לא נכנס לשם קובץ שלא אומת.** אם לא הצלחנו לאמת את השדה, אסור
 *     לו להופיע בשם הקובץ — שם קובץ נראה כמו עובדה אפילו יותר מתא בטבלה,
 *     כי הוא שורד גם אחרי שהטבלה נמחקה. במקומו נכנסים הדומיין ומזהה הקובץ,
 *     ששניהם עובדות ולא קריאה של מודל.
 */
export function invoiceFilePath(input: FilingInput): string {
  const year = input.monthKey.slice(0, 4) || 'ללא-שנה';
  const ext = extensionFor(input.attachment.mimeType);

  if (input.needsHumanReview) {
    const domain = safePathSegment(input.fromDomain, 'ללא-שולח');
    const attId = safePathSegment(input.attachment.attachmentId, 'קובץ');
    return `${INVOICE_ROOT_FOLDER}/${year}/${input.monthKey}/לבדיקה/${domain}__${attId}.${ext}`;
  }

  const supplier = safePathSegment(input.fields.supplierName, 'ספק-לא-ידוע');
  const number = safePathSegment(input.fields.invoiceNumber, 'ללא-מספר');
  return `${INVOICE_ROOT_FOLDER}/${year}/${input.monthKey}/${supplier}__${number}.${ext}`;
}

/** נוחות: הנתיב מתוך רשומה שכבר נבנתה. */
export function pathOf(invoice: Invoice): string {
  return invoice.filePath;
}
