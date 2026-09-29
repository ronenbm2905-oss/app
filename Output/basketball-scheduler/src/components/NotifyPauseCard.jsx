import { useEffect, useState } from "react";
import { PAUSE_OPTIONS, pauseUntil, isNotifyPaused, pauseLabel } from "../utils/notifyPause";
import { IconBan, IconMegaphone } from "./ui/icons";

// "I am about to schedule a fortnight — do not ring anybody."
//
// Ronen, 29.9.2026: each save reaches the coach as though HIS training had been moved, and
// an evening of scheduling sends a dozen. The switch lives here, beside the week he is
// editing, because this is the one moment anybody would want it — a setting on a settings
// screen is a setting nobody turns on in time.
//
// TWO THINGS THIS DELIBERATELY DOES.
//
// It shows a DEADLINE, not a state. "Muted" as a word invites the assumption that somebody
// will unmute; an hour printed on the screen tells the truth about when the phones come
// back, and that is what makes it safe to leave alone.
//
// And it re-renders on a timer while it is on. A card that said "another 40 minutes" an hour
// ago is worse than no card: it is the exact screen someone glances at to confirm the pause
// has lifted.

export function NotifyPauseCard({ data, save, canEdit }) {
  const [, tick] = useState(0);
  const paused = isNotifyPaused(data);

  useEffect(() => {
    if (!paused) return;
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, [paused]);

  if (!canEdit) return null;

  const start = (minutes) => save({ ...data, notifyPausedUntil: pauseUntil(minutes) });
  const stop = () => save({ ...data, notifyPausedUntil: null });

  if (!paused) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5" dir="rtl">
        <span className="text-xs text-stone-700 flex items-center gap-1.5">
          <IconMegaphone size={14} />
          עומד/ת לשבץ כמה שבועות? אפשר להשתיק התראות:
        </span>
        {PAUSE_OPTIONS.map((o) => (
          <button
            key={o.minutes}
            onClick={() => start(o.minutes)}
            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    // Amber and loud. While this is on, a genuinely urgent cancellation will not reach a
    // phone either — so the card has to be impossible to scroll past without noticing.
    <div className="rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-2.5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
          <IconBan size={14} />
          {pauseLabel(data)}
        </div>
        <button
          onClick={stop}
          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-amber-500 bg-white text-amber-900 hover:bg-amber-100"
        >
          הפעל התראות עכשיו
        </button>
      </div>
      <div className="text-xs text-amber-900 mt-1.5">
        השינויים נשמרים ומופיעים כרגיל במסכים, בהודעה השבועית ובלוח ההורים — רק ההתראה
        לטלפון לא נשלחת. ההשתקה נגמרת מעצמה.
      </div>
    </div>
  );
}
