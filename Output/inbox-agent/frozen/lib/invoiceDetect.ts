// ============================================================================
// invoiceDetect.ts — ★ זיהוי חשבונית, דטרמיניסטי, **לפני** המודל.
//
// ---------------------------------------------------------------------------
// אותו עיקרון כמו `triageFilter`, ומאותה סיבה
// ---------------------------------------------------------------------------
// המודל לא מחליט אם משהו הוא חשבונית. הוא מחלץ שדות ממסמך **שכבר נקבע**
// שהוא חשבונית. ההפרדה הזאת אינה ייעול עלות (אם כי היא גם זה) — היא מה
// שמאפשר לענות על השאלה "למה זה נחשב חשבונית" במשפט אחד שאפשר לבדוק, במקום
// ב"ככה המודל החליט".
//
// ולכן הפונקציה מחזירה **החלטה ניתנת להסבר, לא ציון**. אין כאן `confidence`
// ואין סף. ציון של 0.72 לא ניתן להסבר, לא ניתן לשחזור אחרי שינוי גרסה, ואי
// אפשר לתקן אותו — אפשר רק להזיז את הסף ולקוות. סיבה מפורשת כן: אם משהו נחת
// לא נכון, רואים איזה כלל ירה, ומתקנים את הכלל.
//
// ---------------------------------------------------------------------------
// ★ שתי דרגות ראיה, וזו לא בחירה עיצובית
// ---------------------------------------------------------------------------
// `messages.get(format:'metadata')` — הקריאה הזולה שהצינור מתחיל בה — **לא
// מחזירה את רשימת הקבצים המצורפים**. כלומר ברגע הראשון יש בידינו כותרות בלבד.
//
// מכאן שהפונקציה חייבת לעבוד בשני מצבים:
//   • `attachments === undefined` — טרם משכנו את הגוף. הראיה החזקה ביותר
//     שאפשר להשיג היא נושא + דומיין ספק מוכר, וזה מספיק ל-`possible` בלבד.
//     `possible` הוא מה שמצדיק את המשיכה המלאה — ומה שמונע ארכוב.
//   • `attachments` קיים — יש שם קובץ, ואפשר להכריע.
//
// זה גם מכסה חור אמיתי: חשבונית ספק מגיעה לרוב מ-`billing@`/`noreply@` עם
// `List-Unsubscribe`, כלומר המסנן יסמן אותה **רעש** ויעצור לפניה. הראיה
// מהכותרות היא מה שמונע מחשבונית להיקבר — ראה `archivePolicy.ts`, שבו מועמד
// חשבונית לא מאורכב אף פעם.
//
// ---------------------------------------------------------------------------
// הסדר הוא הלוגיקה (שוב)
// ---------------------------------------------------------------------------
// כל בדיקה עוצרת. הקדימות היא כל המשמעות, ושתי נקודות נשברות אם משנים סדר:
//
//  (א) שם הקובץ גובר על הכול חוץ מהוראת משתמש. `חשבונית-1042.pdf` הוא הראיה
//      הכי חזקה שיש, כי הוא נכתב בידי מערכת החשבוניות של הספק ולא בידי מי
//      שניסח את המייל.
//
//  (ב) מילת מפתח בנושא **לבדה לעולם לא מספיקה**. בדיוק כמו במסנן: "החשבונית
//      שלך מוכנה!" הוא הנושא האהוב על דיוור שיווקי. בלי קובץ מצורף אין ממה
//      לחלץ, והתוצאה היא `possible` שמוצג לבעלת העסק כשאלה — לא שורה בטבלה.
// ============================================================================

import type {
  AttachmentMeta,
  InvoiceDetectReason,
  InvoiceDetection,
  InvoiceVerdict,
} from '../types/invoice';
import { isExtractableMime } from '../types/invoice';
import type { MessageMeta } from '../types/triage';
import { domainCandidates, domainOf } from './triageFilter';

// ---------------------------------------------------------------------------
// מילונים
// ---------------------------------------------------------------------------

/**
 * דפוסים בשם הקובץ. הרשימה כוללת עברית ואנגלית כי מערכות חשבוניות ישראליות
 * מייצרות את שתיהן, ולעיתים באותו ספק.
 *
 * `\d` בסוף כמה מהדפוסים אינו קישוט: `invoice_template.pdf` ששולח יועץ אינו
 * חשבונית, `invoice_10423.pdf` כן. מספר בשם הקובץ הוא מה שמפריד בין מסמך
 * שהופק אוטומטית לבין קובץ ששמו במקרה מכיל את המילה.
 */
const FILENAME_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /חשבונית/, label: 'חשבונית' },
  { re: /חשבונית[\s_-]*מס/, label: 'חשבונית מס' },
  { re: /קבלה/, label: 'קבלה' },
  { re: /חשבון[\s_-]*עסקה/, label: 'חשבון עסקה' },
  { re: /דרישת[\s_-]*תשלום/, label: 'דרישת תשלום' },
  { re: /\binvoice\b/i, label: 'invoice' },
  { re: /\breceipt\b/i, label: 'receipt' },
  { re: /\bfactura\b/i, label: 'factura' },
  { re: /\binv[\s_-]?\d{2,}/i, label: 'INV-…' },
  { re: /\bre?c?pt[\s_-]?\d{3,}/i, label: 'RCPT-…' },
];

