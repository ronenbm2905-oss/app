import { homeStats } from "../utils/homeStats";

// The front door: one big button per screen, each carrying a live line about what is
// behind it. Sized for a thumb on a coach's phone, two to a row.
//
// The tab bar above stays exactly as it is. This is the way in for someone who opens the
// app once a week; the tabs remain the way around for whoever is in it all afternoon, and
// neither has to give anything up for the other.

// Each tile borrows the tone of the thing it opens, so the grid reads as places rather
// than as nine identical squares. Kept to a small set — the club's blue leads, and the
// others are quiet enough not to turn the screen into a paint chart.
const TONES = {
  announcements: "bg-amber-50 text-amber-700 ring-amber-100",
  rosters: "bg-brand-50 text-brand-700 ring-brand-100",
  manager: "bg-brand-50 text-brand-700 ring-brand-100",
  constraints: "bg-rose-50 text-rose-700 ring-rose-100",
  availability: "bg-orange-50 text-orange-700 ring-orange-100",
  games: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  weekly: "bg-brand-50 text-brand-700 ring-brand-100",
  coach: "bg-sky-50 text-sky-700 ring-sky-100",
  players: "bg-violet-50 text-violet-700 ring-violet-100",
  report: "bg-stone-100 text-stone-600 ring-stone-200",
};

export function HomeView({ tabs, data, weekStart, onOpen, canEdit, gameNotes }) {
  const stats = homeStats(data, weekStart, canEdit, gameNotes);

  return (
    <div dir="rtl">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => onOpen(tb.id)}
            className="group text-right bg-white rounded-2xl shadow-sm ring-1 ring-stone-900/5 p-4 sm:p-5
                       hover:shadow-md hover:ring-brand-200 focus:outline-none focus-visible:ring-2
                       focus-visible:ring-brand-500 transition-shadow flex flex-col gap-3 min-h-[116px]"
          >
            <span
              className={`w-11 h-11 rounded-xl flex items-center justify-center ring-1 ${
                TONES[tb.id] || TONES.report
              }`}
              aria-hidden="true"
            >
              <tb.Icon size={22} />
            </span>
            <span className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[15px] sm:text-base font-bold text-stone-800 leading-tight">
                {tb.label}
              </span>
              <span className="text-xs sm:text-[13px] text-stone-500 leading-snug break-words">
                {stats[tb.id] || ""}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
