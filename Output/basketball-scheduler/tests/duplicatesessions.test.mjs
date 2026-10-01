import assert from "node:assert/strict";
import {
  duplicateSessionGroups, duplicateRowCount, withoutSessions, splitDuplicates,
} from "../src/utils/duplicateSessions.js";
import {
  acceptKeyOf, isAccepted, accept, unaccept, pruneAccepted,
} from "../src/utils/acceptedChecks.js";
import { seasonHallClashes } from "../src/utils/hallClashes.js";
import { teamLabel } from "../src/utils/teams.js";

let count = 0;
const T = (name, fn) => { fn(); console.log("  ok  " + name); count++; };

const W = "2026-10-11";
const W2 = "2026-10-18";
// Two squads that really are called the same thing — four of this club's are called
// "ילדים ב" — plus the coaches that tell them apart.
const data = {
  coaches: [{ id: "c1", name: "עומר" }, { id: "c2", name: "סהר" }],
  halls: [{ id: "h1", name: "רימונים" }],
  teams: [
    { id: "t1", name: "ילדים ב", coachId: "c1" },
    { id: "t2", name: "ילדים ב", coachId: "c2" },
  ],
  sessions: [
    { id: "s1", teamId: "t1", coachId: "c1", hallId: "h1", day: "שני", start: "17:00", end: "18:30", weekOf: W },
    { id: "s2", teamId: "t1", coachId: "c1", hallId: "h1", day: "שני", start: "17:00", end: "18:30", weekOf: W },
    // Same shape, DIFFERENT squad. Two groups sharing a gym is the schedule, not a fault.
    { id: "s3", teamId: "t2", coachId: "c2", hallId: "h1", day: "שני", start: "17:00", end: "18:30", weekOf: W },
    // Same shape, different WEEK. That is a weekly training.
    { id: "s4", teamId: "t1", coachId: "c1", hallId: "h1", day: "שני", start: "17:00", end: "18:30", weekOf: W2 },
  ],
};
const BEFORE = new Date("2026-10-01T00:00:00");

T("the same row twice is one group, and names what would be removed", () => {
  const g = duplicateSessionGroups(data, { from: BEFORE });
  assert.equal(g.length, 1);
  assert.equal(g[0].count, 2);
  assert.equal(g[0].keepId, "s1");
  assert.deepEqual(g[0].dropIds, ["s2"]);
  assert.equal(duplicateRowCount(g), 1);
});

// THE MISTAKE THIS MODULE EXISTS TO AVOID. Sixteen of the club's teams share a name.
T("two DIFFERENT squads with the SAME NAME are not a duplicate", () => {
  const g = duplicateSessionGroups(data, { from: BEFORE });
  assert.equal(g.some((x) => x.dropIds.includes("s3")), false);
  // And the label has to make them distinguishable on screen, or a manager deletes the
  // wrong one — which is worse than leaving both.
  assert.equal(teamLabel(data, "t1"), "ילדים ב · עומר");
  assert.equal(teamLabel(data, "t2"), "ילדים ב · סהר");
});

T("the same training in another week is the schedule working", () => {
  const g = duplicateSessionGroups(data, { from: BEFORE });
  assert.equal(g.some((x) => x.dropIds.includes("s4")), false);
});

T("a difference in ANY field of the identity breaks the match", () => {
  for (const change of [{ hallId: "h9" }, { start: "17:15" }, { end: "19:00" }, { type: "יורם" }, { coachId: "c2" }]) {
    const d = { ...data, sessions: [data.sessions[0], { ...data.sessions[1], ...change }] };
    assert.deepEqual(duplicateSessionGroups(d, { from: BEFORE }), [], JSON.stringify(change));
  }
});

T("three of the same keeps one and drops two", () => {
  const d = { ...data, sessions: [...data.sessions, { ...data.sessions[0], id: "s5" }] };
  const g = duplicateSessionGroups(d, { from: BEFORE });
  assert.equal(g[0].count, 3);
  assert.deepEqual(g[0].dropIds, ["s2", "s5"]);
  assert.equal(duplicateRowCount(g), 2);
});

T("past weeks drop off, like everywhere else", () => {
  assert.deepEqual(duplicateSessionGroups(data, { from: new Date("2026-11-01T00:00:00") }), []);
  assert.equal(duplicateSessionGroups(data).length, 1, "with no cutoff, everything is reported");
});

