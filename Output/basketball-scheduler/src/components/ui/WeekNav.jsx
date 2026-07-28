import { shiftWeek, formatWeekRange, todayWeekStart, weekStartOf } from "../../utils/dates";
import { IconChevronRight, IconChevronLeft, IconCalendar } from "./icons";

// Shared week navigator. `value` is a Sunday-ISO date string; `onChange` receives a new one.
// RTL: "previous" sits on the right (chevron pointing right), "next" on the left.
export function WeekNav({ value, onChange, className = "" }) {
  const isCurrentWeek = value === todayWeekStart();
  return (
    <div className={`flex items-center gap-1.5 ${className}`} dir="rtl">
      <button
        onClick={() => onChange(shiftWeek(value, -1))}
        className="flex items-center gap-1 px-2.5 py-1.5 text-sm rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
        aria-label="שבוע קודם"
        title="שבוע קודם"
      >
        <IconChevronRight size={16} /> קודם
      </button>

      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 border border-stone-200">
        <IconCalendar size={14} className="text-stone-500 shrink-0" />
        <span className="text-sm font-medium text-stone-700 tabular-nums whitespace-nowrap">
          {formatWeekRange(value)}
        </span>
      </div>

      <button
        onClick={() => onChange(shiftWeek(value, 1))}
        className="flex items-center gap-1 px-2.5 py-1.5 text-sm rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
        aria-label="שבוע הבא"
        title="שבוע הבא"
      >
        הבא <IconChevronLeft size={16} />
      </button>

      <button
        onClick={() => onChange(todayWeekStart())}
        disabled={isCurrentWeek}
        className="px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:hover:bg-white"
        title="חזור לשבוע הנוכחי"
      >
        היום
      </button>

      <label className="relative flex items-center" title="קפוץ לתאריך">
        <input
          type="date"
          value={value}
          onChange={(e) => e.target.value && onChange(weekStartOf(new Date(e.target.value + "T00:00:00")))}
          className="bg-white border border-stone-300 rounded-lg px-2 py-1.5 text-xs text-stone-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
          aria-label="קפוץ לשבוע לפי תאריך"
        />
      </label>
    </div>
  );
}
