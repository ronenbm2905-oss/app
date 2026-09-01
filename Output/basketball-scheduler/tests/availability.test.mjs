import assert from "node:assert/strict";
import {
  isAllDay, absencesOn, absencesInMonth, absenceCoversSession, findAbsenceHits,
  sessionDateIso, sessionsOnDate, absenceLabel, absenceChip, absenceValid,
  upsertAbsence, removeAbsence, upcomingAbsences,
} from "../src/utils/availability.js";
import { monthGrid, shiftMonth, currentMonth, monthLabel, monthOf } from "../src/utils/dates.js";

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("  ok  " + name); };

console.log("- absence shape -");
t("no times = all day", () => assert.equal(isAllDay({ date: "2026-09-09" }), true));
t("times = not all day", () => assert.equal(isAllDay({ start: "16:00", end: "18:00" }), false));
t("only a start is all-day for coverage, but invalid to save", () => {
  assert.equal(isAllDay({ start: "16:00" }), true);
  assert.equal(absenceValid({ coachId: "c1", date: "2026-09-09", start: "16:00" }), false);
});

console.log("- validity -");
t("needs a coach and a date", () => {
  assert.equal(absenceValid({ date: "2026-09-09" }), false);
  assert.equal(absenceValid({ coachId: "c1" }), false);
  assert.equal(absenceValid({ coachId: "c1", date: "2026-09-09" }), true);
});
t("reversed window refused", () =>
  assert.equal(absenceValid({ coachId: "c1", date: "2026-09-09", start: "18:00", end: "16:00" }), false));
t("zero-length window refused", () =>
  assert.equal(absenceValid({ coachId: "c1", date: "2026-09-09", start: "16:00", end: "16:00" }), false));

console.log("- coverage -");
const allDay = { id: "a1", coachId: "c1", date: "2026-09-09" };
const win = { id: "a2", coachId: "c1", date: "2026-09-09", start: "16:00", end: "18:00" };
t("all-day covers any session", () =>
  assert.equal(absenceCoversSession(allDay, { start: "20:00", end: "21:30" }), true));
t("window covers an overlapping session", () =>
  assert.equal(absenceCoversSession(win, { start: "17:00", end: "18:30" }), true));
t("window does NOT cover a later session", () =>
  assert.equal(absenceCoversSession(win, { start: "19:00", end: "20:30" }), false));
t("session ending exactly when the window opens is not covered", () =>
  assert.equal(absenceCoversSession(win, { start: "14:30", end: "16:00" }), false));

console.log("- session date arithmetic -");
t("Sunday week + rev = the Wednesday", () =>
  assert.equal(sessionDateIso({ weekOf: "2026-09-06", day: "רביעי" }), "2026-09-09"));
t("Sunday week + rishon = the Sunday itself", () =>
  assert.equal(sessionDateIso({ weekOf: "2026-09-06", day: "ראשון" }), "2026-09-06"));
t("a session with no week has no date", () =>
  assert.equal(sessionDateIso({ day: "רביעי" }), ""));

console.log("- hits on the board -");
const sessions = [
  { id: "s1", coachId: "c1", weekOf: "2026-09-06", day: "רביעי", start: "16:00", end: "17:30" },
  { id: "s2", coachId: "c1", weekOf: "2026-09-06", day: "רביעי", start: "19:00", end: "20:30" },
  { id: "s3", coachId: "c2", weekOf: "2026-09-06", day: "רביעי", start: "16:00", end: "17:30" },
  { id: "s4", coachId: "c1", weekOf: "2026-09-13", day: "רביעי", start: "16:00", end: "17:30" },
];
const dateOf = (s) => sessionDateIso(s);
t("all-day absence hits both of that coach's sessions, that day only", () => {
  const hits = findAbsenceHits(sessions, dateOf, [allDay]);
  assert.deepEqual(Object.keys(hits).sort(), ["s1", "s2"]);
});
t("another coach on the same day is untouched", () => {
  const hits = findAbsenceHits(sessions, dateOf, [allDay]);
  assert.equal(hits.s3, undefined);
});
t("the same weekday NEXT week is untouched - this is the whole point", () => {
  const hits = findAbsenceHits(sessions, dateOf, [allDay]);
  assert.equal(hits.s4, undefined);
});
t("a window hits only the session inside it", () => {
  const hits = findAbsenceHits(sessions, dateOf, [win]);
  assert.deepEqual(Object.keys(hits), ["s1"]);
});
t("no absences = no work and no hits", () =>
  assert.deepEqual(findAbsenceHits(sessions, dateOf, []), {}));
t("a session with no coach is never a hit", () =>
  assert.deepEqual(findAbsenceHits([{ id: "x", weekOf: "2026-09-06", day: "רביעי" }], dateOf, [allDay]), {}));

