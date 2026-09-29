import { useMemo, useState } from "react";
import { hallMonth, shiftMonth, dayAnswer, HEB_DAY_SHORT, monthLabel } from "../utils/hallCalendar";
import { IconChevronRight, IconChevronLeft, IconBuilding, IconBan, IconCalendarDays } from "./ui/icons";

// "Is the hall free on the 2nd?" — answered on a phone, while somebody waits on the line.
//
// This screen exists because of one sentence from Ronen, 29.9.2026: a coach rings asking to
// bring a fixture forward from 17.12 to 2.12, and answering meant opening the weekly board,
// paging forward to December to find which hall the fixture is in, then paging to another
// week to see whether that hall was taken. Two navigations and a good memory, per call.
//
// SO THE LAYOUT IS THE ANSWER, NOT A LIST TO READ. A month of one hall, with the empty days
// empty. He asked "which DATE is the hall free" — a list of the busy dates would make him
// compute the gaps himself, and a gap computed in your head while somebody waits is how a
// wrong "sure, that works" gets said.
//
// Phone first, and that is not a style preference here: the call is the moment this is used.
// Cells are thumb-sized, the month moves with two big buttons, and the day's detail opens
// BELOW the grid rather than in a dialog — a dialog on a phone hides the very grid you are
// reading from.

const STATE_CELL = {
  // Deliberately not red/green alone. The three states differ in text as well as colour, so
  // the screen still answers on a phone in sunlight and for someone who does not separate
  // red from green.
  games: "bg-amber-50 border-amber-300 text-amber-900",
  closed: "bg-stone-200 border-stone-400 text-stone-700",
  off: "bg-white border-emerald-200 text-emerald-800",
  free: "bg-white border-stone-200 text-stone-700",
};

