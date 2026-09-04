// The training plan, and the club's own version of the form.
//
// The single-club branch reproduces one club's paper sheet field for field: four named
// columns and a lineup block of two groups holding four quads and three fives. That is
// right for the club whose coaches know that sheet and wrong for a product. Here the SHAPE
// is fixed and the FORM is the club's, so most of this suite is about the template — what
// a club may change, what a half-edited setting must not do, and the one thing that must
// never move.

import assert from "node:assert/strict";
import {
  planTemplate, DEFAULT_PLAN_TEMPLATE, groupKeys, emptyPlan, normalizePlan,
  trimRows, rowIsBlank, isFilled, buildPlan, planSummary, planKey, emptyRow,
} from "../src/utils/trainingPlan.js";

const tplOf = (trainingPlan) => planTemplate({ settings: { trainingPlan } });

// ---- The default is a plain basketball vocabulary, and no lineup block ----
{
  const t = planTemplate({});
  assert.deepEqual(t.columns.map((c) => c.label), ["תרגיל", "פירוט", "דגשים", "זמן"]);
  assert.equal(t.lineups.enabled, false, "a lineup block is one club's paper form, not a default");
  assert.equal(t.startingRows, 4);
  assert.deepEqual(planTemplate(undefined), planTemplate({}), "a club document with no settings still opens a form");
}

// ---- A club's own columns ----
{
  const t = tplOf({ columns: [{ id: "a", label: "מה עושים" }, { id: "b", label: "כמה זמן" }] });
  assert.deepEqual(t.columns.map((c) => c.label), ["מה עושים", "כמה זמן"]);
  assert.deepEqual(t.columns.map((c) => c.id), ["a", "b"], "the stored id must be preserved verbatim");
}
// The id is the storage key of every cell already written. THIS is the assertion that
// stops a future refactor from deriving it from the label: rename the column and the
// coaches' text has to stay where it is.
{
  const before = tplOf({ columns: [{ id: "k1", label: "תרגיל" }] });
  const after = tplOf({ columns: [{ id: "k1", label: "תרגיל פתיחה" }] });
  assert.equal(before.columns[0].id, after.columns[0].id, "renaming a column changed its storage key");
  const plan = normalizePlan({ rows: [{ k1: "כדרור" }] }, after);
  assert.equal(plan.rows[0].k1, "כדרור", "a rename orphaned what the coach had written");
}

// ---- A half-edited or hand-edited template must still open a usable form ----
assert.deepEqual(tplOf({ columns: [] }).columns, DEFAULT_PLAN_TEMPLATE.columns, "an empty column list falls back");
assert.deepEqual(tplOf({ columns: "nope" }).columns, DEFAULT_PLAN_TEMPLATE.columns);
assert.deepEqual(tplOf({ columns: [{ label: "  " }, { label: "יש" }] }).columns.map((c) => c.label), ["יש"],
  "a blank column name is dropped rather than rendered as a nameless field");
assert.equal(tplOf({ columns: Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, label: `x${i}` })) }).columns.length, 8,
  "capped, so a paste accident cannot make an unusable table");
// Bare strings are what a hand-edited club document holds. Hebrew slugs to nothing, so the
// ids are positional — and the comment in the module says why that is deliberate.
assert.deepEqual(tplOf({ columns: ["תרגיל", "זמן"] }).columns.map((c) => c.id), ["c1", "c2"]);

for (const bad of [{}, null, "3", true, -1, 99]) {
  const t = tplOf({ lineups: { enabled: true, groups: bad } });
  assert.ok(t.lineups.groups >= 1 && t.lineups.groups <= 6, `a bad group count survived: ${JSON.stringify(bad)}`);
}
assert.equal(tplOf({ startingRows: 0 }).startingRows, 4, "zero rows is not a form");
assert.equal(tplOf({ startingRows: 500 }).startingRows, 4);
assert.equal(tplOf({ startingRows: 7 }).startingRows, 7);
assert.equal(tplOf({ lineups: { enabled: true, quads: 0, fives: 2 } }).lineups.quads, 0,
  "zero quads is a real answer — a club that only uses fives");

// ---- The empty form follows the template ----
{
  const t = tplOf({ startingRows: 2, lineups: { enabled: true, groups: 3, quads: 1, fives: 2 } });
  const p = emptyPlan(t);
  assert.equal(p.rows.length, 2);
  assert.deepEqual(Object.keys(p.units), ["1", "2", "3"]);
  assert.equal(p.units["1"].quads.length, 1);
  assert.equal(p.units["1"].fives.length, 2);
  assert.deepEqual(groupKeys(t), ["1", "2", "3"]);
}

