// What a coach gets told when their week moves. The diff runs on every save in the app, so
// a mistake here is either a silent change or a flood of false alarms.
import assert from "node:assert/strict";
import {
  MAX_CHANGES, BULK_ADD_THRESHOLD,
  diffSessions, collapseBulk, trimChanges, withScheduleChanges,
  changesForCoach, changesForWeek, changeLabel, changesByCoach, changesMessage,
} from "../src/utils/scheduleChanges.js";

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("  ok  " + name); };

const NOW = "2026-09-02T10:00:00.000Z";
const LATER = "2026-09-03T10:00:00.000Z";
const W = "2026-08-30";
const names = {
  coaches: [{ id: "c1", name: "טל ברוך" }, { id: "c2", name: "אסף יוגב" }],
  halls: [{ id: "h1", name: "אולם הכפר" }, { id: "h2", name: "שרת" }],
  teams: [{ id: "t1", name: "נערים א" }],
};
const S = (over = {}) => ({
  id: "s1", coachId: "c1", teamId: "t1", hallId: "h1", weekOf: W,
  day: "רביעי", start: "16:00", end: "17:30", type: "אימון", ...over,
});

console.log("- the diff -");
t("nothing changed, nothing logged", () =>
  assert.deepEqual(diffSessions([S()], [S()], NOW), []));
t("an added session", () => {
  const [e] = diffSessions([], [S()], NOW);
  assert.equal(e.kind, "added");
  assert.equal(e.coachId, "c1");
  assert.equal(e.after.start, "16:00");
});
t("a removed session", () => {
  const [e] = diffSessions([S()], [], NOW);
  assert.equal(e.kind, "removed");
  assert.equal(e.before.start, "16:00");
});
t("a time change", () => {
  const [e] = diffSessions([S()], [S({ start: "17:30", end: "19:00" })], NOW);
  assert.equal(e.kind, "changed");
  assert.equal(e.before.start, "16:00");
  assert.equal(e.after.start, "17:30");
});
t("a hall change, a day change and a type change all register", () => {
  assert.equal(diffSessions([S()], [S({ hallId: "h2" })], NOW)[0].kind, "changed");
  assert.equal(diffSessions([S()], [S({ day: "חמישי" })], NOW)[0].kind, "changed");
  assert.equal(diffSessions([S()], [S({ type: "משחק בית" })], NOW)[0].kind, "changed");
});
t("things a coach would NOT notice are not changes", () => {
  // Notes and the game link move for all sorts of reasons; neither changes where anybody
  // has to be, and logging them would train people to ignore the banner.
  assert.deepEqual(diffSessions([S()], [S({ notes: "דגש על מסירות" })], NOW), []);
  assert.deepEqual(diffSessions([S()], [S({ federationCode: "999" })], NOW), []);
});
t("A REASSIGNED SESSION TELLS BOTH COACHES", () => {
  // The coach who lost it must hear about it. Reporting only to the new owner is how a
  // coach turns up to a training that is not his any more — or nobody turns up at all.
  const out = diffSessions([S()], [S({ coachId: "c2" })], NOW);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((e) => [e.coachId, e.kind]).sort(), [["c1", "removed"], ["c2", "added"]]);
});
t("sessions with no id are skipped rather than crashing the save", () => {
  assert.deepEqual(diffSessions([{ coachId: "c1" }], [{ coachId: "c1" }], NOW), []);
  assert.deepEqual(diffSessions(null, null, NOW), []);
});

