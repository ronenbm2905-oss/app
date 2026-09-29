import { useEffect, useRef, useState } from "react";
import {
  PAUSE_OPTIONS, pauseUntil, isNotifyPaused, pauseLabel,
  isPauseEndingSoon, pauseMinutesLeft, humanLeft, extendPause, MAX_PAUSE_MINUTES,
} from "../utils/notifyPause";
import { IconBan, IconMegaphone, IconAlert, IconCheck } from "./ui/icons";

// "I am about to schedule a fortnight — do not ring anybody."
//
// Ronen, 29.9.2026: each save reaches the coach as though HIS training had been moved, and
// an evening of scheduling sends a dozen. The switch lives here, beside the week he is
// editing, because this is the one moment anybody would want it — a setting on a settings
// screen is a setting nobody turns on in time.
//
// THE CARD HAS FOUR STATES, AND THE LAST TWO EXIST BECAUSE OF A HOLE HE FOUND.
//
//   off            the offer: silence it for 30 / 60 / 120 minutes
//   on             amber, the deadline printed, and a way to end it now
//   ending soon    red, from five minutes out, with one tap to extend
//   just ended     said out loud, once, so it cannot lapse behind his back
//
// He asked: "does it cancel itself after two hours, and what do I do if I haven't finished?"
// Nothing needs cancelling — the deadline simply passes. But the card used to flip straight
// back to its offer state within thirty seconds and say nothing, so a manager still working
// would carry on saving while the notifications quietly resumed. That is the exact evening
// this feature exists to prevent, and a deadline you are not warned about is barely better
// than no deadline.
//
// It shows a DEADLINE, not a state: "muted" invites the assumption that somebody will
// unmute; an hour printed on the screen tells the truth about when the phones come back.

export function NotifyPauseCard({ data, save, canEdit }) {
  const [, tick] = useState(0);
  const [justEnded, setJustEnded] = useState(false);
  const paused = isNotifyPaused(data);
  const soon = isPauseEndingSoon(data);
  const wasPaused = useRef(paused);

  // Faster near the end. Thirty seconds is fine for a two-hour countdown and useless for a
  // five-minute one — it could show "another 5 minutes" with three left.
  useEffect(() => {
    if (!paused) return;
    const t = setInterval(() => tick((n) => n + 1), soon ? 5000 : 30000);
    return () => clearInterval(t);
  }, [paused, soon]);

  // Paused → not paused is the transition nobody sees, so it is the one that gets announced.
  useEffect(() => {
    if (wasPaused.current && !paused) setJustEnded(true);
    wasPaused.current = paused;
  }, [paused]);

  if (!canEdit) {
    // The person whose phone is being silenced is the one who otherwise would not know.
    // Gate #24 asked whether to record WHO silenced the notifications and the answer was no —
    // a record of one identified person's action buys a clause in the privacy policy, a
    // retention period and a deletion route, for nothing anybody would read. This is what it
    // asked for instead: show the state, live, to the people it affects. Read-only.
    if (!paused) return null;
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2" dir="rtl" role="status">
        <div className="text-xs text-amber-900 flex items-center gap-1.5">
          <IconBan size={13} />
          <span>
            <strong>ההתראות במועדון מושתקות כרגע</strong> — {pauseLabel(data)}. השינויים
            מופיעים כרגיל במסך.
          </span>
        </div>
      </div>
    );
  }

  const start = (minutes) => { setJustEnded(false); save({ ...data, notifyPausedUntil: pauseUntil(minutes) }); };
  const extend = (minutes) => save({ ...data, notifyPausedUntil: extendPause(minutes) });
  const stop = () => { setJustEnded(false); save({ ...data, notifyPausedUntil: null }); };

  const offer = (label) => (
    <>
      {PAUSE_OPTIONS.map((o) => (
        <button
          key={o.minutes}
          onClick={() => start(o.minutes)}
          className="px-2.5 py-1 text-xs font-medium rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
        >
          {label ? `${label} ${o.label}` : o.label}
        </button>
      ))}
    </>
  );

  if (!paused && justEnded) {
    return (
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-emerald-400 bg-emerald-50 px-3 py-2.5"
        dir="rtl"
        role="status"
      >
        <span className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
          <IconCheck size={14} />
          ההשתקה הסתיימה — ההתראות פעילות שוב.
        </span>
        <span className="text-xs text-emerald-900">עדיין לא סיימת?</span>
        {offer("עוד")}
        <button
          onClick={() => setJustEnded(false)}
          className="px-2.5 py-1 text-xs font-medium rounded-lg border border-emerald-500 bg-white text-emerald-900 hover:bg-emerald-100"
        >
          סיימתי
        </button>
      </div>
    );
  }

  if (!paused) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5" dir="rtl">
        <span className="text-xs text-stone-700 flex items-center gap-1.5">
          <IconMegaphone size={14} />
          עומד/ת לשבץ כמה שבועות? אפשר להשתיק התראות:
        </span>
        {offer("")}
      </div>
    );
  }

  const left = pauseMinutesLeft(data);

  if (soon) {
    return (
      // Red, and it says the number of minutes rather than the hour: at four minutes out
      // "until 14:00" is something to work out, and "another 4 minutes" is something to act on.
      <div className="rounded-xl border-2 border-red-500 bg-red-50 px-3 py-2.5" dir="rtl" role="status">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-red-900 flex items-center gap-1.5">
            <IconAlert size={14} />
            ההשתקה נגמרת בעוד {humanLeft(left)} — אחריה ההתראות חוזרות.
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PAUSE_OPTIONS.map((o) => (
              <button
                key={o.minutes}
                onClick={() => extend(o.minutes)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-red-500 bg-white text-red-900 hover:bg-red-100"
              >
                עוד {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs text-red-900 mt-1.5">
          הארכה מתחילה מעכשיו, ולכל היותר {humanLeft(MAX_PAUSE_MINUTES)}.
        </div>
      </div>
    );
  }

  return (
    // Amber and loud. While this is on, a genuinely urgent cancellation will not reach a
    // phone either — so the card has to be impossible to scroll past without noticing.
    <div className="rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-2.5" dir="rtl" role="status">
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
