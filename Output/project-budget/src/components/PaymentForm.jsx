import { useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { Button } from "./ui/Button.jsx";
import { Field, Select } from "./ui/Field.jsx";
import { IconDelete } from "./ui/icons.jsx";
import { fmtILS, round2, sum } from "../utils/money.js";
import { fmtDate } from "../utils/dates.js";
import { makePayment, makeInvoice } from "../schema.js";

const METHODS = [
  { value: "transfer", label: "העברה בנקאית" },
  { value: "check", label: "המחאה" },
  { value: "cash", label: "מזומן" },
  { value: "other", label: "אחר" },
];

/**
 * רישום תשלום. חשבונית יכולה להיות משולמת בכמה פעימות, ולכן זו רשימה
 * ולא שדה בודד — "שולם/לא שולם" מאבד בדיוק את המידע שהתזרים צריך.
 */
export default function PaymentForm({ invoice, slice, store, onClose }) {
  const existing = slice.payments.filter((p) => p.invoiceId === invoice.id);
  const paid = sum(existing, (p) => p.amount);
  const balance = round2(invoice.amountGross - paid);

  const [amount, setAmount] = useState(balance > 0 ? balance : 0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("transfer");
  const [reference, setReference] = useState("");

  const add = () => {
    const p = makePayment({
      projectId: invoice.projectId,
      invoiceId: invoice.id,
      date,
      amount: Number(amount),
      method,
      reference,
    });
    const newPaid = round2(paid + p.amount);
    store.update((cur) => ({
      ...cur,
      payments: [...cur.payments, p],
      // שולם במלואו → הסטטוס מתעדכן מעצמו. חצי־תשלום משאיר "מאושרת".
      invoices: cur.invoices.map((x) =>
        x.id !== invoice.id
          ? x
          : makeInvoice({
              ...x,
              status: newPaid >= x.amountGross - 0.01 ? "paid" : x.status === "draft" ? "approved" : x.status,
            }),
      ),
    }));
    onClose();
  };

  const removePayment = (id) => {
    store.update((cur) => {
      const remaining = cur.payments.filter((p) => p.id !== id);
      const stillPaid = sum(remaining.filter((p) => p.invoiceId === invoice.id), (p) => p.amount);
      return {
        ...cur,
        payments: remaining,
        invoices: cur.invoices.map((x) =>
          x.id !== invoice.id || x.status !== "paid" || stillPaid >= x.amountGross - 0.01
            ? x
            : makeInvoice({ ...x, status: "approved" }),
        ),
      };
    });
  };

  return (
    <Modal title={`תשלום — ${invoice.vendorName}`} onClose={onClose}>
      <div className="mb-4 rounded-lg border border-border bg-surface-alt p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-muted">סכום החשבונית</span>
          <span className="num font-semibold text-navy">{fmtILS(invoice.amountGross)}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-ink-muted">שולם עד כה</span>
          <span className="num text-ink-body">{fmtILS(paid)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-border pt-1">
          <span className="font-semibold text-ink-body">יתרה</span>
          <span className={`num font-semibold ${balance > 0 ? "text-danger-text" : "text-success-text"}`}>
            {fmtILS(balance)}
          </span>
        </div>
      </div>

      {existing.length > 0 && (
        <ul className="mb-4 space-y-1">
          {existing.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-sm bg-white px-3 py-1.5 text-sm">
              <span className="num text-ink-muted">{fmtDate(p.date)}</span>
              <span className="num font-semibold text-navy">{fmtILS(p.amount)}</span>
              <button
                onClick={() => removePayment(p.id)}
                title="ביטול תשלום"
                className="rounded-sm p-1 text-ink-muted hover:bg-danger-fill hover:text-danger-text"
              >
                <IconDelete size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="סכום" type="number" value={amount} onChange={(v) => setAmount(v)} required />
        <Field label="תאריך" type="date" value={date} onChange={setDate} required />
        <Select label="אמצעי" value={method} onChange={setMethod} options={METHODS} />
        <Field label="אסמכתא" value={reference} onChange={setReference} />
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          סגירה
        </Button>
        <Button onClick={add} disabled={!(Number(amount) > 0) || !date}>
          רישום תשלום
        </Button>
      </div>
    </Modal>
  );
}
