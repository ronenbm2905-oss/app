import { useMemo, useState } from "react";
import { Button } from "./ui/Button.jsx";
import { EditableField } from "./ui/EditableField.jsx";
import { IconSearch, IconUsers, IconWarning } from "./ui/icons.jsx";
import { fmtILS } from "../utils/money.js";
import { buildingProfit } from "../utils/profitability.js";
import { managerLoad, managerConflicts, knownManagers } from "../utils/managers.js";
import { addressKey } from "../utils/id.js";

/**
 * רשימת הבניינים לפי מי שמנהל אותם.
 *
 * ⚠ **שתי עמודות שונות בגיליון עונות על השאלה הזו, והן חלוקות.**
 * ״מנהל האיזור״ יושב בגיליון הראשי (עמודה חופשית), ו״עובד אחראי״ יושב בגיליון
 * נפרד שלא הוצלב מעולם. רונן אמר שהחלוקה האמיתית היא **מנהל האיזור**, ולכן
 * הוא העמודה הראשית כאן — אבל שתיהן מוצגות ושתיהן נערכות, כי מיזוג ביניהן הוא
 * החלטה עסקית ולא טכנית: ״אבי״ ו״אנדריי״ מופיעים כל אחד רק בעמודה אחת, ורק
 * רונן יודע אם זה אותו אדם.
 *
 * שלוש הכרעות שמייחדות את המסך מטבלת הרווחיות:
 *   · שיוך נעשה **בשורה עצמה** — 131 בניינים זה 131 כניסות ויציאות אחרת.
 *   · **שיוך מרוכז** — סימון כמה שורות ושיוכן בפעולה אחת, כי חלוקה מחדש
 *     נעשית בקבוצות ולא אחד-אחד.
 *   · **הסתירות מסומנות ואפשר לסנן אליהן**, כי הן הממצא ולא רעש.
 */
