// ============================================================================
// InvoicesView.tsx — מסך החשבוניות: טבלה לפי חודש, סה״כ, וכפתור אחד לרו״ח.
//
// ---------------------------------------------------------------------------
// ★ שורה שלא אומתה נראית **אחרת לגמרי**, לא "עם כוכבית"
// ---------------------------------------------------------------------------
// ההנחיה מרונן: "לא הצלחתי לקרוא את הסכום — תסתכלי", לא `needsHumanReview`.
// ולכן השורה הזאת לא מציגה מספר בכלל. אין מספר אפור, אין מספר עם סימן שאלה,
// ואין tooltip. יש מקום ריק, משפט בעברית שאומר מה לא הצלחתי לקרוא, וכפתור
// שפותח את המקור.
//
// הסיבה היא לא עיצובית: מספר על המסך **נקרא**, גם כשיש לידו אזהרה. אם היא
// תראה 1,950 ליד המילה "בערך", היא תזכור 1,950. מקום ריק אי אפשר לזכור.
//
// ---------------------------------------------------------------------------
// נגישות
// ---------------------------------------------------------------------------
// `<table>` אמיתי עם `<th scope>` — לא רשת של `div`-ים. קורא מסך צריך לדעת
// שזו טבלה ומה כותרת העמודה של כל תא, וזה גם מה שגורם לזום של 200% לעבוד.
// גדלי מגע מינימום 44px בכפתורים, פוקוס נראה, וניגודיות מעל 4.5:1.
// ============================================================================

import { useMemo, useState } from 'react';
import type { Invoice, MonthlySummary } from '../types';
import { CURRENCY_SYMBOL, formatAmount, type InvoiceRunResult } from '../utils/invoicePipeline';
import { downloadAccountantCsv } from '../utils/accountantExport';
import { Badge, Banner } from '../../src/components/ui/Badge';
import { t } from '../i18n';

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : dateFmt.format(d);
}

export interface InvoicesViewProps {
  result: InvoiceRunResult;
  invoices: Invoice[];
  canEdit: boolean;
  onToggleReviewed: (id: string) => void;
}

