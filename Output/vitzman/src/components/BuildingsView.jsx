import { useMemo, useState } from "react";
import { IconWarning, IconSearch, IconPlus } from "./ui/icons.jsx";
import { Button } from "./ui/Button.jsx";
import { fmtILS, fmtILSExact, fmtPct } from "../utils/money.js";
import { buildingProfit, unassignedBuildings } from "../utils/profitability.js";
import { addressKey } from "../utils/id.js";
import { makeBuilding } from "../schema.js";
import { validateAddress } from "../utils/entities.js";

const SORTS = {
  address: (a, b) => a.address.localeCompare(b.address, "he"),
  profit: (a, b) => a.profit - b.profit,
  margin: (a, b) => (a.margin ?? 1) - (b.margin ?? 1),
  income: (a, b) => b.income - a.income,
  cost: (a, b) => b.cost - a.cost,
};

export default function BuildingsView({ data, contractIndex, feeIndex, asOf, readOnly = false, add, onOpenBuilding }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("profit");
  const [filter, setFilter] = useState("active");
  const [newAddress, setNewAddress] = useState("");

  /**
   * בניין חדש נוצר **ריק** — בלי חוזים ובלי דמי ניהול. זו הכרעה: מספר שהומצא
   * בהוספה היה נכנס לסכום התיק ונראה כמו נתון אמיתי. המסלול הוא כתובת, ואז
   * מילוי בדף הבניין עצמו, שם כל שדה מתועד ובעל היסטוריה.
   */
  const addCheck = newAddress.trim() ? validateAddress(newAddress, null, data.buildings, addressKey) : null;
  const createBuilding = () => {
    if (readOnly || !addCheck?.ok) return;
    const b = makeBuilding({ address: newAddress.trim() });
    add("buildings", b);
    setNewAddress("");
    onOpenBuilding(b.id);
  };

  const empById = useMemo(
    () => new Map(data.employees.map((e) => [e.id, e.name])),
    [data.employees]
  );

  const rows = useMemo(() => {
    const pool = data.buildings.filter((b) => {
      if (filter === "active") return b.status === "active";
      if (filter === "inactive") return b.status === "inactive";
      if (filter === "unassigned") return b.status === "active" && !b.assignedEmployeeId;
      return true;
    });
    const needle = addressKey(q);
    const matched = needle
      ? pool.filter((b) => [b.address, ...b.aliases].some((a) => addressKey(a).includes(needle)))
      : pool;
    return matched
      .map((b) => ({ ...buildingProfit(b, contractIndex, asOf, feeIndex), building: b }))
      .sort(SORTS[sort]);
  }, [data.buildings, contractIndex, feeIndex, asOf, q, sort, filter]);

  const unassigned = useMemo(() => unassignedBuildings(data.buildings), [data.buildings]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      {/* באנר: 35 בניינים בלי עובד אחראי — ממצא שישב בגיליון נפרד ואיש לא הצליב */}
      {unassigned.length > 0 && filter !== "unassigned" && (
        <button
          onClick={() => setFilter("unassigned")}
          className="flex w-full items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-right text-sm text-amber-900 transition hover:bg-amber-100"
        >
          <IconWarning className="h-4 w-4 shrink-0" />
          <span>
            <b>{unassigned.length} בניינים פעילים ללא עובד אחראי.</b>{" "}
            הרשימה ישבה בגיליון נפרד ולא הוצלבה מעולם — לחץ כדי לראות אותם.
          </span>
        </button>
      )}

      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[14rem] flex-1">
            <IconSearch className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חיפוש כתובת (כולל איותים חלופיים)…"
              className="w-full rounded-lg border border-slate-300 py-1.5 pr-9 pl-3 text-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="active">פעילים</option>
            <option value="unassigned">ללא עובד אחראי</option>
            <option value="inactive">לא פעילים</option>
            <option value="all">הכל</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="profit">מיון: רווח (נמוך→גבוה)</option>
            <option value="margin">מיון: margin</option>
            <option value="income">מיון: הכנסה</option>
            <option value="cost">מיון: עלות</option>
            <option value="address">מיון: כתובת</option>
          </select>
          <span className="text-sm text-slate-500 tnum">{rows.length} תוצאות</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <input
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createBuilding()}
            placeholder="כתובת של בניין חדש…"
            disabled={readOnly}
            className="min-w-[14rem] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
          <Button disabled={readOnly || !addCheck?.ok} onClick={createBuilding}><IconPlus /> בניין חדש</Button>
          {addCheck && !addCheck.ok && (
            <span className="text-xs text-red-700">{addCheck.reason}</span>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">כתובת</th>
                <th className="th">עובד אחראי</th>
                <th className="th">הכנסה</th>
                <th className="th">עלות</th>
                <th className="th">רווח</th>
                <th className="th" title="רווח ÷ הכנסה">margin</th>
                <th className="th" title="רווח ÷ עלות — זה מה שהאקסל הציג">markup</th>
                <th className="th">סימונים</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.buildingId}
                  className={`cursor-pointer hover:bg-slate-50 ${r.isLoss ? "bg-red-50/60" : ""}`}
                  onClick={() => onOpenBuilding(r.buildingId)}>
                  <td className="td font-medium">
                    {r.address}
                    {r.building.aliases.length > 0 && (
                      <span className="mr-2 text-xs text-slate-400" title={r.building.aliases.join(" · ")}>
                        +{r.building.aliases.length} איות
                      </span>
                    )}
                  </td>
                  <td className="td text-slate-600">
                    {r.assignedEmployeeId
                      ? empById.get(r.assignedEmployeeId)
                      : <span className="text-amber-700">— לא משויך</span>}
                  </td>
                  <td className="td tnum">{fmtILS(r.income)}</td>
                  <td className="td tnum">{fmtILS(r.cost)}</td>
                  <td className={`td tnum font-semibold ${r.isLoss ? "text-red-700" : r.isThin ? "text-amber-700" : ""}`}>
                    {fmtILSExact(r.profit)}
                  </td>
                  <td className={`td tnum ${r.isLoss ? "text-red-700" : r.isThin ? "text-amber-700" : "text-slate-600"}`}>
                    {fmtPct(r.margin)}
                  </td>
                  <td className="td tnum text-slate-400">{fmtPct(r.markup)}</td>
                  <td className="td">
                    <div className="flex gap-1">
                      {r.detail.unpricedCount > 0 && <Pill tone="slate" title="קטגוריות ללא סכום — הוועד משלם ישירות">{r.detail.unpricedCount} ללא סכום</Pill>}
                      {r.detail.estimateCount > 0 && <Pill tone="amber" title="הסכום הוא הערכה ולא חוזה">{r.detail.estimateCount} הערכה</Pill>}
                      {r.detail.conditionalCount > 0 && <Pill tone="amber" title="מותנה בכך שכל הדיירים שילמו">{r.detail.conditionalCount} מותנה</Pill>}
                      {r.imputedVatTotal > 0 && <Pill tone="violet" title="כולל מע״מ רעיוני של עוסק פטור">מע״מ רעיוני</Pill>}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td className="td py-8 text-center text-slate-400" colSpan={8}>אין תוצאות</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const TONES = {
  slate: "bg-slate-100 text-slate-600",
  amber: "bg-amber-100 text-amber-800",
  violet: "bg-violet-100 text-violet-800",
};
const Pill = ({ tone = "slate", children, title }) => (
  <span title={title} className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>{children}</span>
);
