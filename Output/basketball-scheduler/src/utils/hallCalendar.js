// One hall, one month, and the question asked on the phone: "is it free on the 2nd?"
//
// WHY THIS IS NOT THE WEEKLY BOARD OR THE FIXTURE LIST. Ronen, 29.9.2026: when the season
// starts, somebody rings and asks to move a fixture to another date. The weekly board answers
// "what is on this week" and needs scrolling forward a month to reach December; the fixture
// list answers "when does this team play". **Neither answers "which dates is this hall
// still open".** He was navigating to one date to see the hall, then to another date to see
// whether it was taken — on a phone, while the other side waited.
//
// So the unit here is A HALL AND A MONTH, and the thing being shown is the EMPTY days as
// much as the full ones. A list of busy dates would force him to work out the gaps himself,
// which is how a wrong "yes, that's free" gets said out loud.
//
// WHAT COUNTS AS TAKEN, and it is deliberately not only fixtures:
//   • a HOME fixture of ours in that hall
//   • a hall closure — the municipality took it, a tournament, a repair (`absences` with a
//     hallId). Leaving these out would print "free" over a date the hall does not exist on.
// Training sessions are NOT counted. He said "free of GAMES" twice, and he is right: a
// training is ours to move, an opponent's travel plan is not.
//
// AND WHAT WE CANNOT KNOW: this club's own record. Another club, a school or the operator
// may hold the hall on a date that looks empty here. That is a real limit of the data, not
// of the screen, and the screen says so rather than implying certainty.

import { parseDateDMY } from "./dates.js";
import { hallClosuresOn, isAllDay } from "./availability.js";
import { matchHall } from "./halls.js";

const arr = (v) => (Array.isArray(v) ? v : []);

export const HEB_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

// Sunday first, because the week starts on Sunday here and the board already does.
export const HEB_DAY_SHORT = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export const isoOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const monthLabel = (year, month) => `${HEB_MONTHS[month]} ${year}`;

// Which hall a fixture occupies — or "" for one that occupies none of ours.
//
// Only HOME fixtures. An away game is played in somebody else's hall and says nothing about
// whether ours is free, and counting it would block dates for no reason.
//
// `hallId` first, then the venue text through `matchHall`: fixtures imported before the form
// started storing the id carry only the federation's spelling of the venue.
export function hallOfGame(game, halls) {
  if (!game || !game.isHome) return "";
  if (game.hallId) return game.hallId;
  return matchHall(game.venue, halls) || "";
}

// Every fixture of ours in one hall, keyed by ISO date.
//
// A CANCELLED fixture is kept and marked rather than dropped. The hall is genuinely free
// that evening — which is the answer to the question being asked — but a manager looking at
// a date that used to hold a game and now shows nothing has no way to tell "nobody was ever
// booked" from "that one was called off", and the second is worth seeing.
export function gamesByDate(data, hallId) {
  const halls = arr(data?.halls);
  const teamName = (id) => arr(data?.teams).find((t) => t && t.id === id)?.name || "";
  const out = new Map();
  if (!hallId) return out;

  for (const g of arr(data?.games)) {
    if (!g || hallOfGame(g, halls) !== hallId) continue;
    const d = parseDateDMY(g.date);
    if (!d) continue;
    const iso = isoOf(d);
    if (!out.has(iso)) out.set(iso, []);
    out.get(iso).push({
      code: g.federationCode || "",
      time: g.time || "",
      team: teamName(g.teamId),
      opponent: g.opponent || "",
      cancelled: !!g.cancelled,
      league: g.league || "",
    });
  }

  for (const list of out.values()) list.sort((a, b) => String(a.time).localeCompare(String(b.time)));
  return out;
}

// The closures on a hall, keyed by ISO date. `hallClosuresOn` already knows how to read a
// one-off closure by calendar date rather than by weekday.
export function closuresByDate(data, hallId, isoDates) {
  const out = new Map();
  if (!hallId) return out;
  for (const iso of isoDates) {
    const found = hallClosuresOn(arr(data?.absences), iso)
      .filter((a) => a.hallId === hallId)
      .map((a) => ({
        allDay: isAllDay(a),
        start: a.start || "",
        end: a.end || "",
        note: String(a.note || "").trim(),
      }));
    if (found.length) out.set(iso, found);
  }
  return out;
}

// The month as a grid, Sunday-first, padded to whole weeks.
//
// Days from the neighbouring months are included and flagged rather than left as blanks: a
// grid that starts mid-row reads as broken, and the 30th of the previous month is genuinely
// useful when somebody proposes "the Sunday before".
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const cells = [];
  // Six weeks covers every possible month layout; the tail is trimmed below when the last
  // row holds nothing from this month.
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({
      iso: isoOf(d),
      date: d,
      dayNum: d.getDate(),
      weekDay: d.getDay(),
      inMonth: d.getMonth() === month && d.getFullYear() === year,
    });
  }
  while (cells.length > 35 && !cells.slice(35).some((c) => c.inMonth)) cells.length = 35;
  return cells;
}

// The whole answer for one hall and one month.
//
//   state: "closed"  the hall is not available that day
//          "games"   at least one live fixture of ours
//          "off"     only cancelled fixtures — the hall IS free
//          "free"    nothing of ours
export function hallMonth(data, hallId, year, month, { today = new Date() } = {}) {
  const cells = monthGrid(year, month);
  const byDate = gamesByDate(data, hallId);
  const closures = closuresByDate(data, hallId, cells.map((c) => c.iso));
  const todayIso = isoOf(today);

  const days = cells.map((c) => {
    const games = byDate.get(c.iso) || [];
    const closed = closures.get(c.iso) || [];
    const live = games.filter((g) => !g.cancelled);
    let state = "free";
    if (closed.length) state = "closed";
    else if (live.length) state = "games";
    else if (games.length) state = "off";
    return { ...c, games, closures: closed, live: live.length, state, isToday: c.iso === todayIso, isPast: c.iso < todayIso };
  });

  const inMonth = days.filter((d) => d.inMonth);
  return {
    days,
    label: monthLabel(year, month),
    // The counts the header shows. Past days are excluded from "free": offering a date that
    // has already gone by is worse than offering none.
    freeAhead: inMonth.filter((d) => !d.isPast && (d.state === "free" || d.state === "off")).length,
    withGames: inMonth.filter((d) => d.state === "games").length,
    closedDays: inMonth.filter((d) => d.state === "closed").length,
  };
}

// Move by months without the 31st turning into the 1st of the month after next.
export function shiftMonth(year, month, delta) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

// "פנוי" / "תפוס" for one day, in the words the answer is given in on the phone.
export function dayAnswer(day) {
  if (!day) return "";
  if (day.state === "closed") {
    const note = day.closures.map((c) => c.note).filter(Boolean)[0];
    return note ? `האולם תפוס — ${note}` : "האולם תפוס";
  }
  if (day.state === "games") return `${day.live} ${day.live === 1 ? "משחק" : "משחקים"}`;
  if (day.state === "off") return "פנוי (המשחק בוטל)";
  return "פנוי ממשחקים";
}