export function InvoicesView({ result, invoices, canEdit, onToggleReviewed }: InvoicesViewProps) {
  // הקיבוץ מחושב מחדש מהרשימה המעודכנת, כדי שסימון "נבדק" ישתקף מיד.
  const months = useMemo<MonthlySummary[]>(() => {
    const byKey = new Map<string, Invoice[]>();
    for (const inv of invoices) {
      const list = byKey.get(inv.monthKey);
      if (list) list.push(inv);
      else byKey.set(inv.monthKey, [inv]);
    }
    return result.months.map((m) => ({ ...m, invoices: byKey.get(m.monthKey) ?? m.invoices }));
  }, [invoices, result.months]);

  const needsReview = invoices.filter((i) => i.needsHumanReview && !i.reviewed).length;

  return (
    <div className="space-y-5">
      <TopSummary
        needsReview={needsReview}
        total={invoices.length}
        onExport={() => downloadAccountantCsv(invoices, months)}
        canEdit={canEdit}
      />

      {months.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          {t('invoicesEmpty')}
        </p>
      ) : (
        months.map((month) => (
          <MonthSection
            key={month.monthKey}
            month={month}
            canEdit={canEdit}
            onToggleReviewed={onToggleReviewed}
          />
        ))
      )}

      {result.openQuestions.length > 0 ? <OpenQuestions result={result} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function TopSummary({
  needsReview,
  total,
  onExport,
  canEdit,
}: {
  needsReview: number;
  total: number;
  onExport: () => void;
  canEdit: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-bold text-slate-900">{t('invoicesTitle')}</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        {total === 0
          ? t('invoicesNoneYet')
          : `אספתי ${total} חשבוניות. הן שמורות בתיקייה לפי חודש, וגם כאן בטבלה.`}
      </p>

      {needsReview > 0 ? (
        <div className="mt-3">
          <Banner tone="warn" title={t('invoicesNeedYouTitle')}>
            {needsReview === 1
              ? 'יש חשבונית אחת שלא הצלחתי לקרוא במלואה. היא מסומנת למטה, ולא נכללה בסכומים.'
              : `יש ${needsReview} חשבוניות שלא הצלחתי לקרוא במלואן. הן מסומנות למטה, ולא נכללו בסכומים.`}
          </Banner>
        </div>
      ) : null}

      {/* ★ כפתור אחד. בלי בחירת עמודות, בלי דיאלוג, בלי המילה CSV. */}
      <div className="mt-4">
        <button
          type="button"
          onClick={onExport}
          disabled={!canEdit || total === 0}
          className="min-h-[44px] w-full rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 sm:w-auto"
        >
          {t('invoicesExport')}
        </button>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{t('invoicesExportHint')}</p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function MonthSection({
  month,
  canEdit,
  onToggleReviewed,
}: {
  month: MonthlySummary;
  canEdit: boolean;
  onToggleReviewed: (id: string) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">{month.monthLabelHe}</h3>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {month.totals.length === 0 ? (
            <span className="text-slate-500">{t('invoicesNoTotal')}</span>
          ) : (
            month.totals.map((tot) => (
              <span key={tot.currency} className="font-semibold text-slate-900">
                <span aria-hidden="true">{CURRENCY_SYMBOL[tot.currency]}</span>
                {formatAmount(tot.total)}
                <span className="ms-1 text-xs font-normal text-slate-500">
                  ({tot.count} חשבוניות)
                </span>
              </span>
            ))
          )}
        </div>
      </div>

      {month.needsReviewCount > 0 ? (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          {/* הסכום למעלה **אינו** התמונה המלאה, וזה נאמר במפורש ולא ברמז. */}
          {month.needsReviewCount === 1
            ? 'הסכום למעלה לא כולל חשבונית אחת שלא הצלחתי לקרוא.'
            : `הסכום למעלה לא כולל ${month.needsReviewCount} חשבוניות שלא הצלחתי לקרוא.`}
        </p>
      ) : null}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">חשבוניות של {month.monthLabelHe}</caption>
          <thead>
            <tr className="border-b border-slate-300 text-right text-xs text-slate-600">
              <th scope="col" className="py-2 pe-2 font-medium">{t('colDate')}</th>
              <th scope="col" className="py-2 pe-2 font-medium">{t('colSupplier')}</th>
              <th scope="col" className="py-2 pe-2 font-medium">{t('colNumber')}</th>
              <th scope="col" className="py-2 pe-2 font-medium">{t('colVat')}</th>
              <th scope="col" className="py-2 pe-2 font-medium">{t('colTotal')}</th>
              <th scope="col" className="py-2 pe-2 font-medium">{t('colStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {month.invoices.map((inv) => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                canEdit={canEdit}
                onToggleReviewed={onToggleReviewed}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function InvoiceRow({
  invoice,
  canEdit,
  onToggleReviewed,
}: {
  invoice: Invoice;
  canEdit: boolean;
  onToggleReviewed: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const suspect = invoice.needsHumanReview;
  const f = invoice.fields;

  return (
    <>
      <tr
        className={`border-b border-slate-100 align-top ${
          suspect ? 'bg-amber-50/60' : ''
        } ${invoice.reviewed ? 'opacity-60' : ''}`}
      >
        <td className="py-2 pe-2 text-slate-700">{formatDate(f.issueDate ?? invoice.receivedAt)}</td>

        <td className="py-2 pe-2">
          {/* ★ שם ספק שלא אומת לא מוצג בכלל — גם לא מטושטש. */}
          <span className="font-medium text-slate-900">{f.supplierName ?? '—'}</span>
          <span className="block text-xs text-slate-500">{invoice.fromDomain}</span>
        </td>

        <td className="py-2 pe-2 text-slate-700">{f.invoiceNumber ?? '—'}</td>

        <td className="py-2 pe-2 text-slate-700">
          {f.vatAmount !== null && f.currency ? (
            <>
              <span aria-hidden="true">{CURRENCY_SYMBOL[f.currency]}</span>
              {formatAmount(f.vatAmount)}
            </>
          ) : (
            '—'
          )}
        </td>

        <td className="py-2 pe-2 font-semibold text-slate-900">
          {f.total !== null && f.currency ? (
            <>
              <span aria-hidden="true">{CURRENCY_SYMBOL[f.currency]}</span>
              {formatAmount(f.total)}
            </>
          ) : (
            // ★ מקום ריק, ולא מספר. ראה ההערה בראש הקובץ.
            <span className="text-amber-800">{t('invoiceAmountUnreadable')}</span>
          )}
        </td>

        <td className="py-2 pe-2">
          {suspect ? (
            <Badge tone="warn">{t('invoiceNeedsYou')}</Badge>
          ) : invoice.reviewed ? (
            <Badge tone="quiet">{t('invoiceReviewed')}</Badge>
          ) : (
            <Badge tone="quiet">{t('invoiceOk')}</Badge>
          )}
        </td>
      </tr>

      {suspect ? (
        <tr className="border-b border-slate-100 bg-amber-50/40">
          <td colSpan={6} className="px-2 pb-3">
            <ul className="space-y-1 text-xs leading-relaxed text-amber-900">
              {invoice.issues.map((issue, i) => (
                <li key={i}>• {issue.messageHe}</li>
              ))}
            </ul>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {/* ★ קישור למקור — בלי זה "שדה ריק עם הסבר" לא שווה כלום. */}
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="min-h-[44px] rounded border border-slate-400 bg-white px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                {t('invoiceShowSource')}
              </button>

              {canEdit ? (
                <button
                  type="button"
                  onClick={() => onToggleReviewed(invoice.id)}
                  className="min-h-[44px] rounded border border-slate-400 bg-white px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  {invoice.reviewed ? t('invoiceUnmark') : t('invoiceMarkChecked')}
                </button>
              ) : null}
            </div>

            {open ? (
              <dl className="mt-2 grid gap-1 rounded border border-slate-300 bg-white p-2 text-xs text-slate-700 sm:grid-cols-2">
                <div>
                  <dt className="inline font-medium">{t('invoiceSourceMail')}: </dt>
                  <dd className="inline">{invoice.sourceItemId}</dd>
                </div>
                <div>
                  <dt className="inline font-medium">{t('invoiceFileName')}: </dt>
                  <dd className="inline">{invoice.attachment.fileName}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="inline font-medium">{t('invoiceSavedAt')}: </dt>
                  <dd className="inline break-all">{invoice.filePath}</dd>
                </div>
                {invoice.unverified.total !== null ? (
                  <div className="sm:col-span-2">
                    <dt className="inline font-medium">{t('invoiceUnverifiedAmount')}: </dt>
                    {/* מוצג **רק** כאן, ורק עם המילים "לא הצלחתי לוודא" לידו. */}
                    <dd className="inline">{invoice.unverified.total}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------

/**
 * ★ מיילים שנראו קשורים לחשבונית ולא הפכו לשורה.
 *
 * הקטע הזה קיים כי הפער בין "נראה כמו חשבונית" ל"לא בטבלה", **בלי הסבר**,
 * הוא בדיוק מה שגורם למשתמשת להפסיק לסמוך על הכלי. עדיף להגיד "ראיתי, ולא
 * נגעתי, וזאת הסיבה" מאשר לא להגיד כלום.
 */
function OpenQuestions({ result }: { result: InvoiceRunResult }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-bold text-slate-900">{t('invoiceQuestionsTitle')}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{t('invoiceQuestionsBody')}</p>
      <ul className="mt-3 space-y-2">
        {result.openQuestions.map((q) => (
          <li key={q.messageId} className="rounded border border-slate-200 bg-white px-3 py-2 text-xs">
            <div className="font-medium text-slate-800">{q.subject || q.fromDomain}</div>
            <div className="mt-0.5 text-slate-600">{q.reasonHe}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
