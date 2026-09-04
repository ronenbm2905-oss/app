// Copying last week's schedule into this one.
//
// This used to be a blind append: every manual session of the previous week was pushed on,
// whatever the target week already held. On 30.8.2026 that landed 115 August sessions on
// top of a week whose new-season schedule was already typed in — 241 rows instead of 126,
// every team showing its hours twice.
//
// Two guards, because they answer two different mistakes:
//
// 1. **Nothing is copied twice.** A session already standing in the target week — same
//    team, coach, hall, day, hours and type — is skipped, so pressing the button again
//    does nothing. That idempotence is the property the old version most conspicuously
//    lacked.
// 2. **A week that is already built has to be asked about.** Skipping identical rows does
//    not save you from a week whose hours have all moved since: those are not duplicates
//    by any comparison, and they are exactly what happened. So the decision is handed back
//    to the caller with the numbers, rather than decided here.
//
// Pure and separate from the screen: the accident this prevents is worth a test, and a
// `window.confirm` buried in a component cannot have one.

import { shiftWeek } from "./dates.js";

const arr = (list) => (Array.isArray(list) ? list : []);

// What makes two sessions "the same row". Deliberately the visible facts and not the id:
// a copy gets a fresh id by definition, so comparing ids would find no duplicates ever.
export function sessionKey(s) {
  return [s?.teamId, s?.coachId, s?.hallId, s?.day, s?.start, s?.end, s?.type || ""].join("|");
}

// Returns what a copy would do, without doing it:
//   { fresh, skipped, existing, sessions }
// `fresh` is the rows that would be added, already stamped for the target week.
export function planWeekCopy(sessions, weekStart, makeId = () => Math.random().toString(36).slice(2, 10)) {
  const all = arr(sessions);
  const prev = shiftWeek(weekStart, -1);
  // `fromGame` rows are excluded on both sides: imported fixtures belong to the federation
  // file, and copying one forward would invent a match that is not on anyone's calendar.
  const source = all.filter((s) => s && (s.weekOf || "") === prev && !s.fromGame);
  const existing = all.filter((s) => s && (s.weekOf || "") === weekStart && !s.fromGame);

  const here = new Set(existing.map(sessionKey));
  const fresh = source
    .filter((s) => !here.has(sessionKey(s)))
    .map((s) => ({ ...s, id: makeId(), weekOf: weekStart }));

  return {
    source: source.length,
    existing: existing.length,
    skipped: source.length - fresh.length,
    fresh,
    sessions: [...all, ...fresh],
  };
}
