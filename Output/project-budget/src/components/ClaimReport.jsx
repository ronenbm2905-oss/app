import { useMemo } from "react";
import { Modal } from "./ui/Modal.jsx";
import { Button } from "./ui/Button.jsx";
import { IconDownload, IconWarning } from "./ui/icons.jsx";
import { fmtILS, fmtILSExact } from "../utils/money.js";
import { fmtDate } from "../utils/dates.js";
import { buildClaimReport, downloadClaimCsv } from "../utils/claimReport.js";

/**
 * דוח ההגשה. שני פלטים מאותו מבנה נתונים:
 *   · הדפסה / שמירה כ-PDF — דרך `window.print` והסגנון ב-index.css.
 *   · CSV לאקסל.
 *
 * האזהרות מודפסות בתוך הדוח ולא רק במסך. אם חשבונית חסרת מספר נכנסת להגשה,
 * עדיף שזה יופיע על הנייר מאשר שיתגלה אצל השמאי.
 */
export default function ClaimReport({ project, batch, invoices, onClose }) {
  const report = useMemo(
    () => buildClaimReport({ project, batch, invoices }),
    [project, batch, invoices],
  );
  const { header, rows, totals, warnings } = report;

  return (
    <Modal title={`דוח הגשה — ${header.batchTitle}`} onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap justify-end gap-2 print:hidden">
        <Button variant="secondary" onClick={() => downloadClaimCsv(report)}>
          <IconDownload size={16} /> הורדת CSV
        </Button>
        <Button onClick={() => window.print()}>הדפסה / שמירה כ-PDF</Button>
      </div>

      <div className="print-root bg-white text-navy">
        <header className="border-b-2 border-navy pb-3">
          <h1 className="text-xl font-bold">{header.projectName}</h1>
          {header.address && <p className="text-sm text-ink-muted">{header.address}</p>}
          <p className="mt-2 text-base font-semibold">
            {header.batchTitle}
          </p>
          <p className="text-sm text-ink-muted">
            {header.isSubmitted
              ? `הוגש בתאריך ${fmtDate(header.submittedDate)}`
              : `מועד הגשה מתוכנן: ${fmtDate(header.plannedDate) || "—"} · טרם הוגש`}
          </p>
        </header>

        {warnings.length > 0 && (
          <section className="mt-4 rounded-sm border border-warning-solid/40 bg-warning-fill p-3">
            <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-warning-text">
              <IconWarning size={15} /> לבדיקה לפני הגשה
            </h2>
            <ul className="list-inside list-disc text-sm text-warning-text">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </section>
        )}

        <table className="mt-4 w-full text-sm">
          <thead className="border-b border-navy text-xs text-ink-muted">
            <tr>
              <th className="py-2 pl-2 text-right font-semibold">#</th>
              <th className="py-2 pl-2 text-right font-semibold">ספק</th>
              <th className="py-2 pl-2 text-right font-semibold">מס׳ חשבונית</th>
              <th className="py-2 pl-2 text-right font-semibold">תאריך</th>
              <th className="py-2 pl-2 text-left font-semibold">לפני מע״מ</th>
              <th className="py-2 pl-2 text-left font-semibold">מע״מ</th>
              <th className="py-2 text-left font-semibold">כולל מע״מ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-ink-faint">
                  אין חשבוניות משויכות למנה.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.n} className="border-b border-border">
                <td className="py-1.5 pl-2 text-ink-muted">{r.n}</td>
                <td className="py-1.5 pl-2 font-semibold">{r.vendorName}</td>
                <td className="num py-1.5 pl-2 text-ink-muted">{r.invoiceNumber || "—"}</td>
                <td className="num py-1.5 pl-2 text-ink-muted">{fmtDate(r.issueDate) || "—"}</td>
                <td className="num py-1.5 pl-2 text-left">{fmtILSExact(r.amountNet)}</td>
                <td className="num py-1.5 pl-2 text-left">{fmtILSExact(r.vatAmount)}</td>
                <td className="num py-1.5 text-left font-semibold">
                  {fmtILSExact(r.amountGross)}
                  {r.isPartial && (
                    <div className="text-[11px] font-normal text-warning-text">
                      נדרש {fmtILS(r.claimAmount)}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-navy font-semibold">
              <td colSpan={4} className="py-2">
                סה״כ {totals.count} חשבוניות
              </td>
              <td className="num py-2 pl-2 text-left">{fmtILSExact(totals.net)}</td>
              <td className="num py-2 pl-2 text-left">{fmtILSExact(totals.vat)}</td>
              <td className="num py-2 text-left">{fmtILSExact(totals.gross)}</td>
            </tr>
          </tfoot>
        </table>

        <section className="mt-4 ml-auto w-full max-w-sm text-sm">
          <Line label="סכום החשבוניות" value={totals.claimTotal} />
          {totals.topUp > 0 && (
            <Line label="השלמת חשבונית" value={totals.topUp} note={batch.topUpNote} />
          )}
          <Line label="סה״כ להגשה" value={totals.submitted} strong />
          <Line label="יעד המנה" value={totals.target} muted />
          {Math.abs(totals.gap) > 0.01 && (
            <Line label="פער ליעד" value={totals.gap} tone="warn" />
          )}
        </section>

        <footer className="mt-6 border-t border-border pt-3 text-xs text-ink-muted">
          <p>
            <strong>מסמך מוכן להגשה — אינו מהווה הגשה.</strong> ההגשה ל{header.authority} מבוצעת
            על ידי מנהל הפרויקט.
          </p>
          <p className="mt-1">הופק מתוך מערכת ניהול תקציב הפרויקט · {fmtDate(new Date().toISOString().slice(0, 10))}</p>
        </footer>
      </div>
    </Modal>
  );
}

function Line({ label, value, strong, muted, tone, note }) {
  return (
    <div
      className={`flex justify-between border-b border-border py-1.5 ${
        strong ? "border-navy font-semibold" : ""
      }`}
    >
      <span className={muted ? "text-ink-muted" : ""}>
        {label}
        {note && <span className="block text-[11px] text-ink-faint">{note}</span>}
      </span>
      <span className={`num ${tone === "warn" ? "text-warning-text" : ""}`}>{fmtILSExact(value)}</span>
    </div>
  );
}