console.log("- a week being built is not twenty announcements -");
const many = (n, over = {}) => Array.from({ length: n }, (_, i) => S({ id: `x${i}`, ...over }));
t("more than the threshold collapses into one entry, and keeps the count", () => {
  const out = collapseBulk(diffSessions([], many(BULK_ADD_THRESHOLD + 5), NOW), NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "bulk");
  assert.equal(out[0].count, BULK_ADD_THRESHOLD + 5);
});
t("at or below the threshold every addition is kept", () => {
  const out = collapseBulk(diffSessions([], many(BULK_ADD_THRESHOLD), NOW), NOW);
  assert.equal(out.length, BULK_ADD_THRESHOLD);
  assert.ok(out.every((e) => e.kind === "added"));
});
t("a removal is NEVER collapsed away, even inside a bulk build", () => {
  // A cancelled training hidden inside "נוספו 14 אימונים" is the one line that had to survive.
  const before = [S({ id: "gone" })];
  const after = many(BULK_ADD_THRESHOLD + 3);
  const out = collapseBulk(diffSessions(before, after, NOW), NOW);
  assert.equal(out.filter((e) => e.kind === "removed").length, 1);
  assert.equal(out.filter((e) => e.kind === "bulk").length, 1);
});
t("two coaches are collapsed independently", () => {
  const out = collapseBulk(
    diffSessions([], [...many(BULK_ADD_THRESHOLD + 2), ...many(2, { coachId: "c2" }).map((s, i) => ({ ...s, id: `y${i}` }))], NOW),
    NOW
  );
  assert.equal(out.filter((e) => e.kind === "bulk").length, 1);
  assert.equal(out.filter((e) => e.kind === "added" && e.coachId === "c2").length, 2);
});

console.log("- the write path -");
t("a save that touches no session writes no log", () => {
  const prev = { sessions: [S()], changes: [] };
  const next = { sessions: [S()], teams: [{ id: "t9", name: "חדשה" }] };
  assert.equal(withScheduleChanges(prev, next, NOW).changes, undefined, "no changes key added");
});
t("the very same array reference short-circuits", () => {
  const shared = [S()];
  const next = { sessions: shared, players: [1] };
  assert.equal(withScheduleChanges({ sessions: shared }, next, NOW), next);
});
t("a real move appends to the existing log", () => {
  const prev = { sessions: [S()], changes: [{ id: "old", at: NOW, coachId: "c1", kind: "added" }] };
  const next = { sessions: [S({ start: "17:30" })], changes: prev.changes };
  const out = withScheduleChanges(prev, next, LATER);
  assert.equal(out.changes.length, 2);
  assert.equal(out.changes[1].kind, "changed");
});
t("a document with no sessions array is returned untouched", () => {
  const next = { teams: [] };
  assert.equal(withScheduleChanges({ sessions: [] }, next, NOW), next);
});
t("GATE #11 M1: a save that touched no session STILL expires stale entries", () => {
  // Trimming only on a save that produced an entry makes deletion a function of activity
  // rather than of the clock — and it breaks in exactly the case the deletion procedure
  // gives as its example: a coach leaving at the end of the season, when nobody is moving
  // trainings and so nothing gets purged.
  const stale = { id: "old", at: "2026-01-01T00:00:00.000Z", coachId: "c1", kind: "added" };
  const shared = [S()];
  const next = { sessions: shared, changes: [stale], teams: [] };
  const out = withScheduleChanges({ sessions: shared, changes: [stale] }, next, NOW);
  assert.deepEqual(out.changes, [], "the expired entry should be gone");
});
t("...and a save with nothing stale and no session change is still a no-op", () => {
  const shared = [S()];
  const fresh = { id: "f", at: NOW, coachId: "c1", kind: "added" };
  const next = { sessions: shared, changes: [fresh] };
  assert.equal(withScheduleChanges({ sessions: shared }, next, NOW), next, "same object back");
});

console.log("- the log stays bounded: it lives on a document with a 1 MB ceiling -");
t("entries older than the window are dropped", () => {
  const old = { id: "o", at: "2026-01-01T00:00:00.000Z", coachId: "c1", kind: "added" };
  const fresh = { id: "f", at: NOW, coachId: "c1", kind: "added" };
  assert.deepEqual(trimChanges([old, fresh], NOW).map((c) => c.id), ["f"]);
});
t("the log never exceeds its cap, and it is the OLDEST that go", () => {
  const list = Array.from({ length: MAX_CHANGES + 40 }, (_, i) => ({ id: `c${i}`, at: NOW, coachId: "c1", kind: "added" }));
  const out = trimChanges(list, NOW);
  assert.equal(out.length, MAX_CHANGES);
  assert.equal(out[out.length - 1].id, `c${MAX_CHANGES + 39}`, "the newest survived");
});
t("a malformed entry cannot wedge the trim", () =>
  assert.deepEqual(trimChanges([null, {}, { at: "" }], NOW), []));

