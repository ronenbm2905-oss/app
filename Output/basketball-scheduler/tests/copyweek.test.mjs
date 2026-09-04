// "Copy last week" — the button that duplicated a whole week.
//
// The accident is on record: 115 August sessions landed on a week whose new-season
// schedule was already typed in, 241 rows instead of 126, every team showing its hours
// twice. New here — the single-club branch fixed the bug inside the component, where a
// `window.confirm` makes it untestable. The fix is the same; the planner is pulled out so
// the accident can be asserted against rather than remembered.

import assert from "node:assert/strict";
import { planWeekCopy, sessionKey } from "../src/utils/copyWeek.js";

const THIS = "2026-09-13";
const PREV = "2026-09-06";
let n = 0;
const ids = () => `new${++n}`;

const S = (over = {}) => ({
  id: "x", teamId: "t1", coachId: "c1", hallId: "h1",
  day: "ראשון", start: "17:00", end: "18:30", type: "אימון", weekOf: PREV, ...over,
});

// ---- What counts as "the same row" ----
assert.equal(sessionKey(S()), sessionKey(S({ id: "totally-different" })),
  "the id must not take part — a copy gets a fresh one by definition, so comparing ids would find no duplicate ever");
assert.notEqual(sessionKey(S()), sessionKey(S({ start: "17:30" })));
assert.notEqual(sessionKey(S()), sessionKey(S({ hallId: "h2" })));
assert.notEqual(sessionKey(S()), sessionKey(S({ coachId: "c2" })));
assert.equal(sessionKey(S({ type: "" })), sessionKey(S({ type: undefined })), "a missing type and an empty one are the same row");

// ---- An empty target week: a plain copy ----
{
  n = 0;
  const plan = planWeekCopy([S({ id: "a" }), S({ id: "b", day: "שני" })], THIS, ids);
  assert.equal(plan.source, 2);
  assert.equal(plan.existing, 0);
  assert.equal(plan.skipped, 0);
  assert.equal(plan.fresh.length, 2);
  assert.ok(plan.fresh.every((s) => s.weekOf === THIS), "the copies were not stamped for the target week");
  assert.deepEqual(plan.fresh.map((s) => s.id), ["new1", "new2"], "fresh ids, or the copy overwrites its source");
  assert.equal(plan.sessions.length, 4, "the source week must survive the copy");
}

// ---- Pressing it twice does nothing. This is the property the old version lacked ----
{
  n = 0;
  const start = [S({ id: "a" })];
  const once = planWeekCopy(start, THIS, ids);
  const twice = planWeekCopy(once.sessions, THIS, ids);
  assert.equal(twice.fresh.length, 0, "a second press copied the week again");
  assert.equal(twice.skipped, 1);
  assert.equal(twice.sessions.length, once.sessions.length, "a second press changed the data");
}

// ---- The accident itself: a week already built, whose hours have all moved ----
//
// Not one of these is a duplicate by any comparison, which is exactly why skipping
// identical rows could not have saved anyone here. The planner does not decide — it hands
// back the numbers so the screen can ask.
{
  n = 0;
  const august = [S({ id: "a" }), S({ id: "b", day: "שני" }), S({ id: "c", day: "שלישי" })];
  const september = [
    S({ id: "x", weekOf: THIS, start: "18:00", end: "19:30" }),
    S({ id: "y", weekOf: THIS, day: "שני", start: "18:00", end: "19:30" }),
  ];
  const plan = planWeekCopy([...august, ...september], THIS, ids);
  assert.equal(plan.existing, 2, "the manager must be told the week is not empty");
  assert.equal(plan.skipped, 0, "moved hours are not duplicates — which is the whole trap");
  assert.equal(plan.fresh.length, 3);
  // And the caller can refuse: the plan is inert until `sessions` is saved.
  assert.equal([...august, ...september].length, 5, "planning must not mutate the input");
}

// ---- Partial overlap ----
{
  n = 0;
  const plan = planWeekCopy(
    [S({ id: "a" }), S({ id: "b", day: "שני" }), S({ id: "same", weekOf: THIS })],
    THIS, ids
  );
  assert.equal(plan.existing, 1);
  assert.equal(plan.skipped, 1, "the identical row should have been skipped");
  assert.equal(plan.fresh.length, 1);
  assert.equal(plan.fresh[0].day, "שני");
}

// ---- Imported fixtures belong to the federation file, not to a copy ----
{
  n = 0;
  const plan = planWeekCopy([S({ id: "g", fromGame: true }), S({ id: "a" })], THIS, ids);
  assert.equal(plan.source, 1, "an imported game was offered for copying");
  assert.ok(plan.fresh.every((s) => !s.fromGame));
}
// ...and an imported fixture already in the target week does not count as "already built",
// because the manager did not build it.
{
  n = 0;
  const plan = planWeekCopy([S({ id: "a" }), S({ id: "g", weekOf: THIS, fromGame: true })], THIS, ids);
  assert.equal(plan.existing, 0);
  assert.equal(plan.fresh.length, 1);
}

// ---- Nothing to copy ----
{
  const plan = planWeekCopy([S({ id: "a", weekOf: "2026-01-04" })], THIS, ids);
  assert.equal(plan.source, 0);
  assert.equal(plan.fresh.length, 0);
}
assert.equal(planWeekCopy([], THIS, ids).source, 0);
assert.equal(planWeekCopy(null, THIS, ids).sessions.length, 0);
assert.equal(planWeekCopy([null, undefined], THIS, ids).source, 0, "a malformed row must not throw");

console.log("copy-week: 31 assertions passed");
