import assert from "node:assert/strict";
import { copyToDay, clashesOn, targetDays } from "../src/utils/dayCopy.js";

const base = {
  id: "s1", teamId: "t1", coachId: "c1", hallId: "h1",
  day: "ראשון", start: "16:00", end: "17:30", type: "אימון",
  weekOf: "2026-09-13", notes: "",
};
let n = 0;
const nextId = () => "new" + ++n;
const t = (name, fn) => { fn(); console.log("  ok  " + name); };

t("copies a training to another day of the same week", () => {
  const r = copyToDay([base], base, "שני", nextId);
  assert.equal(r.ok, true);
  assert.equal(r.session.day, "שני");
  assert.equal(r.session.weekOf, "2026-09-13");
  assert.equal(r.session.start, "16:00");
  assert.equal(r.session.teamId, "t1");
});

t("the copy gets a FRESH id — otherwise saving replaces the original", () => {
  const r = copyToDay([base], base, "שני", nextId);
  assert.notEqual(r.session.id, base.id);
});

t("marks that belong to the original day do not travel", () => {
  const marked = { ...base, timeOverride: { start: "17:00" }, cancelled: true, cancelledAt: "x" };
  const r = copyToDay([marked], marked, "שלישי", nextId);
  assert.equal("timeOverride" in r.session, false);
  assert.equal("cancelled" in r.session, false);
  assert.equal("cancelledAt" in r.session, false);
});

t("an identical training already on the target day is not duplicated", () => {
  const monday = { ...base, id: "s2", day: "שני" };
  const r = copyToDay([base, monday], base, "שני", nextId);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "duplicate");
});

t("the SAME training in a DIFFERENT week is not a duplicate", () => {
  const otherWeek = { ...base, id: "s3", day: "שני", weekOf: "2026-09-20" };
  const r = copyToDay([base, otherWeek], base, "שני", nextId);
  assert.equal(r.ok, true);
});

t("an imported fixture is never copied — the federation owns those dates", () => {
  const game = { ...base, fromGame: true };
  assert.equal(copyToDay([game], game, "שני", nextId).reason, "game");
});

t("copying onto its own day does nothing", () => {
  assert.equal(copyToDay([base], base, "ראשון", nextId).reason, "same-day");
});

t("a day that is not a day is refused", () => {
  assert.equal(copyToDay([base], base, "יום החמישי", nextId).reason, "invalid");
  assert.equal(copyToDay([base], base, "", nextId).reason, "invalid");
});

t("a clash on the target day is REPORTED, and the copy still happens", () => {
  const busyHall = { id: "x", teamId: "t9", coachId: "c9", hallId: "h1", day: "שני", start: "16:30", end: "18:00", weekOf: "2026-09-13" };
  const r = copyToDay([base, busyHall], base, "שני", nextId);
  assert.equal(r.ok, true);
  assert.equal(r.clashes.length, 1);
});

t("the same coach twice at once is a clash too, not only the hall", () => {
  const busyCoach = { id: "y", teamId: "t9", coachId: "c1", hallId: "h9", day: "שני", start: "16:30", end: "18:00", weekOf: "2026-09-13" };
  assert.equal(copyToDay([base, busyCoach], base, "שני", nextId).clashes.length, 1);
});

t("a different hall, a different coach and touching hours is not a clash", () => {
  const after = { id: "z", teamId: "t9", coachId: "c9", hallId: "h9", day: "שני", start: "17:30", end: "19:00", weekOf: "2026-09-13" };
  assert.equal(copyToDay([base, after], base, "שני", nextId).clashes.length, 0);
});

t("a clash in ANOTHER week is not a clash here", () => {
  const elsewhere = { id: "w", teamId: "t9", coachId: "c1", hallId: "h1", day: "שני", start: "16:00", end: "17:00", weekOf: "2026-09-20" };
  assert.equal(copyToDay([base, elsewhere], base, "שני", nextId).clashes.length, 0);
});

t("clashesOn never counts the candidate against itself", () => {
  assert.equal(clashesOn([base], base).length, 0);
});

t("the training's own day is not offered as a target", () => {
  const days = targetDays("ראשון");
  assert.equal(days.includes("ראשון"), false);
  assert.equal(days.length, 6);
});

t("nothing in, nothing out", () => {
  assert.equal(copyToDay(null, null, "שני", nextId).ok, false);
  assert.deepEqual(clashesOn(null, null), []);
});

console.log("\n" + 15 + " tests passed");
