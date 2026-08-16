import { useState, useMemo } from "react";
import { indoorBalance } from "../utils/indoorBalance";
import { shiftWeek, formatWeekRange } from "../utils/dates";
import { IconChevronRight, IconChevronLeft } from "./ui/icons";

// Who has been getting the covered courts.
//
// A slot on a covered court is the better slot, so the question the scheduler actually
// asks is not "how many sessions did each coach take" but "am I sharing the good ones
// out evenly". The bar makes that readable without arithmetic: the widest and the
// narrowest rows are the answer.

const RANGES = [
  { id: "week", label: "שבוע" },
  { id: "month", label: "חודש" },
  { id: "all", label: "כל העונה" },
];

const monthBounds = (weekStartIso) => {
  const d = new Date(weekStartIso + "T00:00:00");
  const p = (n) => String(n).padStart(2, "0");
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const iso = (x) => `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
  return { from: iso(first), to: iso(last), label: d.toLocaleDateString("he-IL", { month: "long", year: "numeric" }) };
};

export function IndoorBalanceCard({ data, weekStart }) {
  const [range, setRange] = useState("week");
  const [week, setWeek] = useState(weekStart);

  const { bounds, periodLabel } = useMemo(() => {
    if (range === "all") return { bounds: {}, periodLabel: "כל העונה" };
    if (range === "month") {
      const m = monthBounds(week);
      return { bounds: { from: m.from, to: m.to }, periodLabel: m.label };
    }
    return { bounds: { from: week, to: addDays(week, 6) }, periodLabel: formatWeekRange(week) };
  }, [range, week]);

  const result = useMemo(() => indoorBalance(data, bounds), [data, bounds]);
  const { rows, totalIndoor, indoorHallCount, spread } = result;
  const max = rows.length ? Math.max(...rows.map((r) => r.indoor), 1) : 1;

  if (indoorHallCount === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-5 text-sm text-stone-600" dir="rtl">
        <p className="font-semibold text-stone-800 mb-1">חלוקת אולמות מקורה</p>
        <p>
          אף אולם לא מסומן כמקורה, אז אין מה לחשב. סמן אותם במסך{" "}
          <strong>קבוצות ואולמות</strong> — יש שם כפתור שמסמן את כולם לפי השם בלחיצה אחת.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden" dir="rtl">
      <div className="bg-stone-50 px-4 py-2.5 border-b border-stone-200 flex items-center justify-between gap-2 flex-wrap">
        <div className="text-stone-700 font-semibold text-sm">חלוקת אולמות מקורה בין המאמנים</div>
        <div className="no-print flex items-center gap-1 bg-stone-200/70 rounded-lg p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                range === r.id ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 flex items-center gap-2 flex-wrap border-b border-stone-100">
        {range !== "all" && (
          <div className="no-print flex items-center gap-1">
            <button
              onClick={() => setWeek(shiftWeek(week, range === "month" ? -4 : -1))}
              aria-label="אחורה"
              className="p-1.5 rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
            >
              <IconChevronRight size={15} />
            </button>
            <button
              onClick={() => setWeek(shiftWeek(week, range === "month" ? 4 : 1))}
              aria-label="קדימה"
              className="p-1.5 rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
            >
              <IconChevronLeft size={15} />
            </button>
          </div>
        )}
        <span className="text-sm text-stone-700 font-medium">{periodLabel}</span>
        <span className="text-xs text-stone-500">
          · {totalIndoor} אימונים במקורה · {indoorHallCount} אולמות מסומנים
        </span>
        {rows.length > 1 && (
          <span
            className={`text-xs font-semibold rounded-full px-2 py-0.5 mr-auto ${
              spread <= 1
                ? "bg-emerald-50 text-emerald-700"
                : spread <= 3
                ? "bg-amber-50 text-amber-800"
                : "bg-red-50 text-red-700"
            }`}
            title="ההפרש בין המאמן עם הכי הרבה מקורה למאמן עם הכי מעט"
          >
            פער {spread}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-stone-600">אין אימונים בתקופה הזו.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-stone-50 text-xs text-stone-600">
              <th className="px-4 py-2 text-right font-semibold">מאמן</th>
              <th className="px-2 py-2 text-center font-semibold w-20">מקורה</th>
              <th className="px-2 py-2 text-center font-semibold w-20">סה״כ</th>
              <th className="px-2 py-2 text-center font-semibold w-20">חלק</th>
              <th className="px-4 py-2 text-right font-semibold">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.coachId || "none"} className="border-t border-stone-100">
                <td className="px-4 py-2 text-stone-800">{r.name}</td>
                <td className="px-2 py-2 text-center font-bold tabular-nums text-stone-900">{r.indoor}</td>
                <td className="px-2 py-2 text-center tabular-nums text-stone-500">{r.total}</td>
                <td className="px-2 py-2 text-center tabular-nums text-stone-500">
                  {Math.round(r.share * 100)}%
                </td>
                <td className="px-4 py-2">
                  <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${(r.indoor / max) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// weekStart + 6 days, as an ISO date.
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
