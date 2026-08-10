import { birthdaysInWeek, birthdayWhen, todayOffsetInWeek } from "../utils/birthdays";
import { toISODate } from "../utils/dates";

// Coach birthdays for the week being viewed, pulled straight from the dates entered on
// the coach records — nobody has to remember to write them into the notice.
//
// Scoped to the week rather than to a rolling window from today, so it lines up with
// everything else in this app: whatever week the board is showing, this shows the same
// week's birthdays. Looking ahead at next week's schedule shows next week's birthdays,
// which is when you would actually plan something.
export function BirthdayReminder({ coaches, weekStart, compact = false }) {
  const list = birthdaysInWeek(coaches, weekStart);
  if (list.length === 0) return null;

  // "היום"/"מחר" only when the week on screen really is the current one.
  const todayOffset = todayOffsetInWeek(weekStart, toISODate(new Date()));

  if (compact) {
    return (
      <div
        className="no-print mb-4 rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 flex items-start gap-2.5"
        dir="rtl"
      >
        <span aria-hidden="true" className="text-lg leading-none mt-0.5">🎂</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-pink-800 mb-0.5">
            {list.length === 1 ? "יום הולדת השבוע" : "ימי הולדת השבוע"}
          </p>
          <p className="text-sm text-pink-900">
            {list.map((c, i) => (
              <span key={c.id || i}>
                {i > 0 && <span className="text-pink-400"> · </span>}
                <span className="font-medium">{c.name}</span>{" "}
                <span className="text-pink-700 text-xs">{birthdayWhen(c, todayOffset)}</span>
              </span>
            ))}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-pink-50 border border-pink-200 rounded-xl p-4" dir="rtl">
      <div className="flex items-center gap-2 mb-2">
        <span aria-hidden="true">🎂</span>
        <h2 className="text-sm font-semibold text-pink-900">
          {list.length === 1 ? "יום הולדת השבוע" : "ימי הולדת השבוע"}
        </h2>
      </div>
      <ul className="space-y-1">
        {list.map((c, i) => (
          <li key={c.id || i} className="text-sm text-pink-900 flex items-center gap-2 flex-wrap">
            <span className="font-medium">{c.name}</span>
            <span
              className={`text-xs ${
                todayOffset === c.offset ? "text-pink-700 font-semibold" : "text-pink-600"
              }`}
            >
              {birthdayWhen(c, todayOffset)}
            </span>
            {/* 29 February in a common year — say so rather than quietly showing the 28th. */}
            {c.observed && <span className="text-[11px] text-pink-500">(נולד/ה ב-29/02)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
