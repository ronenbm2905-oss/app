import { useMemo, useState } from "react";
import { Button } from "./ui/Button.jsx";
import { StatTile } from "./ui/StatTile.jsx";
import { IconWarning, IconSearch, IconShield } from "./ui/icons.jsx";
import { fmtDate, fmtRelative, todayISO, addMonths } from "../utils/dates.js";
import { addressKey } from "../utils/id.js";
import { makeInspection } from "../schema.js";
import {
  indexInspections, buildingInspections, inspectionSummary, planBulkRecord,
  INSPECTION_STATUS_LABEL, STATUS_ORDER,
} from "../utils/inspections.js";
import { INSPECTION_TYPES, INSPECTION_TYPE_LABEL, INSPECTION_INTERVAL_MONTHS } from "../constants.js";

const STATUS_STYLE = {
  never: "bg-slate-100 text-slate-500 border-slate-200",
  overdue: "bg-red-100 text-red-800 border-red-300",
  dueSoon: "bg-amber-100 text-amber-800 border-amber-300",
  ok: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

/**
 * מסך הביקורות התקופתיות.
 *
 * נקודת הפתיחה היא 131 בניינים × 4 סוגים = **524 תאים, אפס מהם מתועדים**.
 * לכן זה בראש ובראשונה **מסך הזנה**: בחירה מרובה + רישום מרוכז, עם תצוגה
 * מקדימה של מה בדיוק ישתנה. מסך שרק מציג 524 פריטים אדומים לא היה מזיז כלום —
 * הוא היה הופך את החוסר לרעש שמתרגלים אליו, בדיוק כמו העמודות הריקות בגיליון.
 */
export default function InspectionsView({ data, applyBatch, asOf = todayISO(), readOnly = false, onOpenBuilding }) {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(() => new Set());
  const [bulkType, setBulkType] = useState(INSPECTION_TYPES[0]);
  const [bulkDate, setBulkDate] = useState(asOf);
  const [bulkVendor, setBulkVendor] = useState("");
  const [flash, setFlash] = useState("");

  const active = useMemo(() => data.buildings.filter((b) => b.status === "active"), [data.buildings]);
  const idx = useMemo(() => indexInspections(data.inspections), [data.inspections]);
  const summary = useMemo(() => inspectionSummary(active, data.inspections, asOf), [active, data.inspections, asOf]);
  const empById = useMemo(() => new Map(data.employees.map((e) => [e.id, e.name])), [data.employees]);
  const vendorById = useMemo(() => new Map(data.vendors.map((v) => [v.id, v])), [data.vendors]);

  const rows = useMemo(() => {
    const needle = addressKey(q);
    return active
      .map((b) => ({ building: b, cells: buildingInspections(b, idx, asOf) }))
      .filter(({ building, cells }) => {
        if (needle && !addressKey(building.address).includes(needle)) return false;
        const relevant = typeFilter === "all" ? cells : cells.filter((c) => c.type === typeFilter);
        if (!relevant.length) return false;
        if (statusFilter !== "all" && !relevant.some((c) => c.status === statusFilter)) return false;
        return true;
      })
      .sort((a, b) => {
        const wa = Math.min(...a.cells.map((c) => STATUS_ORDER[c.status]));
        const wb = Math.min(...b.cells.map((c) => STATUS_ORDER[c.status]));
        return wa - wb || a.building.address.localeCompare(b.building.address, "he");
      });
  }, [active, idx, q, typeFilter, statusFilter, asOf]);

  const toggle = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const allShown = rows.length > 0 && rows.every(({ building }) => selected.has(building.id));
  const toggleAll = () =>
    setSelected(allShown ? new Set() : new Set(rows.map((r) => r.building.id)));

  // תצוגה מקדימה — מה בדיוק ישתנה, לפני האישור.
  const plan = useMemo(
    () => planBulkRecord({
      buildingIds: [...selected], type: bulkType, date: bulkDate,
      inspections: data.inspections, vendorId: bulkVendor || null,
    }),
    [selected, bulkType, bulkDate, bulkVendor, data.inspections]
  );

  const commit = () => {
    if (plan.error || (!plan.updates.length && !plan.creates.length)) return;
    applyBatch("inspections", {
      updates: plan.updates,
      creates: plan.creates.map((c) => makeInspection(c)),
    });
    setFlash(
      `נרשמו ${plan.creates.length + plan.updates.length} ביקורות ` +
      `מסוג ״${INSPECTION_TYPE_LABEL[bulkType]}״ בתאריך ${fmtDate(bulkDate)}` +
      (plan.updates.length ? ` (${plan.updates.length} עודכנו, ${plan.creates.length} נוספו)` : "")
    );
    setSelected(new Set());
    setTimeout(() => setFlash(""), 6000);
  };

  const pct = (n) => (summary.total ? `${((n / summary.total) * 100).toFixed(0)}%` : "—");

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="פג תוקף" value={summary.counts.overdue} tone={summary.counts.overdue ? "bad" : "good"}
          hint="בוצעה בעבר, ועבר מועדה" />
        <StatTile label="מעולם לא תועד" value={summary.counts.never}
          tone={summary.counts.never ? "warn" : "good"} hint={`${pct(summary.counts.never)} מכלל התאים`} />
        <StatTile label="מתקרב" value={summary.counts.dueSoon} tone={summary.counts.dueSoon ? "warn" : "good"} />
        <StatTile label="כיסוי תיעוד" value={pct(summary.recorded)}
          tone={summary.coverage > 0.8 ? "good" : summary.coverage > 0 ? "warn" : "bad"}
          hint={`${summary.recorded} מתוך ${summary.total} תאים`} />
      </div>

      {summary.recorded === 0 && (
        <div className="card border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <IconWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="text-sm leading-relaxed text-amber-900">
              <b>אף ביקורת לא תועדה — {summary.total} תאים ריקים.</b> בגיליון היו ארבע
              עמודות לזה, ולא מולא בהן אף תא. סמן בניינים בטבלה, בחר סוג ותאריך,
              ורשום את כולם בפעולה אחת. אין צורך למלא הכל — עדיף להתחיל מסוג ביקורת אחד.
            </div>
          </div>
        </div>
      )}

      {flash && (
        <div className="card border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">✓ {flash}</div>
      )}

      {/* --- הזנה מרוכזת --- */}
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <IconShield className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700">רישום מרוכז</h2>
          <span className="text-xs text-slate-500">
            {selected.size ? `${selected.size} בניינים מסומנים` : "לא נבחרו בניינים"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-600">
            סוג ביקורת
            <select value={bulkType} onChange={(e) => setBulkType(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
              {INSPECTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {INSPECTION_TYPE_LABEL[t]} (כל {INSPECTION_INTERVAL_MONTHS[t]} חודשים)
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            תאריך הביצוע
            <input type="date" value={bulkDate} max={asOf} onChange={(e) => setBulkDate(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-1.5 text-sm tnum" />
          </label>
          <label className="text-xs text-slate-600">
            ספק (לא חובה)
            <select value={bulkVendor} onChange={(e) => setBulkVendor(e.target.value)}
              className="mt-1 block max-w-[16rem] rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
              <option value="">— ללא —</option>
              {data.vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
          <Button variant="primary" disabled={readOnly || !selected.size || !!plan.error} onClick={commit}>
            רישום {selected.size || ""}
          </Button>
        </div>

        {selected.size > 0 && !plan.error && (
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <b>מה יקרה:</b> {plan.creates.length} רשומות חדשות
            {plan.updates.length > 0 && <> · {plan.updates.length} רשומות קיימות יידרסו</>}.
            המועד הבא ייקבע ל-
            <b className="tnum">{fmtDate(addMonths(bulkDate, INSPECTION_INTERVAL_MONTHS[bulkType]))}</b>.
            {plan.updates.some((u) => u.previous) && (
              <div className="mt-1 text-amber-700">
                ⚠ {plan.updates.filter((u) => u.previous).length} מהרשומות כבר נושאות תאריך והוא יוחלף.
              </div>
            )}
          </div>
        )}
        {plan.error && <p className="mt-2 text-xs text-red-700">{plan.error}</p>}
      </div>

      {/* --- מסננים --- */}
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[13rem] flex-1">
            <IconSearch className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש כתובת…"
              className="w-full rounded-lg border border-slate-300 py-1.5 pr-9 pl-3 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="all">כל סוגי הביקורת</option>
            {INSPECTION_TYPES.map((t) => <option key={t} value={t}>{INSPECTION_TYPE_LABEL[t]}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="all">כל המצבים</option>
            <option value="overdue">פג תוקף</option>
            <option value="never">מעולם לא תועד</option>
            <option value="dueSoon">מתקרב</option>
            <option value="ok">בתוקף</option>
          </select>
          <span className="text-sm text-slate-500 tnum">{rows.length} בניינים</span>
        </div>
      </div>

      {/* --- המטריצה --- */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th w-8">
                  <input type="checkbox" checked={allShown} onChange={toggleAll}
                    aria-label="בחירת כל הבניינים המוצגים" className="cursor-pointer" />
                </th>
                <th className="th">בניין</th>
                <th className="th">עובד</th>
                {INSPECTION_TYPES.map((t) => (
                  <th key={t} className="th" title={`ברירת מחדל: כל ${INSPECTION_INTERVAL_MONTHS[t]} חודשים`}>
                    {INSPECTION_TYPE_LABEL[t]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ building, cells }) => (
                <tr key={building.id} className={selected.has(building.id) ? "bg-slate-50" : "hover:bg-slate-50"}>
                  <td className="td">
                    <input type="checkbox" checked={selected.has(building.id)}
                      onChange={() => toggle(building.id)} className="cursor-pointer"
                      aria-label={`בחירת ${building.address}`} />
                  </td>
                  <td className="td font-medium">
                    <button className="underline-offset-2 hover:underline"
                      onClick={() => onOpenBuilding(building.id)}>{building.address}</button>
                  </td>
                  <td className="td text-xs text-slate-500">
                    {empById.get(building.assignedEmployeeId) || <span className="text-amber-700">לא משויך</span>}
                  </td>
                  {cells.map((c) => (
                    <td key={c.type} className="td">
                      <Cell cell={c} vendorById={vendorById} />
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td className="td py-8 text-center text-slate-400" colSpan={3 + INSPECTION_TYPES.length}>
                  אין תוצאות
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="px-1 text-xs leading-relaxed text-slate-500">
        <b>התדירויות הן ברירות מחדל, לא קביעה משפטית.</b> גילוי אש, כיבוי אש וניקוי
        מאגרים — שנתי; גנרטור — חצי-שנתי. הן ניתנות לעקיפה פר בניין. אימות מול הדין,
        מול דרישות המבטח ומול הוראות היצרן הוא שער משפטי ולא החלטה של המערכת.
      </p>
    </div>
  );
}

function Cell({ cell, vendorById }) {
  const vendor = cell.record?.vendorId ? vendorById.get(cell.record.vendorId) : null;
  return (
    <div className={`inline-flex flex-col rounded-md border px-2 py-1 ${STATUS_STYLE[cell.status]}`}
      title={
        cell.status === "never"
          ? "לא תועדה מעולם"
          : `בוצעה ${fmtDate(cell.lastDate)} · הבא ${fmtDate(cell.nextDue)} (כל ${cell.intervalMonths} חודשים)` +
            (vendor ? ` · ${vendor.name}` : "")
      }>
      <span className="text-[11px] font-medium">{INSPECTION_STATUS_LABEL[cell.status]}</span>
      {cell.lastDate && (
        <span className="text-[11px] tnum opacity-80">
          {fmtDate(cell.lastDate)} → {fmtRelative(cell.daysUntil)}
        </span>
      )}
    </div>
  );
}
