import { useState, useMemo } from "react";
import { DAYS } from "../constants";
import { IconDownload, IconChevronRight, IconChevronLeft } from "./ui/icons";

// כל יחידת אימון = שעה וחצי. סוגי אימון שאינם נספרים בדו"ח השעות.
const HOURS_PER_UNIT = 1.5;
const EXCLUDED_TYPES = ["ספורטתרפיה", "יורם"];

// "YYYY-MM" של החודש הנוכחי.
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// הזזת חודש ב-±1: "YYYY-MM" -> "YYYY-MM".
function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

// התאריך בפועל של אימון = יום ראשון של השבוע (weekOf) + היסט לפי היום.
function sessionDate(s) {
  if (!s.weekOf) return null;
  const idx = DAYS.indexOf(s.day);
  if (idx < 0) return null;
  const d = new Date(s.weekOf + "T00:00:00");
  d.setDate(d.getDate() + idx);
  return d;
}

export function ReportView({ data }) {
  const [month, setMonth] = useState(currentMonth());

  const inMonth = (s) => {
    const d = sessionDate(s);
    if (!d) return false;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === month;
  };

  const rows = useMemo(() => {
    const monthSessions = data.sessions.filter(
      (s) => inMonth(s) && !EXCLUDED_TYPES.includes(s.type)
    );
    return data.coaches
      .map((coach) => {
        const units = monthSessions.filter((s) => s.coachId === coach.id).length;
        return { id: coach.id, name: coach.name, units, hours: units * HOURS_PER_UNIT };
      })
      .filter((r) => r.units > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [data.sessions, data.coaches, month]);

  const totalUnits = rows.reduce((n, r) => n + r.units, 0);
  const totalHours = totalUnits * HOURS_PER_UNIT;

  const fmtHours = (h) => (Number.isInteger(h) ? String(h) : h.toFixed(1));

  return (
    <div className="space-y-4" dir="rtl">
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
            className="bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
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
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-orange-600 text-white hover:bg-orange-700"
        >
          <IconDownload size={15} /> הדפסה / שמור PDF
        </button>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-200 bg-stone-50">
          <h2 className="text-base font-semibold text-stone-800">דו"ח שעות לפי מאמן</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {monthLabel(month)} · כל יחידת אימון = שעה וחצי · ספורטתרפיה ו"יורם" אינם נספרים
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center text-stone-600 text-sm">אין אימונים נספרים בחודש זה.</div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-right text-xs font-semibold text-stone-600">מאמן</th>
                <th className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-center text-xs font-semibold text-stone-600 w-32">יחידות אימון</th>
                <th className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-center text-xs font-semibold text-stone-600 w-32">סה"כ שעות</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50">
                  <td className="border-b border-stone-100 px-4 py-2.5 font-medium text-stone-800">{r.name}</td>
                  <td className="border-b border-stone-100 px-4 py-2.5 text-center tabular-nums text-stone-700">{r.units}</td>
                  <td className="border-b border-stone-100 px-4 py-2.5 text-center tabular-nums font-semibold text-stone-800">{fmtHours(r.hours)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-orange-50">
                <td className="px-4 py-2.5 font-bold text-stone-800">סה"כ</td>
                <td className="px-4 py-2.5 text-center tabular-nums font-bold text-stone-800">{totalUnits}</td>
                <td className="px-4 py-2.5 text-center tabular-nums font-bold text-orange-700">{fmtHours(totalHours)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <p className="no-print text-xs text-stone-500">
        הספירה כוללת כל אימון/משחק המשויך למאמן בחודש הנבחר, פרט לסוגים "ספורטתרפיה" ו"יורם".
      </p>
    </div>
  );
}
