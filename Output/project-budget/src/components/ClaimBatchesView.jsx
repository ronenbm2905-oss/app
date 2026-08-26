import { useMemo, useState } from "react";
import StatTile from "./ui/StatTile.jsx";
import { Button, Pill } from "./ui/Button.jsx";
import { Modal } from "./ui/Modal.jsx";
import { Field } from "./ui/Field.jsx";
import { IconPlus, IconLink, IconUnlink, IconWarning, IconInfo, IconAuthority } from "./ui/icons.jsx";
import { fmtILS, round2, sum } from "../utils/money.js";
import { fmtDate } from "../utils/dates.js";
import {
  batchSummary,
  suggestedTopUp,
  availableForBatch,
  expectedRefundDate,
  derivedBatchStatus,
  claimsOverview,
  claimAmountOf,
} from "../utils/claims.js";
import { makeClaimBatch, makeInvoice } from "../schema.js";
import { BATCH_STATUS_LABEL } from "../constants.js";

const TONE = { planning: "slate", submitted: "blue", partiallyRefunded: "amber", closed: "green" };

export default function ClaimBatchesView({ slice, store, canEdit }) {
  const { project, claimBatches, invoices } = slice;
  const [openId, setOpenId] = useState(claimBatches[0]?.id || null);
  const [submitting, setSubmitting] = useState(null);
  const [refunding, setRefunding] = useState(null);

  const ov = useMemo(
    () => claimsOverview(claimBatches, invoices, project.entitlementCap, project.entitlementReceived),
    [claimBatches, invoices, project.entitlementCap, project.entitlementReceived],
  );

  const addBatch = () => {
    const seq = Math.max(0, ...claimBatches.map((b) => b.seq)) + 1;
    const b = makeClaimBatch({
      projectId: project.id,
      seq,
      title: `מנה ${seq} — הגשה ל${project.taxAuthorityName}`,
      refundLagDays: project.refundLagDays,
    });
    store.upsert("claimBatches", b);
    setOpenId(b.id);
  };

  return (
    <div>
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-info-solid/30 bg-info-fill p-3 text-sm text-info-text">
        <IconInfo size={18} className="mt-0.5 shrink-0" />
        <p>
          <strong>המערכת מכינה מנה — היא לא מגישה אותה.</strong> ההגשה ל{project.taxAuthorityName} היא
          הגשה רשמית לרשות ונעשית על ידך. כאן מסמנים "הוגש" אחרי שזה קרה בפועל.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={`תקרת החזר מ${project.taxAuthorityName}`}
          value={ov.entitlementCap}
          hint={ov.alreadyReceived > 0 ? `מתוכם ${fmtILS(ov.alreadyReceived)} התקבלו כמקדמה` : undefined}
        />
        <StatTile label="הוגש עד כה" value={ov.submittedTotal} />
        <StatTile
          label="בדרך (הוגש וטרם הוחזר)"
          value={ov.inTransit}
          tone={ov.inTransit > 0 ? "warning" : "default"}
        />
        <StatTile label="יתרת זכאות" value={ov.remainingEntitlement} />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-navy">מנות ההגשה</h2>
        {canEdit && (
          <Button variant="secondary" onClick={addBatch}>
            <IconPlus size={16} /> מנה חדשה
          </Button>
        )}
      </div>

      {claimBatches.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-ink-muted">
          אין מנות. מנה היא אוסף חשבוניות שמוגש יחד לרשות מול יעד סכום.
        </p>
      ) : (
        <div className="space-y-3">
          {claimBatches
            .slice()
            .sort((a, b) => a.seq - b.seq)
            .map((batch) => (
              <BatchCard
                key={batch.id}
                batch={batch}
                slice={slice}
                store={store}
                canEdit={canEdit}
                open={openId === batch.id}
                onToggle={() => setOpenId(openId === batch.id ? null : batch.id)}
                onSubmit={() => setSubmitting(batch)}
                onRefund={() => setRefunding(batch)}
              />
            ))}
        </div>
      )}

      {submitting && (
        <SubmitDialog batch={submitting} slice={slice} store={store} onClose={() => setSubmitting(null)} />
      )}
      {refunding && (
        <RefundDialog batch={refunding} slice={slice} store={store} onClose={() => setRefunding(null)} />
      )}
    </div>
  );
}

