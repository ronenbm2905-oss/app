// The hall half of `absences`. The coach half is covered by availability.test.mjs, which
// still passes unchanged — that is itself the first assertion of this file.
import assert from "node:assert/strict";
import {
  subjectOf, isHallClosure, absencesOn, absencesInMonth, hallClosuresOn,
  findAbsenceHits, sessionsOnDate, sessionDateIso, absenceLabel, absenceChip,
  absenceValid, upsertAbsence, upcomingAbsences,
} from "../src/utils/availability.js";

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("  ok  " + name); };

const coachOut = { id: "a1", coachId: "c1", date: "2026-09-09" };
const hallShut = { id: "a2", hallId: "h1", date: "2026-09-09" };
const hallWindow = { id: "a3", hallId: "h1", date: "2026-09-09", start: "18:00", end: "22:00", note: "עירייה" };

console.log("- which subject a record is about -");
t("a record with hallId is a closure", () => {
  assert.deepEqual(subjectOf(hallShut), { kind: "hall", id: "h1" });
  assert.equal(isHallClosure(hallShut), true);
});
t("a record with coachId is an absence", () => {
  assert.deepEqual(subjectOf(coachOut), { kind: "coach", id: "c1" });
  assert.equal(isHallClosure(coachOut), false);
});
t("THE MIGRATION PROMISE: a record written before halls existed still reads as a coach", () => {
  // Every absence already in production has this exact shape and no `type` field.
  const legacy = { id: "old", coachId: "c9", date: "2026-09-09", start: "", end: "", note: "" };
  assert.deepEqual(subjectOf(legacy), { kind: "coach", id: "c9" });
});
t("nothing throws on a broken record", () => {
  assert.deepEqual(subjectOf(null), { kind: "", id: "" });
  assert.deepEqual(subjectOf({}), { kind: "coach", id: "" });
});

console.log("- the two kinds do not see each other -");
const mixed = [coachOut, hallShut, { id: "a4", hallId: "h2", date: "2026-09-09" }];
t("asking for a coach never returns a closure", () => {
  assert.deepEqual(absencesOn(mixed, "c1", "2026-09-09").map((a) => a.id), ["a1"]);
});
t("asking for a hall never returns a coach absence", () => {
  assert.deepEqual(absencesOn(mixed, "h1", "2026-09-09", "hall").map((a) => a.id), ["a2"]);
});
t("an id that exists as a coach is not found as a hall", () => {
  assert.deepEqual(absencesOn(mixed, "c1", "2026-09-09", "hall"), []);
});
t("the month list splits the same way", () => {
  assert.deepEqual(absencesInMonth(mixed, "h1", "2026-09", "hall").map((a) => a.id), ["a2"]);
  assert.deepEqual(absencesInMonth(mixed, "c1", "2026-09").map((a) => a.id), ["a1"]);
});
t("hallClosuresOn returns every hall shut that day, and no coach", () => {
  assert.deepEqual(hallClosuresOn(mixed, "2026-09-09").map((a) => a.id), ["a2", "a4"]);
  assert.deepEqual(hallClosuresOn(mixed, "2026-09-10"), []);
});

console.log("- the blast radius: a closure hits everyone in the building -");
const sessions = [
  { id: "s1", coachId: "c1", hallId: "h1", weekOf: "2026-09-06", day: "רביעי", start: "16:00", end: "17:30" },
  { id: "s2", coachId: "c2", hallId: "h1", weekOf: "2026-09-06", day: "רביעי", start: "19:00", end: "20:30" },
  { id: "s3", coachId: "c3", hallId: "h2", weekOf: "2026-09-06", day: "רביעי", start: "19:00", end: "20:30" },
  { id: "s4", coachId: "c1", hallId: "h1", weekOf: "2026-09-13", day: "רביעי", start: "16:00", end: "17:30" },
  // A home game imported from the federation: it carries a hallId like any session, which
  // is why a closed hall has to reach it. This is the expensive one to miss.
  { id: "g1", coachId: "c2", hallId: "h1", fromGame: true, weekOf: "2026-09-06", day: "רביעי", start: "20:00", end: "21:30" },
];
const dateOf = (s) => sessionDateIso(s);

t("an all-day closure hits every coach in that hall, that date only", () => {
  const hits = findAbsenceHits(sessions, dateOf, [hallShut]);
  assert.deepEqual(Object.keys(hits).sort(), ["g1", "s1", "s2"]);
});
t("the other hall is untouched", () =>
  assert.equal(findAbsenceHits(sessions, dateOf, [hallShut]).s3, undefined));
t("the same weekday next week is untouched", () =>
  assert.equal(findAbsenceHits(sessions, dateOf, [hallShut]).s4, undefined));
t("a windowed closure only hits what runs inside it", () => {
  const hits = findAbsenceHits(sessions, dateOf, [hallWindow]);
  assert.deepEqual(Object.keys(hits).sort(), ["g1", "s2"]); // 16:00–17:30 is before 18:00
});
t("a home game in a closed hall is flagged — the fixture nobody can move quietly", () =>
  assert.ok(findAbsenceHits(sessions, dateOf, [hallShut]).g1));