/**
 * מילות מפתח בנושא. **מקדמות בלבד** — ראה נקודה (ב) בראש הקובץ.
 * הן אף פעם לא מספיקות לבדן להכריע `invoice`.
 */
const SUBJECT_KEYWORDS = [
  'חשבונית',
  'חשבונית מס',
  'קבלה',
  'חשבון עסקה',
  'דרישת תשלום',
  'אישור תשלום',
  'הפקת מסמך',
  'מסמך חשבונאי',
  'invoice',
  'receipt',
  'billing statement',
];

/**
 * שמות קבצים שמכילים מילת חשבונית אבל **אינם** מסמך.
 * הצורה הזאת נפוצה יותר ממה שנדמה: ספק שולח "מדריך" או "טופס ריק".
 */
const FILENAME_ANTI_PATTERNS: RegExp[] = [
  /template|תבנית|דוגמה|דוגמא/i,
  /\bsample\b/i,
  /^(riq|ריק)\b/i,
  /הוראות|מדריך|guide|instructions/i,
];

// ---------------------------------------------------------------------------
// הקשר
// ---------------------------------------------------------------------------

export interface InvoiceDetectContext {
  /**
   * דומיינים שידוע שמגיעות מהם חשבוניות. מוזן מפנקס השולחים
   * (`SenderLedgerEntry.invoiceSource`) — כלומר **נלמד**, לא מקודד קשיח.
   * התאמה היא על הדומיין או על דומיין-האב, כמו במסנן.
   */
  supplierDomains?: readonly string[];

  /** הוראת משתמש מפורשת. גוברת על הכול, לשני הכיוונים. */
  alwaysInvoiceDomains?: readonly string[];
  neverInvoiceDomains?: readonly string[];

  /** דריסת מילות המפתח (לבדיקות). */
  subjectKeywords?: readonly string[];

  /**
   * גודל מינימלי לקובץ שנחשב מסמך. קובץ PDF של 200 בתים הוא לא חשבונית —
   * הוא לרוב תמונת חתימה או pixel מעקב שנארז כקובץ.
   */
  minAttachmentBytes?: number;
}

const DEFAULT_MIN_ATTACHMENT_BYTES = 2048;

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

