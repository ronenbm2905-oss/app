// Teams whose week is the same every week — the basketball school.
//
// The app's time model is deliberately week-by-week: every session carries a `weekOf` and
// each week stands on its own (28.7.2026). That is right for the competitive teams, whose
// hours move with halls and fixtures. It is wrong for the school, which runs the same four
// rows every week of the year, and re-entering them by hand is how a week ends up missing
// one.
//
// So a team can be marked `weekly: true`, and a week that has none of its sessions gets
// offered them. Three things this is NOT, on purpose:
//
// 1. NOT a separate recurrence store. The template is simply the last week that team
//    actually ran. Change the school's Monday hour once and every later week inherits it —
//    no second copy of the truth to keep in sync with the board.
// 2. NOT automatic. Filling writes the whole club document, and paging forward through ten
//    weeks would silently create ten weeks of sessions nobody asked for. It is one click,
//    the same bargain the nightly federation import already makes.
// 3. NOT a different kind of session. What lands in the week is an ordinary session with a
//    fresh id, so the hours report, the transport export, conflicts, the calendar and the
//    coach's training plans all keep working with no idea this feature exists.

import { shiftWeek } from "./dates.js";

const arr = (list) => (Array.isArray(list) ? list : []);

export function isFixedTeam(team) {
  return Boolean(team && team.weekly);
}

export function fixedTeams(teams) {
  return arr(teams).filter(isFixedTeam);
}

// The most recent week at or before `weekStart` in which this team actually ran, or "".
// Imported games are skipped: a fixture is not a recurring training, and the federation
// owns those dates anyway.
//
// Bounded rather than open-ended — `maxBack` weeks. A team marked fixed but dormant since
// last season should stop being offered rather than resurrect a year-old week.
export function templateWeekFor(sessions, teamId, weekStart, maxBack = 8) {
  if (!teamId || !weekStart) return "";
  const list = arr(sessions);
  for (let back = 1; back <= maxBack; back++) {
    const week = shiftWeek(weekStart, -back);
    if (list.some((s) => s && s.teamId === teamId && (s.weekOf || "") === week && !s.fromGame)) {
      return week;
    }
  }
  return "";
}

export function templateSessions(sessions, teamId, templateWeek) {
  return arr(sessions).filter(
    (s) => s && s.teamId === teamId && (s.weekOf || "") === templateWeek && !s.fromGame
  );
}

// Which fixed teams are missing from `weekStart`, and what would be added for each.
//
// "Missing" means the team has NO session that week. A team with even one is left alone —
// half a week entered by hand is a decision, and topping it up from an older week would
// fight the person who made it.
export function pendingFixedTeams(data, weekStart, maxBack = 8) {
  const d = data || {};
  if (arr(d.fixedWeekSkips).includes(weekStart)) return [];
  const sessions = arr(d.sessions);
  return fixedTeams(d.teams)
    .filter((t) => !sessions.some((s) => s && s.teamId === t.id && (s.weekOf || "") === weekStart))
    .map((team) => {
      const from = templateWeekFor(sessions, team.id, weekStart, maxBack);
      return from ? { team, from, sessions: templateSessions(sessions, team.id, from) } : null;
    })
    .filter((e) => e && e.sessions.length > 0);
}

// The sessions to append. `makeId` is injected so the caller owns id generation and the
// result is testable.
export function buildFixedSessions(pending, weekStart, makeId) {
  const out = [];
  (pending || []).forEach((entry) => {
    entry.sessions.forEach((s) => {
      // `timeOverride` and `cancelled` belong to the week they were set in — a game moved
      // by fifteen minutes three weeks ago says nothing about this Monday, and a training
      // cancelled once is not cancelled forever.
      const { id, weekOf, timeOverride, cancelled, cancelledAt, ...rest } = s;
      out.push({ ...rest, id: makeId(), weekOf: weekStart });
    });
  });
  return out;
}

export function countPending(pending) {
  return (pending || []).reduce((n, e) => n + e.sessions.length, 0);
}

// "לא השבוע" — remember the refusal so the strip stops asking. Per week, not per team:
// the answer being given is about this week, not about the school.
export function skipWeek(data, weekStart) {
  const skips = arr(data.fixedWeekSkips);
  return skips.includes(weekStart) ? skips : [...skips, weekStart];
}