console.log("- both at once -");
t("coach away AND hall shut = two reasons on one session, absence first", () => {
  const hits = findAbsenceHits(sessions, dateOf, [hallShut, coachOut]);
  assert.equal(hits.s1.length, 2);
  assert.equal(isHallClosure(hits.s1[0]), false, "the coach's own absence reads first");
  assert.equal(isHallClosure(hits.s1[1]), true);
});

console.log("- sessionsOnDate follows the subject -");
t("a coach's day is his own sessions", () =>
  assert.deepEqual(sessionsOnDate(sessions, "c1", "2026-09-09").map((s) => s.id), ["s1"]));
t("a hall's day is everything booked into it", () =>
  assert.deepEqual(sessionsOnDate(sessions, "h1", "2026-09-09", "hall").map((s) => s.id), ["s1", "s2", "g1"]));

console.log("- wording -");
t("a hall is תפוס, a coach is לא זמין", () => {
  assert.equal(absenceLabel(hallShut), "תפוס כל היום"); // no "האולם" — the caller prints which
  assert.equal(absenceLabel(coachOut), "לא זמין כל היום");
  assert.equal(absenceChip(hallShut), "תפוס");
  assert.equal(absenceChip(coachOut), "לא זמין");
});
t("a windowed closure prints its hours", () => {
  assert.ok(absenceLabel(hallWindow).startsWith("תפוס 18:00–22:00"));
  assert.equal(absenceChip(hallWindow), "18:00–22:00");
});
t("THE PRIVACY ASYMMETRY: a hall's reason always shows, a coach's does not", () => {
  // A closure reason describes a building, so there is nothing to protect and the coach
  // standing outside benefits from reading it. A coach's reason is about a person.
  assert.ok(absenceLabel(hallWindow).includes("עירייה"), "hall reason must survive the default");
  const withReason = { id: "x", coachId: "c1", date: "2026-09-09", note: "מילואים" };
  assert.equal(absenceLabel(withReason), "לא זמין כל היום", "coach reason must NOT leak by default");
  assert.ok(absenceLabel(withReason, true).includes("מילואים"));
});
t("index-as-second-argument still cannot leak a coach's reason", () => {
  // The bug that shipped once: `list.map(absenceLabel)` passes the index as `withNote`.
  const list = [
    { id: "1", coachId: "c1", date: "2026-09-09", note: "סודי" },
    { id: "2", coachId: "c1", date: "2026-09-09", note: "גם סודי" },
  ];
  assert.ok(!list.map(absenceLabel).join(" ").includes("סודי"));
});

console.log("- validity refuses the ambiguous record -");
t("a hall closure with a date is valid", () =>
  assert.equal(absenceValid({ hallId: "h1", date: "2026-09-09" }), true));
t("no subject at all is invalid", () =>
  assert.equal(absenceValid({ date: "2026-09-09" }), false));
t("BOTH a coach and a hall is invalid — it would silently read as a hall", () =>
  assert.equal(absenceValid({ coachId: "c1", hallId: "h1", date: "2026-09-09" }), false));
t("a half-open window is refused for a hall too", () =>
  assert.equal(absenceValid({ hallId: "h1", date: "2026-09-09", start: "18:00" }), false));
t("end before start is refused", () =>
  assert.equal(absenceValid({ hallId: "h1", date: "2026-09-09", start: "20:00", end: "18:00" }), false));

console.log("- upsert writes one subject key, never two -");
t("a hall closure carries hallId and no coachId at all", () => {
  const [rec] = upsertAbsence([], { id: "n1", hallId: "h1", date: "2026-09-09", note: " עירייה " });
  assert.equal(rec.hallId, "h1");
  assert.equal("coachId" in rec, false);
  assert.equal(rec.note, "עירייה");
});
t("a coach absence carries coachId and no hallId at all", () => {
  const [rec] = upsertAbsence([], { id: "n2", coachId: "c1", date: "2026-09-09" });
  assert.equal(rec.coachId, "c1");
  assert.equal("hallId" in rec, false);
});
t("switching a record from all-day to windowed and back drops the stale hours", () => {
  let list = upsertAbsence([], { id: "n3", hallId: "h1", date: "2026-09-09", start: "18:00", end: "20:00" });
  list = upsertAbsence(list, { id: "n3", hallId: "h1", date: "2026-09-09" });
  assert.equal(list.length, 1);
  assert.equal(list[0].start, "");
  assert.equal(list[0].end, "");
});

console.log("- the upcoming list -");
const soon = [
  { id: "u1", coachId: "c1", date: "2026-09-09" },
  { id: "u2", hallId: "h1", date: "2026-09-07" },
  { id: "u3", coachId: "c2", date: "2026-08-01" },
];
t("both kinds, soonest first, past dropped", () =>
  assert.deepEqual(upcomingAbsences(soon, "2026-09-01").map((a) => a.id), ["u2", "u1"]));
t("narrowing to one kind still works", () => {
  assert.deepEqual(upcomingAbsences(soon, "2026-09-01", 0, "hall").map((a) => a.id), ["u2"]);
  assert.deepEqual(upcomingAbsences(soon, "2026-09-01", 0, "coach").map((a) => a.id), ["u1"]);
});

console.log("\n" + pass + " hall tests passed");
