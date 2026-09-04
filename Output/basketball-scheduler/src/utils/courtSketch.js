// A court diagram attached to one drill row of the training plan.
//
// Stored as geometry, never as an image. A PNG of a sketch is 60-150KB, and four of those
// would push a plan document towards the 1MB Firestore ceiling that already drives the
// subcollection split; the same sketch as points is about 2KB. Geometry also stays sharp
// in print, and because the court is an inline SVG rather than a loaded file, html2canvas
// exports it without the cross-origin failure that bites the club logo.

// Court dimensions in decimetres, so the numbers are FIBA measurements read straight off
// the rulebook: a 28x15m court is 280x150 here, and a marker radius of 5 is half a metre.
export const COURTS = {
  half: { id: "half", label: "חצי מגרש", w: 150, h: 140 },
  full: { id: "full", label: "מגרש שלם", w: 150, h: 280 },
};

export const DEFAULT_COURT = "half";
export const PAD = 3;

export const PLAYER_NUMBERS = 5;

// Point markers and two-point lines are separated because they are drawn differently:
// a marker lands where the finger touches, a line needs a drag.
export const MARK_KINDS = ["player", "defender", "ball", "cone"];
export const LINE_KINDS = ["move", "pass", "dribble", "screen"];

export const TOOL_LABELS = {
  player: "שחקן",
  defender: "מגן",
  ball: "כדור",
  cone: "קונוס",
  move: "תנועה",
  pass: "מסירה",
  dribble: "כדרור",
  screen: "חסימה",
  pen: "עט חופשי",
  erase: "מחיקה",
};

// Caps that exist so one runaway gesture cannot turn a plan document into a problem.
// A busy drill is a dozen elements; 150 is far past anything readable.
const MAX_ELEMENTS = 150;
const MAX_POINTS = 400;
// A finger reports far more points than a line needs. Anything closer than 1.2 decimetres
// to the previous kept point is the same pixel as far as the drawing is concerned.
const MIN_STEP = 1.2;

const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
const r1 = (v) => Math.round(v * 10) / 10;

export function courtOf(id) {
  return COURTS[id] || COURTS[DEFAULT_COURT];
}

export function clampPoint(x, y, courtId) {
  const c = courtOf(courtId);
  return {
    x: r1(Math.min(Math.max(x, -PAD), c.w + PAD)),
    y: r1(Math.min(Math.max(y, -PAD), c.h + PAD)),
  };
}

export function emptySketch(courtId = DEFAULT_COURT) {
  return { court: courtOf(courtId).id, el: [] };
}

function normalizeElement(raw) {
  const e = raw && typeof raw === "object" ? raw : {};
  if (MARK_KINDS.includes(e.k)) {
    const x = num(e.x);
    const y = num(e.y);
    if (x === null || y === null) return null;
    const mark = { k: e.k, x: r1(x), y: r1(y) };
    if (e.k === "player") {
      const n = num(e.n);
      mark.n = n === null ? 1 : Math.min(Math.max(Math.round(n), 1), PLAYER_NUMBERS);
    }
    return mark;
  }
  if (LINE_KINDS.includes(e.k)) {
    const v = [e.x1, e.y1, e.x2, e.y2].map(num);
    if (v.some((n) => n === null)) return null;
    return { k: e.k, x1: r1(v[0]), y1: r1(v[1]), x2: r1(v[2]), y2: r1(v[3]) };
  }
  if (e.k === "pen") {
    const p = Array.isArray(e.p) ? e.p.map(num) : [];
    // A flat [x,y,x,y] array rather than [[x,y],…]: same data, about half the JSON.
    const clean = [];
    for (let i = 0; i + 1 < p.length && clean.length < MAX_POINTS * 2; i += 2) {
      if (p[i] === null || p[i + 1] === null) continue;
      clean.push(r1(p[i]), r1(p[i + 1]));
    }
    return clean.length >= 4 ? { k: "pen", p: clean } : null;
  }
  return null;
}

// Anything read out of storage is repaired before it reaches the editor, and anything the
// editor produces is repaired before it is written. Returns null for an empty sketch so a
// row that was never drawn on carries no field at all.
export function normalizeSketch(sketch) {
  const s = sketch && typeof sketch === "object" ? sketch : null;
  if (!s) return null;
  const court = courtOf(s.court).id;
  const el = (Array.isArray(s.el) ? s.el : []).map(normalizeElement).filter(Boolean).slice(0, MAX_ELEMENTS);
  return el.length ? { court, el } : null;
}

export function isEmptySketch(sketch) {
  return normalizeSketch(sketch) === null;
}

export function countElements(sketch) {
  return normalizeSketch(sketch)?.el.length || 0;
}

export function atCapacity(sketch) {
  return countElements(sketch) >= MAX_ELEMENTS;
}

// A freehand stroke grows point by point while the finger moves. Skipping points that are
// on top of the last one keeps a three-second squiggle from storing a thousand of them.
export function extendStroke(points, x, y) {
  const p = Array.isArray(points) ? points : [];
  if (p.length >= MAX_POINTS * 2) return p;
  const n = p.length;
  if (n >= 2) {
    const dx = x - p[n - 2];
    const dy = y - p[n - 1];
    if (dx * dx + dy * dy < MIN_STEP * MIN_STEP) return p;
  }
  return [...p, r1(x), r1(y)];
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  // A zero-length segment is a point, and projecting onto it would divide by zero.
  const t = len === 0 ? 0 : Math.min(Math.max(((px - x1) * dx + (py - y1) * dy) / len, 0), 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function distanceTo(el, x, y) {
  if (MARK_KINDS.includes(el.k)) return Math.hypot(x - el.x, y - el.y);
  if (LINE_KINDS.includes(el.k)) return distToSegment(x, y, el.x1, el.y1, el.x2, el.y2);
  if (el.k === "pen") {
    let best = Infinity;
    for (let i = 0; i + 3 < el.p.length; i += 2) {
      best = Math.min(best, distToSegment(x, y, el.p[i], el.p[i + 1], el.p[i + 2], el.p[i + 3]));
    }
    return best;
  }
  return Infinity;
}

// The eraser deletes the topmost element under the finger, so overlapping marks come off
// in the order they look stacked rather than the order they were drawn.
export function eraseAt(sketch, x, y, tolerance = 7) {
  const s = normalizeSketch(sketch);
  if (!s) return { sketch: null, erased: false };
  let hit = -1;
  for (let i = s.el.length - 1; i >= 0; i--) {
    if (distanceTo(s.el[i], x, y) <= tolerance) {
      hit = i;
      break;
    }
  }
  if (hit < 0) return { sketch: s, erased: false };
  const el = s.el.filter((_, i) => i !== hit);
  return { sketch: el.length ? { ...s, el } : null, erased: true };
}

// The next shirt number to place: keeps 1-5 cycling without the coach setting it, and
// picks up where the sketch left off when a saved diagram is reopened.
export function nextPlayerNumber(sketch) {
  const s = normalizeSketch(sketch);
  const last = [...(s?.el || [])].reverse().find((e) => e.k === "player");
  return last ? (last.n % PLAYER_NUMBERS) + 1 : 1;
}

export function sketchLabel(sketch) {
  const n = countElements(sketch);
  return n ? `שרטוט · ${n === 1 ? "סימון אחד" : `${n} סימונים`}` : "שרטוט";
}
