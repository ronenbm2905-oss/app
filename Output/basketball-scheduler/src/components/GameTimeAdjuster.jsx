import { useState, useEffect } from "react";
import { IconX, IconRefresh } from "./ui/icons";

// Nudging the hall slot around an imported game.
//
// The federation owns the tip-off time and nothing here changes it. What a manager needs
// to move is the block the game occupies on the board — the warm-up before it and the
// hall held after it — so two games can be fitted into one evening. The change is stored
// on the game rather than on the session, because the session is rebuilt from scratch on
// every import and anything living there would be silently thrown away.

const STEP = 15;
const MIN_MINUTES = 6 * 60; // 06:00 — earlier than any club activity
const MAX_MINUTES = 23 * 60 + 45;
const MIN_LENGTH = 30;

export const toMinutes = (hm) => {
  const [h, m] = String(hm || "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
};
export const toHM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

// Every edit goes through here, so the block can never be inverted or pushed off the day.
// `shift` moves both ends together; the other two resize one end at a time.
export function nudge(start, end, { shift = 0, startBy = 0, endBy = 0 } = {}) {
  let s = toMinutes(start);
  let e = toMinutes(end);
  if (shift) {
    const room = Math.min(Math.max(shift, MIN_MINUTES - s), MAX_MINUTES - e);
    s += room;
    e += room;
  }
  if (startBy) s = Math.min(Math.max(s + startBy, MIN_MINUTES), e - MIN_LENGTH);
  if (endBy) e = Math.max(Math.min(e + endBy, MAX_MINUTES), s + MIN_LENGTH);
  return { start: toHM(s), end: toHM(e) };
}

function Stepper({ label, onMinus, onPlus, value }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-stone-600 w-16 shrink-0">{label}</span>
      <button
        type="button"
        onClick={onMinus}
        aria-label={`${label} — פחות רבע שעה`}
        className="w-9 h-8 rounded-md border border-stone-200 text-stone-700 hover:bg-stone-50 font-semibold"
      >
        −
      </button>
      <span className="text-sm font-semibold tabular-nums w-14 text-center" dir="ltr">
        {value}
      </span>
      <button
        type="button"
        onClick={onPlus}
        aria-label={`${label} — עוד רבע שעה`}
        className="w-9 h-8 rounded-md border border-stone-200 text-stone-700 hover:bg-stone-50 font-semibold"
      >
        +
      </button>
    </div>
  );
}

export function GameTimeAdjuster({ session, game, teamName, dateLabel, defaultTimes, onSave, onClose }) {
  const [times, setTimes] = useState({ start: session.start, end: session.end });

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const apply = (opts) => setTimes((t) => nudge(t.start, t.end, opts));
  const isDefault = times.start === defaultTimes.start && times.end === defaultTimes.end;
  const length = toMinutes(times.end) - toMinutes(times.start);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="שעות המשחק בלוח"
        className="bg-white rounded-xl shadow-xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2 px-3 py-2 border-b border-stone-200">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-stone-800 truncate">{teamName}</h4>
            <p className="text-xs text-stone-500 truncate">
              {[dateLabel, game?.opponent && `נגד ${game.opponent}`, session.type].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-stone-500 hover:text-stone-800" aria-label="סגור">
            <IconX size={16} />
          </button>
        </div>

        <div className="p-3 space-y-3">
          {/* The federation's own time, stated plainly: it is the one number here that is
              not ours to move, and the block is only ever the hall around it. */}
          {game?.time && (
            <p className="text-xs text-stone-600 bg-stone-50 border border-stone-200 rounded-md px-2 py-1.5">
              שעת המשחק מהאיגוד: <strong dir="ltr">{game.time}</strong> — היא לא משתנה כאן. מה שמשתנה הוא
              הזמן שהקבוצה תופסת בלוח.
            </p>
          )}

          <div className="space-y-2">
            <Stepper
              label="הזז הכל"
              value={`${times.start}–${times.end}`}
              onMinus={() => apply({ shift: -STEP })}
              onPlus={() => apply({ shift: STEP })}
            />
            <Stepper label="התחלה" value={times.start} onMinus={() => apply({ startBy: -STEP })} onPlus={() => apply({ startBy: STEP })} />
            <Stepper label="סיום" value={times.end} onMinus={() => apply({ endBy: -STEP })} onPlus={() => apply({ endBy: STEP })} />
          </div>

          <p className="text-xs text-stone-500">
            אורך: {Math.floor(length / 60)}:{String(length % 60).padStart(2, "0")} שעות
            {!isDefault && (
              <>
                {" · "}
                <span className="text-brand-700">
                  ברירת המחדל: <span dir="ltr">{defaultTimes.start}–{defaultTimes.end}</span>
                </span>
              </>
            )}
          </p>

          <div className="flex items-center gap-2 pt-1 border-t border-stone-200">
            <button
              type="button"
              onClick={() => setTimes(defaultTimes)}
              disabled={isDefault}
              className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 px-2 py-1.5 rounded-md border border-stone-200 hover:bg-stone-50 disabled:opacity-40"
            >
              <IconRefresh size={13} /> ברירת מחדל
            </button>
            <span className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium text-stone-600 px-3 py-1.5 rounded-md border border-stone-200 hover:bg-stone-50"
            >
              ביטול
            </button>
            <button
              type="button"
              // Saving the default clears the override rather than storing it, so a game
              // left alone keeps following the club's warm-up rule if that rule changes.
              onClick={() => onSave(isDefault ? null : times)}
              className="text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-md"
            >
              שמור
            </button>
          </div>
          <p className="text-[11px] text-stone-500">השינוי נשמר על המשחק, ולכן הוא שורד ייבוא מחדש של קובץ האיגוד.</p>
        </div>
      </div>
    </div>
  );
}
