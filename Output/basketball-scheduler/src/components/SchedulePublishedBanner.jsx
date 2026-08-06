import { formatWeekRange } from "../utils/dates";

// How long the "schedule published" banner keeps showing after the manager published it.
const MAX_AGE_DAYS = 8;

function formatWhen(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Lightweight "notification": when a manager marks a week's schedule as published,
// every coach sees this banner (live via onSnapshot) at the top of the app for a few days.
export function SchedulePublishedBanner({ data }) {
  const pub = data.schedulePublished;
  if (!pub?.weekOf || !pub?.at) return null;
  const ageDays = (Date.now() - new Date(pub.at).getTime()) / 86400000;
  if (!(ageDays >= 0) || ageDays > MAX_AGE_DAYS) return null;

  return (
    <div className="no-print mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 flex items-start gap-2.5" dir="rtl">
      <span aria-hidden="true" className="text-lg leading-none mt-0.5">📅</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-emerald-800 mb-0.5">לוח האימונים פורסם</p>
        <p className="text-sm text-emerald-900">
          לוח האימונים לשבוע {formatWeekRange(pub.weekOf)} מוכן ומעודכן. פורסם {formatWhen(pub.at)}.
        </p>
      </div>
    </div>
  );
}
