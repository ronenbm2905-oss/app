import { useMemo, useState } from "react";
import { Button, Pill } from "./ui/Button.jsx";
import { Modal } from "./ui/Modal.jsx";
import { Field, Select, Textarea } from "./ui/Field.jsx";
import StatTile from "./ui/StatTile.jsx";
import { IconPlus, IconEdit, IconDelete, IconCash, IconWarning } from "./ui/icons.jsx";
import { fmtILS, round2, sum } from "../utils/money.js";
import { monthLabel, monthRange, fmtDate, toMonth } from "../utils/dates.js";
import { makeFundingEvent } from "../schema.js";
import { FUNDING_TYPES, FUNDING_TYPE_LABEL } from "../constants.js";

const TYPE_TONE = { ownerMonthly: "slate", ownerLump: "blue", taxRefund: "green", other: "amber" };

/**
 * מקורות המימון — הצד הנכנס של התזרים.
 *
 * זה החלק שהיה חסר: אפשר היה לרשום כסף שיוצא (תשלום על חשבונית) אבל לא כסף
 * שנכנס. בלי זה "בפועל" בתזרים הוא חצי תמונה, וכל חודש שעבר נראה גרעוני.
 */
export default function FundingPanel({ slice, store, canEdit }) {
  const { project, fundingEvents, claimBatches } = slice;
  const [editing, setEditing] = useState(null); // event | "new"
  const [receipting, setReceipting] = useState(null);

  const rows = useMemo(
    () =>
      fundingEvents
        .slice()
        .sort((a, b) => (a.month || "").localeCompare(b.month || "") || a.type.localeCompare(b.type)),
    [fundingEvents],
  );

  const totals = useMemo(() => {
    const received = rows.filter((f) => f.actualAmount != null);
    return {
      planned: sum(rows, (f) => f.plannedAmount),
      received: sum(received, (f) => f.actualAmount),
      pending: round2(sum(rows, (f) => f.plannedAmount) - sum(received, (f) => f.actualAmount)),
      count: received.length,
    };
  }, [rows]);

  const batchTitle = (id) => claimBatches.find((b) => b.id === id)?.title || null;

  const remove = (id) => {
    if (!confirm("למחוק את מקור המימון הזה מהתזרים?")) return;
    store.remove("fundingEvents", id);
  };

  return (
    <div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="סה״כ מתוכנן להיכנס" value={totals.planned} />
        <StatTile
          label="התקבל בפועל"
          value={totals.received}
          hint={`${totals.count} מתוך ${rows.length} תקבולים נרשמו`}
          tone={totals.received > 0 ? "success" : "default"}
        />
        <StatTile label="טרם התקבל" value={totals.pending} />
        <StatTile
          label={`תקרת החזר מ${project.taxAuthorityName}`}
          value={project.entitlementCap}
          hint={project.entitlementReceived > 0 ? `${fmtILS(project.entitlementReceived)} כמקדמה` : undefined}
        />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          כל שורה היא כסף שאמור להיכנס לקופה. רשום תקבול כשהכסף באמת הגיע — זה מה שהופך
          את התזרים מתוכנית למעקב.
        </p>
        {canEdit && (
          <Button variant="secondary" onClick={() => setEditing("new")}>
            <IconPlus size={16} /> מקור מימון
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-ink-muted">
          אין מקורות מימון. הוסף מימון שוטף, הזרקה חד-פעמית, או החזר צפוי מהרשות.
        </p>
      ) : (
        <div className="table-scroll rounded-lg border border-border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-alt text-xs text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-right font-semibold">חודש</th>
                <th className="px-3 py-2 text-right font-semibold">מקור</th>
                <th className="px-3 py-2 text-right font-semibold">סוג</th>
                <th className="px-3 py-2 text-left font-semibold">מתוכנן</th>
                <th className="px-3 py-2 text-left font-semibold">התקבל</th>
                <th className="px-3 py-2 text-right font-semibold">תאריך</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const gap = round2(f.plannedAmount - (f.actualAmount ?? 0));
                const short = f.actualAmount != null && gap > 0.01;
                return (
                  <tr key={f.id} className="border-b border-border last:border-0 hover:bg-surface-alt">
                    <td className="num px-3 py-2">{monthLabel(f.month)}</td>
                    <td className="px-3 py-2">
                      <span className="font-semibold text-navy">{f.source || "—"}</span>
                      {f.claimBatchId && batchTitle(f.claimBatchId) && (
                        <div className="text-[11px] text-ink-faint">{batchTitle(f.claimBatchId)}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Pill tone={TYPE_TONE[f.type]}>{FUNDING_TYPE_LABEL[f.type]}</Pill>
                    </td>
                    <td className="num px-3 py-2 text-left text-ink-body">{fmtILS(f.plannedAmount)}</td>
                    <td
                      className={`num px-3 py-2 text-left font-semibold ${
                        f.actualAmount == null ? "text-ink-faint" : short ? "text-warning-text" : "text-success-text"
                      }`}
                    >
                      {f.actualAmount == null ? "—" : fmtILS(f.actualAmount)}
                      {short && (
                        <span className="mr-1 inline-flex" title={`התקבל ${fmtILS(gap)} פחות מהמתוכנן`}>
                          <IconWarning size={12} />
                        </span>
                      )}
                    </td>
                    <td className="num px-3 py-2 text-ink-muted">{fmtDate(f.actualDate) || "—"}</td>
                    <td className="px-3 py-2 text-left">
                      {canEdit && (
                        <div className="flex justify-end gap-1">
                          <IconBtn label="רישום תקבול" onClick={() => setReceipting(f)}>
                            <IconCash size={15} />
                          </IconBtn>
                          <IconBtn label="עריכה" onClick={() => setEditing(f)}>
                            <IconEdit size={15} />
                          </IconBtn>
                          <IconBtn label="מחיקה" danger onClick={() => remove(f.id)}>
                            <IconDelete size={15} />
                          </IconBtn>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-navy bg-surface-alt">
              <tr>
                <td colSpan={3} className="px-3 py-2 font-semibold text-navy">
                  סה״כ
                </td>
                <td className="num px-3 py-2 text-left font-semibold text-navy">{fmtILS(totals.planned)}</td>
                <td className="num px-3 py-2 text-left font-semibold text-navy">{fmtILS(totals.received)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {editing && (
        <FundingForm
          event={editing === "new" ? null : editing}
          slice={slice}
          store={store}
          onClose={() => setEditing(null)}
        />
      )}
      {receipting && (
        <ReceiptDialog event={receipting} store={store} onClose={() => setReceipting(null)} />
      )}
    </div>
  );
}

function FundingForm({ event, slice, store, onClose }) {
  const { project, claimBatches } = slice;
  const isNew = !event;
  const [form, setForm] = useState(
    () => event || makeFundingEvent({ projectId: project.id, month: project.startMonth, type: "ownerLump" }),
  );
  const [repeat, setRepeat] = useState(false);
  const [untilMonth, setUntilMonth] = useState(project.endMonth || project.startMonth);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const months = project.startMonth && project.endMonth ? monthRange(project.startMonth, project.endMonth) : [];
  const canSave = form.month && form.plannedAmount > 0;

  const save = () => {
    if (isNew && repeat && untilMonth >= form.month) {
      // מימון שוטף הוא אותו סכום חודש אחרי חודש — הזנה ידנית של 20 שורות
      // זהה היא בדיוק סוג העבודה שהמערכת אמורה לחסוך.
      for (const month of monthRange(form.month, untilMonth)) {
        store.upsert("fundingEvents", makeFundingEvent({ ...form, id: undefined, month }));
      }
    } else {
      store.upsert("fundingEvents", makeFundingEvent(form));
    }
    onClose();
  };

  return (
    <Modal title={isNew ? "מקור מימון חדש" : "עריכת מקור מימון"} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="מקור" value={form.source} onChange={(v) => set({ source: v })} placeholder="אריאל / מס רכוש" />
        <Select
          label="סוג"
          value={form.type}
          onChange={(v) => set({ type: v })}
          options={FUNDING_TYPES.map((t) => ({ value: t, label: FUNDING_TYPE_LABEL[t] }))}
        />
        <Select
          label="חודש"
          value={form.month || ""}
          onChange={(v) => set({ month: v })}
          options={
            months.length
              ? months.map((m) => ({ value: m, label: monthLabel(m) }))
              : [{ value: form.month || "", label: monthLabel(form.month) || "—" }]
          }
          required
        />
        <Field
          label="סכום מתוכנן"
          type="number"
          value={form.plannedAmount}
          onChange={(v) => set({ plannedAmount: Number(v) })}
          required
        />
        {form.type === "taxRefund" && (
          <Select
            label="מנת הגשה מקושרת"
            value={form.claimBatchId || ""}
            onChange={(v) => set({ claimBatchId: v || null })}
            options={[
              { value: "", label: "— ללא קישור —" },
              ...claimBatches.map((b) => ({ value: b.id, label: b.title })),
            ]}
          />
        )}
      </div>

      {isNew && (
        <div className="mt-4 rounded-lg border border-border bg-surface-alt p-3">
          <label className="flex items-center gap-2 text-sm text-ink-body">
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="h-4 w-4" />
            חוזר בכל חודש עד…
          </label>
          {repeat && (
            <div className="mt-2 max-w-[220px]">
              <Select
                value={untilMonth}
                onChange={setUntilMonth}
                options={months.filter((m) => m >= (form.month || "")).map((m) => ({ value: m, label: monthLabel(m) }))}
              />
              <p className="mt-1 text-xs text-ink-muted">
                ייווצרו {monthRange(form.month || untilMonth, untilMonth).length} שורות בסכום זהה.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4">
        <Textarea label="הערות" value={form.notes} onChange={(v) => set({ notes: v })} rows={2} />
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          ביטול
        </Button>
        <Button onClick={save} disabled={!canSave}>
          שמירה
        </Button>
      </div>
    </Modal>
  );
}

function ReceiptDialog({ event, store, onClose }) {
  const [amount, setAmount] = useState(event.actualAmount ?? event.plannedAmount);
  const [date, setDate] = useState(event.actualDate || new Date().toISOString().slice(0, 10));
  const gap = round2(event.plannedAmount - Number(amount));

  const save = () => {
    store.upsert(
      "fundingEvents",
      makeFundingEvent({ ...event, actualAmount: Number(amount), actualDate: date }),
    );
    onClose();
  };

  const clear = () => {
    store.upsert("fundingEvents", makeFundingEvent({ ...event, actualAmount: null, actualDate: null }));
    onClose();
  };

  return (
    <Modal title={`רישום תקבול — ${event.source || FUNDING_TYPE_LABEL[event.type]}`} onClose={onClose}>
      <p className="mb-4 text-sm text-ink-muted">
        מתוכנן ל-{monthLabel(event.month)}:{" "}
        <span className="num font-semibold text-navy">{fmtILS(event.plannedAmount)}</span>
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="סכום שהתקבל" type="number" value={amount} onChange={setAmount} required />
        <Field label="תאריך התקבול" type="date" value={date} onChange={setDate} required />
      </div>

      {toMonth(date) && toMonth(date) !== event.month && (
        <p className="mt-3 text-sm text-warning-text">
          התקבול נרשם ב-{monthLabel(toMonth(date))} במקום {monthLabel(event.month)} — התזרים ישקף
          אותו בחודש שבו הכסף באמת נכנס.
        </p>
      )}
      {gap > 0.01 && (
        <p className="mt-2 text-sm text-warning-text">
          התקבל {fmtILS(gap)} פחות מהמתוכנן.
        </p>
      )}

      <div className="mt-6 flex justify-between gap-2">
        {event.actualAmount != null ? (
          <Button variant="ghost" onClick={clear}>
            ביטול הרישום
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            סגירה
          </Button>
          <Button onClick={save} disabled={!date || !(Number(amount) >= 0)}>
            שמירה
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const IconBtn = ({ children, label, onClick, danger }) => (
  <button
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`rounded-sm p-1.5 transition ${
      danger
        ? "text-ink-muted hover:bg-danger-fill hover:text-danger-text"
        : "text-ink-muted hover:bg-surface-sunk hover:text-navy"
    }`}
  >
    {children}
  </button>
);