T("removing takes exactly the named rows and nothing near them", () => {
  const next = withoutSessions(data, ["s2"]);
  assert.deepEqual(next.sessions.map((s) => s.id), ["s1", "s3", "s4"]);
  assert.equal(next.teams, data.teams, "nothing else in the club is touched");
  assert.equal(data.sessions.length, 4, "the original is not mutated");
});

T("removing nothing changes nothing", () => {
  assert.equal(withoutSessions(data, []), data);
  assert.equal(withoutSessions(data, null), data);
});

T("after the fix, the check comes back clean", () => {
  const fixed = withoutSessions(data, duplicateSessionGroups(data, { from: BEFORE })[0].dropIds);
  assert.deepEqual(duplicateSessionGroups(fixed, { from: BEFORE }), []);
});

// The two reports answer different questions and must not be confused again.
T("a duplicate row and a hall clash are not the same finding", () => {
  const clashes = seasonHallClashes(data, { from: BEFORE });
  // s1/s2/s3 all sit in one gym at one hour, so the hall report sees pairs among them.
  assert.equal(clashes.length > 0, true);
  // But only ONE of those pairs is the same squad twice.
  assert.equal(clashes.filter((c) => c.duplicate).length, 1);
  assert.equal(duplicateSessionGroups(data, { from: BEFORE }).length, 1);
});

T("rubbish never throws", () => {
  assert.deepEqual(duplicateSessionGroups(null), []);
  assert.deepEqual(duplicateSessionGroups({}), []);
  assert.deepEqual(duplicateSessionGroups({ sessions: [null, undefined, {}] }), []);
  assert.equal(duplicateRowCount(null), 0);
});

console.log(`\n${count} duplicate-row tests passed`);