export function HallGamesView({ data }) {
  const halls = useMemo(() => (data.halls || []).filter(Boolean), [data.halls]);
  const [hallId, setHallId] = useState(halls[0]?.id || "");
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [openIso, setOpenIso] = useState("");

  const month = useMemo(
    () => hallMonth(data, hallId, cursor.year, cursor.month),
    [data, hallId, cursor.year, cursor.month]
  );

  const open = month.days.find((d) => d.iso === openIso) || null;
  const hallName = halls.find((h) => h.id === hallId)?.name || "";

  if (halls.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600" dir="rtl">
        עדיין לא הוגדרו אולמות.
      </div>
    );
  }

  return (
    <div className="space-y-3" dir="rtl">
      {/* The hall is the first choice and stays visible: every number below means something
          different once it changes, and a picker that scrolls away invites reading one
          hall's month as another's. */}
      <div className="flex flex-wrap gap-1.5">
        {halls.map((h) => (
          <button
            key={h.id}
            onClick={() => { setHallId(h.id); setOpenIso(""); }}
            className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              h.id === hallId
                ? "bg-stone-800 text-white border-stone-800"
                : "bg-white text-stone-700 border-stone-300 hover:bg-stone-50"
            }`}
          >
            {h.name}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        {/* RTL: "previous" on the right, matching WeekNav so the two navigators do not
            disagree about which way is back. */}
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-stone-200 bg-stone-50">
          <button
            onClick={() => { setCursor(shiftMonth(cursor.year, cursor.month, -1)); setOpenIso(""); }}
            className="p-2 rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
            aria-label="חודש קודם"
          >
            <IconChevronRight size={18} />
          </button>
          <div className="text-center">
            <div className="text-sm font-semibold text-stone-900 flex items-center justify-center gap-1.5">
              <IconBuilding size={14} /> {hallName} · {month.label}
            </div>
            <div className="text-xs text-stone-600 mt-0.5">
              {month.freeAhead} ימים פנויים · {month.withGames} עם משחקים
              {month.closedDays > 0 && ` · ${month.closedDays} סגור`}
            </div>
          </div>
          <button
            onClick={() => { setCursor(shiftMonth(cursor.year, cursor.month, 1)); setOpenIso(""); }}
            className="p-2 rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
            aria-label="חודש הבא"
          >
            <IconChevronLeft size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-px bg-stone-100 px-1 pt-1">
          {HEB_DAY_SHORT.map((d, i) => (
            <div key={i} className="text-center text-xs font-medium text-stone-600 py-1 bg-white">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 p-1">
          {month.days.map((d) => {
            const muted = !d.inMonth || d.isPast;
            return (
              <button
                key={d.iso}
                onClick={() => setOpenIso(d.iso === openIso ? "" : d.iso)}
                // A day that has gone by, or belongs to the month either side, is pushed
                // back with a named COLOUR and never with `opacity`. Measured in the running
                // page on 29.9.2026: `opacity-45` took these numbers to **2.34:1**, under
                // half the 4.5:1 minimum, while the ordinary days sat at 10.27:1. Opacity
                // multiplies through to whatever is behind it, so it fails quietly and it
                // fails differently on every background — which is why this is the sixth
                // contrast slip in this project and the first one caught by measuring.
                className={`relative min-h-[3.25rem] rounded-lg border p-1 text-right transition-colors ${
                  muted ? "bg-stone-50 border-stone-200 text-stone-500" : STATE_CELL[d.state]
                } ${d.iso === openIso ? "ring-2 ring-stone-800 ring-offset-1" : ""}`}
                aria-label={`${d.dayNum} — ${dayAnswer(d)}`}
              >
                <div className={`text-xs font-semibold ${d.isToday ? "underline decoration-2" : ""}`}>
                  {d.dayNum}
                </div>
                {d.state === "closed" && (
                  <div className="mt-0.5 flex justify-center"><IconBan size={12} /></div>
                )}
                {/* The kick-off time, not a dot. On a date that already holds a fixture the
                    next question is always "at what hour", and a dot sends him to tap. */}
                {d.state === "games" && (
                  <div className="mt-0.5 space-y-0.5">
                    {d.games.filter((g) => !g.cancelled).slice(0, 2).map((g, i) => (
                      <div key={i} className="text-[11px] leading-tight font-semibold tabular-nums">{g.time}</div>
                    ))}
                    {d.live > 2 && <div className="text-[11px] leading-tight">+{d.live - 2}</div>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {open && (
        <div className="rounded-xl border border-stone-200 bg-white p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-stone-900">
              {open.dayNum} ב{monthLabel(open.date.getFullYear(), open.date.getMonth())} · יום{" "}
              {HEB_DAY_SHORT[open.weekDay]}
            </div>
            <div
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                open.state === "games"
                  ? "bg-amber-100 text-amber-900"
                  : open.state === "closed"
                  ? "bg-stone-200 text-stone-700"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {dayAnswer(open)}
            </div>
          </div>

          {open.closures.map((c, i) => (
            <div key={i} className="text-xs text-stone-700 flex items-center gap-1.5">
              <IconBan size={12} />
              {c.allDay ? "כל היום" : `${c.start}–${c.end}`}
              {c.note && ` · ${c.note}`}
            </div>
          ))}

          {open.games.map((g, i) => (
            <div
              key={i}
              className={`text-xs flex items-center gap-2 ${g.cancelled ? "text-stone-500" : "text-stone-700"}`}
            >
              <span className="tabular-nums font-medium">{g.time}</span>
              <span className={g.cancelled ? "line-through" : ""}>
                {g.team}
                {g.opponent && ` נגד ${g.opponent}`}
              </span>
              {g.cancelled && <span className="text-stone-600 font-medium">מבוטל</span>}
            </div>
          ))}

          {open.games.length === 0 && open.closures.length === 0 && (
            <div className="text-xs text-stone-600">אין משחקים של המועדון באולם הזה בתאריך הזה.</div>
          )}
        </div>
      )}

      {/* Said once, plainly, and not hidden behind a tooltip. The screen knows this club's
          own fixtures and this club's own closure notes. It does not know what the
          municipality, a school or another club booked — so "free" here means "free of OUR
          games", which is what was asked for and is not the same as "available". */}
      <div className="text-xs text-stone-600 flex items-start gap-1.5 px-1">
        <IconCalendarDays size={13} className="mt-0.5 shrink-0" />
        <span>
          מוצגים <strong>משחקי הבית של המועדון</strong> וסימוני "אולם תפוס". אימונים אינם
          חוסמים כאן. תאריך שנראה פנוי עשוי להיות תפוס אצל מפעיל האולם או העירייה — זה
          המידע שלנו, לא היומן שלהם.
        </span>
      </div>
    </div>
  );
}
