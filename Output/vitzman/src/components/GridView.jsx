import { useMemo, useState } from "react";
import PriceEditor from "./PriceEditor.jsx";
import { IconSearch, IconTable } from "./ui/icons.jsx";
import { fmtILS, fmtILSExact } from "../utils/money.js";
import { EXPENSE_CATEGORIES } from "../constants.js";
import { buildingProfit, priceHistory, feeHistory } from "../utils/profitability.js";
import { activeAsOf } from "../utils/pricing.js";
import { makeContract, makeFeeAgreement } from "../schema.js";
import { addressKey } from "../utils/id.js";

/**
 * הטבלה המלאה — כל הבניינים על כל 24 העמודות, במסך אחד.
 *
 * ⚠ **זה מה שהאקסל נתן ורונן איבד.** כל שדה כאן היה ניתן לעריכה גם קודם, אבל
 * רק בדף של בניין בודד — כלומר 131 כניסות ויציאות כדי לראות עמודה אחת לרוחב.
 * המסך הזה אינו מוסיף יכולת עריכה; הוא מחזיר את **המבט**.
 *
 * שלוש הכרעות:
 *   · **לחיצה על תא פותחת את `PriceEditor`**, ולא עריכה מהירה במקום. עריכה
 *     ישירה בתא הייתה מכריחה אותי לבחור עבור רונן בין ״תיקון״ ל״מחיר חדש
 *     מתאריך״ — וזו בדיוק ההבחנה שכל פרוסה 3 נבנתה סביבה. מהירות שקונים
 *     במחיר של היסטוריה שקרית אינה מהירות.
 *   · **העמודה הראשונה והכותרת דביקות.** בלי זה, גלילה לעמודה 20 מאבדת את
 *     הכתובת ואת שם הקטגוריה, והטבלה הופכת לרשת מספרים חסרת משמעות.
 *   · **תא ריק אינו אפס.** ״—״ פירושו שאין חוזה (הוועד משלם ישירות), ו-0
 *     פירושו חוזה בסכום אפס. הצגה זהה שלהם הייתה מנפחת או מכווצת את ההוצאה.
 */
