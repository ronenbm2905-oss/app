import { useMemo, useState } from "react";
import InvoiceForm from "./InvoiceForm.jsx";
import PaymentForm from "./PaymentForm.jsx";
import QuickFillPanel from "./QuickFillPanel.jsx";
import StatTile from "./ui/StatTile.jsx";
import { Button, Pill } from "./ui/Button.jsx";
import { Select } from "./ui/Field.jsx";
import { IconPlus, IconEdit, IconDelete, IconCash, IconSearch, IconAttach, IconWarning } from "./ui/icons.jsx";
import { fmtILS, sum, round2 } from "../utils/money.js";
import { fmtDate } from "../utils/dates.js";
import { invoiceFlags } from "../utils/selectors.js";
import { claimAmountOf } from "../utils/claims.js";
import {
  INVOICE_STATUS,
  INVOICE_STATUS_LABEL,
  CLAIM_STATUS,
  CLAIM_STATUS_LABEL,
} from "../constants.js";

const STATUS_TONE = { draft: "slate", approved: "blue", paid: "green", rejected: "red" };
const CLAIM_TONE = {
  notEligible: "slate",
  eligible: "amber",
  submitted: "blue",
  approvedByTax: "green",
  reducedByTax: "amber",
  rejected: "red",
};

export default function InvoicesView({ slice, store, canEdit }) {
  const { invoices, payments, costLines, claimBatches } = slice;
  const [editing, setEditing] = useState(null); // invoice | "new"
  const [paying, setPaying] = useState(null);
  const [quickFill, setQuickFill] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [claim, setClaim] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return invoices
      .filter((i) => (status ? i.status === status : true))
      .filter((i) => (claim ? i.claimStatus === claim : true))
      .filter((i) =>
        needle
          ? `${i.vendorName} ${i.invoiceNumber} ${i.notes}`.toLowerCase().includes(needle)
          : true,
      )
      .sort((a, b) => (b.issueDate || "").localeCompare(a.issueDate || ""));
  }, [invoices, q, status, claim]);

  const totals = useMemo(() => {
    const committed = invoices.filter((i) => i.status === "approved" || i.status === "paid");
    const paidSum = sum(payments, (p) => p.amount);
    const unclaimed = invoices.filter((i) => !i.claimBatchId && i.claimStatus === "eligible");
    return {
      count: invoices.length,
      gross: sum(invoices, (i) => i.amountGross),
      committed: sum(committed, (i) => i.amountGross),
      paid: paidSum,
      outstanding: round2(sum(committed, (i) => i.amountGross) - paidSum),
      unclaimed: sum(unclaimed, claimAmountOf),
      unclaimedCount: unclaimed.length,
    };
  }, [invoices, payments]);

  const incompleteCount = invoices.filter((i) => !i.invoiceNumber || !i.issueDate).length;

  const batchTitle = (id) => claimBatches.find((b) => b.id === id)?.title || "—";
  const lineName = (id) => costLines.find((c) => c.id === id)?.name || null;

  return (
    <div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="חשבוניות בפנקס" value={totals.count} raw />
        <StatTile label="מחויב (מאושר + שולם)" value={totals.committed} />
        <StatTile label="שולם בפועל" value={totals.paid} />
        <StatTile
          label="ממתין להגשה לרשות"
          value={totals.unclaimed}
          hint={totals.unclaimedCount ? `${totals.unclaimedCount} חשבוניות זכאיות שלא בשום מנה` : "הכול משויך"}
          tone={totals.unclaimed > 0 ? "warning" : "default"}
        />
      </div>

      {incompleteCount > 0 && canEdit && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-solid/30 bg-warning-fill p-3 text-sm text-warning-text">
          <span className="flex items-center gap-2">
            <IconWarning size={18} className="shrink-0" />
            <span>
              <strong>{incompleteCount} חשבוניות חסרות מספר או תאריך.</strong> הן ייכנסו לדוח
              ההגשה כך, ויסומנו בו כחסרות.
            </span>
          </span>
          <Button variant="secondary" onClick={() => setQuickFill(true)}>
            השלמה מהירה
          </Button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative min-w-[200px] flex-1">
          <IconSearch size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש ספק / מספר חשבונית"
            className="w-full rounded-sm border border-border bg-white py-2 pr-9 pl-3 text-sm text-navy outline-none focus:border-accent"
          />
        </div>
        <div className="w-44">
          <Select
            value={status}
            onChange={setStatus}
            options={[{ value: "", label: "כל סטטוסי התשלום" }, ...INVOICE_STATUS.map((s) => ({ value: s, label: INVOICE_STATUS_LABEL[s] }))]}
          />
        </div>
        <div className="w-48">
          <Select
            value={claim}
            onChange={setClaim}
            options={[{ value: "", label: "כל הסטטוסים מול הרשות" }, ...CLAIM_STATUS.map((s) => ({ value: s, label: CLAIM_STATUS_LABEL[s] }))]}
          />
        </div>
        {canEdit && (
          <Button onClick={() => setEditing("new")}>
            <IconPlus size={16} /> חשבונית חדשה
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState hasAny={invoices.length > 0} onAdd={() => setEditing("new")} canEdit={canEdit} />
      ) : (
        <div className="table-scroll rounded-lg border border-border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-alt text-right text-xs text-ink-muted">
              <tr>
                <Th>תאריך</Th>
                <Th>ספק</Th>
                <Th>מס׳</Th>
                <Th align="left">סכום כולל מע״מ</Th>
                <Th align="left">שולם</Th>
                <Th>שורת תקציב</Th>
                <Th>תשלום</Th>
                <Th>מס רכוש</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const f = invoiceFlags(inv, payments);
                return (
                  <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-surface-alt">
                    <Td>
                      <span className="num">{fmtDate(inv.issueDate)}</span>
                      {f.overdue && (
                        <span className="mr-1 inline-flex items-center text-danger-text" title="עבר מועד התשלום">
                          <IconWarning size={13} />
                        </span>
                      )}
                    </Td>
                    <Td>
                      <span className="font-semibold text-navy">{inv.vendorName}</span>
                      {inv.documentId && (
                        <IconAttach size={13} className="mr-1 inline text-ink-faint" aria-label="מסמך מצורף" />
                      )}
                    </Td>
                    <Td className="num text-ink-muted">{inv.invoiceNumber || "—"}</Td>
                    <Td align="left" className="num font-semibold text-navy">{fmtILS(inv.amountGross)}</Td>
                    <Td align="left" className="num text-ink-muted">
                      {f.paid > 0 ? fmtILS(f.paid) : "—"}
                    </Td>
                    <Td className="text-xs text-ink-muted">
                      {lineName(inv.costLineId) || <span className="text-warning-text">לא משויך</span>}
                    </Td>
                    <Td>
                      <Pill tone={STATUS_TONE[inv.status]}>{INVOICE_STATUS_LABEL[inv.status]}</Pill>
                    </Td>
                    <Td>
                      <Pill tone={CLAIM_TONE[inv.claimStatus]}>{CLAIM_STATUS_LABEL[inv.claimStatus]}</Pill>
                      {inv.claimBatchId && (
                        <div className="mt-0.5 text-[11px] text-ink-faint">{batchTitle(inv.claimBatchId)}</div>
                      )}
                    </Td>
                    <Td align="left">
                      {canEdit && (
                        <div className="flex justify-end gap-1">
                          <IconBtn label="רישום תשלום" onClick={() => setPaying(inv)}>
                            <IconCash size={15} />
                          </IconBtn>
                          <IconBtn label="עריכה" onClick={() => setEditing(inv)}>
                            <IconEdit size={15} />
                          </IconBtn>
                          <IconBtn
                            label="מחיקה"
                            danger
                            onClick={() => {
                              if (!confirm(`למחוק את החשבונית של ${inv.vendorName}?`)) return;
                              store.update((cur) => ({
                                ...cur,
                                invoices: cur.invoices.filter((x) => x.id !== inv.id),
                                payments: cur.payments.filter((p) => p.invoiceId !== inv.id),
                                documents: cur.documents.filter((d) => d.invoiceId !== inv.id),
                              }));
                            }}
                          >
                            <IconDelete size={15} />
                          </IconBtn>
                        </div>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-navy bg-surface-alt">
              <tr>
                <Td colSpan={3} className="font-semibold text-navy">
                  {rows.length === invoices.length ? "סה״כ" : `סה״כ מסונן (${rows.length})`}
                </Td>
                <Td align="left" className="num font-semibold text-navy">
                  {fmtILS(sum(rows, (i) => i.amountGross))}
                </Td>
                <Td align="left" className="num text-ink-body">
                  {fmtILS(sum(rows, (i) => invoiceFlags(i, payments).paid))}
                </Td>
                <Td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {editing && (
        <InvoiceForm
          invoice={editing === "new" ? null : editing}
          slice={slice}
          store={store}
          onClose={() => setEditing(null)}
        />
      )}
      {quickFill && (
        <QuickFillPanel invoices={invoices} store={store} onClose={() => setQuickFill(false)} />
      )}
      {paying && <PaymentForm invoice={paying} slice={slice} store={store} onClose={() => setPaying(null)} />}
    </div>
  );
}

function EmptyState({ hasAny, onAdd, canEdit }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center">
      <p className="text-ink-muted">
        {hasAny ? "אין חשבוניות שתואמות את הסינון." : "הפנקס ריק. כל חשבונית שתיכנס כאן תופיע בתזרים, בתקציב מול ביצוע, ובמנות ההגשה."}
      </p>
      {!hasAny && canEdit && (
        <Button className="mt-4" onClick={onAdd}>
          <IconPlus size={16} /> חשבונית ראשונה
        </Button>
      )}
    </div>
  );
}

// מחלקות מפורשות ולא `text-${align}` — Tailwind סורק מחרוזות סטטיות בקוד,
// ומחלקה שנבנית בזמן ריצה פשוט לא תיווצר ב-CSS.
const ALIGN = { right: "text-right", left: "text-left", center: "text-center" };

const Th = ({ children, align = "right" }) => (
  <th className={`px-3 py-2 font-semibold ${ALIGN[align]}`}>{children}</th>
);
const Td = ({ children, align = "right", className = "", colSpan }) => (
  <td colSpan={colSpan} className={`px-3 py-2 ${ALIGN[align]} ${className}`}>
    {children}
  </td>
);
const IconBtn = ({ children, label, onClick, danger }) => (
  <button
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`rounded-sm p-1.5 transition ${
      danger ? "text-ink-muted hover:bg-danger-fill hover:text-danger-text" : "text-ink-muted hover:bg-surface-sunk hover:text-navy"
    }`}
  >
    {children}
  </button>
);
