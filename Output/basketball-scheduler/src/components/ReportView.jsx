import { useState, useMemo } from "react";
import { currentMonth, shiftMonth, monthLabel } from "../utils/dates";
// The arithmetic lives in a tested module, not here. This number decides what a coach is
// paid, and in August 2026 it reported a doubled month without anyone noticing until the
// board itself looked wrong.
import {
  hoursRows, hoursTotals, fmtHours, excludedLabel, exportHoursXlsx, HOURS_PER_UNIT,
  exemptTeamNames,
} from "../utils/hoursReport";
import { IconDownload, IconChevronRight, IconChevronLeft, IconFileSpreadsheet } from "./ui/icons";
import { IndoorBalanceCard } from "./IndoorBalanceCard";

export function ReportView({ data, weekStart }) {
  const [month, setMonth] = useState(currentMonth());

  const rows = useMemo(() => hoursRows(data, month), [data, month]);
  // Named, not merely omitted. A report that quietly drops squads is a report nobody can
  // check — and this one decides what people are paid.
  const exempt = useMemo(() => exemptTeamNames(data?.teams), [data?.teams]);
  const totals = useMemo(() => hoursTotals(rows, data, month), [rows, data, month]);

  return (
    <div className="space-y-4" dir="rtl">
      <IndoorBalanceCard data={data} weekStart={weekStart} />
      {/* Controls */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label="חודש קודם"
            className="p-1.5 rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
          >
            <IconChevronRight size={16} />
          </button>
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            aria-label="חודש הדוח"
            className="bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label="חודש הבא"
            className="p-1.5 rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
          >
            <IconChevronLeft size={16} />
          </button>
          <button
            onClick={() => setMonth(currentMonth())}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
          >
            החודש
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportHoursXlsx(rows, totals, month, monthLabel(month))}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:hover:bg-white"
          >
            <IconFileSpreadsheet size={15} /> ייצוא לאקסל
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700"
          >
            <IconDownload size={15} /> הדפסה / שמור PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-200 bg-stone-50">
          <h2 className="text-base font-semibold text-stone-800">דו"ח שעות לפי מאמן</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {monthLabel(month)} · כל יחידת אימון = {HOURS_PER_UNIT} שעות · {excludedLabel} אינם נספרים
          </p>
          {/* Named, not merely omitted. A payroll report that quietly drops squads is one
              nobody can check — least of all the coach it shortchanges. */}
          {exempt.length > 0 && (
            <p className="text-xs text-stone-500 mt-0.5">לא נספרות בדוח: {exempt.join(" · ")}</p>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center text-stone-600 text-sm">אין אימונים נספרים בחודש זה.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-right text-xs font-semibold text-stone-600">מאמן</th>
                  <th className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-center text-xs font-semibold text-stone-600 w-28">ימי אימון</th>
                  <th className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-center text-xs font-semibold text-stone-600 w-32">יחידות אימון</th>
                  <th className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-center text-xs font-semibold text-stone-600 w-32">סה"כ שעות</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50">
                    <td className="border-b border-stone-100 px-4 py-2.5 font-medium text-stone-800">{r.name}</td>
                    <td className="border-b border-stone-100 px-4 py-2.5 text-center tabular-nums text-stone-700">{r.days}</td>
                    <td className="border-b border-stone-100 px-4 py-2.5 text-center tabular-nums text-stone-700">{r.units}</td>
                    <td className="border-b border-stone-100 px-4 py-2.5 text-center tabular-nums font-semibold text-stone-800">{fmtHours(r.hours)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-brand-50">
                  <td className="px-4 py-2.5 font-bold text-stone-800">סה"כ</td>
                  <td className="px-4 py-2.5 text-center tabular-nums font-bold text-stone-800">{totals.days}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums font-bold text-stone-800">{totals.units}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums font-bold text-brand-700">{fmtHours(totals.hours)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* The days column needs its two sentences said out loud. "ימי אימון" is not
          "sessions", and the footer sum is not "the number of days the club trained" —
          either misreading turns a payroll figure into a wrong one. */}
      <p className="text-xs text-stone-500">
        <span className="font-medium text-stone-600">ימי אימון</span> = ימים שונים. מאמן עם שלושה אימונים
        באותו יום נספר יום אחד. סכום העמודה הוא סך ימי-המאמן — המועדון עצמו פעל ב-{totals.clubDays} ימים בחודש זה.
      </p>
      <p className="no-print text-xs text-stone-500">
        הספירה כוללת כל אימון/משחק המשויך למאמן בחודש הנבחר, פרט לסוגים {excludedLabel}.
      </p>
    </div>
  );
}
