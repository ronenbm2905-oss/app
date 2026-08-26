import { useMemo, useState } from "react";
import StatTile from "./ui/StatTile.jsx";
import { Pill } from "./ui/Button.jsx";
import { IconChevronDown, IconChevronLeft, IconWarning, IconInfo } from "./ui/icons.jsx";
import { fmtILS, fmtSigned, round2 } from "../utils/money.js";
import { chapterRollup, boqSummary, costLineRollup, projectTotals } from "../utils/variance.js";

export default function BudgetView({ slice }) {
  const { costLines, boqItems, invoices, payments } = slice;
  const [openChapter, setOpenChapter] = useState(null);

  const lines = useMemo(() => costLineRollup(costLines, invoices, payments), [costLines, invoices, payments]);
  const totals = useMemo(() => projectTotals(lines), [lines]);
  const rollup = useMemo(() => chapterRollup(boqItems, invoices, payments), [boqItems, invoices, payments]);
  const bs = useMemo(() => boqSummary(rollup), [rollup]);

  return (
    <div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="תקציב הפרויקט" value={totals.budget} />
        <StatTile label="מחויב בחשבוניות" value={totals.committed} />
        <StatTile label="שולם" value={totals.paid} />
        <StatTile label="יתרה לתשלום" value={totals.remaining} />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-navy">שורות התקציב</h2>
        <div className="table-scroll rounded-lg border border-border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-alt text-xs text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-right font-semibold">שורה</th>
                <th className="px-3 py-2 text-left font-semibold">תקציב</th>
                <th className="px-3 py-2 text-left font-semibold">שולם</th>
                <th className="px-3 py-2 text-left font-semibold">מחויב בחשבוניות</th>
                <th className="px-3 py-2 text-left font-semibold">טרם מחויב</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <span className="font-semibold text-navy">{l.name}</span>
                    {l.paidBefore > 0 && (
                      <span className="mr-2 text-xs text-ink-faint">
                        (כולל {fmtILS(l.paidBefore)} ששולם לפני תחילת המעקב)
                      </span>
                    )}
                  </td>
                  <td className="num px-3 py-2 text-left text-navy">{fmtILS(l.budgetGross)}</td>
                  <td className="num px-3 py-2 text-left text-ink-body">{fmtILS(l.paid)}</td>
                  <td className="num px-3 py-2 text-left text-ink-body">
                    {l.committed ? fmtILS(l.committed) : "—"}
                    {l.invoiceCount > 0 && <span className="mr-1 text-xs text-ink-faint">({l.invoiceCount})</span>}
                  </td>
                  <td className={`num px-3 py-2 text-left ${l.overBudget > 0.01 ? "text-danger-text" : "text-ink-muted"}`}>
                    {fmtILS(l.uncommitted)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-navy bg-surface-alt">
              <tr>
                <td className="px-3 py-2 font-semibold text-navy">סה״כ</td>
                <td className="num px-3 py-2 text-left font-semibold text-navy">{fmtILS(totals.budget)}</td>
                <td className="num px-3 py-2 text-left font-semibold text-navy">{fmtILS(totals.paid)}</td>
                <td className="num px-3 py-2 text-left font-semibold text-navy">{fmtILS(totals.committed)}</td>
                <td className="num px-3 py-2 text-left font-semibold text-navy">
                  {fmtILS(round2(totals.budget - totals.committed - lines.reduce((s, l) => s + l.paidBefore, 0)))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {rollup.length > 0 && (
        <section>
          <div className="mb-3">
            <h2 className="text-base font-semibold text-navy">כתב הכמויות — שלושה בסיסים</h2>
            <p className="text-sm text-ink-muted">
              חריגה מול <strong>אושר סופי</strong> היא החשיפה מול הרשות. חריגה מול{" "}
              <strong>ראשוני</strong> היא מה שהפרויקט באמת עולה.
            </p>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="ראשוני" value={bs.initial} />
            <StatTile label="הוגש לרשות" value={bs.submitted} />
            <StatTile label="אושר סופי" value={bs.approved} />
            <StatTile
              label="קוצץ ע״י הרשות"
              value={bs.taxCut}
              hint="עבודה שתבוצע ותשולם — אבל לא תוחזר"
              tone="warning"
            />
          </div>

          <div className="table-scroll rounded-lg border border-border bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-alt text-xs text-ink-muted">
                <tr>
                  <th className="px-3 py-2 text-right font-semibold">פרק</th>
                  <th className="px-3 py-2 text-left font-semibold">ראשוני</th>
                  <th className="px-3 py-2 text-left font-semibold">הוגש</th>
                  <th className="px-3 py-2 text-left font-semibold">אושר</th>
                  <th className="px-3 py-2 text-left font-semibold">קיצוץ</th>
                  <th className="px-3 py-2 text-left font-semibold">מחויב</th>
                </tr>
              </thead>
              <tbody>
                {rollup.map((r) => (
                  <ChapterRow
                    key={r.chapter}
                    row={r}
                    open={openChapter === r.chapter}
                    onToggle={() => setOpenChapter(openChapter === r.chapter ? null : r.chapter)}
                  />
                ))}
              </tbody>
              <tfoot className="border-t-2 border-navy bg-surface-alt">
                <tr>
                  <td className="px-3 py-2 font-semibold text-navy">סה״כ (לפני מע״מ)</td>
                  <td className="num px-3 py-2 text-left font-semibold text-navy">{fmtILS(bs.initial)}</td>
                  <td className="num px-3 py-2 text-left font-semibold text-navy">{fmtILS(bs.submitted)}</td>
                  <td className="num px-3 py-2 text-left font-semibold text-navy">{fmtILS(bs.approved)}</td>
                  <td className="num px-3 py-2 text-left font-semibold text-danger-text">{fmtSigned(bs.taxCut)}</td>
                  <td className="num px-3 py-2 text-left font-semibold text-navy">{fmtILS(bs.committed)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-muted">
            <IconInfo size={14} className="mt-0.5 shrink-0" />
            פרק מסומן ב-<IconWarning size={12} className="inline text-warning-text" /> הוא פרק שבו
            "אושר סופי" קיים <strong>ברמת פרק בלבד</strong> — הפירוט בגיליון המקור היה גרסת עבודה
            מוקדמת ולא התלכד עם הסיכום הרשמי. הסכומים ברמת הפרק נכונים; הפיצול לשורות לא.
          </p>
        </section>
      )}
    </div>
  );
}

function ChapterRow({ row, open, onToggle }) {
  const hasItems = row.items.length > 0;
  const Chevron = open ? IconChevronDown : IconChevronLeft;
  return (
    <>
      <tr className="border-b border-border hover:bg-surface-alt">
        <td className="px-3 py-2">
          <button onClick={onToggle} className="flex items-center gap-1.5 text-right" disabled={!hasItems}>
            {hasItems ? <Chevron size={14} className="text-ink-faint" /> : <span className="w-3.5" />}
            <span className="num text-ink-muted">{row.chapter}</span>
            <span className="font-semibold text-navy">{row.chapterName}</span>
            {row.needsReview && (
              <IconWarning size={13} className="text-warning-text" aria-label="קיים ברמת פרק בלבד" />
            )}
          </button>
        </td>
        <td className="num px-3 py-2 text-left text-ink-body">{fmtILS(row.initial)}</td>
        <td className="num px-3 py-2 text-left text-ink-body">{fmtILS(row.submitted)}</td>
        <td className="num px-3 py-2 text-left text-navy">{fmtILS(row.approved)}</td>
        <td className={`num px-3 py-2 text-left ${row.taxCut < -0.01 ? "text-danger-text" : "text-ink-faint"}`}>
          {row.taxCut < -0.01 ? fmtSigned(row.taxCut) : "—"}
        </td>
        <td className="num px-3 py-2 text-left text-ink-body">
          {row.committed ? fmtILS(row.committed) : "—"}
        </td>
      </tr>
      {open &&
        row.items.map((it) => (
          <tr key={it.id} className="border-b border-border bg-surface-alt/60 text-xs">
            <td className="py-1.5 pr-10 pl-3">
              <span className="num text-ink-faint">{it.code}</span>{" "}
              <span className="text-ink-body">{it.description.slice(0, 90)}</span>
              {it.reviewerNote && (
                <div className="mt-0.5 text-[11px] text-warning-text">הערת בודק: {it.reviewerNote}</div>
              )}
            </td>
            <td className="num px-3 py-1.5 text-left text-ink-muted">{it.priceInitial ? fmtILS(it.priceInitial) : "—"}</td>
            <td className="num px-3 py-1.5 text-left text-ink-muted">{fmtILS(it.priceSubmitted)}</td>
            <td className="num px-3 py-1.5 text-left text-ink-muted">{it.priceApproved ? fmtILS(it.priceApproved) : "—"}</td>
            <td className="px-3 py-1.5 text-left">
              {it.needsReview && <Pill tone="amber">רמת פרק</Pill>}
            </td>
            <td className="num px-3 py-1.5 text-left text-ink-muted">{it.committed ? fmtILS(it.committed) : "—"}</td>
          </tr>
        ))}
    </>
  );
}
