import { useMemo, useState } from "react";
import { Button } from "./ui/Button.jsx";
import { StatTile } from "./ui/StatTile.jsx";
import { IconBack, IconNote } from "./ui/icons.jsx";
import { fmtILS, fmtILSExact, fmtPct, round2 } from "../utils/money.js";
import { fmtDate, fmtRelative, todayISO, isISODate } from "../utils/dates.js";
import { buildingProfit, priceHistory, feeHistory } from "../utils/profitability.js";
import { indexInspections, buildingInspections, INSPECTION_STATUS_LABEL } from "../utils/inspections.js";
import { activeAsOf } from "../utils/pricing.js";
import { makeInspection, makeContract, makeFeeAgreement } from "../schema.js";
import PriceEditor from "./PriceEditor.jsx";
import { EXPENSE_CATEGORIES, NOTE_KIND_LABEL, BUILDING_STATUS_LABEL, INSPECTION_TYPE_LABEL } from "../constants.js";

const INSPECTION_CARD = {
  never: "border-slate-200 bg-slate-50 text-slate-600",
  overdue: "border-red-300 bg-red-50 text-red-900",
  dueSoon: "border-amber-300 bg-amber-50 text-amber-900",
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

export default function BuildingPage({ buildingId, data, contractIndex, feeIndex, asOf = todayISO(), readOnly = false, update, add, applyBatch, remove, onBack }) {
  const building = data.buildings.find((b) => b.id === buildingId);
  // { kind: "contract", categoryId } | { kind: "fee" } | null
  const [editing, setEditing] = useState(null);

  const vendorById = useMemo(() => new Map(data.vendors.map((v) => [v.id, v])), [data.vendors]);
  const empById = useMemo(() => new Map(data.employees.map((e) => [e.id, e.name])), [data.employees]);
  const notes = useMemo(
    () => data.notes.filter((n) => n.buildingId === buildingId),
    [data.notes, buildingId]
  );
  const inspectionIndex = useMemo(() => indexInspections(data.inspections), [data.inspections]);
  const inspectionRows = useMemo(
    () => (building ? buildingInspections(building, inspectionIndex, asOf) : []),
    [building, inspectionIndex, asOf]
  );

  const feeRows = useMemo(() => feeHistory(buildingId, feeIndex), [buildingId, feeIndex]);

  // ⚠ מחושב מחדש בכל רינדור מהחוזים — לא נשמר בשום מקום. זה בדיוק ההבדל
  // מהאקסל: שינוי סכום חוזה מזיז את הרווח ואת האחוזים באותו רגע.
  const p = useMemo(
    () => (building ? buildingProfit(building, contractIndex, asOf, feeIndex) : null),
    [building, contractIndex, asOf, feeIndex]
  );

  if (!building) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-slate-500">
        הבניין לא נמצא. <Button onClick={onBack}>חזרה</Button>
      </div>
    );
  }

  /**
   * מחיל תוכנית שינוי מחיר.
   *
   * `updates` ו-`creates` מגיעים מ-`planPriceChange` — עדכון במקום (״תיקון״) או
   * שורה חדשה (״מחיר חדש מתאריך״). כאן רק ההחלה; ההחלטה נעשתה במנוע הטהור.
   */
  const applyPricePlan = (collection, { updates, creates }) => {
    const factory = collection === "contracts" ? makeContract : makeFeeAgreement;
    applyBatch(collection, { updates, creates: creates.map((c) => factory(c)) });
  };

  /**
   * רישום ביקורת. שדה ריק מוחק את התאריך ומחזיר ל״מעולם לא תועד״ — טעות הקלדה
   * חייבת להיות הפיכה, ומחיקת הרשומה כולה הייתה מאבדת גם את הספק ואת ההערה.
   * `nextDueDate` מתאפס כדי שהמועד הבא ייגזר מחדש מהתאריך החדש.
   */
  const recordInspection = (row, value) => {
    if (readOnly) return;
    const date = isISODate(value) ? value : null;
    if (row.record) update("inspections", row.record.id, { lastDate: date, nextDueDate: null });
    else if (date) add("inspections", makeInspection({ buildingId, type: row.type, lastDate: date }));
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
        <button className="text-right" disabled={readOnly}
          title={readOnly ? "צפייה בתאריך עבר — קריאה בלבד" : "עריכת דמי הניהול"}
          onClick={() => setEditing({ kind: "fee" })}>
          <StatTile label="דמי ניהול (הכנסה)" value={fmtILS(p.income)}
            hint={readOnly ? "קריאה בלבד" : feeRows.length > 1 ? `${feeRows.length} מחירים — לחץ לעריכה` : "לחץ לעריכה"} />
        </button>
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
            {readOnly
              ? "צפייה בתמונה של תאריך עבר — העריכה נעולה. חזרה להיום כדי לערוך."
              : "עריכת סכום מעדכנת מיד את הרווח, את ה-margin ואת ה-markup למעלה. שדה ריק = הוועד משלם ישירות."}
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
                      <button className="rounded px-2 py-1 hover:bg-slate-100 disabled:hover:bg-transparent"
                        disabled={readOnly}
                        title={readOnly ? "צפייה בתאריך עבר — קריאה בלבד" : "עריכת המחיר"}
                        onClick={() => setEditing({ kind: "contract", categoryId: row.categoryId })}>
                        {row.amount === null
                          ? <span className="text-slate-400">— הוועד משלם</span>
                          : fmtILSExact(row.amount)}
                      </button>
                    </td>
                    <td className="td text-xs text-slate-500">
                      {c.effectiveFrom || <span className="text-slate-300">—</span>}
                      {history.length > 1 && (
                        <button
                          onClick={() => setEditing({ kind: "contract", categoryId: row.categoryId })}
                          className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-200">
                          {history.length} מחירים
                        </button>
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
          {inspectionRows.map((row) => (
            <div key={row.type} className={`rounded-lg border p-3 ${INSPECTION_CARD[row.status]}`}>
              <div className="text-xs font-medium">{INSPECTION_TYPE_LABEL[row.type]}</div>
              <div className="mt-0.5 text-[11px] opacity-80">
                {INSPECTION_STATUS_LABEL[row.status]}
                {row.status !== "never" && <> · הבא {fmtDate(row.nextDue)} ({fmtRelative(row.daysUntil)})</>}
              </div>
              <input
                type="date"
                max={asOf}
                value={row.lastDate || ""}
                disabled={readOnly}
                onChange={(e) => recordInspection(row, e.target.value)}
                className="mt-2 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs tnum"
                aria-label={`תאריך ביצוע — ${INSPECTION_TYPE_LABEL[row.type]}`}
              />
              <div className="mt-1 text-[11px] opacity-70">כל {row.intervalMonths} חודשים</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          התדירויות הן <b>ברירות מחדל, לא קביעה משפטית</b>. אימות מול הדין, מול דרישות
          המבטח ומול הוראות היצרן הוא שער משפטי ולא החלטה של המערכת.
        </p>
      </div>

      {/* --- עורך המחיר --- */}
      {!readOnly && editing?.kind === "contract" && (() => {
        const entries = priceHistory(buildingId, editing.categoryId, contractIndex);
        const active = activeAsOf(entries, asOf);
        const cat = EXPENSE_CATEGORIES.find((c) => c.id === editing.categoryId);
        return (
          <PriceEditor
            title={`${cat?.name || editing.categoryId} — ${building.address}`}
            entries={entries}
            current={active}
            collection="contracts"
            template={{
              buildingId,
              categoryId: editing.categoryId,
              vendorId: active?.vendorId ?? null,
              vatMode: active?.vatMode ?? "standard",
              vatRate: active?.vatRate,
            }}
            allowNull
            onApply={applyPricePlan}
            onDelete={remove}
            onClose={() => setEditing(null)}
          />
        );
      })()}

      {!readOnly && editing?.kind === "fee" && (
        <PriceEditor
          title={`דמי ניהול — ${building.address}`}
          entries={feeRows}
          current={activeAsOf(feeRows, asOf)}
          collection="feeAgreements"
          template={{ buildingId }}
          allowNull={false}
          onApply={applyPricePlan}
          onDelete={remove}
          onClose={() => setEditing(null)}
        />
      )}

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
