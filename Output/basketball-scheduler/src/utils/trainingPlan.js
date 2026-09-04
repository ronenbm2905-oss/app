// A training plan a coach fills on a phone.
//
// The single-club branch reproduces one club's paper form field for field — four named
// columns, and a lineup block of two groups holding four quads and three fives each. That
// is the right call for the club whose coaches already know that sheet, and the wrong one
// for a product: another club's form has different columns, and most clubs have no lineup
// block at all.
//
// So the SHAPE is generic and the FORM is per-club. What stays fixed is what every
// training plan has — a header the schedule already knows, a table of drills, who was
// there, and a closing note. What comes from `settings.trainingPlan` is what that table's
// columns are called and whether the lineup block exists.
//
// Every function here therefore takes the template, and defaults to `DEFAULT_PLAN_TEMPLATE`
// when it is not given. That default is a plain basketball vocabulary, not anyone's
// identity — the same reasoning as VIDEO_CATEGORIES.

import { normalizeSketch, isEmptySketch } from "./courtSketch.js";
import { normalizeEmail } from "./access.js";

// A column's `id` is the STORAGE KEY of that cell in every plan already written. It is
// minted once when the column is created and never derived from the label again: rename a
// column and the coaches' text stays put; derive the id from the label and a rename would
// orphan every cell under it. The slug below is only for a club document hand-edited to
// hold bare strings, and it is positional for the same reason — Hebrew labels slug to
// nothing, so there is no label-derived id to be tempted by.
const slug = (v, i) => {
  const clean = String(v ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return clean || `c${i + 1}`;
};

export const DEFAULT_PLAN_TEMPLATE = {
  columns: [
    { id: "drill", label: "תרגיל" },
    { id: "detail", label: "פירוט" },
    { id: "focus", label: "דגשים" },
    { id: "time", label: "זמן" },
  ],
  // Off by default, and that default is the point: two groups of four quads and three
  // fives is one club's sheet. A club that works that way turns it on and sets the numbers.
  lineups: { enabled: false, groups: 2, quads: 4, fives: 3 },
  startingRows: 4,
};

const clampInt = (v, min, max, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : fallback;
};

// The club's template, repaired to full shape. A club document written before this setting
// existed, or half-edited, must still open a usable form rather than an empty table.
export function planTemplate(data) {
  const raw = data?.settings?.trainingPlan;
  const t = raw && typeof raw === "object" ? raw : {};
  const cols = Array.isArray(t.columns) ? t.columns : [];
  const columns = cols
    .map((c, i) => (typeof c === "string" ? { id: slug(c, i), label: c.trim() } : { id: String(c?.id || slug(c?.label, i)), label: String(c?.label || "").trim() }))
    .filter((c) => c.label)
    .slice(0, 8);
  const ln = t.lineups && typeof t.lineups === "object" ? t.lineups : {};
  return {
    columns: columns.length ? columns : DEFAULT_PLAN_TEMPLATE.columns,
    lineups: {
      enabled: Boolean(ln.enabled),
      groups: clampInt(ln.groups, 1, 6, DEFAULT_PLAN_TEMPLATE.lineups.groups),
      quads: clampInt(ln.quads, 0, 12, DEFAULT_PLAN_TEMPLATE.lineups.quads),
      fives: clampInt(ln.fives, 0, 12, DEFAULT_PLAN_TEMPLATE.lineups.fives),
    },
    startingRows: clampInt(t.startingRows, 1, 20, DEFAULT_PLAN_TEMPLATE.startingRows),
  };
}

// Group keys are "1", "2", … — positional, because the paper forms this replaces repeat
// the same block with no heading of its own, and inventing names for the halves would be
// putting words in a club's mouth.
export const groupKeys = (tpl) => Array.from({ length: tpl.lineups.groups }, (_, i) => String(i + 1));

const str = (v) => (typeof v === "string" ? v.trim() : "");
const arr = (v) => (Array.isArray(v) ? v : []);

// A plan belongs to one session, and the session id is what survives an edit: a manager
// moving a training to a different hour keeps the id, so the coach's plan moves with it.
// Copying a week hands out fresh ids, which is what we want — last week's plan is not
// this week's plan.
export function planKey(session) {
  return str(session?.id);
}

export function emptyRow() {
  return { drill: "", detail: "", focus: "", time: "" };
}

function emptyUnits(tpl) {
  const group = () => ({
    quads: Array.from({ length: tpl.lineups.quads }, () => ""),
    fives: Array.from({ length: tpl.lineups.fives }, () => ""),
  });
  return Object.fromEntries(groupKeys(tpl).map((g) => [g, group()]));
}

export function emptyPlan(tpl = DEFAULT_PLAN_TEMPLATE) {
  return {
    players: "",
    missing: "",
    rows: Array.from({ length: tpl.startingRows }, emptyRow),
    units: emptyUnits(tpl),
    summary: "",
  };
}

// Anything read out of storage is repaired to full shape before it reaches the form.
// A plan saved before a column or a lineup slot existed must still open, and a field that
// arrives as a number rather than a string must not put `undefined` into an input and turn
// it uncontrolled halfway through a sentence.
export function normalizePlan(plan, tpl = DEFAULT_PLAN_TEMPLATE) {
  const p = plan && typeof plan === "object" ? plan : {};
  const units = p.units && typeof p.units === "object" ? p.units : {};
  const rows = arr(p.rows).map((r) => {
    const row = r && typeof r === "object" ? r : {};
    const cells = Object.fromEntries(tpl.columns.map((c) => [c.id, str(row[c.id])]));
    // The key is omitted rather than set to null when there is no diagram: a plan with
    // four blank rows should cost four blank rows, not four empty sketch objects.
    const sketch = normalizeSketch(row.sketch);
    return sketch ? { ...cells, sketch } : cells;
  });
  return {
    players: str(p.players),
    missing: str(p.missing),
    rows: rows.length ? rows : Array.from({ length: tpl.startingRows }, emptyRow),
    units: Object.fromEntries(
      groupKeys(tpl).map((g) => {
        const src = units[g] && typeof units[g] === "object" ? units[g] : {};
        const slot = (list, n) => Array.from({ length: n }, (_, i) => str(arr(list)[i]));
        return [g, { quads: slot(src.quads, tpl.lineups.quads), fives: slot(src.fives, tpl.lineups.fives) }];
      })
    ),
    summary: str(p.summary),
    author: str(p.author),
    createdAt: p.createdAt || "",
    updatedAt: p.updatedAt || "",
  };
}

// Trailing blank rows are what a coach leaves behind, not what they wrote. Dropping them
// on save keeps a half-used form from counting as filled and from being stored in full.
export function rowIsBlank(row, tpl = DEFAULT_PLAN_TEMPLATE) {
  return tpl.columns.every((c) => !str(row?.[c.id])) && isEmptySketch(row?.sketch);
}

export function trimRows(rows, tpl = DEFAULT_PLAN_TEMPLATE) {
  const clean = arr(rows).map((r) => {
    const cells = Object.fromEntries(tpl.columns.map((c) => [c.id, str(r?.[c.id])]));
    const sketch = normalizeSketch(r?.sketch);
    return sketch ? { ...cells, sketch } : cells;
  });
  let end = clean.length;
  // A row that holds only a diagram is a written row. Dropping it would delete the drawing
  // the coach just made because they had not typed a name for it yet.
  while (end > 0 && rowIsBlank(clean[end - 1], tpl)) end--;
  return clean.slice(0, end);
}

export function isFilled(plan, tpl = DEFAULT_PLAN_TEMPLATE) {
  if (!plan) return false;
  const p = normalizePlan(plan, tpl);
  if (trimRows(p.rows, tpl).length > 0) return true;
  if (p.players || p.missing || p.summary) return true;
  return groupKeys(tpl).some((g) => [...p.units[g].quads, ...p.units[g].fives].some(Boolean));
}

// `authorEmail` is lower-cased and written on every save: it is the only field the
// security rules can match against a signed-in user, and a capital letter would lock a
// coach out of their own plan.
export function buildPlan(previous, { plan, author, authorEmail, now, tpl = DEFAULT_PLAN_TEMPLATE }) {
  const p = normalizePlan(plan, tpl);
  const rows = trimRows(p.rows, tpl);
  return {
    players: p.players,
    missing: p.missing,
    rows,
    units: p.units,
    summary: p.summary,
    author: str(author) || str(previous?.author),
    authorEmail: normalizeEmail(authorEmail) || str(previous?.authorEmail),
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };
}

// One line for the session row, so a coach can see at a glance whether the form is done
// without opening it.
export function planSummary(plan, tpl = DEFAULT_PLAN_TEMPLATE) {
  if (!isFilled(plan, tpl)) return "";
  const n = trimRows(normalizePlan(plan, tpl).rows, tpl).length;
  if (n === 0) return "מערך אימון";
  return n === 1 ? "מערך אימון · תרגיל אחד" : `מערך אימון · ${n} תרגילים`;
}
