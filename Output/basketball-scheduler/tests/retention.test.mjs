// Records that have outlived their purpose.
//
// The legal gate's M2: an absence mark is a line a manager writes ABOUT a coach, and once
// the day it refers to has passed nothing in the app reads it — the hours report counts
// sessions. It had no retention period and no mechanism, and the code comment pointed at a
// deletion procedure that did not exist in this branch. A driver's details did have a rule,
// but only inside the federation import, so a club that stopped importing kept a stranger's
// phone number indefinitely.
//
// The assertions that matter are the refusals: an unreadable date is never a reason to
// delete somebody's record, and a mark inside the window stays.

import assert from "node:assert/strict";
import {
  expiredAbsences, retentionReport, retentionSummary, ABSENCE_KEEP_DAYS, DRIVER_KEEP_DAYS,
} from "../src/utils/retention.js";

const TODAY = "2026-09-04";

const absences = [
  { id: "old", coachId: "c1", date: "2026-07-01", note: "מילואים" },   // 65 days back
  { id: "edge-out", coachId: "c1", date: "2026-08-04", note: "" },      // exactly 31 back
  { id: "edge-in", coachId: "c1", date: "2026-08-05", note: "" },       // exactly 30 back
  { id: "recent", coachId: "c1", date: "2026-09-01", note: "ניתוח" },
  { id: "future", coachId: "c1", date: "2026-10-01", note: "" },
  { id: "hall", hallId: "h1", date: "2026-07-01", note: "עירייה" },     // a hall closure expires too
];

assert.equal(ABSENCE_KEEP_DAYS, 30);
assert.equal(DRIVER_KEEP_DAYS, 14, "the driver rule must stay the one transport.js already applies");

// ---- What has expired ----
assert.deepEqual(expiredAbsences(absences, TODAY).sort(), ["edge-out", "hall", "old"]);
// The boundary, stated in both directions so an off-by-one cannot pass.
assert.ok(expiredAbsences(absences, TODAY).includes("edge-out"), "31 days back should be gone");
assert.ok(!expiredAbsences(absences, TODAY).includes("edge-in"), "exactly 30 days back should stay");
assert.ok(!expiredAbsences(absences, TODAY).includes("future"), "a mark for a day still ahead was deleted");
// The window is a parameter, and zero means "everything already past".
assert.deepEqual(expiredAbsences(absences, TODAY, 0).sort(), ["edge-in", "edge-out", "hall", "old", "recent"]);

// ---- What must never be swept ----
//
// An unreadable date is not "expired", it is unknown — and unknown is never a reason to
// delete a record about a person.
for (const bad of [{ id: "x" }, { id: "x", date: "" }, { id: "x", date: "01/07/2026" }, { id: "x", date: null }, { id: "x", date: "2026-7-1" }]) {
  assert.deepEqual(expiredAbsences([bad], TODAY), [], `a mark dated ${JSON.stringify(bad.date)} was swept`);
}
assert.deepEqual(expiredAbsences(null, TODAY), []);
assert.deepEqual(expiredAbsences(absences, "not-a-date"), [], "an unreadable today must sweep nothing, not everything");
assert.deepEqual(expiredAbsences(absences, ""), []);

// ---- The report a manager reads, and the document pressing produces ----
const games = () => [
  { id: "g1", date: "01/07/2026", opponent: "הפועל", driverName: "משה", driverPhone: "052-1" },
  { id: "g2", date: "01/10/2026", opponent: "מכבי", driverName: "יוסי", driverPhone: "052-2" },
  { id: "g3", date: "01/07/2026", opponent: "בית\"ר" },
];
const club = () => ({ settings: { name: "מכבי בדיקה" }, absences: [...absences], games: games(), teams: [{ id: "t1" }] });

{
  const r = retentionReport(club(), new Date(`${TODAY}T12:00:00Z`));
  assert.equal(r.absences, 3);
  assert.equal(r.drivers, 1, "only the past game's driver — the October fixture is still ahead");
  assert.equal(r.total, 4);

  assert.deepEqual(r.next.absences.map((a) => a.id), ["edge-in", "recent", "future"]);
  // The record survives, minus the fields that expired: the game keeps its opponent.
  const g1 = r.next.games.find((g) => g.id === "g1");
  assert.equal(g1.opponent, "הפועל", "the game was removed instead of the driver");
  assert.ok(!("driverName" in g1) && !("driverPhone" in g1), "the driver's details stayed on a past game");
  const g2 = r.next.games.find((g) => g.id === "g2");
  assert.equal(g2.driverName, "יוסי", "a driver for a game still ahead was cleared");
  // Everything else about the club is carried through untouched.
  assert.deepEqual(r.next.teams, [{ id: "t1" }]);
  assert.equal(r.next.settings.name, "מכבי בדיקה");
}

// Nothing to clean reports nothing, and still hands back a usable document — the caller
// decides whether to write, and `total === 0` is that decision.
{
  const r = retentionReport({ settings: {}, absences: [{ id: "a", coachId: "c1", date: "2026-09-01" }], games: [] });
  assert.equal(r.total, 0);
  assert.equal(r.next.absences.length, 1);
}
{
  const r = retentionReport({}, new Date(`${TODAY}T00:00:00Z`));
  assert.equal(r.total, 0);
  assert.deepEqual(r.next.absences, []);
  assert.deepEqual(r.next.games, []);
}
assert.doesNotThrow(() => retentionReport(null));
assert.doesNotThrow(() => retentionReport({ absences: "לא מערך", games: 7 }));

// Running it twice changes nothing the second time — the manager can press again without
// wondering what else went.
{
  const first = retentionReport(club(), new Date(`${TODAY}T12:00:00Z`));
  const second = retentionReport(first.next, new Date(`${TODAY}T12:00:00Z`));
  assert.equal(second.total, 0, "a second sweep found more to delete");
}

// ---- The sentence and the counts are the same numbers ----
assert.equal(
  retentionSummary(retentionReport(club(), new Date(`${TODAY}T12:00:00Z`))),
  "3 סימוני היעדרות · פרטי נהג אחד"
);
assert.equal(retentionSummary({ absences: 1, drivers: 1, total: 2 }), "סימון היעדרות אחד · פרטי נהג אחד");
assert.equal(retentionSummary({ absences: 0, drivers: 0, total: 0 }), "");
assert.equal(retentionSummary({ absences: 2, drivers: 0, total: 2 }), "2 סימוני היעדרות");

console.log("retention: 36 assertions passed");