// ── the label, after the club renamed its ambiguous squads ───────────────────────────
{
  const a = (await import("node:assert/strict")).default;
  const ok = (n, f) => { f(); console.log("  ok  " + n); };
  const club = {
    coaches: [
      { id: "c1", name: "נדב שוורץ" },
      { id: "c2", name: "עמנואל ורדי" },
      { id: "c3", name: "רועי ליבשיץ + עידו זיידמן" },
    ],
    teams: [
      { id: "t1", name: "ילדים א מחוזית נדב", coachId: "c1" },
      { id: "t2", name: "ילדים א מחוזית", coachId: "c2" },
      { id: "t3", name: "נערים ב מחוזית", coachId: "c3" },
      { id: "t4", name: "נוער מחוזית", coachId: "" },
    ],
  };

  ok("a squad that already carries its coach is not made to say it twice", () => {
    // Renaming the ambiguous squads was the fix; appending on top of it produced
    // "ילדים א מחוזית נדב · נדב שוורץ".
    a.equal(teamLabel(club, "t1"), "ילדים א מחוזית נדב");
  });

  ok("a squad that does not still gets the coach, which is the whole point", () => {
    a.equal(teamLabel(club, "t2"), "ילדים א מחוזית · עמנואל ורדי");
    a.equal(teamLabel(club, "t3"), "נערים ב מחוזית · רועי ליבשיץ + עידו זיידמן");
  });

  ok("no coach, no suffix — and no trailing separator into nothing", () => {
    a.equal(teamLabel(club, "t4"), "נוער מחוזית");
    a.equal(teamLabel(club, "nope"), "");
  });

  ok("the match is on a whole word, not on letters inside one", () => {
    const odd = {
      coaches: [{ id: "c9", name: "דן לוי" }],
      teams: [{ id: "x", name: "ילדים מודן", coachId: "c9" }],
    };
    a.equal(teamLabel(odd, "x"), "ילדים מודן · דן לוי");
  });

  console.log("\n4 label tests passed");
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// "THIS ONE IS DELIBERATE" — answering the report instead of re-reading it.
//
// Ronen, 1.10.2026: "let me delete it or approve that it is fine, so I do not have to go
// through it again and again." A duplicate is not always a fault — a squad can genuinely
// train twice in one slot — and a report that cannot be answered is one people stop opening.
console.log("- a duplicate a person has already decided about -");

T("approving a group hides it from the open list and keeps it in reach", () => {
  const [g] = duplicateSessionGroups(data, { from: BEFORE });
  const next = accept(data, g, BEFORE);
  const split = splitDuplicates(next, { from: BEFORE });
  assert.equal(split.open.length, 0, "it must stop asking");
  assert.equal(split.accepted.length, 1, "and it must still be findable — never silently dropped");
  assert.deepEqual(split.accepted[0].dropIds, ["s2"]);
});

T("and the decision can be taken back", () => {
  const [g] = duplicateSessionGroups(data, { from: BEFORE });
  const accepted = accept(data, g, BEFORE);
  const undone = unaccept(accepted, g);
  assert.deepEqual(undone.acceptedChecks, []);
  assert.equal(splitDuplicates(undone, { from: BEFORE }).open.length, 1);
});

T("A GROUP THAT GROWS COMES BACK — approving two is not approving three", () => {
  // The count is part of the key on purpose. A third identical row appearing weeks later is
  // new information, and inheriting an old "it is fine" would bury it for the season.
  const [g] = duplicateSessionGroups(data, { from: BEFORE });
  const accepted = accept(data, g, BEFORE);
  const grown = {
    ...accepted,
    sessions: [...data.sessions, { ...data.sessions[0], id: "s5" }],
  };
  const split = splitDuplicates(grown, { from: BEFORE });
  assert.equal(split.open.length, 1, "three identical rows must be asked about again");
  assert.equal(split.open[0].count, 3);
});

T("the stored key carries ids and clock times — no name of a person, team or child", () => {
  const [g] = duplicateSessionGroups(data, { from: BEFORE });
  const key = acceptKeyOf(g);
  // Both of this club's "ילדים ב" squads, and both coaches, must be absent from it.
  for (const name of ["ילדים ב", "עומר", "סהר", "רימונים"]) {
    assert.equal(key.includes(name), false, name);
  }
  assert.ok(key.startsWith(W), "the week leads, which is what lets an old decision be pruned");
  assert.ok(key.includes("t1"), "the team is identified by id");
});

T("a decision about a week that has passed is dropped, not kept for ever", () => {
  // It lives on a document with a size ceiling, and it can never match again — the week is
  // part of the key.
  const old = ["2026-01-05|t1|c1|h1|שני|17:00|18:30||x2"];
  assert.deepEqual(pruneAccepted(old, new Date("2026-10-01T00:00:00")), []);
  assert.deepEqual(pruneAccepted([`${W2}|x2`], new Date("2026-10-01T00:00:00")), [`${W2}|x2`]);
});

T("PRUNING EARLY IN THE MONTH does not wipe every decision", () => {
  // `getDate() - 7` on the 3rd of the month produces the string "2026-11--4", which sorts
  // below every real key and throws the lot away — every decision the manager ever made,
  // on a date that has nothing to do with any of them. Date arithmetic goes through a Date.
  const from = new Date("2026-11-03T00:00:00"); // cutoff: 27.10
  assert.deepEqual(pruneAccepted(["2026-10-28|x2"], from), ["2026-10-28|x2"], "inside the window");
  assert.deepEqual(pruneAccepted(["2026-10-26|x2"], from), [], "and outside it is still dropped");
  // The first of the month is the sharpest case: the subtraction crosses into the previous
  // month AND goes negative.
  const first = new Date("2026-10-01T00:00:00"); // cutoff: 24.9
  assert.deepEqual(pruneAccepted(["2026-09-27|x2"], first), ["2026-09-27|x2"]);
});

T("a key that is not a date is kept — unreadable is not the same as stale", () => {
  assert.deepEqual(pruneAccepted(["rubbish"], new Date("2026-10-01T00:00:00")), ["rubbish"]);
});

T("approving the same group twice stores it once", () => {
  const [g] = duplicateSessionGroups(data, { from: BEFORE });
  const twice = accept(accept(data, g, BEFORE), g, BEFORE);
  assert.equal(twice.acceptedChecks.length, 1);
});

T("nothing throws on a group with no key, and nothing is stored", () => {
  assert.equal(acceptKeyOf(null), "");
  assert.equal(acceptKeyOf({}), "");
  assert.equal(accept(data, {}, BEFORE), data, "same object back");
  assert.equal(isAccepted(undefined, { key: "k", count: 2 }), false);
});

console.log(`\n${count} tests passed`);