console.log("- lists -");
t("absencesOn filters by coach and date", () => {
  const list = absencesOn([allDay, win, { id: "a3", coachId: "c2", date: "2026-09-09" }], "c1", "2026-09-09");
  assert.equal(list.length, 2);
});
t("absencesInMonth matches the YYYY-MM prefix", () => {
  const list = absencesInMonth([allDay, { id: "a4", coachId: "c1", date: "2026-10-01" }], "c1", "2026-09");
  assert.deepEqual(list.map((a) => a.id), ["a1"]);
});
t("upcoming drops the past, keeps today", () => {
  const list = upcomingAbsences([{ id: "p", coachId: "c1", date: "2026-09-01" }, allDay], "2026-09-09");
  assert.deepEqual(list.map((a) => a.id), ["a1"]);
});
t("sessionsOnDate returns that coach's day in time order", () => {
  const list = sessionsOnDate(sessions, "c1", "2026-09-09");
  assert.deepEqual(list.map((s) => s.id), ["s1", "s2"]);
});

console.log("- upsert -");
t("turning an absence back to all-day clears its old window", () => {
  const next = upsertAbsence([win], { ...win, start: "", end: "" });
  assert.equal(next.length, 1);
  assert.equal(next[0].start, "");
  assert.equal(next[0].end, "");
});
t("a half-cleared window is stored as all-day, never as half a window", () => {
  const next = upsertAbsence([], { id: "n1", coachId: "c1", date: "2026-09-09", start: "16:00", end: "" });
  assert.equal(next[0].start, "");
});
t("editing replaces in place rather than appending", () => {
  const next = upsertAbsence([allDay], { ...allDay, note: "חתונה" });
  assert.equal(next.length, 1);
  assert.equal(next[0].note, "חתונה");
});
t("note is trimmed", () => {
  const next = upsertAbsence([], { id: "n2", coachId: "c1", date: "2026-09-09", note: "  מילואים  " });
  assert.equal(next[0].note, "מילואים");
});
t("remove takes one and leaves the rest", () =>
  assert.deepEqual(removeAbsence([allDay, win], "a1").map((a) => a.id), ["a2"]));

console.log("- labels -");
t("all-day label", () => assert.equal(absenceLabel(allDay), "לא זמין כל היום"));
t("the reason is HIDDEN by default", () =>
  assert.equal(absenceLabel({ ...win, note: "עבודה" }), "לא זמין 16:00–18:00"));
t("the reason shows only when asked for", () =>
  assert.equal(absenceLabel({ ...win, note: "עבודה" }, true), "לא זמין 16:00–18:00 — עבודה"));
t("an all-day absence hides its reason too", () =>
  assert.equal(absenceLabel({ ...allDay, note: "מילואים" }), "לא זמין כל היום"));
t("passing an array index as withNote cannot leak — the note needs an explicit true", () => {
  // Guards the .map(absenceLabel) shape. This used to document a footgun: index 1 was
  // truthy, so the SECOND absence of a day revealed its reason while the first stayed
  // hidden. `withNote === true` closed it — the shape is now simply safe.
  const list = [{ ...allDay, note: "מילואים" }, { ...win, note: "חתונה" }];
  const mapped = list.map((a, i) => absenceLabel(a, i));
  assert.ok(!mapped[0].includes("מילואים"));
  assert.ok(!mapped[1].includes("חתונה"), "index 1 must no longer count as a yes");
});
t("chip stays short", () => {
  assert.equal(absenceChip(allDay), "לא זמין");
  assert.equal(absenceChip(win), "16:00–18:00");
});

console.log("- month grid -");
t("September 2026 fits 5 full weeks of 7", () => {
  const g = monthGrid("2026-09");
  assert.equal(g.length, 5);
  g.forEach((w) => assert.equal(w.length, 7));
});
t("every row starts on a Sunday", () => {
  monthGrid("2026-09").forEach((w) => assert.equal(new Date(w[0].iso + "T00:00:00").getDay(), 0));
});
t("9/9/2026 sits in the Wednesday column and is inMonth", () => {
  const cell = monthGrid("2026-09").flat().find((c) => c.iso === "2026-09-09");
  assert.equal(cell.inMonth, true);
  assert.equal(new Date(cell.iso + "T00:00:00").getDay(), 3);
});
t("spill-over days are kept but marked", () => {
  const g = monthGrid("2026-09").flat();
  assert.equal(g.find((c) => c.iso === "2026-08-30").inMonth, false);
  assert.equal(g.filter((c) => c.inMonth).length, 30);
});
t("February 2027 still yields whole weeks", () => {
  const g = monthGrid("2027-02");
  assert.equal(g.flat().filter((c) => c.inMonth).length, 28);
  g.forEach((w) => assert.equal(w.length, 7));
});
t("a month starting on Sunday does not gain an empty leading week", () => {
  const g = monthGrid("2026-11");
  assert.equal(g[0][0].iso, "2026-11-01");
});
t("shiftMonth rolls the year in both directions", () => {
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
});
t("shiftMonth from a 31-day month lands on the right month", () =>
  assert.equal(shiftMonth("2026-01", 1), "2026-02"));
t("monthOf slices the date", () => assert.equal(monthOf("2026-09-09"), "2026-09"));
t("currentMonth is a YYYY-MM", () => assert.match(currentMonth(), /^\d{4}-\d{2}$/));
t("monthLabel is Hebrew", () => assert.ok(monthLabel("2026-09").includes("2026")));

console.log("\n" + pass + " tests passed");
