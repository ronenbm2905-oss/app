import { useMemo, useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { Button } from "./ui/Button.jsx";
import { IconCheck, IconWarning } from "./ui/icons.jsx";
import { fmtILS } from "../utils/money.js";
import { makeInvoice } from "../schema.js";

/**
 * השלמת פרטים חסרים — מסך אחד לכל החשבוניות שחסר להן מספר או תאריך.
 *
 * למה זה קיים: הייבוא מגיליון התשלומים הכניס 14 חשבוניות בלי תאריך ובלי מספר,
 * כי במקור פשוט אין. להשלים אותן דרך טופס העריכה פירושו לפתוח ולסגור מודאל
 * עשר פעמים; כאן זו טבלה אחת שנשמרת תוך כדי הקלדה.
 */
export default function QuickFillPanel({ invoices, store, onClose }) {
  const [savedIds, setSavedIds] = useState(() => new Set());

  const incomplete = useMemo(
    () =>
      invoices
        .filter((i) => !i.invoiceNumber || !i.issueDate)
        .sort((a, b) => b.amountGross - a.amountGross),
    // הרשימה מחושבת פעם אחת בכוונה: אילו היא הייתה מתעדכנת בכל שמירה, שורה
    // שהושלמה הייתה נעלמת מתחת לאצבע באמצע ההקלדה.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const save = (inv, patch) => {
    store.upsert("invoices", makeInvoice({ ...inv, ...patch }));
    const next = { ...inv, ...patch };
    if (next.invoiceNumber && next.issueDate) {
      setSavedIds((s) => new Set(s).add(inv.id));
    }
  };

  const remaining = incomplete.filter((i) => {
    const cur = invoices.find((x) => x.id === i.id) || i;
    return !cur.invoiceNumber || !cur.issueDate;
  }).length;

  return (
    <Modal title="השלמת פרטים חסרים" onClose={onClose} wide>
      <p className="mb-4 text-sm text-ink-muted">
        חשבוניות שחסר להן מספר או תאריך. השדות נשמרים ביציאה מהשדה — אין כפתור שמירה.
        {remaining > 0 && (
          <span className="mr-1 font-semibold text-warning-text">נותרו {remaining}.</span>
        )}
      </p>

      {incomplete.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-ink-muted">
          לכל החשבוניות יש מספר ותאריך.
        </p>
      ) : (
        <div className="table-scroll rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-alt text-xs text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-right font-semibold">ספק</th>
                <th className="px-3 py-2 text-left font-semibold">סכום</th>
                <th className="px-3 py-2 text-right font-semibold">מס׳ חשבונית</th>
                <th className="px-3 py-2 text-right font-semibold">תאריך</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {incomplete.map((row) => {
                const inv = invoices.find((x) => x.id === row.id) || row;
                const done = !!inv.invoiceNumber && !!inv.issueDate;
                return (
                  <tr key={inv.id} className={`border-b border-border last:border-0 ${done ? "bg-success-fill/40" : ""}`}>
                    <td className="px-3 py-2 font-semibold text-navy">{inv.vendorName}</td>
                    <td className="num px-3 py-2 text-left text-ink-muted">{fmtILS(inv.amountGross)}</td>
                    <td className="px-3 py-2">
                      <input
                        defaultValue={inv.invoiceNumber}
                        onBlur={(e) => save(inv, { invoiceNumber: e.target.value.trim() })}
                        placeholder="מספר"
                        className="num w-32 rounded-sm border border-border bg-white px-2 py-1 text-sm text-navy outline-none focus:border-accent"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {/*
                        תאריך נשמר ב-onChange ולא ב-onBlur: בבורר תאריכים הבחירה
                        עצמה היא הפעולה המכוונת, ואין סיבה לדרוש מהמשתמש גם לצאת
                        מהשדה כדי שהיא תיתפס.
                      */}
                      <input
                        type="date"
                        value={inv.issueDate || ""}
                        onChange={(e) => save(inv, { issueDate: e.target.value || null })}
                        className="num rounded-sm border border-border bg-white px-2 py-1 text-sm text-navy outline-none focus:border-accent"
                      />
                    </td>
                    <td className="px-3 py-2 text-left">
                      {done ? (
                        <IconCheck size={16} className="text-success-text" aria-label="הושלם" />
                      ) : (
                        <IconWarning size={15} className="text-warning-text" aria-label="חסר" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button onClick={onClose}>סגירה</Button>
      </div>
    </Modal>
  );
}