// ---- Rows are repaired to the CLUB's columns ----
{
  const t = tplOf({ columns: [{ id: "what", label: "מה" }] });
  const p = normalizePlan({ rows: [{ what: " כדרור ", drill: "מהעבר" }] }, t);
  assert.equal(p.rows[0].what, "כדרור", "trimmed");
  assert.equal(p.rows[0].drill, undefined, "a cell from a column the club does not have is not rendered");
  assert.equal(normalizePlan({}, t).rows.length, t.startingRows, "an empty plan opens with rows to type in");
  // A value that is not a string becomes "", never `undefined`. That is the contract the
  // module states and the one the form needs: `undefined` in a controlled input turns it
  // uncontrolled halfway through a sentence. It does mean a hand-edited number is dropped
  // rather than converted — acceptable, because the app only ever writes strings here.
  assert.equal(normalizePlan({ rows: [{ what: 7 }] }, t).rows[0].what, "");
  assert.notEqual(normalizePlan({ rows: [{ what: 7 }] }, t).rows[0].what, undefined);
  assert.equal(normalizePlan({ rows: [{ what: null }] }, t).rows[0].what, "");
}

// ---- Trailing blanks are what a coach left behind, not what they wrote ----
{
  const t = planTemplate({});
  const rows = [{ drill: "חימום" }, emptyRow(), emptyRow()];
  assert.equal(trimRows(rows, t).length, 1);
  assert.equal(rowIsBlank(emptyRow(), t), true);
  assert.equal(rowIsBlank({ drill: "x" }, t), false);
  // A row holding only a diagram is a written row — dropping it would delete the drawing
  // the coach just made because they had not named it yet.
  const drawn = { ...emptyRow(), sketch: { court: "half", el: [{ k: "player", x: 10, y: 10, n: 1 }] } };
  assert.equal(rowIsBlank(drawn, t), false, "a row with only a sketch was treated as blank");
  assert.equal(trimRows([{ drill: "x" }, drawn], t).length, 2);
}

// ---- isFilled follows the template too ----
{
  const off = tplOf({ lineups: { enabled: false } });
  const on = tplOf({ lineups: { enabled: true, groups: 1, quads: 1, fives: 0 } });
  const onlyLineup = { rows: [], units: { 1: { quads: ["דני"], fives: [] } }, players: "", missing: "", summary: "" };
  assert.equal(isFilled(onlyLineup, on), true);
  assert.equal(isFilled(null, off), false);
  assert.equal(isFilled({ summary: "היה טוב" }, off), true);
  assert.equal(isFilled(emptyPlan(off), off), false, "an untouched form is not a filled one");
}

// ---- Saving ----
{
  const t = planTemplate({});
  const built = buildPlan(null, {
    plan: { rows: [{ drill: "כדרור" }, emptyRow()], summary: " טוב " },
    author: "דנה", authorEmail: "  Dana@Gmail.COM ", now: "2026-09-10T00:00:00.000Z", tpl: t,
  });
  assert.equal(built.rows.length, 1, "trailing blanks were stored");
  assert.equal(built.summary, "טוב");
  // The rules compare this exactly; a capital letter locks the coach out of their own plan.
  assert.equal(built.authorEmail, "dana@gmail.com");
  assert.equal(built.createdAt, "2026-09-10T00:00:00.000Z");
  const later = buildPlan(built, { plan: built, author: "", authorEmail: "", now: "2026-09-11T00:00:00.000Z", tpl: t });
  assert.equal(later.createdAt, built.createdAt, "createdAt is the plan's birthday and never moves");
  assert.equal(later.author, "דנה", "an edit without an author must not blank the original");
}

assert.equal(planKey({ id: " s1 " }), "s1");
assert.equal(planKey({}), "", "a session with no id gets no plan, rather than a shared one");
assert.equal(planSummary({ rows: [{ drill: "א" }, { drill: "ב" }] }), "מערך אימון · 2 תרגילים");
assert.equal(planSummary({ rows: [{ drill: "א" }] }), "מערך אימון · תרגיל אחד");
assert.equal(planSummary(null), "");

console.log("training-plan: 47 assertions passed");
