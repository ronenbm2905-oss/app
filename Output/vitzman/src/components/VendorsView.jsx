import { useMemo, useState } from "react";
import { StatTile } from "./ui/StatTile.jsx";
import { IconSearch, IconWarning } from "./ui/icons.jsx";
import { fmtILS, fmtILSExact, fmtPct } from "../utils/money.js";
import { fmtDate, todayISO } from "../utils/dates.js";
import { addressKey } from "../utils/id.js";
import { portfolioTotals } from "../utils/profitability.js";
import { vendorSpend, vendorConcentration, stalePriceContracts, STALE_PRICE_YEARS } from "../utils/vendors.js";
import { CATEGORY_BY_ID } from "../constants.js";

/**
 * מסך הספקים.
 *
 * בגיליון הספק היה שם בתא ליד כל בניין בנפרד, ולכן אי אפשר היה לשאול *״כמה
 * אנחנו משלמים לו בסך הכל״*. כאן זו השורה הראשונה בטבלה.
 */
export default function VendorsView({ data, contractIndex, feeIndex, onOpenBuilding }) {
  const asOf = todayISO();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);

  const active = useMemo(() => data.buildings.filter((b) => b.status === "active"), [data.buildings]);
  const totals = useMemo(() => portfolioTotals(active, contractIndex, asOf, feeIndex), [active, contractIndex, asOf, feeIndex]);
  const rows = useMemo(() => {
    const spend = vendorSpend(data.vendors, data.buildings, contractIndex, asOf);
    return vendorConcentration(spend, totals.cost);
  }, [data.vendors, data.buildings, contractIndex, totals.cost, asOf]);
  const stale = useMemo(
    () => stalePriceContracts(data.buildings, contractIndex, asOf),
    [data.buildings, contractIndex, asOf]
  );

  const filtered = useMemo(() => {
    const needle = addressKey(q);
    return needle ? rows.filter((v) => addressKey(v.name).includes(needle)) : rows;
  }, [rows, q]);

  const open = openId ? rows.find((v) => v.id === openId) : null;
  const top5 = rows.slice(0, 5).reduce((a, v) => a + v.monthlySpend, 0);
  const vendorById = useMemo(() => new Map(data.vendors.map((v) => [v.id, v])), [data.vendors]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="ספקים פעילים" value={rows.length}
          hint={`מתוך ${data.vendors.length} רשומים`} />
        <StatTile label="הוצאה מכוסה בחוזי ספק" value={fmtILS(rows.reduce((a, v) => a + v.monthlySpend, 0))}
          hint={`מתוך ${fmtILS(totals.cost)} סה״כ הוצאה`} />
        <StatTile label="נתח 5 הספקים הגדולים" value={fmtPct(totals.cost ? top5 / totals.cost : null, 1)}
          tone={top5 / (totals.cost || 1) > 0.5 ? "warn" : "neutral"} hint="ריכוזיות מול ספק בודד" />
        <StatTile label={`מחיר שלא זז מעל ${STALE_PRICE_YEARS} שנים`} value={stale.contracts.length}
          tone={stale.contracts.length ? "warn" : "good"}
          hint={stale.contracts.length ? `${fmtILS(stale.monthlyTotal)} לחודש` : undefined} />
      </div>

      {/* --- מחירים שלא זזו: מועמדים למשא ומתן --- */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-amber-50 px-4 py-3">
          <IconWarning className="h-4 w-4 text-amber-700" />
          <h2 className="text-sm font-semibold text-amber-900">
            מועמדים למשא ומתן — מחיר שלא עודכן מעל {STALE_PRICE_YEARS} שנים
          </h2>
        </div>
        {stale.contracts.length ? (
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">בניין</th><th className="th">קטגוריה</th><th className="th">ספק</th>
                <th className="th">סכום</th><th className="th">המחיר נקבע</th><th className="th">ותק</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stale.contracts.map((c) => (
                <tr key={`${c.buildingId}-${c.categoryId}`} className="hover:bg-slate-50">
                  <td className="td">
                    <button className="underline-offset-2 hover:underline"
                      onClick={() => onOpenBuilding(c.buildingId)}>{c.address}</button>
                  </td>
                  <td className="td max-w-[14rem] truncate" title={c.categoryName}>{c.categoryName}</td>
                  <td className="td text-slate-600">{vendorById.get(c.vendorId)?.name || "—"}</td>
                  <td className="td tnum">{fmtILS(c.amount)}</td>
                  <td className="td tnum text-slate-500">{fmtDate(c.effectiveFrom)}</td>
                  <td className="td tnum font-medium text-amber-800">{c.ageYears} שנים</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-4 text-sm text-slate-500">— אין חוזים עם תאריך תחולה ותיק מזה.</p>
        )}
        <p className="border-t border-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-500">
          <b>מה לא נכלל כאן:</b> {stale.undatedCount} חוזים תקפים <b>ללא תאריך תחולה ידוע</b>.
          רוב השורות בגיליון לא נשאו תאריך — התאריכים שכן קיימים נגזרו מ-27 הערות מסוג
          ״הסכם עלה מ-X ל-Y החל מ-Z״. חוזה בלי תאריך אינו ״ותיק״ אלא <b>לא ידוע</b>,
          וספירתו כאן הייתה הופכת רשימת פעולה קצרה לרשימה של כמעט הכל.
        </p>
      </div>

      {/* --- טבלת הספקים --- */}
      <div className="card p-3">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש ספק…"
            className="w-full rounded-lg border border-slate-300 py-1.5 pr-9 pl-3 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">ספק</th><th className="th">בניינים</th>
                <th className="th">הוצאה חודשית</th><th className="th">ממוצע לבניין</th>
                <th className="th">נתח מההוצאה</th><th className="th">קטגוריות</th><th className="th">סימונים</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((v) => (
                <tr key={v.id} className="cursor-pointer hover:bg-slate-50"
                  onClick={() => setOpenId(openId === v.id ? null : v.id)}>
                  <td className="td font-medium">
                    {v.name}
                    {v.phone && <span className="mr-2 text-xs text-slate-400 tnum">{v.phone}</span>}
                  </td>
                  <td className="td tnum">{v.buildingCount}</td>
                  <td className="td tnum font-semibold">{fmtILS(v.monthlySpend)}</td>
                  <td className="td tnum text-slate-600">{fmtILS(v.avgPerBuilding)}</td>
                  <td className="td tnum text-slate-500">{fmtPct(v.share, 1)}</td>
                  <td className="td max-w-[16rem] truncate text-xs text-slate-500"
                    title={v.categories.map((c) => CATEGORY_BY_ID[c]?.name).join(" · ")}>
                    {v.categories.map((c) => CATEGORY_BY_ID[c]?.name).join(" · ")}
                  </td>
                  <td className="td">
                    {v.vatExempt && (
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-800"
                        title="עוסק פטור — הסכומים כוללים מע״מ רעיוני להשוואה">עוסק פטור</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td className="td py-8 text-center text-slate-400" colSpan={7}>אין תוצאות</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- פירוט ספק --- */}
      {open && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">
              {open.name} — {open.buildingCount} בניינים · {fmtILSExact(open.monthlySpend)} לחודש
            </h2>
            <button className="text-xs text-slate-500 hover:underline" onClick={() => setOpenId(null)}>סגירה</button>
          </div>
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">בניין</th><th className="th">קטגוריה</th>
                <th className="th">סכום</th><th className="th">מ-</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...open.lines].sort((a, b) => b.amount - a.amount).map((l) => (
                <tr key={l.contractId} className="hover:bg-slate-50">
                  <td className="td">
                    <button className="underline-offset-2 hover:underline"
                      onClick={() => onOpenBuilding(l.buildingId)}>{l.address}</button>
                  </td>
                  <td className="td max-w-[16rem] truncate" title={l.categoryName}>{l.categoryName}</td>
                  <td className="td tnum">{fmtILSExact(l.amount)}</td>
                  <td className="td tnum text-slate-500">
                    {l.effectiveFrom ? fmtDate(l.effectiveFrom) : <span className="text-slate-300">לא ידוע</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {open.imputedVat > 0 && (
            <p className="border-t border-slate-100 px-4 py-3 text-xs text-violet-800">
              ספק ״עוסק פטור״: מתוך {fmtILSExact(open.monthlySpend)} כ-{fmtILSExact(open.imputedVat)} הם
              <b> מע״מ רעיוני שנוסף להשוואה</b> — אומדן, לא נתון מקור.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
