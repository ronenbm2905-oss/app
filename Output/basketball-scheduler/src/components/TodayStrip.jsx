import { useEffect, useState } from "react";
import { toISODate } from "../utils/dates";
import { todaySummary, minutesOfDay } from "../utils/today";
import { IconClock, IconMapPin, IconCheck } from "./ui/icons";

// One line answering "what do I need to know right now", above whatever screen you are on.
// It is the difference between opening the app onto a table and opening it onto an answer.
//
// About today, never about the week being viewed: the rest of the app follows you when you
// navigate to next month, and this line would be worse than useless if it did too.
export function TodayStrip({ data, coachId }) {
  // Re-read the clock every minute so "the next session" does not go stale on a screen
  // that stays open all afternoon — which is exactly how a manager uses this.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const t = todaySummary(data, toISODate(now), minutesOfDay(now), coachId);
  if (!t.valid) return null;

  return (
    <div className="no-print mb-4 rounded-xl bg-white shadow-sm ring-1 ring-stone-900/5 px-4 py-3 flex items-center gap-x-5 gap-y-2 flex-wrap">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold tracking-wider text-stone-400">
          היום · יום {t.dayName}, {t.dateLabel}
        </div>
        <div className="text-[17px] font-bold text-stone-800 leading-tight">
          {t.scoped
            ? t.count === 0
              ? "אין לך אימונים היום"
              : t.count === 1
              ? "אימון אחד שלך"
              : `${t.count} אימונים שלך`
            : t.count === 0
            ? "אין אימונים היום"
            : t.count === 1
            ? "אימון אחד"
            : `${t.count} אימונים`}
        </div>
      </div>

      {t.next ? (
        <div className="flex items-center gap-2 text-sm text-stone-600 min-w-0">
          <IconClock size={15} className="text-stone-400 shrink-0" />
          <span className="shrink-0">
            הקרוב — <b className="text-stone-800 tabular-nums" dir="ltr">{t.next.start}</b>
          </span>
          <span className="truncate">
            · {t.next.teamName}
            {t.next.hallName && (
              <span className="text-stone-500">
                {" · "}
                <IconMapPin size={13} className="inline-block align-[-2px] text-stone-400" /> {t.next.hallName}
              </span>
            )}
          </span>
        </div>
      ) : (
        t.count > 0 && (
          <div className="text-sm text-stone-500">
            {t.scoped ? "האימונים שלך היום הסתיימו" : "כל האימונים של היום הסתיימו"}
          </div>
        )
      )}

      {/* Publication state belongs here rather than buried in the board: it is the one
          thing a manager forgets, and the coaches are waiting on it. */}
      <div className="ms-auto shrink-0">
        {t.published ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-xs font-semibold">
            <IconCheck size={13} /> הלו״ז פורסם
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-800 px-2.5 py-1 text-xs font-semibold">
            הלו״ז לשבוע טרם פורסם
          </span>
        )}
      </div>
    </div>
  );
}
