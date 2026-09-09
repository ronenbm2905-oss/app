import assert from "node:assert/strict";
import {
  sessionsOfType, templateWeekForType, pendingTypeSessions, buildTypeCopies,
} from "../src/utils/recurringType.js";

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("  ok  " + name); };

let n = 0;
const makeId = () => `new-${++n}`;

// יורם's standing Sunday slot: four קט-סל squads, one after the other.
const yoram = (week, teamId, start, end) => ({
  id: `${teamId}-${week}`, teamId, coachId: "c-yoram", hallId: "h1",
  day: "ראשון", start, end, type: "יורם", weekOf: week,
});
const training = (week, teamId) => ({
  id: `tr-${teamId}-${week}`, teamId, coachId: "c1", hallId: "h1",
  day: "שלישי", start: "17:00", end: "18:30", type: "אימון", weekOf: week,
});

const LAST = "2026-08-30";
const THIS = "2026-09-06";

const base = [
  yoram(LAST, "kat1", "09:00", "09:45"),
  yoram(LAST, "kat2", "09:45", "10:30"),
  yoram(LAST, "kat3", "10:30", "11:15"),
  training(LAST, "kat1"),
  training(THIS, "kat1"), // this week already has the squads' own trainings
];

console.log("- finding the template -");
t("the most recent week that actually ran", () =>
  assert.equal(templateWeekForType(base, "יורם", THIS), LAST));
t("skips empty weeks and keeps looking back", () => {
  const older = [yoram("2026-08-16", "kat1", "09:00", "09:45")];
  assert.equal(templateWeekForType(older, "יורם", THIS), "2026-08-16");
});
t("a slot dormant beyond the window is not resurrected", () =>
  // Bounded on purpose: a specialist who stopped in June should stop being offered, not
  // reappear from the middle of last season.
  assert.equal(templateWeekForType([yoram("2026-05-03", "kat1", "09:00", "09:45")], "יורם", THIS), ""));
t("an imported fixture is never a template", () =>
  assert.equal(
    templateWeekForType([{ ...yoram(LAST, "kat1", "09:00", "09:45"), fromGame: true }], "יורם", THIS),
    ""
  ));
t("nothing to find, nothing thrown", () => {
  assert.equal(templateWeekForType([], "יורם", THIS), "");
  assert.equal(templateWeekForType(base, "", THIS), "");
  assert.equal(templateWeekForType(base, "יורם", ""), "");
});

console.log("- what this week is missing -");
t("the squads' own trainings do not silence the slot", () => {
  // This is the whole reason the module exists: fixedTeams.js offers a team only when it
  // has NO session that week, so a קט-סל squad that already trains would never be offered
  // its יורם row.
  const { from, sessions } = pendingTypeSessions({ sessions: base }, "יורם", THIS);
  assert.equal(from, LAST);
  assert.equal(sessions.length, 3);
});
t("a week already half-entered is topped up, not doubled", () => {
  const partly = [...base, yoram(THIS, "kat1", "09:00", "09:45")];
  const { sessions } = pendingTypeSessions({ sessions: partly }, "יורם", THIS);
  assert.deepEqual(sessions.map((s) => s.teamId), ["kat2", "kat3"]);
});
t("a complete week offers nothing", () => {
  const done = [
    ...base,
    yoram(THIS, "kat1", "09:00", "09:45"),
    yoram(THIS, "kat2", "09:45", "10:30"),
    yoram(THIS, "kat3", "10:30", "11:15"),
  ];
  assert.deepEqual(pendingTypeSessions({ sessions: done }, "יורם", THIS).sessions, []);
});
t("a row moved to a different hour counts as missing, and both survive", () => {
  // sessionKey includes the times, so an hour changed by hand is a different row. Adding
  // it back is the honest answer — the manager can see two and delete one.
  const moved = [...base, { ...yoram(THIS, "kat1", "10:00", "10:45") }];
  const { sessions } = pendingTypeSessions({ sessions: moved }, "יורם", THIS);
  assert.equal(sessions.length, 3);
});
t("other types are not touched", () => {
  const mixed = [...base, { ...yoram(LAST, "kat1", "12:00", "13:00"), id: "sp", type: "ספורטתרפיה" }];
  const { sessions } = pendingTypeSessions({ sessions: mixed }, "יורם", THIS);
  assert.equal(sessions.every((s) => s.type === "יורם"), true);
  assert.equal(sessions.length, 3);
});
t("no data, no throw", () => {
  assert.deepEqual(pendingTypeSessions(null, "יורם", THIS), { from: "", sessions: [] });
  assert.deepEqual(pendingTypeSessions({}, "יורם", THIS), { from: "", sessions: [] });
});

console.log("- what gets written -");
t("fresh ids, this week, everything else carried", () => {
  const pending = pendingTypeSessions({ sessions: base }, "יורם", THIS);
  const copies = buildTypeCopies(pending, THIS, makeId);
  assert.equal(copies.length, 3);
  assert.equal(new Set(copies.map((c) => c.id)).size, 3);
  copies.forEach((c) => {
    assert.equal(c.weekOf, THIS);
    assert.equal(c.type, "יורם");
    assert.equal(c.coachId, "c-yoram");
  });
  assert.equal(copies[0].day, "ראשון");
  assert.equal(copies[0].start, "09:00");
});
t("the day is carried, never assumed", () => {
  // Sunday is where these sit today, and nothing in the module knows that. The week יורם
  // moves to Monday this keeps working.
  const monday = [{ ...yoram(LAST, "kat1", "16:00", "16:45"), day: "שני" }];
  const copies = buildTypeCopies(pendingTypeSessions({ sessions: monday }, "יורם", THIS), THIS, makeId);
  assert.equal(copies[0].day, "שני");
});
t("last week's cancellation and time override do not come along", () => {
  const dirty = [{ ...yoram(LAST, "kat1", "09:00", "09:45"), cancelled: true, cancelledAt: "x", timeOverride: "10:00" }];
  const [copy] = buildTypeCopies(pendingTypeSessions({ sessions: dirty }, "יורם", THIS), THIS, makeId);
  assert.equal(copy.cancelled, undefined);
  assert.equal(copy.cancelledAt, undefined);
  assert.equal(copy.timeOverride, undefined);
});
t("nothing pending, nothing built", () => {
  assert.deepEqual(buildTypeCopies({ from: "", sessions: [] }, THIS, makeId), []);
  assert.deepEqual(buildTypeCopies(null, THIS, makeId), []);
});

console.log("- sessionsOfType -");
t("one type, one week, manual only", () => {
  assert.equal(sessionsOfType(base, "יורם", LAST).length, 3);
  assert.equal(sessionsOfType(base, "יורם", THIS).length, 0);
  assert.equal(sessionsOfType(base, "אימון", LAST).length, 1);
  assert.deepEqual(sessionsOfType(null, "יורם", LAST), []);
});

console.log("\n" + pass + " tests passed");