export default function GridView({ data, contractIndex, feeIndex, asOf, readOnly = false, applyBatch, remove, onOpenBuilding }) {
  const [q, setQ] = useState("");
  const [onlyFilled, setOnlyFilled] = useState(true);
  const [editing, setEditing] = useState(null); // { buildingId, categoryId | "fee" }

  const active = useMemo(
    () => data.buildings.filter((b) => b.status === "active"),
    [data.buildings]
  );

  const rows = useMemo(() => {
    const needle = addressKey(q);
    return active
      .filter((b) => !needle || [b.address, ...b.aliases].some((a) => addressKey(a).includes(needle)))
      .map((b) => ({ building: b, ...buildingProfit(b, contractIndex, asOf, feeIndex) }))
      .sort((a, b) => a.address.localeCompare(b.address, "he"));
  }, [active, contractIndex, feeIndex, asOf, q]);

  /**
   * ⚠ 24 עמודות שרובן ריקות הן רעש, לא מידע. הסינון מסתיר קטגוריה שאין לה
   * ולו חוזה אחד בכל התיק — אבל **נשאר ניתן לכיבוי**, כי ״אין לזה אף חוזה״
   * הוא בדיוק מה שרוצים לראות כשמוסיפים קטגוריה חדשה מהסכם ניהול.
   */
  const columns = useMemo(() => {
    if (!onlyFilled) return EXPENSE_CATEGORIES;
    const used = new Set(data.contracts.filter((c) => c.amount !== null).map((c) => c.categoryId));
    return EXPENSE_CATEGORIES.filter((c) => used.has(c.id));
  }, [onlyFilled, data.contracts]);

  const byBuildingCat = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      for (const d of r.detail.byCategory) m.set(`${r.buildingId}|${d.categoryId}`, d);
    }
    return m;
  }, [rows]);

  const applyPricePlan = (collection, { updates, creates }) => {
    const factory = collection === "contracts" ? makeContract : makeFeeAgreement;
    applyBatch(collection, { updates, creates: creates.map((c) => factory(c)) });
  };

  const totals = useMemo(() => {
    const t = { income: 0, cost: 0, profit: 0, byCat: new Map() };
    for (const r of rows) {
      t.income += r.income; t.cost += r.cost; t.profit += r.profit;
      for (const d of r.detail.byCategory) {
        if (d.amount === null) continue;
        t.byCat.set(d.categoryId, (t.byCat.get(d.categoryId) || 0) + d.amount);
      }
    }
    return t;
  }, [rows]);

  const openCell = (buildingId, categoryId) => { if (!readOnly) setEditing({ buildingId, categoryId }); };

  const editorProps = useMemo(() => {
    if (!editing) return null;
    const b = data.buildings.find((x) => x.id === editing.buildingId);
    if (!b) return null;
    if (editing.categoryId === "fee") {
      const entries = feeHistory(b.id, feeIndex);
      return {
        title: `דמי ניהול — ${b.address}`, entries, current: activeAsOf(entries, asOf),
        collection: "feeAgreements", template: { buildingId: b.id }, allowNull: false,
      };
    }
    const cat = EXPENSE_CATEGORIES.find((c) => c.id === editing.categoryId);
    const entries = priceHistory(b.id, editing.categoryId, contractIndex);
    return {
      title: `${cat?.name} — ${b.address}`, entries, current: activeAsOf(entries, asOf),
      collection: "contracts", template: { buildingId: b.id, categoryId: editing.categoryId },
      allowNull: true,
    };
  }, [editing, data.buildings, contractIndex, feeIndex, asOf]);

  const Cell = ({ value, onClick, title, tone = "" }) => (
    <td className="border-s border-slate-100 p-0">
      <button
        onClick={onClick}
        disabled={readOnly}
        title={title}
        className={`h-full w-full px-2 py-1.5 text-right text-sm tabular-nums
          hover:bg-amber-50 disabled:cursor-not-allowed disabled:hover:bg-transparent ${tone}`}
      >
        {value === null || value === undefined
          ? <span className="text-slate-300">—</span>
          : fmtILS(value)}
      </button>
    </td>
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-6">
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <IconTable className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">הטבלה המלאה</h2>
          </div>
          <div className="relative min-w-[14rem] flex-1">
            <IconSearch className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חיפוש כתובת…"
              className="w-full rounded-lg border border-slate-300 py-1.5 pr-9 pl-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            <input type="checkbox" checked={onlyFilled} onChange={(e) => setOnlyFilled(e.target.checked)}
              className="cursor-pointer" />
            רק קטגוריות בשימוש ({columns.length} מתוך {EXPENSE_CATEGORIES.length})
          </label>
          <span className="text-sm text-slate-500 tabular-nums">{rows.length} בניינים</span>
        </div>
        <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
          לחיצה על תא פותחת את עורך המחיר — עם הבחירה בין <b>תיקון</b> (הסכום היה שגוי)
          ל<b>מחיר חדש מתאריך</b> (שומר את הקודם בהיסטוריה).{" "}
          <span className="text-slate-400">״—״ = אין חוזה, הוועד משלם ישירות. זה אינו אפס.</span>
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="max-h-[75vh] overflow-auto">
          <table className="border-collapse text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-100">
                <th className="sticky right-0 z-30 min-w-[13rem] border-b border-s border-slate-200 bg-slate-100 px-3 py-2 text-right font-semibold">
                  כתובת
                </th>
                <th className="min-w-[7rem] border-b border-s border-slate-200 bg-emerald-50 px-2 py-2 text-right font-semibold text-emerald-900">
                  דמי ניהול
                </th>
                {columns.map((c) => (
                  <th key={c.id} title={c.name}
                    className="min-w-[6.5rem] max-w-[9rem] border-b border-s border-slate-200 px-2 py-2 text-right align-bottom text-xs font-semibold leading-tight">
                    {c.name}
                  </th>
                ))}
                <th className="min-w-[7rem] border-b border-s border-slate-200 bg-slate-200 px-2 py-2 text-right font-semibold">
                  סה״כ עלות
                </th>
                <th className="min-w-[7rem] border-b border-s border-slate-200 bg-slate-200 px-2 py-2 text-right font-semibold">
                  רווח
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.buildingId} className="hover:bg-slate-50/60">
                  <th scope="row"
                    className="sticky right-0 z-10 border-s border-slate-100 bg-white px-3 py-1.5 text-right font-medium">
                    <button onClick={() => onOpenBuilding(r.buildingId)}
                      className="text-right hover:underline" title="פתיחת דף הבניין">
                      {r.address}
                    </button>
                  </th>
                  <Cell
                    value={r.income}
                    tone="bg-emerald-50/50 font-medium text-emerald-900"
                    title={readOnly ? "צפייה בתאריך עבר — קריאה בלבד" : "עריכת דמי הניהול"}
                    onClick={() => openCell(r.buildingId, "fee")}
                  />
                  {columns.map((c) => {
                    const d = byBuildingCat.get(`${r.buildingId}|${c.id}`);
                    return (
                      <Cell
                        key={c.id}
                        value={d ? d.amount : null}
                        title={readOnly ? "צפייה בתאריך עבר — קריאה בלבד" : `${c.name} — ${r.address}`}
                        onClick={() => openCell(r.buildingId, c.id)}
                      />
                    );
                  })}
                  <td className="border-s border-slate-100 bg-slate-50 px-2 py-1.5 text-right tabular-nums">
                    {fmtILS(r.cost)}
                  </td>
                  <td className={`border-s border-slate-100 bg-slate-50 px-2 py-1.5 text-right font-semibold tabular-nums ${
                    r.isLoss ? "text-red-700" : r.isThin ? "text-amber-700" : ""}`}>
                    {fmtILS(r.profit)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td className="px-4 py-8 text-center text-slate-400" colSpan={columns.length + 4}>אין תוצאות</td></tr>
              )}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
              <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold">
                <th className="sticky right-0 z-30 border-s border-slate-200 bg-slate-100 px-3 py-2 text-right">
                  סה״כ {rows.length} בניינים
                </th>
                <td className="border-s border-slate-200 bg-emerald-100 px-2 py-2 text-right tabular-nums text-emerald-900">
                  {fmtILSExact(totals.income)}
                </td>
                {columns.map((c) => (
                  <td key={c.id} className="border-s border-slate-200 px-2 py-2 text-right tabular-nums">
                    {totals.byCat.has(c.id)
                      ? fmtILS(totals.byCat.get(c.id))
                      : <span className="text-slate-300">—</span>}
                  </td>
                ))}
                <td className="border-s border-slate-200 bg-slate-200 px-2 py-2 text-right tabular-nums">
                  {fmtILSExact(totals.cost)}
                </td>
                <td className="border-s border-slate-200 bg-slate-200 px-2 py-2 text-right tabular-nums">
                  {fmtILSExact(totals.profit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {editorProps && (
        <PriceEditor
          {...editorProps}
          onApply={applyPricePlan}
          onDelete={remove}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
