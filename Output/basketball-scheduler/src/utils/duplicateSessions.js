import { sessionKey } from "./rowCopy.js";
import { splitAccepted, FIELD } from "./acceptedChecks.js";
import { teamLabel } from "./teams.js";
import { sessionDate } from "./hallClashes.js";

// The same board row entered twice.
//
// WHAT THIS IS NOT. It is not the hall report: two squads in one gym at one hour is a
// booking to move, and this is one row that exists twice and should not. The two were
// conflated once already — the hall report printed team NAMES, sixteen of this club's
// teams share a name with another, and twenty-three real clashes therefore read as
// duplicates when they were nothing of the kind. Identity here is `teamId`, never a name.
//
// IDENTITY IS `sessionKey`, the same one the three copy tools already use to decide
// whether a row they are about to paste is already there. If this asked the question in its
// own words, "duplicate" would come to mean one thing when copying a week and another when
// checking for duplicates, and the two would disagree in exactly the cases that matter.
// `sessionKey` covers team, coach, hall, day, start, end and type; the week is added here
// because the same training in two different weeks is the schedule working, not a fault.

const arr = (list) => (Array.isArray(list) ? list : []);

export function duplicateSessionGroups(data, { from = null } = {}) {
  const groups = new Map();
  arr(data?.sessions).forEach((s) => {
    if (!s || !s.id) return;
    const key = (s.weekOf || "") + "|" + sessionKey(s);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  });

  const cutoff = from
    ? `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`
    : "";

  return [...groups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => {
      const first = rows[0];
      return {
        // The group's own identity, carried out so a manager's decision about it can be
        // recorded. `weekOf` leads, which is what lets an old decision be pruned by date.
        key,
        date: sessionDate(first),
        day: first.day,
        start: first.start,
        end: first.end,
        team: teamLabel(data, first.teamId),
        label: first.fromGame || /^משחק/.test(first.type || "") ? "משחק" : first.type || "אימון",
        count: rows.length,
        // The first is kept and the rest are what a fix would remove. Which one survives
        // does not matter — by definition they are the same row — but SAYING which one
        // does, because the person pressing the button is entitled to know.
        keepId: first.id,
        dropIds: rows.slice(1).map((s) => s.id),
      };
    })
    .filter((g) => !cutoff || (g.date && g.date >= cutoff))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.start).localeCompare(String(b.start)));
}

export function duplicateRowCount(groups) {
  return arr(groups).reduce((n, g) => n + g.dropIds.length, 0);
}

// Removing rows by id, and nothing else. It does not touch `games` — a duplicated board row
// is a row, and deleting a fixture is a different decision made on a different screen.
export function withoutSessions(data, ids) {
  const drop = new Set(arr(ids));
  if (drop.size === 0) return data;
  return { ...data, sessions: arr(data?.sessions).filter((s) => !s || !drop.has(s.id)) };
}

// Answering the report instead of re-reading it — see utils/acceptedChecks.js, which the
// hall-clash report on the same card shares. A duplicate is not always a fault: a squad can
// genuinely train twice in one slot, and the check cannot tell.
export function splitDuplicates(data, { from = null } = {}) {
  return splitAccepted(duplicateSessionGroups(data, { from }), data?.[FIELD]);
}
