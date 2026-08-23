// The club's paper "מערך אימון" form, turned into something a coach fills on a phone.
//
// The paper form is reproduced field for field — same columns, same lineup slots, same
// closing summary — because coaches already know it. What the app adds is the header:
// team, date and hall are already in the schedule, so the coach never writes them again.

// The exercise table, right to left exactly as printed.
export const PLAN_COLUMNS = [
  { id: "drill", label: "תרגיל" },
  { id: "detail", label: "פירוט" },
  { id: "focus", label: "דגשים" },
  { id: "time", label: "זמן" },
];

// The lineup slots. The paper form repeats the same block twice with no heading of its
// own, so the app repeats it too rather than inventing names for the two halves.
export const UNIT_GROUPS = ["1", "2"];
export const QUAD_COUNT = 4;
export const FIVE_COUNT = 3;

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

function emptyUnits() {
  const group = () => ({
    quads: Array.from({ length: QUAD_COUNT }, () => ""),
    fives: Array.from({ length: FIVE_COUNT }, () => ""),
  });
  return Object.fromEntries(UNIT_GROUPS.map((g) => [g, group()]));
}

export const STARTING_ROWS = 4;

export function emptyPlan() {
  return {
    players: "",
    missing: "",
    rows: Array.from({ length: STARTING_ROWS }, emptyRow),
    units: emptyUnits(),
    summary: "",
  };
}

// Anything read out of storage is repaired to full shape before it reaches the form.
// A plan saved before a column or a lineup slot existed must still open, and a field that
// arrives as a number rather than a string must not put `undefined` into an input and turn
// it uncontrolled halfway through a sentence.
export function normalizePlan(plan) {
  const p = plan && typeof plan === "object" ? plan : {};
  const units = p.units && typeof p.units === "object" ? p.units : {};
  const rows = arr(p.rows).map((r) => {
    const row = r && typeof r === "object" ? r : {};
    return Object.fromEntries(PLAN_COLUMNS.map((c) => [c.id, str(row[c.id])]));
  });
  return {
    players: str(p.players),
    missing: str(p.missing),
    rows: rows.length ? rows : Array.from({ length: STARTING_ROWS }, emptyRow),
    units: Object.fromEntries(
      UNIT_GROUPS.map((g) => {
        const src = units[g] && typeof units[g] === "object" ? units[g] : {};
        const slot = (list, n) => Array.from({ length: n }, (_, i) => str(arr(list)[i]));
        return [g, { quads: slot(src.quads, QUAD_COUNT), fives: slot(src.fives, FIVE_COUNT) }];
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
export function trimRows(rows) {
  const clean = arr(rows).map((r) => Object.fromEntries(PLAN_COLUMNS.map((c) => [c.id, str(r?.[c.id])])));
  let end = clean.length;
  while (end > 0 && PLAN_COLUMNS.every((c) => !clean[end - 1][c.id])) end--;
  return clean.slice(0, end);
}

export function isFilled(plan) {
  if (!plan) return false;
  const p = normalizePlan(plan);
  if (trimRows(p.rows).length > 0) return true;
  if (p.players || p.missing || p.summary) return true;
  return UNIT_GROUPS.some((g) => [...p.units[g].quads, ...p.units[g].fives].some(Boolean));
}

export function buildPlan(previous, { plan, author, now }) {
  const p = normalizePlan(plan);
  const rows = trimRows(p.rows);
  return {
    players: p.players,
    missing: p.missing,
    rows,
    units: p.units,
    summary: p.summary,
    author: str(author) || str(previous?.author),
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };
}

// One line for the session row, so a coach can see at a glance whether the form is done
// without opening it.
export function planSummary(plan) {
  if (!isFilled(plan)) return "";
  const n = trimRows(normalizePlan(plan).rows).length;
  if (n === 0) return "מערך אימון";
  return n === 1 ? "מערך אימון · תרגיל אחד" : `מערך אימון · ${n} תרגילים`;
}