console.log("- reading: the coach's banner -");
const log = [
  { id: "a", at: NOW, coachId: "c1", weekOf: W, kind: "added", after: { day: "רביעי", start: "16:00", end: "17:30", hallId: "h1" } },
  { id: "b", at: LATER, coachId: "c1", weekOf: W, kind: "removed", before: { day: "שני", start: "18:00", end: "19:30", hallId: "h2" } },
  { id: "c", at: LATER, coachId: "c2", weekOf: W, kind: "added", after: { day: "שישי", start: "10:00", end: "11:30", hallId: "h1" } },
];
t("a coach sees only their own, newest first", () =>
  assert.deepEqual(changesForCoach(log, "c1").map((c) => c.id), ["b", "a"]));
t("and only what happened since they last looked", () =>
  assert.deepEqual(changesForCoach(log, "c1", NOW).map((c) => c.id), ["b"]));
t("no coach, nothing", () => {
  assert.deepEqual(changesForCoach(log, ""), []);
  assert.deepEqual(changesForCoach(null, "c1"), []);
});
t("the week view takes everyone's", () =>
  assert.deepEqual(changesForWeek(log, W).map((c) => c.id), ["a", "b", "c"]));

console.log("- wording -");
t("an addition and a cancellation read as sentences", () => {
  assert.equal(changeLabel(log[0], names), "נוסף: יום רביעי 16:00–17:30 · אולם הכפר");
  assert.equal(changeLabel(log[1], names), "בוטל: יום שני 18:00–19:30 · שרת");
});
t("a change names ONLY what moved", () => {
  const e = { kind: "changed", before: { day: "רביעי", start: "16:00", end: "17:30", hallId: "h1" },
              after: { day: "רביעי", start: "17:30", end: "19:00", hallId: "h1" } };
  const line = changeLabel(e, names);
  assert.ok(line.includes("16:00–17:30 → 17:30–19:00"));
  assert.ok(!line.includes("אולם הכפר"), "the unchanged hall is noise");
});
t("a hall move names both halls", () => {
  const e = { kind: "changed", before: { day: "רביעי", start: "16:00", end: "17:30", hallId: "h1" },
              after: { day: "רביעי", start: "16:00", end: "17:30", hallId: "h2" } };
  assert.ok(changeLabel(e, names).includes("אולם הכפר → שרת"));
});
t("the hall is looked up at read time, not frozen into the record", () => {
  // A hall renamed after the fact should read by its new name.
  const renamed = { ...names, halls: [{ id: "h1", name: "אולם חדש" }] };
  assert.ok(changeLabel(log[0], renamed).includes("אולם חדש"));
});
t("a bulk entry says how many", () =>
  assert.equal(changeLabel({ kind: "bulk", count: 14 }, names), "נוספו 14 אימונים"));
t("nothing throws on a broken entry", () => {
  assert.equal(changeLabel(null, names), "");
  assert.equal(typeof changeLabel({ kind: "changed", before: {}, after: {} }, names), "string");
});

console.log("- the WhatsApp message -");
t("grouped by coach, alphabetical, with a heading", () => {
  const msg = changesMessage(log, W, "30/08–05/09", names);
  assert.ok(msg.startsWith("עדכון לו״ז — 30/08–05/09"));
  assert.ok(msg.indexOf("אסף יוגב") < msg.indexOf("טל ברוך"), "Hebrew alphabetical");
  assert.ok(msg.includes("• נוסף:"));
});
t("a week with nothing to say produces NO message, not an empty one", () => {
  // A manager pasting "עדכון לו״ז" with nothing under it teaches coaches to ignore it.
  assert.equal(changesMessage(log, "2026-09-13", "x", names), "");
  assert.equal(changesMessage([], W, "x", names), "");
});
t("a session with no coach still reaches the message rather than vanishing", () => {
  const orphan = [{ id: "z", at: NOW, coachId: "", weekOf: W, kind: "removed", before: { day: "שני", start: "18:00", end: "19:30" } }];
  assert.ok(changesMessage(orphan, W, "x", names).includes("ללא מאמן"));
});
t("changesByCoach drops groups whose lines all came out empty", () =>
  assert.deepEqual(changesByCoach([{ coachId: "c1" }], names), []));

console.log("\n" + pass + " tests passed");
