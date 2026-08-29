// ============================================================================
// invoicePipeline.ts — צינור החשבוניות. מחבר את המודולים הטהורים לסדר אחד.
//
//   הודעה → triageFilter → invoiceDetect → ★ שער הקליטה → sanitize(המסמך)
//          → mockExtractInvoice → validateInvoice → invoiceFilePath → Invoice
//
// אותו מבנה כמו `pipeline.ts`, ומאותה סיבה: **הדטרמיניסטי קודם.** מסמך שלא
// נקבע עליו שהוא חשבונית, או שלא עבר את שער הקליטה, לא נפתח, לא נשמר, ולא
// מייצר שורה בטבלה. בפרוסה 1 מוחלף רכיב אחד — `mockExtractInvoice` → קריאה
// ל-Cloud Function שמחזירה בדיוק את אותו `InvoiceExtraction`.
//
// ---------------------------------------------------------------------------
// ★ למה הסניטייזר רץ גם על טקסט שיצא מ-PDF
// ---------------------------------------------------------------------------
// זה נראה מיותר — PDF הוא לא HTML. הוא לא מיותר: תווי כיווניות ו-zero-width
// עוברים דרך PDF בדיוק כמו דרך מייל, ו-URL בתוך מסמך הוא אותו ערוץ בדיוק.
// גוף מייל וטקסט מסמך הם **אותו גבול אמון** — טקסט שכתב אדם לא מוכר ושנשלח
// למודל — ולכן הם עוברים באותו ניקוי. שני מסלולי ניקוי לאותו סוג קלט הם שני
// מסלולים שאחד מהם יישאר מאחור.
//
// ---------------------------------------------------------------------------
// ★ למה הצינור הזה מריץ בעצמו את המסנן ואת הסיווג
// ---------------------------------------------------------------------------
// שער הקליטה דורש שני קלטים שאינם בהודעה עצמה: פסק המסנן (`לא רעש`) והדגל
// `containsSensitive` (שמגיע מהסיווג). בפרוסה 1 שלושת השלבים יושבים באותה
// Cloud Function ברצף, ולכן גם כאן הם רצים ברצף אחד ולא בשני מסלולים —
// אחרת נבנה כאן סדר שלא קיים בשום מקום אחר.
// ============================================================================

import { invoiceDetect, looksLikeInvoice } from '../lib/invoiceDetect';
import { invoiceIntakeDecision, type IntakeDecision } from '../lib/invoiceIntake';
import { validateInvoice } from '../lib/validateInvoice';
import { invoiceFilePath, monthKeyOf, monthLabelHe } from '../lib/invoiceFiling';
import { domainOf, prepareContext, triageFilter, type TriageContext } from '../lib/triageFilter';
import { sanitizeEmailBody } from '../../shared/lib/sanitize';
import { mockAgentClassify } from './mockAgent';
import {
  mockExtractInvoice,
  MOCK_INVOICE_MODEL_ID,
  type FixtureAttachment,
} from './mockInvoiceExtract';
import {
  EMPTY_EXTRACTION,
  type Invoice,
  type InvoiceCurrency,
  type MessageMeta,
  type MonthlySummary,
  type MonthlyTotal,
  type SenderLedgerEntry,
} from '../types';
import { LOCAL_USER_ID, RETENTION_DAYS } from '../constants';

// ---------------------------------------------------------------------------
// קלט ופלט
// ---------------------------------------------------------------------------

export interface InvoiceSourceMessage extends MessageMeta {
  bodyHtml?: string;
  attachments?: FixtureAttachment[];
}

/** מייל שנראה קשור לחשבונית ולא הפך לשורה בטבלה — ולמה. */
export interface InvoiceOpenQuestion {
  messageId: string;
  fromDomain: string;
  subject: string;
  receivedAt: string;
  reasonHe: string;
}

export interface InvoiceRunResult {
  invoices: Invoice[];
  months: MonthlySummary[];
  stats: {
    scanned: number;
    detected: number;
    extracted: number;
    refusedByGate: number;
    needsReview: number;
  };
  /**
   * ★ מיילים שנראים קשורים לחשבונית ואין מהם שורה — או כי אין קובץ, או כי
   * שער הקליטה סירב. הם לא נעלמים: "מייל שנראה כמו חשבונית ולא מופיע
   * בטבלה" בלי הסבר הוא בדיוק הפער שגורם לחוסר אמון בכלי.
   */
  openQuestions: InvoiceOpenQuestion[];
}

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

const nowIso = (): string => new Date().toISOString();

