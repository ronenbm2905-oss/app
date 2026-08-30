import { useMemo } from "react";
import { StatTile } from "./ui/StatTile.jsx";
import { IconWarning } from "./ui/icons.jsx";
import { fmtILS, fmtILSExact, fmtPct, round2 } from "../utils/money.js";
import { todayISO } from "../utils/dates.js";
import { portfolioTotals, categoryBreakdown, employeeLoad, unassignedBuildings } from "../utils/profitability.js";
import { inspectionSummary } from "../utils/inspections.js";
import { stalePriceContracts, STALE_PRICE_YEARS } from "../utils/vendors.js";

/**
 * דשבורד הרווחיות.
 *
 * שתי החלטות תצוגה שנגזרות ישירות ממה שהגיליון עשה לא נכון:
 *
 * 1. **margin ו-markup זה לצד זה, מתויגים.** הגיליון הציג רק את markup וקרא
 *    לו "אחוז רווח". כאן אי אפשר לקרוא אחד מהם בלי לראות את השני.
 *
 * 2. **פירוק הקטגוריות מציג את בדיקת ההתאזנות על המסך.** אם הפירוק לא מסתכם
 *    לסה"כ — זה מוצג באדום, לא מתגלה חצי שנה אחרי.
 */
export default function ProfitabilityDashboard({ data, contractIndex, feeIndex, onOpenBuilding, onOpenTab }) {
  const asOf = todayISO();
  const active = useMemo(() => data.buildings.filter((b) => b.status === "active"), [data.buildings]);
  const inspections = useMemo(
    () => inspectionSummary(active, data.inspections, asOf),
    [active, data.inspections, asOf]
  );
  const stale = useMemo(
    () => stalePriceContracts(data.buildings, contractIndex, asOf),
    [data.buildings, contractIndex, asOf]
  );
  const totals = useMemo(() => portfolioTotals(active, contractIndex, asOf, feeIndex), [active, contractIndex, asOf, feeIndex]);
  const breakdown = useMemo(() => categoryBreakdown(active, contractIndex), [active, contractIndex]);
  const loads = useMemo(
    () => employeeLoad(data.employees, data.buildings, contractIndex),
    [data.employees, data.buildings, contractIndex]
  );
  const unassigned = useMemo(() => unassignedBuildings(data.buildings), [data.buildings]);

  const balanceDiff = round2(breakdown.actualTotal - totals.cost);
  const balanced = Math.abs(balanceDiff) < 0.01;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      {/* --- מדדי-על --- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="הכנסה חודשית" value={fmtILS(totals.income)}
          hint={`${totals.buildingCount} בניינים פעילים`} />
        <StatTile label="הוצאה חודשית" value={fmtILS(totals.cost)} />
        <StatTile label="רווח חודשי" value={fmtILS(totals.profit)}
          tone={totals.profit >= 0 ? "good" : "bad"}
          hint={`${fmtILS(totals.profit * 12)} לשנה`} />
        <StatTile label="שולי רווח (margin)" value={fmtPct(totals.margin)}
          tone={totals.margin >= 0.1 ? "good" : "warn"}
          hint="רווח חלקי ההכנסה — שיעור הרווח מהמחזור" />
      </div>

      {/* --- דורש טיפול: מה שאינו כספי, ולכן נעלם בגיליון --- */}
      {(inspections.counts.overdue > 0 || inspections.counts.never > 0 ||
        inspections.counts.dueSoon > 0 || stale.contracts.length > 0 || unassigned.length > 0) && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-slate-700">דורש טיפול</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {inspections.counts.overdue > 0 && (
              <Alert tone="bad" label="ביקורות שפג תוקפן" value={inspections.counts.overdue}
                onClick={() => onOpenTab?.("inspections")} />
            )}
            {inspections.counts.never > 0 && (
              <Alert tone="warn" label="ביקורות שמעולם לא תועדו" value={inspections.counts.never}
                hint={`מתוך ${inspections.total} תאים`} onClick={() => onOpenTab?.("inspections")} />
            )}
            {inspections.counts.dueSoon > 0 && (
              <Alert tone="warn" label="ביקורות מתקרבות" value={inspections.counts.dueSoon}
                onClick={() => onOpenTab?.("inspections")} />
            )}
            {unassigned.length > 0 && (
              <Alert tone="warn" label="בניינים ללא עובד אחראי" value={unassigned.length}
                onClick={() => onOpenTab?.("buildings")} />
            )}
            {stale.contracts.length > 0 && (
              <Alert tone="warn" label={`מחיר שלא זז מעל ${STALE_PRICE_YEARS} שנים`}
                value={stale.contracts.length} hint={`${fmtILS(stale.monthlyTotal)} לחודש`}
                onClick={() => onOpenTab?.("vendors")} />
            )}
          </div>
        </div>
      )}

      {/* --- margin מול markup: ההבדל שהגיליון טשטש --- */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-slate-700">שני אחוזים שונים, ולא במקרה</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-xs font-medium text-emerald-800">margin — שיעור רווח מהמחזור</div>
            <div className="mt-1 text-2xl font-semibold tnum text-emerald-900">{fmtPct(totals.margin)}</div>
            <div className="mt-1 text-xs text-emerald-700">רווח ÷ <b>הכנסה</b> — המספר העסקי</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="text-xs font-medium text-amber-800">markup — תוספת על העלות</div>
            <div className="mt-1 text-2xl font-semibold tnum text-amber-900">{fmtPct(totals.markup)}</div>
            <div className="mt-1 text-xs text-amber-700">
              רווח ÷ <b>עלות</b> — זה מה שהאקסל הציג כ״אחוז רווח״
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          הפער בין השניים —{" "}
          <b className="tnum">{fmtPct(Math.abs((totals.markup ?? 0) - (totals.margin ?? 0)))}</b>{" "}
          — חוזר על עצמו בכל שורה. תמחור שנקבע לפי markup בהנחה שהוא margin הוא תמחור אופטימי מדי.
        </p>
      </div>

      {/* --- בניינים בהפסד --- */}
      {(totals.losses.length > 0 || totals.thin.length > 0) && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-amber-50 px-4 py-3">
            <IconWarning className="h-4 w-4 text-amber-700" />
            <h2 className="text-sm font-semibold text-amber-900">
              {totals.losses.length} בהפסד · {totals.thin.length} מתחת ל-5%
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="th">בניין</th><th className="th">הכנסה</th>
                  <th className="th">עלות</th><th className="th">רווח</th><th className="th">margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...totals.losses, ...totals.thin].map((r) => (
                  <tr key={r.buildingId} className="hover:bg-slate-50">
                    <td className="td">
                      <button className="text-slate-900 underline-offset-2 hover:underline"
                        onClick={() => onOpenBuilding(r.buildingId)}>{r.address}</button>
                    </td>
                    <td className="td tnum">{fmtILS(r.income)}</td>
                    <td className="td tnum">{fmtILS(r.cost)}</td>
                    <td className={`td tnum font-semibold ${r.profit < 0 ? "text-red-700" : "text-amber-700"}`}>
                      {fmtILSExact(r.profit)}
                    </td>
                    <td className={`td tnum ${r.profit < 0 ? "text-red-700" : "text-amber-700"}`}>
                      {fmtPct(r.margin)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- פירוק קטגוריות + בדיקת התאזנות --- */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">פירוק ההוצאה לפי קטגוריה</h2>
          <div className={`rounded-full px-3 py-1 text-xs font-medium ${
            balanced ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
            {balanced
              ? `✓ הפירוק מסתכם לסה״כ (${fmtILSExact(breakdown.actualTotal)})`
              : `✗ הפירוק אינו מסתכם לסה״כ — פער ${fmtILSExact(balanceDiff)}`}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">קטגוריה</th>
                <th className="th">עמודה במקור</th>
                <th className="th">סכום חודשי</th>
                <th className="th">% מההוצאה</th>
                <th className="th">בניינים</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {breakdown.categories.map((c) => (
                <tr key={c.categoryId} className="hover:bg-slate-50">
                  <td className="td max-w-xs truncate" title={c.name}>{c.name}</td>
                  <td className="td text-slate-400">{c.sourceCol}</td>
                  <td className="td tnum">{fmtILS(c.actual)}</td>
                  <td className="td tnum text-slate-500">
                    {fmtPct(totals.cost ? c.actual / totals.cost : null, 1)}
                  </td>
                  <td className="td tnum text-slate-500">
                    {c.buildingCount}{c.unpricedCount ? ` (+${c.unpricedCount} ללא סכום)` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
              <tr>
                <td className="td" colSpan={2}>סה״כ</td>
                <td className="td tnum">{fmtILSExact(breakdown.actualTotal)}</td>
                <td className="td" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* --- עומס עובדים --- */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">חלוקה לעובדים</h2>
        </div>
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">עובד</th><th className="th">בניינים</th>
              <th className="th">הכנסה</th><th className="th">רווח</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loads.map((l) => (
              <tr key={l.employeeId}>
                <td className="td">{l.name}</td>
                <td className="td tnum">{l.buildingCount}</td>
                <td className="td tnum">{fmtILS(l.income)}</td>
                <td className="td tnum">{fmtILS(l.profit)}</td>
              </tr>
            ))}
            {unassigned.length > 0 && (
              <tr className="bg-amber-50">
                <td className="td font-medium text-amber-900">ללא עובד אחראי</td>
                <td className="td tnum font-semibold text-amber-900">{unassigned.length}</td>
                <td className="td tnum text-amber-900">
                  {fmtILS(unassigned.reduce((a, b) => a + b.managementFee, 0))}
                </td>
                <td className="td text-xs text-amber-700">לא מכוסה</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- המע"מ הרעיוני --- */}
      {totals.imputedVatTotal > 0 && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-slate-700">מע״מ רעיוני של ספקי ״עוסק פטור״</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <StatTile label="רכיב רעיוני בהוצאה" value={fmtILSExact(totals.imputedVatTotal)}
              tone="warn" hint="אומדן — נגזר לאחור" />
            <StatTile label="הרווח כפי שרשום" value={fmtILSExact(totals.profit)} />
            <StatTile label="רווח בניכוי הרעיוני" value={fmtILSExact(totals.profitExImputedVat)}
              tone="warn" hint="אומדן, לא נתון" />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            הסכומים במערכת נשמרו <b>כפי שהם בגיליון</b> — לא שינינו מספרים. אף הערה
            במקור לא מתעדת את הסכום שלפני הוספת המע״מ הרעיוני, ולכן הניכוי הוא גזירה
            לאחור לפי 18% ולא נתון. כדי לקבל מספר ודאי צריך להזין את הסכום הנקי בכל חוזה כזה.
          </p>
        </div>
      )}
    </div>
  );
}

const ALERT_TONE = {
  bad: "border-red-200 bg-red-50 text-red-900 hover:bg-red-100",
  warn: "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100",
};

function Alert({ tone, label, value, hint, onClick }) {
  return (
    <button onClick={onClick}
      className={`rounded-lg border p-3 text-right transition ${ALERT_TONE[tone]}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold tnum">{value}</div>
      {hint && <div className="text-[11px] opacity-70">{hint}</div>}
    </button>
  );
}