function BatchCard({ batch, slice, store, canEdit, open, onToggle, onSubmit, onRefund }) {
  const { invoices, project } = slice;
  const s = batchSummary(batch, invoices);
  const derived = derivedBatchStatus(batch, invoices);
  const attached = invoices.filter((i) => i.claimBatchId === batch.id);
  const available = availableForBatch(invoices, project.id);

  const attach = (inv) =>
    store.upsert("invoices", makeInvoice({ ...inv, claimBatchId: batch.id, claimStatus: "submitted" }));
  const detach = (inv) =>
    store.upsert("invoices", makeInvoice({ ...inv, claimBatchId: null, claimStatus: "eligible" }));

  const applyTopUp = () =>
    store.upsert("claimBatches", makeClaimBatch({ ...batch, topUpAmount: suggestedTopUp(batch, invoices) }));

  return (
    <section className="rounded-lg border border-border bg-white">
      <button onClick={onToggle} className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-right">
        <span className="flex items-center gap-2">
          <IconAuthority size={18} className="text-accent" />
          <span className="font-semibold text-navy">{batch.title}</span>
          <Pill tone={TONE[derived]}>{BATCH_STATUS_LABEL[derived]}</Pill>
        </span>
        <span className="flex items-center gap-4 text-sm">
          <span className="text-ink-muted">
            יעד <span className="num font-semibold text-navy">{fmtILS(s.targetAmount)}</span>
          </span>
          <span className="text-ink-muted">
            מגובה בחשבוניות{" "}
            <span className={`num font-semibold ${s.invoicesTotal > 0 ? "text-navy" : "text-ink-faint"}`}>
              {fmtILS(s.invoicesTotal)}
            </span>
          </span>
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="חשבוניות במנה" value={`${s.invoiceCount}`} />
            <MiniStat label="סכום החשבוניות" value={fmtILS(s.invoicesTotal)} />
            <MiniStat label="השלמת חשבונית" value={fmtILS(s.topUpAmount)} />
            <MiniStat
              label="פער ליעד"
              value={fmtILS(s.gapToTarget)}
              tone={Math.abs(s.gapToTarget) < 0.01 ? "success" : "warning"}
            />
          </div>

          {batch.plannedComponents.length > 0 && (
            <div className="mb-4 rounded-lg border border-warning-solid/30 bg-warning-fill p-3">
              <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-warning-text">
                <IconWarning size={15} /> מתוכנן לפי הגיליון — עדיין בלי חשבוניות מאחור
              </div>
              <ul className="space-y-0.5 text-sm text-warning-text">
                {batch.plannedComponents.map((c, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{c.label}</span>
                    <span className="num">{fmtILS(c.amount)}</span>
                  </li>
                ))}
                <li className="flex justify-between border-t border-warning-text/20 pt-1 font-semibold">
                  <span>עדיין לא מגובה</span>
                  <span className="num">{fmtILS(s.unbacked)}</span>
                </li>
              </ul>
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
            <span>מועד מתוכנן: <span className="num">{fmtDate(batch.plannedDate) || "—"}</span></span>
            {batch.submittedDate && <span>הוגש: <span className="num">{fmtDate(batch.submittedDate)}</span></span>}
            <span>
              החזר צפוי: <span className="num">{fmtDate(expectedRefundDate(batch)) || "—"}</span>
              <span className="text-ink-faint"> (+{batch.refundLagDays} יום)</span>
            </span>
            {batch.actualRefundDate && (
              <span className="text-success-text">
                הוחזר <span className="num">{fmtILS(batch.refundedAmount)}</span> ב-
                <span className="num">{fmtDate(batch.actualRefundDate)}</span>
              </span>
            )}
            {s.reduction > 0.01 && (
              <span className="text-danger-text">
                קוצץ <span className="num">{fmtILS(s.reduction)}</span>
              </span>
            )}
          </div>

          {canEdit && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {/*
                ההשלמה סוגרת שארית קטנה אחרי שהחשבוניות כבר במנה. כל עוד יש רכיבים
                מתוכננים בלי חשבונית מאחור, הצעת השלמה תהיה "תקבע את כל המנה כהשלמה" —
                וזה בדיוק מה שאסור. קודם מצרפים חשבוניות, אחר כך סוגרים שארית.
              */}
              {s.unbacked > 0.01 ? (
                <p className="text-sm text-ink-muted">
                  צרף קודם חשבוניות בסך {fmtILS(s.unbacked)} — ההשלמה נועדה לסגור שארית, לא להחליף חשבוניות.
                </p>
              ) : (
                s.gapToTarget > 0.01 && (
                  <Button variant="secondary" onClick={applyTopUp}>
                    קביעת השלמה של {fmtILS(suggestedTopUp(batch, invoices))}
                  </Button>
                )
              )}
              {!batch.submittedDate && <Button onClick={onSubmit}>סימון כהוגשה</Button>}
              {batch.submittedDate && !batch.actualRefundDate && (
                <Button onClick={onRefund}>רישום החזר</Button>
              )}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <InvoiceList
              title={`במנה (${attached.length})`}
              rows={attached}
              empty="עדיין לא שויכה שום חשבונית."
              action={canEdit && !batch.submittedDate ? { icon: <IconUnlink size={14} />, label: "הסרה", fn: detach } : null}
            />
            {canEdit && !batch.submittedDate && (
              <InvoiceList
                title={`זמינות לשיוך (${available.length})`}
                rows={available}
                empty="אין חשבוניות זכאיות פנויות."
                action={{ icon: <IconLink size={14} />, label: "שיוך למנה", fn: attach }}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function InvoiceList({ title, rows, empty, action }) {
  return (
    <div className="rounded-lg border border-border bg-surface-alt p-3">
      <h4 className="mb-2 text-sm font-semibold text-ink-body">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-xs text-ink-faint">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between gap-2 rounded-sm bg-white px-3 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold text-navy">{inv.vendorName}</span>
                <span className="num mr-2 text-xs text-ink-faint">{fmtDate(inv.issueDate)}</span>
              </span>
              <span className="num shrink-0 font-semibold text-navy">{fmtILS(claimAmountOf(inv))}</span>
              {action && (
                <button
                  onClick={() => action.fn(inv)}
                  title={action.label}
                  aria-label={action.label}
                  className="shrink-0 rounded-sm p-1 text-ink-muted transition hover:bg-surface-sunk hover:text-navy"
                >
                  {action.icon}
                </button>
              )}
            </li>
          ))}
          <li className="flex justify-between border-t border-border px-3 pt-1.5 text-sm font-semibold text-navy">
            <span>סה״כ</span>
            <span className="num">{fmtILS(sum(rows, claimAmountOf))}</span>
          </li>
        </ul>
      )}
    </div>
  );
}

function SubmitDialog({ batch, slice, store, onClose }) {
  const s = batchSummary(batch, slice.invoices);
  const [date, setDate] = useState(batch.plannedDate || new Date().toISOString().slice(0, 10));

  return (
    <Modal title="סימון מנה כהוגשה" onClose={onClose}>
      <p className="mb-4 text-sm text-ink-body">
        סימון בדיעבד של הגשה שכבר בוצעה מול {slice.project.taxAuthorityName}. הסכום שיירשם כמוגש
        הוא <strong className="num">{fmtILS(s.submittedTotal)}</strong>
        {s.gapToTarget > 0.01 && (
          <span className="text-warning-text">
            {" "}— שהם {fmtILS(s.gapToTarget)} פחות מהיעד.
          </span>
        )}
      </p>
      <Field label="תאריך ההגשה בפועל" type="date" value={date} onChange={setDate} required />
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>ביטול</Button>
        <Button
          onClick={() => {
            store.upsert(
              "claimBatches",
              makeClaimBatch({ ...batch, submittedDate: date, status: "submitted" }),
            );
            onClose();
          }}
          disabled={!date}
        >
          אישור
        </Button>
      </div>
    </Modal>
  );
}

function RefundDialog({ batch, slice, store, onClose }) {
  const s = batchSummary(batch, slice.invoices);
  const [amount, setAmount] = useState(s.submittedTotal);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const cut = round2(s.submittedTotal - Number(amount));

  return (
    <Modal title="רישום החזר מהרשות" onClose={onClose}>
      <p className="mb-4 text-sm text-ink-muted">
        הוגש: <span className="num font-semibold text-navy">{fmtILS(s.submittedTotal)}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="סכום שהתקבל" type="number" value={amount} onChange={setAmount} required />
        <Field label="תאריך התקבול" type="date" value={date} onChange={setDate} required />
      </div>
      {cut > 0.01 && (
        <p className="mt-3 flex items-start gap-1.5 text-sm text-danger-text">
          <IconWarning size={16} className="mt-0.5 shrink-0" />
          הרשות קיצצה {fmtILS(cut)}. הסכום הזה נשאר עלות שתמומן מהמקורות שלך.
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>ביטול</Button>
        <Button
          onClick={() => {
            store.upsert(
              "claimBatches",
              makeClaimBatch({
                ...batch,
                actualRefundDate: date,
                refundedAmount: Number(amount),
                status: cut > 0.01 ? "partiallyRefunded" : "closed",
              }),
            );
            // החשבוניות במנה מקבלות את תוצאת ההגשה.
            store.update((cur) => ({
              ...cur,
              invoices: cur.invoices.map((i) =>
                i.claimBatchId !== batch.id
                  ? i
                  : makeInvoice({ ...i, claimStatus: cut > 0.01 ? "reducedByTax" : "approvedByTax" }),
              ),
            }));
            onClose();
          }}
          disabled={!date || !(Number(amount) >= 0)}
        >
          שמירה
        </Button>
      </div>
    </Modal>
  );
}

const MINI_TONES = {
  default: "text-navy",
  success: "text-success-text",
  warning: "text-warning-text",
};

const MiniStat = ({ label, value, tone = "default" }) => (
  <div className="rounded-sm border border-border bg-surface-alt px-3 py-2">
    <div className="text-[11px] uppercase tracking-wider text-ink-muted">{label}</div>
    <div className={`num mt-0.5 text-lg font-semibold ${MINI_TONES[tone]}`}>{value}</div>
  </div>
);