function purgeDateFrom(receivedAt: string): string {
  const base = new Date(receivedAt);
  const d = isNaN(base.getTime()) ? new Date() : base;
  return new Date(d.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** רשימת דומייני הספקים מהפנקס. **נלמד**, לא מקודד קשיח. */
export function supplierDomainsFrom(
  senders: Readonly<Record<string, SenderLedgerEntry>> | undefined,
): string[] {
  return Object.values(senders ?? {})
    .filter((s) => s.invoiceSource)
    .map((s) => s.domainKey);
}

// ---------------------------------------------------------------------------
// ★ הצינור
// ---------------------------------------------------------------------------

export interface RunInvoicesOptions {
  /** הקשר המסנן — פנקס, נמענים, כללי משתמש. */
  triage?: TriageContext;
  /** הפנקס, לגזירת רשימת הספקים המוכרים. */
  senders?: Readonly<Record<string, SenderLedgerEntry>>;
  /** הוראות משתמש ייעודיות לחשבוניות. */
  alwaysInvoiceDomains?: readonly string[];
  neverInvoiceDomains?: readonly string[];
  /** "היום", לוולידציית התאריך. מוזרק כדי שמבחן לא יהיה תלוי בשעון. */
  now?: Date | string;
}

export function runInvoicePipeline(
  messages: readonly InvoiceSourceMessage[],
  opts: RunInvoicesOptions = {},
): InvoiceRunResult {
  const ctx = prepareContext(opts.triage ?? {});
  const supplierDomains = supplierDomainsFrom(opts.senders);
  const knownSuppliers = new Set(supplierDomains);

  const invoices: Invoice[] = [];
  const openQuestions: InvoiceOpenQuestion[] = [];
  let detected = 0;
  let refusedByGate = 0;

  for (const msg of messages) {
    const fromDomain = domainOf(msg.fromAddress);

    // --- שלב 1: המסנן. אפס רשת, אפס טוקנים. ---
    const triage = triageFilter(msg, ctx);

    // --- שלב 2: זיהוי חשבונית, דטרמיניסטי. ---
    const detection = invoiceDetect(msg, msg.attachments, {
      supplierDomains,
      alwaysInvoiceDomains: opts.alwaysInvoiceDomains,
      neverInvoiceDomains: opts.neverInvoiceDomains,
    });
    if (!looksLikeInvoice(detection)) continue;
    detected++;

    // --- שלב 3: הסיווג, בשביל `containsSensitive` בלבד. ---
    // רץ **לפני** שער הקליטה, כי השער דורש אותו. הגוף המנוקה לא נשמר בשום
    // מקום — הוא חי בתוך האיטרציה הזאת ומת איתה.
    const cleanBody = sanitizeEmailBody(msg.bodyHtml ?? '');
    const agent = mockAgentClassify(msg, cleanBody.text);

    // --- שלב 4: ★ שער הקליטה. allowlist מצטבר, כל רכיב הוא וטו. ---
    const gate: IntakeDecision = invoiceIntakeDecision({
      filterVerdict: triage.verdict,
      detection,
      attachment: detection.attachment,
      containsSensitive: agent.containsSensitive,
    });

    if (!gate.allowed) {
      refusedByGate++;
      openQuestions.push({
        messageId: msg.messageId,
        fromDomain,
        // ★ הכותרת מוצגת כאן רק כי הפריט **אינו רעש** (השער דוחה רעש לפני
        // כן). אותו כלל בדיוק כמו בצינור המיילים: כותרת קיימת רק בענף
        // המסווג.
        subject: triage.verdict === 'noise' ? '' : String(msg.subject ?? ''),
        receivedAt: msg.receivedAt,
        reasonHe: gate.reasonHe,
      });
      continue;
    }

    // --- שלב 5: ★ ניקוי טקסט המסמך — אותו סניטייזר בדיוק. ---
    const source = (msg.attachments ?? []).find(
      (a) => a.attachmentId === detection.attachment?.attachmentId,
    );
    const cleanDoc = source ? sanitizeEmailBody(source.documentText ?? '') : null;

    // --- שלב 6: החילוץ (כאן: מוק דטרמיניסטי; בפרוסה 1: המודל). ---
    const raw =
      source && cleanDoc
        ? mockExtractInvoice({ ...source, documentText: cleanDoc.text })
        : { ...EMPTY_EXTRACTION };

    // --- שלב 7: ★ הוולידציה. מכאן והלאה `fields` הוא מה שנחשב אמת. ---
    const validation = validateInvoice(raw, {
      now: opts.now,
      supplierIsKnown: knownSuppliers.has(fromDomain),
    });

    // ★ טקסט מוסתר בתוך המסמך — אותו tripwire כמו בצינור המיילים, ומאותה
    // סיבה: הסניטייזר מחק את החלק המוסתר לפני שהמודל ראה אותו, ולכן רק מי
    // שראה את המקור יכול לדווח עליו. הזרקה שהניקוי הצליח להסיר הייתה
    // נעלמת בשקט — הכשל הגרוע ביותר, כי אין לו תסמין.
    const hiddenInDoc =
      (cleanDoc?.hiddenBlocksRemoved ?? 0) > 0 || (cleanDoc?.invisibleCharsRemoved ?? 0) > 0;
    const issues = hiddenInDoc
      ? [
          ...validation.issues,
          {
            field: 'document' as const,
            code: 'injectionAttempt' as const,
            severity: 'block' as const,
            messageHe:
              'במסמך היה טקסט מוסתר שלא נראה בעין. לא סמכתי על מה שקראתי ממנו — כדאי שתפתחי אותו',
          },
        ]
      : validation.issues;
    const needsHumanReview = validation.needsHumanReview || hiddenInDoc;

    // --- שלב 8: חודש, נתיב, רשומה. ---
    const monthKeySource = validation.value.issueDate ? 'issueDate' : 'receivedAt';
    const monthKey = validation.value.issueDate
      ? validation.value.issueDate.slice(0, 7)
      : monthKeyOf(msg.receivedAt);

    const attachment = {
      attachmentId: detection.attachment!.attachmentId,
      fileName: detection.attachment!.fileName,
      mimeType: detection.attachment!.mimeType,
      sizeBytes: detection.attachment!.sizeBytes,
    };

    const ts = nowIso();
    invoices.push({
      userId: LOCAL_USER_ID,
      id: `inv-${msg.messageId}-${attachment.attachmentId}`,
      sourceItemId: msg.messageId,
      threadId: msg.threadId,
      fromDomain,
      receivedAt: msg.receivedAt,
      attachment,
      filePath: invoiceFilePath({
        monthKey,
        fields: validation.value,
        fromDomain,
        attachment,
        needsHumanReview,
      }),
      detection: { ...detection, attachment },
      fields: validation.value,
      unverified: raw,
      needsHumanReview,
      issues,
      monthKey,
      monthKeySource,
      modelId: MOCK_INVOICE_MODEL_ID,
      reviewed: false,
      purgeAfter: purgeDateFrom(msg.receivedAt),
      createdAt: ts,
      updatedAt: ts,
    });
  }

  return {
    invoices,
    months: groupByMonth(invoices),
    openQuestions,
    stats: {
      scanned: messages.length,
      detected,
      extracted: invoices.length,
      refusedByGate,
      needsReview: invoices.filter((i) => i.needsHumanReview).length,
    },
  };
}

// ---------------------------------------------------------------------------
// ★ קיבוץ וסכימה
// ---------------------------------------------------------------------------

/**
 * מקבץ לפי חודש ומסכם **לפי מטבע**.
 *
 * שתי החלטות שהן כל ההבדל בין טבלה שאפשר לשלוח לרו״ח לבין טבלה שנראית טוב:
 *
 *  1. **שורה שדורשת בדיקה לא נכנסת לסכום.** בכלל. גם לא "חלקית". סכום
 *     שמכיל מספר שלא אומת הוא מספר שגוי שנראה סמכותי, וזה מה שהמודול הזה
 *     נבנה כדי למנוע. במקום זה מוצג `needsReviewCount` לצד הסכום, כדי
 *     שיהיה ברור שהסכום אינו התמונה המלאה.
 *
 *  2. **סכום לכל מטבע בנפרד.** אין המרה ולא תהיה — שער המרה הוא החלטה
 *     חשבונאית, לא פרט תצוגה.
 */
export function groupByMonth(invoices: readonly Invoice[]): MonthlySummary[] {
  const byMonth = new Map<string, Invoice[]>();
  for (const inv of invoices) {
    const list = byMonth.get(inv.monthKey);
    if (list) list.push(inv);
    else byMonth.set(inv.monthKey, [inv]);
  }

  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  return [...byMonth.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([monthKey, list]) => {
      const totalsByCurrency = new Map<InvoiceCurrency, MonthlyTotal>();
      let needsReviewCount = 0;

      for (const inv of list) {
        if (inv.needsHumanReview || !inv.fields.currency || inv.fields.total === null) {
          needsReviewCount++;
          continue;
        }
        const cur = inv.fields.currency;
        const acc = totalsByCurrency.get(cur) ?? {
          currency: cur,
          subtotal: 0,
          vatAmount: 0,
          total: 0,
          count: 0,
        };
        acc.subtotal += inv.fields.subtotal ?? 0;
        acc.vatAmount += inv.fields.vatAmount ?? 0;
        acc.total += inv.fields.total;
        acc.count += 1;
        totalsByCurrency.set(cur, acc);
      }

      return {
        monthKey,
        monthLabelHe: monthLabelHe(monthKey),
        invoices: [...list].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
        totals: [...totalsByCurrency.values()].map((t) => ({
          ...t,
          subtotal: round2(t.subtotal),
          vatAmount: round2(t.vatAmount),
          total: round2(t.total),
        })),
        needsReviewCount,
      };
    });
}

/** סמלים לתצוגה. `ILS` על המסך הוא ז׳רגון; `₪` הוא מה שכתוב על החשבונית. */
export const CURRENCY_SYMBOL: Record<InvoiceCurrency, string> = {
  ILS: '₪',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

/** `1234.5` → `1,234.50`. בלי סמל — הסמל נוסף בנפרד כדי לא לשבור כיווניות. */
export function formatAmount(n: number): string {
  return n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
