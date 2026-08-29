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

import { weekStartOfDMY } from "./dates.js";

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
      duties.push({ hostTeamId, hostTeamName: teamName(hostTeamId), date: "", day: "", time: "", venue: "", gameKey: "" });
      return;
    }
    games.forEach((g) => {
      duties.push({
        hostTeamId,
        hostTeamName: teamName(hostTeamId),
        date: g.date || "",
        day: dayOf(g.date),
        time: g.time || "",
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

export function secretaryLabel(duty) {
  if (!duty) return "";
  return duty.hostTeamName ? `מזכירות — משחק של ${duty.hostTeamName}` : "מזכירות";
}

// "יום שני 07/09 · 20:30", or "" when the fixture is not on record yet.
export function secretaryWhen(duty) {
  if (!duty || !duty.date) return "";
  const parts = [duty.day ? `יום ${duty.day}` : "", shortDate(duty.date)].filter(Boolean).join(" ");
  return duty.time ? `${parts} · ${duty.time}` : parts;
}