function normalizeFileName(name: string): string {
  // NFKC כדי ש-`ｉｎｖｏｉｃｅ.pdf` בתווים רחבים לא יחמוק, והסרת תווי כיווניות
  // כדי ש-`חשבוניתfdp.pdf` (RLO) לא ייראה כמו PDF ויהיה בעצם משהו אחר.
  return String(name ?? '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u061C\u202A-\u202E\u2066-\u2069\uFEFF\u00AD]/g, '')
    .trim();
}

function matchList(domain: string, list: readonly string[] | undefined): string | undefined {
  if (!list || list.length === 0) return undefined;
  const wanted = new Set(list.map((d) => String(d).toLowerCase().trim()));
  // התאמה על הדומיין המלא ועל דומיין-האב — אותה לוגיקה של `domainCandidates`
  // במסנן: ספק שמפזר על תת-דומיינים לא מחייב רשומה לכל אחד.
  const candidates = [domain, ...domainCandidates(domain)];
  return candidates.find((c) => c && wanted.has(c));
}

/** קובץ שיש טעם לנסות לחלץ ממנו: סוג נתמך, ולא זעיר. */
function isDocumentAttachment(a: AttachmentMeta, minBytes: number): boolean {
  return isExtractableMime(a.mimeType) && Number(a.sizeBytes ?? 0) >= minBytes;
}

function fileNameEvidence(name: string): string | null {
  const clean = normalizeFileName(name);
  if (FILENAME_ANTI_PATTERNS.some((re) => re.test(clean))) return null;
  const hit = FILENAME_PATTERNS.find(({ re }) => re.test(clean));
  return hit ? hit.label : null;
}

function build(
  verdict: InvoiceVerdict,
  reason: InvoiceDetectReason,
  reasonHe: string,
  attachment: AttachmentMeta | null,
  extra: { matchedSupplierDomain?: string; matchedEvidence?: string } = {},
): InvoiceDetection {
  return {
    verdict,
    reason,
    reasonHe,
    attachment,
    // ★ בלי קובץ אין חילוץ. גם `invoice` מלא לא שולח למודל אם אין ממה לחלץ,
    // כי הדבר היחיד שאפשר לעשות אז הוא לנחש סכום מגוף המייל.
    needsExtraction: verdict !== 'notInvoice' && attachment !== null,
    ...(extra.matchedSupplierDomain ? { matchedSupplierDomain: extra.matchedSupplierDomain } : {}),
    ...(extra.matchedEvidence ? { matchedEvidence: extra.matchedEvidence } : {}),
  };
}

// ---------------------------------------------------------------------------
// ★ הפונקציה
// ---------------------------------------------------------------------------

/**
 * @param attachments `undefined` = טרם משכנו את הגוף (מצב `format:'metadata'`).
 *                    מערך ריק = משכנו, ואין קבצים. **ההבדל משמעותי.**
 */
export function invoiceDetect(
  msg: MessageMeta,
  attachments?: readonly AttachmentMeta[],
  ctx: InvoiceDetectContext = {},
): InvoiceDetection {
  const domain = domainOf(msg.fromAddress);
  const minBytes = ctx.minAttachmentBytes ?? DEFAULT_MIN_ATTACHMENT_BYTES;
  const keywords = ctx.subjectKeywords ?? SUBJECT_KEYWORDS;
  const subject = String(msg.subject ?? '').normalize('NFKC');
  const subjectHit = keywords.find((k) => k && subject.toLowerCase().includes(k.toLowerCase()));

  const docs = (attachments ?? []).filter((a) => isDocumentAttachment(a, minBytes));

  // --- 1. הוראת משתמש. גוברת על הכול, לשני הכיוונים. ------------------------
  const never = matchList(domain, ctx.neverInvoiceDomains);
  if (never) {
    return build('notInvoice', 'userRuleNever', 'אמרת לי שמהשולח הזה לא מגיעות חשבוניות', null, {
      matchedSupplierDomain: never,
    });
  }

  const always = matchList(domain, ctx.alwaysInvoiceDomains);
  if (always && docs.length > 0) {
    const a = docs[0];
    return build('invoice', 'userRuleAlways', 'אמרת לי שמהשולח הזה מגיעות חשבוניות', a, {
      matchedSupplierDomain: always,
      matchedEvidence: a.fileName,
    });
  }

  // --- 2. ★ שם הקובץ. הראיה החזקה ביותר שקיימת. -----------------------------
  // הוא נכתב בידי מערכת החשבוניות של הספק, לא בידי מי שניסח את המייל, ולכן
  // הוא הרבה פחות "מכירתי" מהנושא.
  for (const a of docs) {
    const evidence = fileNameEvidence(a.fileName);
    if (evidence) {
      return build('invoice', 'attachmentName', `שם הקובץ המצורף מכיל "${evidence}"`, a, {
        matchedEvidence: a.fileName,
      });
    }
  }

  // --- 3. ספק מוכר + קובץ מסמך ---------------------------------------------
  const supplier = matchList(domain, ctx.supplierDomains);
  if (supplier && docs.length > 0) {
    return build(
      'invoice',
      'supplierDomain',
      `${supplier} הוא ספק שכבר שלח חשבוניות, ומצורף כאן מסמך`,
      docs[0],
      { matchedSupplierDomain: supplier, matchedEvidence: docs[0].fileName },
    );
  }

  // --- 4. מילת מפתח בנושא + קובץ מסמך --------------------------------------
  // כאן, ולא לפני שם הקובץ: הנושא הוא מה שהשולח כתב על עצמו.
  if (subjectHit && docs.length > 0) {
    return build(
      'invoice',
      'subjectAndAttachment',
      `בנושא כתוב "${subjectHit}" ומצורף מסמך`,
      docs[0],
      { matchedEvidence: subjectHit },
    );
  }

  // --- 5. ספק מוכר, בלי קובץ ------------------------------------------------
  // שווה מבט: ספק ששולח חשבוניות בדרך כלל, ופתאום שלח קישור במקום קובץ.
  if (supplier) {
    return build(
      'possible',
      'supplierDomain',
      `${supplier} הוא ספק שכבר שלח חשבוניות, אבל הפעם לא צורף מסמך`,
      null,
      { matchedSupplierDomain: supplier },
    );
  }

  // --- 6. ★ מילת מפתח בנושא, בלי קובץ. `possible` ולעולם לא יותר. -----------
  // "החשבונית שלך מוכנה — לחצי כאן" הוא נושא של דיוור, לא של ספק. אין ממה
  // לחלץ, ולכן זה מוצג כשאלה לבעלת העסק ולא כשורה בטבלה.
  if (subjectHit) {
    return build(
      'possible',
      'subjectOnly',
      `בנושא כתוב "${subjectHit}", אבל לא צורף מסמך — יכול להיות שהחשבונית נמצאת בקישור`,
      null,
      { matchedEvidence: subjectHit },
    );
  }

  // --- 7. קובץ מסמך בלי שום רמז אחר ----------------------------------------
  if (docs.length > 0) {
    return build('possible', 'attachmentOnly', 'צורף מסמך — לא ברור אם זו חשבונית', docs[0], {
      matchedEvidence: docs[0].fileName,
    });
  }

  return build('notInvoice', 'noEvidence', 'אין כאן סימן לחשבונית', null);
}

/**
 * קיצור לשאלה שחוזרת בשני מקומות: המסך, ו-`archivePolicy`.
 * `possible` נחשב "כן" בכוונה — כשמדובר בכסף, ספק פועל לטובת השארת המייל.
 */
export function looksLikeInvoice(detection: InvoiceDetection): boolean {
  return detection.verdict !== 'notInvoice';
}
