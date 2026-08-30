import { useMemo, useState } from "react";
import { Button } from "./ui/Button.jsx";
import { StatTile } from "./ui/StatTile.jsx";
import { IconBack, IconNote } from "./ui/icons.jsx";
import { fmtILS, fmtILSExact, fmtPct, round2 } from "../utils/money.js";
import { buildingProfit, priceHistory } from "../utils/profitability.js";
import { EXPENSE_CATEGORIES, NOTE_KIND_LABEL, BUILDING_STATUS_LABEL, INSPECTION_TYPE_LABEL, INSPECTION_TYPES } from "../constants.js";

export default function BuildingPage({ buildingId, data, contractIndex, update, onBack }) {
  const building = data.buildings.find((b) => b.id === buildingId);
  const [editing, setEditing] = useState(null); // categoryId שנערך כרגע

  const vendorById = useMemo(() => new Map(data.vendors.map((v) => [v.id, v])), [data.vendors]);
  const empById = useMemo(() => new Map(data.employees.map((e) => [e.id, e.name])), [data.employees]);
  const notes = useMemo(
    () => data.notes.filter((n) => n.buildingId === buildingId),
    [data.notes, buildingId]
  );
  const inspections = useMemo(
    () => data.inspections.filter((i) => i.buildingId === buildingId),
    [data.inspections, buildingId]
  );

  // ⚠ מחושב מחדש בכל רינדור מהחוזים — לא נשמר בשום מקום. זה בדיוק ההבדל
  // מהאקסל: שינוי סכום חוזה מזיז את הרווח ואת האחוזים באותו רגע.
  const p = useMemo(
    () => (building ? buildingProfit(building, contractIndex) : null),
    [building, contractIndex]
  );

  if (!building) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-slate-500">
        הבניין לא נמצא. <Button onClick={onBack}>חזרה</Button>
      </div>
    );
  }

  const saveAmount = (contract, raw) => {
    const trimmed = String(raw).trim();
    // ריק → `null` = "לא אנחנו משלמים". שונה מהותית מ-0, ולכן לא ממירים לאפס.
    const value = trimmed === "" ? null : Number(trimmed.replace(/,/g, ""));
    if (trimmed !== "" && !Number.isFinite(value)) return;
    update("contracts", contract.id, { amount: value === null ? null : round2(value) });
    setEditing(null);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button onClick={onBack}><IconBack /> חזרה לרשימה</Button>
          <h1 className="mt-2 text-2xl font-semibold">{building.address}</h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>{BUILDING_STATUS_LABEL[building.status]}</span>
            <span>עובד אחראי: {empById.get(building.assignedEmployeeId) || "— לא משויך"}</span>
            {building.areaManager && <span>אחראי איזור: {building.areaManager}</span>}
            {building.insurerName && <span>ביטוח: {building.insurerName}</span>}
            {building.inIlm && <span>ברשימת ילמ</span>}
            {building.sourceRow && <span className="text-slate-400">שורה {building.sourceRow} במקור</span>}
          </div>
          {building.aliases.length > 0 && (
            <div className="mt-1 text-xs text-slate-400">
              איותים חלופיים במקור: {building.aliases.join(" · ")}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="דמי ניהול (הכנסה)" value={fmtILS(p.income)} />
        <StatTile label="עלות חודשית" value={fmtILS(p.cost)} />
        <StatTile label="רווח" value={fmtILSExact(p.profit)} tone={p.isLoss ? "bad" : p.isThin ? "warn" : "good"} />
        <StatTile label="margin" value={fmtPct(p.margin)} tone={p.isLoss ? "bad" : p.isThin ? "warn" : "good"}
          hint="רווח ÷ הכנסה" />
        <StatTile label="markup" value={fmtPct(p.markup)} hint="רווח ÷ עלות (כמו באקסל)" />
      </div>

      {/* --- חוזי השירות --- */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">חוזי שירות</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            עריכת סכום מעדכנת מיד את הרווח, את ה-margin ואת ה-markup למעלה. שדה ריק = הוועד משלם ישירות.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">קטגוריה</th><th className="th">ספק</th>
                <th className="th">סכום חודשי</th><th className="th">מ-</th><th className="th">סימונים</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {p.detail.byCategory.map((row) => {
                const c = row.contract;
                const vendor = vendorById.get(c.vendorId);
                const history = priceHistory(buildingId, row.categoryId, contractIndex);
                return (
                  <tr key={row.categoryId} className="hover:bg-slate-50">
                    <td className="td max-w-xs truncate" title={row.name}>{row.name}</td>
                    <td className="td text-slate-600">
                      {vendor ? (
                        <>
                          {vendor.name}
                          {vendor.phone && <span className="mr-2 text-xs text-slate-400">{vendor.phone}</span>}
                        </>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="td tnum">
                      {editing === row.categoryId ? (
                        <input
                          autoFocus
                          defaultValue={c.amount ?? ""}
                          onBlur={(e) => saveAmount(c, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveAmount(c, e.target.value);
                            if (e.key === "Escape") setEditing(null);
                          }}
                          className="w-28 rounded border border-slate-400 px-2 py-1 text-sm tnum"
                        />
                      ) : (
                        <button className="rounded px-2 py-1 hover:bg-slate-100"
                          onClick={() => setEditing(row.categoryId)}>
                          {row.amount === null
                            ? <span className="text-slate-400">— הוועד משלם</span>
                            : fmtILSExact(row.amount)}
                        </button>
                      )}
                    </td>
                    <td className="td text-xs text-slate-500">
                      {c.effectiveFrom || <span className="text-slate-300">—</span>}
                      {history.length > 1 && (
                        <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600"
                          title={history.map((h) => `${h.effectiveFrom || "עד לשינוי"}: ${fmtILS(h.amount)}`).join("\n")}>
                          {history.length} מחירים
                        </span>
                      )}
                    </td>
                    <td className="td">
                      <div className="flex gap-1">
                        {c.vatMode === "imputed" && (
                          <Pill tone="violet" title="עוסק פטור — הסכום כולל מע״מ רעיוני להשוואה">
                            רעיוני {fmtILS(row.imputedVat)}
                          </Pill>
                        )}
                        {c.isEstimate && <Pill tone="amber" title="הערכה בלבד, לא חוזה חתום">הערכה</Pill>}
                        {c.isConditional && <Pill tone="amber" title="מותנה בכך שכל הדיירים שילמו">מותנה</Pill>}
                        {c.paidByVaad && <Pill tone="slate">ועד</Pill>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
              <tr>
                <td className="td" colSpan={2}>סה״כ עלות</td>
                <td className="td tnum">{fmtILSExact(p.cost)}</td>
                <td className="td" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* --- ביקורות תקופתיות --- */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-slate-700">ביקורות תקופתיות</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {INSPECTION_TYPES.map((t) => {
            const rec = inspections.find((i) => i.type === t);
            return (
              <div key={t} className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs font-medium text-slate-600">{INSPECTION_TYPE_LABEL[t]}</div>
                <div className="mt-1 text-sm tnum">
                  {rec?.lastDate || <span className="text-slate-400">— לא תועד מעולם</span>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          ארבע העמודות האלה קיימות בגיליון המקור ולא מולא בהן אף תא באף בניין.
          מעקב פקיעה והתראות — פרוסה 2.
        </p>
      </div>

      {/* --- ההערות --- */}
      {notes.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
            <IconNote className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">הערות מהגיליון ({notes.length})</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {notes.map((n) => (
              <li key={n.id} className="px-4 py-2.5">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                    {NOTE_KIND_LABEL[n.kind] || n.kind}
                  </span>
                  {n.categoryId && (
                    <span className="text-xs text-slate-500">
                      {EXPENSE_CATEGORIES.find((c) => c.id === n.categoryId)?.name}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-300">{n.sourceCell}</span>
                </div>
                <p className="mt-1 text-sm leading-snug text-slate-700">{n.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
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
