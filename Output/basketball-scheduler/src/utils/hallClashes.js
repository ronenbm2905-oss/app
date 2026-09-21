import { DAYS } from "../constants.js";
import { hallClashPairs } from "./conflicts.js";
import { getWeekDates, toISODate } from "./dates.js";

// Every double-booked hall in the season, on one screen.
//
// The board already paints a clash red — but only for the week being looked at, and the
// federation publishes a whole season at once. Finding them by paging through thirty weeks
// is not a check anybody performs, so in practice they were found by a coach arriving at a
// gym that was already in use.
//
// BUILT FROM SESSIONS, NOT FROM GAMES, AND THAT IS THE WHOLE DESIGN. A fixture record from
// the federation carries a venue as TEXT — "אולם רימונים, רח' בר יהודה 5" — and its
// `hallId` is empty on almost every one of them. Grouping fixtures by `hallId` therefore
// puts the entire season in one "no hall" bucket and reports pairs that share nothing at
// all; it looks like a working report and is noise. `syncGamesToSessions` already resolves
// the venue text to a hall through the rename table, and it also applies the warm-up window
// that decides whether two fixtures actually overlap. Reading its output is reading the
// answer the app itself uses.
//
// Trainings are included for the same reason: a fixture landing on top of a training in the
// same gym is the same problem for the same caretaker, and excluding them would report half
// the clashes while looking complete.

const arr = (list) => (Array.isArray(list) ? list : []);

// The real calendar date of a session: its week's Sunday plus the offset of its day name.
export function sessionDate(session) {
  // `getWeekDates` is keyed BY DAY NAME, not by index — it returns an object, not an array.
  if (!session?.weekOf || DAYS.indexOf(session?.day) < 0) return "";
  const d = getWeekDates(session.weekOf)[session.day];
  return d ? toISODate(d) : "";
}

export function formatDayMonth(iso) {
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? iso : `${d.getDate()}.${d.getMonth() + 1}`;
}

// One entry per clashing PAIR, carrying what a manager needs to act: when, which hall, and
// the two things that collide.
export function seasonHallClashes(data, { from = new Date() } = {}) {
  const halls = arr(data?.halls);
  const teams = arr(data?.teams);
  const hallName = (id) => halls.find((h) => h && h.id === id)?.name || "";
  const teamName = (id) => teams.find((t) => t && t.id === id)?.name || "";

  const today = toISODate(new Date(from.getFullYear(), from.getMonth(), from.getDate()));

  const kindOf = (s) => (s.fromGame || /^משחק/.test(s.type || "") ? "game" : "training");
  const labelOf = (s) => {
    if (kindOf(s) === "game") return s.type && /^משחק/.test(s.type) ? s.type : "משחק";
    return s.type && s.type !== "אימון" ? s.type : "אימון";
  };

  // A cancelled row frees the hall. Reporting it as a clash sends a manager to move
  // something that is not happening.
  const live = arr(data?.sessions).filter((s) => s && !s.cancelled);

  const out = hallClashPairs(live)
    .map(([a, b]) => {
      const date = sessionDate(a);
      const first = a.start <= b.start ? a : b;
      const second = first === a ? b : a;
      return {
        date,
        day: a.day,
        hall: hallName(a.hallId),
        // TWO DIFFERENT PROBLEMS COME OUT OF THE SAME TEST, and calling both "a hall clash"
        // makes the tool look broken. One squad against ANOTHER squad in one gym is a
        // booking to move. One squad against ITSELF, at the very same hours, is not a
        // booking at all — it is the same row twice, from an import that ran into an
        // existing record. The manager fixes those by deleting one, not by phoning a hall.
        sameTeam: Boolean(a.teamId) && a.teamId === b.teamId,
        duplicate:
          Boolean(a.teamId) && a.teamId === b.teamId && a.start === b.start && a.end === b.end,
        rows: [first, second].map((s) => ({
          id: s.id,
          team: teamName(s.teamId),
          start: s.start,
          end: s.end,
          kind: kindOf(s),
          label: labelOf(s),
        })),
      };
    })
    // Past weeks are history; a manager can only move what has not happened yet.
    .filter((c) => c.date && c.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.rows[0].start.localeCompare(b.rows[0].start));

  return out;
}

// The same list grouped by day, because that is how it gets dealt with: a manager opens the
// hall's diary for one evening, not for one pair.
export function clashesByDate(clashes) {
  const map = new Map();
  arr(clashes).forEach((c) => {
    if (!map.has(c.date)) map.set(c.date, { date: c.date, day: c.day, items: [] });
    map.get(c.date).items.push(c);
  });
  return [...map.values()];
}
