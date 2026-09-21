import assert from "node:assert/strict";
import {
  duplicateSessionGroups, duplicateRowCount, withoutSessions,
} from "../src/utils/duplicateSessions.js";
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