export default function AssignmentsView({ data, contractIndex, feeIndex, asOf, readOnly = false, update, applyBatch, onOpenBuilding }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all"); // all | none | conflicts | mgr:<name>
  const [selected, setSelected] = useState(() => new Set());
  const [bulkField, setBulkField] = useState("areaManager");
  const [bulkValue, setBulkValue] = useState("");

  const active = useMemo(() => data.buildings.filter((b) => b.status === "active"), [data.buildings]);

  const load = useMemo(
    () => managerLoad(active, data.employees, contractIndex, asOf, feeIndex),
    [active, data.employees, contractIndex, asOf, feeIndex]
  );
  const conflicts = useMemo(() => managerConflicts(active, data.employees), [active, data.employees]);
  const managerNames = useMemo(() => knownManagers(data.buildings, data.employees), [data.buildings, data.employees]);

  const empById = useMemo(() => new Map(data.employees.map((e) => [e.id, e.name])), [data.employees]);
  const empOptions = useMemo(
    () => data.employees.map((e) => ({ value: e.id, label: e.active ? e.name : `${e.name} (לא פעיל)` })),
    [data.employees]
  );

  const rows = useMemo(() => {
    const needle = addressKey(q);
    const conflictIds = new Set(conflicts.rows.map((r) => r.buildingId));
    return active
      .filter((b) => {
        if (filter === "all") return true;
        if (filter === "none") return !b.areaManager?.trim() && !b.assignedEmployeeId;
        if (filter === "conflicts") return conflictIds.has(b.id);
        return (b.areaManager || "").trim() === filter.slice(4);
      })
      .filter((b) => !needle || [b.address, ...b.aliases].some((a) => addressKey(a).includes(needle)))
      .map((b) => ({
        building: b,
        ...buildingProfit(b, contractIndex, asOf, feeIndex),
        manager: (b.areaManager || "").trim(),
        employeeName: empById.get(b.assignedEmployeeId) || "",
        conflict: conflictIds.has(b.id),
      }))
      .sort((a, b) => a.address.localeCompare(b.address, "he"));
  }, [active, contractIndex, feeIndex, asOf, q, filter, conflicts, empById]);

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const visibleIds = rows.map((r) => r.buildingId);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const toggleAll = () => setSelected(allVisibleSelected ? new Set() : new Set(visibleIds));

  /** שיוך מרוכז בעדכון-מצב אחד — לא 30 קריאות שכל אחת בונה על מצב ישן. */
  const applyBulk = () => {
    if (readOnly || !selected.size) return;
    const patch = bulkField === "areaManager"
      ? { areaManager: bulkValue.trim() }
      : { assignedEmployeeId: bulkValue || null };
    applyBatch("buildings", {
      updates: [...selected].map((id) => ({ id, patch })),
      creates: [],
    });
    setSelected(new Set());
  };

  const Chip = ({ id, label, count, tone = "slate" }) => (
    <button
      onClick={() => { setFilter(id); setSelected(new Set()); }}
      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
        filter === id
          ? "border-slate-900 bg-slate-900 text-white"
          : tone === "amber"
            ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label} <span className="tnum opacity-70">{count}</span>
    </button>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      {readOnly && (
        <div className="card border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          צפייה בתמונה של תאריך עבר — השיוך נעול. חזרה להיום כדי לשנות.
        </div>
      )}

      {/* ⚠ הממצא: שתי העמודות חלוקות. לא ממוזג אוטומטית — זו החלטה של רונן. */}
      {conflicts.rows.length > 0 && filter !== "conflicts" && (
        <button
          onClick={() => { setFilter("conflicts"); setSelected(new Set()); }}
          className="flex w-full items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-right text-sm text-amber-900 transition hover:bg-amber-100"
        >
          <IconWarning className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <b>ב-{conflicts.rows.length} בניינים מנהל האיזור והעובד האחראי אינם אותו שם.</b>{" "}
            שתי העמודות ישבו בשני גיליונות שלא הוצלבו מעולם.
            {conflicts.topPair && (
              <> הפער הגדול: <b>{conflicts.topPair.label}</b> ב-{conflicts.topPair.count} בניינים.</>
            )}{" "}
            לא מיזגתי אותן — לחץ כדי לראות ולהכריע.
          </span>
        </button>
      )}

      {/* מי מנהל מה, לפי הגיליון הראשי */}
      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-baseline gap-2">
          <IconUsers className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700">מי מנהל מה</h2>
          <span className="text-xs text-slate-500">לפי מנהל האיזור שבגיליון הראשי</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip id="all" label="כל הבניינים" count={active.length} />
          {load.managers.map((m) => (
            <Chip key={m.name} id={`mgr:${m.name}`} label={m.name} count={m.buildingCount} />
          ))}
          {load.unmanaged > 0 && <Chip id="mgr:" label="ללא מנהל איזור" count={load.unmanaged} tone="amber" />}
          {load.orphans > 0 && <Chip id="none" label="בלי אף שיוך" count={load.orphans} tone="amber" />}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {load.managers.map((m) => (
            <div key={m.name} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500">
              <div className="font-medium text-slate-700">{m.name}</div>
              <div className="tnum mt-0.5">{m.buildingCount} בניינים</div>
              <div className="tnum">{fmtILS(m.income)} הכנסה · {fmtILS(m.profit)} רווח</div>
            </div>
          ))}
        </div>
      </div>

      {/* חיפוש + שיוך מרוכז */}
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[14rem] flex-1">
            <IconSearch className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חיפוש כתובת…"
              className="w-full rounded-lg border border-slate-300 py-1.5 pr-9 pl-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <span className="text-sm text-slate-500 tnum">{rows.length} בניינים</span>
        </div>

        {selected.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">
            <span className="tnum font-medium">{selected.size} מסומנים</span>
            <span>→ שנה</span>
            <select value={bulkField} disabled={readOnly}
              onChange={(e) => { setBulkField(e.target.value); setBulkValue(""); }}
              className="rounded border border-slate-500 bg-slate-800 px-2 py-1 text-sm">
              <option value="areaManager">מנהל איזור</option>
              <option value="assignedEmployeeId">עובד אחראי</option>
            </select>
            <span>ל:</span>
            {bulkField === "areaManager" ? (
              <>
                <input value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}
                  list="bulk-managers" placeholder="שם, או ריק לניקוי" disabled={readOnly}
                  className="rounded border border-slate-500 bg-slate-800 px-2 py-1 text-sm" />
                <datalist id="bulk-managers">
                  {managerNames.map((n) => <option key={n} value={n} />)}
                </datalist>
              </>
            ) : (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} disabled={readOnly}
                className="rounded border border-slate-500 bg-slate-800 px-2 py-1 text-sm">
                <option value="">— ללא עובד</option>
                {empOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            <Button className="border-white bg-white !text-slate-900 hover:bg-slate-100"
              disabled={readOnly} onClick={applyBulk}>
              החל על {selected.size}
            </Button>
            <button onClick={() => setSelected(new Set())} className="text-xs underline opacity-80 hover:opacity-100">
              ביטול הסימון
            </button>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th w-10">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll}
                    disabled={readOnly} className="cursor-pointer" title="סימון הכל" />
                </th>
                <th className="th">כתובת</th>
                <th className="th" title="העמודה שבגיליון הראשי — החלוקה האמיתית">מנהל האיזור</th>
                <th className="th" title="מהגיליון הנפרד ׳רשימת בנינים בחלוקה לעובדים׳">עובד אחראי</th>
                <th className="th">הכנסה</th>
                <th className="th">רווח</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.buildingId}
                  className={`hover:bg-slate-50 ${r.conflict ? "bg-amber-50/60" : ""}`}>
                  <td className="td">
                    <input type="checkbox" checked={selected.has(r.buildingId)} disabled={readOnly}
                      onChange={() => toggle(r.buildingId)} className="cursor-pointer" />
                  </td>
                  <td className="td font-medium">
                    <button onClick={() => onOpenBuilding(r.buildingId)}
                      className="text-right hover:underline" title="פתיחת דף הבניין">
                      {r.address}
                    </button>
                  </td>
                  {/* טקסט חופשי עם הצעות, ולא בורר סגור: ״אבי״ ו״אסף״ קיימים רק
                      כאן, וכל רשימה סגורה הייתה מוחקת אותם או חוסמת שם חדש. */}
                  <td className="td">
                    <EditableField
                      value={r.manager}
                      readOnly={readOnly}
                      placeholder="— ללא מנהל"
                      suggestions={managerNames}
                      className={r.manager ? "" : "text-amber-800"}
                      onSave={(v) => update("buildings", r.buildingId, { areaManager: v })}
                    />
                  </td>
                  <td className="td">
                    <EditableField
                      type="select"
                      value={r.assignedEmployeeId || ""}
                      readOnly={readOnly}
                      placeholder="— ללא עובד"
                      options={empOptions}
                      className={r.conflict ? "border-amber-400 text-amber-800" : ""}
                      onSave={(v) => update("buildings", r.buildingId, { assignedEmployeeId: v })}
                    />
                    {r.conflict && (
                      <span className="mr-1 text-[11px] text-amber-700" title="מנהל האיזור והעובד האחראי אינם אותו שם">
                        ≠
                      </span>
                    )}
                  </td>
                  <td className="td tnum text-slate-600">{fmtILS(r.income)}</td>
                  <td className={`td tnum ${r.isLoss ? "font-semibold text-red-700" : "text-slate-600"}`}>
                    {fmtILS(r.profit)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td className="td py-8 text-center text-slate-400" colSpan={6}>אין בניינים בסינון הזה</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
