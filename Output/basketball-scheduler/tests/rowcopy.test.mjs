import assert from "node:assert/strict";
import { sessionKey, rowSessions, copyRow, planRowPaste } from "../src/utils/rowCopy.js";

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("  ok  " + name); };
let n = 0;
const makeId = () => `new${++n}`;
const reset = () => { n = 0; };

const S = (id, teamId, weekOf, day, extra = {}) => ({
  id, teamId, weekOf, day, start: "17:00", end: "18:30",
  coachId: "c1", hallId: "h1", type: "אימון", notes: "", ...extra,
});

const WEEK_A = "2026-09-06";
const WEEK_B = "2026-09-13";

console.log("- what counts as the same training -");
t("the key ignores notes", () =>
  assert.equal(
    sessionKey(S("a", "t1", WEEK_A, "ראשון")),
    sessionKey(S("b", "t1", WEEK_A, "ראשון", { notes: "להביא כדורים" }))
  ));
t("the key ignores the week", () =>
  assert.equal(
    sessionKey(S("a", "t1", WEEK_A, "ראשון")),
    sessionKey(S("b", "t1", WEEK_B, "ראשון"))
  ));
t("a different hour is a different training", () =>
  assert.notEqual(
    sessionKey(S("a", "t1", WEEK_A, "ראשון")),
    sessionKey(S("b", "t1", WEEK_A, "ראשון", { start: "18:00" }))
  ));

console.log("- reading one row -");
const base = [
  S("a1", "t1", WEEK_A, "ראשון"),
  S("a2", "t1", WEEK_A, "שלישי", { start: "19:00", end: "20:30" }),
  S("g1", "t1", WEEK_A, "חמישי", { fromGame: true }),   // imported fixture
  S("b1", "t2", WEEK_A, "ראשון"),                        // another team
  S("a3", "t1", WEEK_B, "ראשון"),                        // another week
];
t("only that team, that week, no games", () =>
  assert.deepEqual(rowSessions(base, "t1", WEEK_A).map((s) => s.id), ["a1", "a2"]));
t("an unknown team reads empty", () => assert.deepEqual(rowSessions(base, "nope", WEEK_A), []));
t("a missing session list does not throw", () => assert.deepEqual(rowSessions(null, "t1", WEEK_A), []));

console.log("- the clipboard -");
const clip = copyRow(base, "t1", WEEK_A);
t("holds the row's manual trainings", () => assert.equal(clip.sessions.length, 2));
t("remembers where it came from", () => assert.equal(clip.fromWeek, WEEK_A));
t("carries no id and no week", () => {
  clip.sessions.forEach((s) => {
    assert.equal("id" in s, false);
    assert.equal("weekOf" in s, false);
  });
});
t("a fixture never rides along", () =>
  assert.equal(clip.sessions.some((s) => s.fromGame), false));
t("week-specific marks are dropped", () => {
  const marked = [S("m1", "t3", WEEK_A, "שני", { timeOverride: { start: "17:15" }, cancelled: true, cancelledAt: 1 })];
  const c = copyRow(marked, "t3", WEEK_A);
  assert.equal("timeOverride" in c.sessions[0], false);
  assert.equal("cancelled" in c.sessions[0], false);
  assert.equal("cancelledAt" in c.sessions[0], false);
});
t("an empty row copies to nothing", () => assert.equal(copyRow(base, "t1", "2026-10-04"), null));

console.log("- pasting into an empty week -");
reset();
const empty = planRowPaste(clip, base.filter((s) => s.teamId !== "t1" || s.weekOf !== WEEK_B), "2026-09-20", makeId);
t("status ok", () => assert.equal(empty.status, "ok"));
t("both trainings land", () => assert.equal(empty.fresh.length, 2));
t("nothing was skipped", () => assert.equal(empty.skipped, 0));
t("the row was empty", () => assert.equal(empty.existing, 0));
t("they carry the target week", () =>
  empty.fresh.forEach((s) => assert.equal(s.weekOf, "2026-09-20")));
t("they carry fresh ids", () =>
  assert.deepEqual(empty.fresh.map((s) => s.id), ["new1", "new2"]));
t("the day and the hours are the row's", () =>
  assert.deepEqual(empty.fresh.map((s) => `${s.day} ${s.start}`), ["ראשון 17:00", "שלישי 19:00"]));

console.log("- pasting is idempotent -");
reset();
const after = [...base, ...planRowPaste(clip, base, WEEK_B, makeId).fresh];
const again = planRowPaste(clip, after, WEEK_B, makeId);
t("a second press writes nothing", () => assert.equal(again.fresh.length, 0));
t("and says why", () => assert.equal(again.status, "nothing-new"));
t("counting what it skipped", () => assert.equal(again.skipped, 2));

console.log("- a row that is already built -");
reset();
// WEEK_B already holds a1's twin ("ראשון 17:00") plus an hour that moved.
const built = [
  S("x1", "t1", WEEK_B, "ראשון"),
  S("x2", "t1", WEEK_B, "חמישי", { start: "20:00", end: "21:30" }),
];
const onto = planRowPaste(clip, built, WEEK_B, makeId);
t("the twin is skipped", () => assert.equal(onto.skipped, 1));
t("the rest still lands", () => assert.deepEqual(onto.fresh.map((s) => s.day), ["שלישי"]));
t("the caller is told the row is not empty", () => assert.equal(onto.existing, 2));
t("nothing already there is touched", () =>
  assert.equal(onto.fresh.some((s) => s.id === "x1" || s.id === "x2"), false));

console.log("- refusals -");
t("no clipboard", () => assert.equal(planRowPaste(null, base, WEEK_B, makeId).status, "empty"));
t("an empty clipboard", () =>
  assert.equal(planRowPaste({ teamId: "t1", fromWeek: WEEK_A, sessions: [] }, base, WEEK_B, makeId).status, "empty"));
t("no target week", () => assert.equal(planRowPaste(clip, base, "", makeId).status, "empty"));
t("the week it came from", () => {
  const same = planRowPaste(clip, base, WEEK_A, makeId);
  assert.equal(same.status, "same-week");
  assert.equal(same.fresh.length, 0);
});

console.log("- a clipboard holding the same training twice -");
reset();
const doubled = { teamId: "t1", fromWeek: WEEK_A, sessions: [
  { teamId: "t1", coachId: "c1", hallId: "h1", day: "ראשון", start: "17:00", end: "18:30", type: "אימון" },
  { teamId: "t1", coachId: "c1", hallId: "h1", day: "ראשון", start: "17:00", end: "18:30", type: "אימון" },
] };
const once = planRowPaste(doubled, [], WEEK_B, makeId);
t("only one of them is written", () => assert.equal(once.fresh.length, 1));
t("the other counts as skipped", () => assert.equal(once.skipped, 1));

console.log("- a fixture in the target week is not a duplicate to hide behind -");
reset();
const withGame = [S("g9", "t1", WEEK_B, "ראשון", { fromGame: true })];
const overGame = planRowPaste(clip, withGame, WEEK_B, makeId);
t("the training still lands next to the game", () => assert.equal(overGame.fresh.length, 2));
t("and the game is not counted as the row being built", () => assert.equal(overGame.existing, 0));

console.log(`\n${pass} row-copy assertions passed`);
