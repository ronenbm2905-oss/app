// "האם הקבוצה שלי עושה מזכירות השבוע?"
//
// The weekly board carries two columns at the end of every team row — "קבוצה משחקת" and
// "קבוצה מזכירות" — stored in `weeklyAssignments` under `` `${weekStart}__${teamId}` ``
// with a value of `{ playing, secretary }`, both TEAM IDS.
//
// The semantics are not written down anywhere in the code; they were read off the club's
// own records, where every row says the same thing: the row's team is the one playing, and
// `secretary` is a DIFFERENT team staffing the scorer's table at that game. So the question
// a coach actually asks — "are we on the table this week?" — is answered by scanning every
// row of the week for `secretary === myTeamId`, not by looking at my own row.
//
// The one thing the model cannot tell us is WHEN: the key holds a week, never a date or a
// game. The time is recovered from the host team's home game that week.

import { weekStartOfDMY, timeMinus } from "./dates.js";

// The table crew is asked for a quarter of an hour before the first whistle — the scoresheet
// has to be filled in and the clock set before anyone jumps.
//
// The single-club branch names this as a constant, with a comment saying out loud that it
// is "a club rule, not a fact about time". That comment is the whole argument for moving
// it: one club's rule hard-coded into a product every club runs is exactly what the port
// gate asks about, and a number is no less club-specific for being small. Fifteen stays as
// the DEFAULT, because it is a sensible convention rather than anyone's identity.
export const SECRETARY_LEAD_MIN = 15;

// Minutes before tip-off this club expects the table crew. Guarded rather than trusted:
// the value comes from a settings field, and a blank or a pasted word must not turn every
// duty time into "NaN:NaN" on a coach's screen.
export function secretaryLeadFor(data) {
  const raw = data?.settings?.secretaryLeadMin;
  // Only a number or a numeric string counts. `Number("")`, `Number(null)` and
  // `Number([])` are all 0, so a plain range check would read "not set" — a cleared field,
  // or a club document written before this setting existed — as "arrive at the whistle",
  // which is a real instruction and the wrong one. `true` coerces to 1 for the same reason.
  const isNumeric =
    typeof raw === "number" ||
    (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw)));
  if (!isNumeric) return SECRETARY_LEAD_MIN;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 240 ? Math.round(n) : SECRETARY_LEAD_MIN;
}

const arr = (list) => (Array.isArray(list) ? list : []);

// The tip-off, deliberately taken from the game record rather than from the session the
// board draws. `syncGamesToSessions` sets a session's `start` to tip-off minus thirty
// minutes, because a team warms up before it plays — but a scorer's table does not. Reading
// the session would have told every secretary crew to arrive half an hour early, every time.
function homeGamesFor(games, teamId, weekStart) {
  return arr(games)
    .filter(
      (g) =>
        g &&
        g.teamId === teamId &&
        g.isHome &&
        !g.cancelled &&
        g.date &&
        weekStartOfDMY(g.date) === weekStart
    )
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.time || "").localeCompare(b.time || ""));
}

// "DD-MM-YYYY" -> "DD/MM", the short form the report and the banner both use.
export function shortDate(dmy) {
  const p = String(dmy || "").split("-");
  return p.length === 3 ? `${p[0]}/${p[1]}` : "";
}

function dayOf(dmy) {
  const p = String(dmy || "").split("-");
  if (p.length !== 3) return "";
  const d = new Date(`${p[2]}-${p[1]}-${p[0]}T00:00:00`);
  return isNaN(d.getTime()) ? "" : ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"][d.getDay()];
}

// Every secretary duty this team carries in this week.
//
// Returns one entry per host game, so a week with two home games on the same host row
// produces two duties rather than one ambiguous line. A duty whose host has no home game on
// record still comes back — without a date — because "you are on the table this week" is
// worth saying even when the fixture has not been imported yet.
export function secretaryDutiesFor(data, teamId, weekStart) {
  const d = data || {};
  if (!teamId || !weekStart) return [];
  const teamName = (id) => arr(d.teams).find((t) => t && t.id === id)?.name || "";
  const prefix = `${weekStart}__`;
  const lead = secretaryLeadFor(d);

  const duties = [];
  Object.entries(d.weeklyAssignments || {}).forEach(([key, value]) => {
    if (!key.startsWith(prefix) || !value || value.secretary !== teamId) return;
    const rowTeamId = key.slice(prefix.length);
    // `playing` wins when it is filled — it is what the manager actually chose. The row's
    // own team is the fallback, and in every record the club has written so far the two
    // are the same.
    const hostTeamId = value.playing || rowTeamId;
    // A team keeping the table at its own game is a data-entry slip, not a duty. Reporting
    // it would put a line on the coach's schedule that contradicts the game right above it.
    if (!hostTeamId || hostTeamId === teamId) return;

    const games = homeGamesFor(d.games, hostTeamId, weekStart);
    if (games.length === 0) {
      duties.push({ hostTeamId, hostTeamName: teamName(hostTeamId), date: "", day: "", time: "", gameTime: "", venue: "", gameKey: "" });
      return;
    }
    games.forEach((g) => {
      duties.push({
        hostTeamId,
        hostTeamName: teamName(hostTeamId),
        date: g.date || "",
        day: dayOf(g.date),
        // `time` is when the crew is due, not when the ball goes up. Both are carried: the
        // coach needs to know when to be there, and the tip-off is what tells them the row
        // is about the game they already have in their head.
        time: timeMinus(g.time, lead),
        gameTime: g.time || "",
        venue: g.addressOverride || g.venue || "",
        gameKey: String(g.federationCode || ""),
      });
    });
  });

  // Dated duties first, in order; undated ones last, where they read as "sometime this week".
  return duties.sort((a, b) => {
    if (!a.date !== !b.date) return a.date ? -1 : 1;
    return (a.date || "").localeCompare(b.date || "") || (a.time || "").localeCompare(b.time || "");
  });
}

// "מזכירות — משחק של נוער על · שריקה 20:30".
//
// The tip-off is named explicitly because the time next to it is the lead time earlier.
// Without it the row reads as a game at 20:15 and someone eventually shows up late to the
// real thing, or early to the wrong one.
export function secretaryLabel(duty) {
  if (!duty) return "";
  const who = duty.hostTeamName ? `מזכירות — משחק של ${duty.hostTeamName}` : "מזכירות";
  return duty.gameTime ? `${who} · שריקה ${duty.gameTime}` : who;
}

// "יום שני 07/09 · 20:15" — when the crew is due, or "" when the fixture is not on record.
export function secretaryWhen(duty) {
  if (!duty || !duty.date) return "";
  const parts = [duty.day ? `יום ${duty.day}` : "", shortDate(duty.date)].filter(Boolean).join(" ");
  return duty.time ? `${parts} · ${duty.time}` : parts;
}
