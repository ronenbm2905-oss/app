import { COURTS, PAD, courtOf, normalizeSketch } from "../utils/courtSketch";

// The court itself, and the read-only rendering of a sketch on top of it.
//
// Everything here is plain SVG geometry with literal colours rather than Tailwind classes:
// the same markup has to survive html2canvas and the print stylesheet, and a class that
// resolves to a CSS variable does not always make it through either.

const LINE = "#a8a29e"; // stone-400 — the court, present but never competing with the drawing
const INK = "#1c1917"; // stone-900 — everything the coach draws
const BALL = "#ea580c";
const CONE = "#f59e0b";

// FIBA measurements in decimetres, basket at the top. Drawn once and mirrored for the far
// half, so the two ends cannot drift apart.
function HalfCourtMarkings() {
  return (
    <g fill="none" stroke={LINE} strokeWidth="0.7">
      {/* free-throw lane and circle */}
      <rect x="50.5" y="0" width="49" height="58" />
      <circle cx="75" cy="58" r="18" />
      {/* backboard, ring, and the no-charge semicircle under it */}
      <path d="M 66 12 L 84 12" strokeWidth="1.1" />
      <path d="M 75 12 L 75 13.5" />
      <circle cx="75" cy="15.75" r="2.25" />
      <path d="M 62.5 15.75 A 12.5 12.5 0 0 0 87.5 15.75" />
      {/* three-point line: 0.9m from each sideline, then a 6.75m arc off the ring centre */}
      <path d="M 9 0 L 9 29.9 A 67.5 67.5 0 0 0 141 29.9 L 141 0" />
    </g>
  );
}

export function CourtMarkings({ court }) {
  const c = courtOf(court);
  return (
    <g>
      <rect x="0" y="0" width={c.w} height={c.h} fill="none" stroke={LINE} strokeWidth="0.9" />
      <HalfCourtMarkings />
      {c.id === "full" ? (
        <>
          <g transform="translate(150, 280) rotate(180)">
            <HalfCourtMarkings />
          </g>
          <g fill="none" stroke={LINE} strokeWidth="0.7">
            <path d="M 0 140 L 150 140" />
            <circle cx="75" cy="140" r="18" />
          </g>
        </>
      ) : (
        /* On the half-court view the halfway line is the bottom edge, so only the near
           half of the centre circle exists. */
        <path d="M 57 140 A 18 18 0 0 1 93 140" fill="none" stroke={LINE} strokeWidth="0.7" />
      )}
    </g>
  );
}

const HEAD = 4.5;

// Arrowheads are drawn as explicit polygons rather than SVG <marker> defs: several
// sketches share one page, and duplicated marker ids are exactly the kind of thing that
// renders fine in the browser and then comes out wrong in an exported image.
function arrowHead(x1, y1, x2, y2) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const wing = (t) => `${x2 - HEAD * Math.cos(a + t)} ${y2 - HEAD * Math.sin(a + t)}`;
  return `M ${x2} ${y2} L ${wing(0.42)} L ${wing(-0.42)} Z`;
}

// A dribble is drawn as a wave along the line, which is how it appears on the paper form.
function wavePath(x1, y1, x2, y2) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const steps = Math.max(2, Math.round(len / 5));
  let d = `M ${x1} ${y1}`;
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * len;
    const half = t - len / (steps * 2);
    const side = i % 2 ? 2.2 : -2.2;
    d += ` Q ${x1 + ux * half - uy * side} ${y1 + uy * half + ux * side} ${x1 + ux * t} ${y1 + uy * t}`;
  }
  return d;
}

// A screen ends in a bar across the path instead of an arrowhead.
function screenBar(x1, y1, x2, y2) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -((y2 - y1) / len) * 4.5;
  const ny = ((x2 - x1) / len) * 4.5;
  return `M ${x2 + nx} ${y2 + ny} L ${x2 - nx} ${y2 - ny}`;
}

function Element({ el }) {
  const stroke = { stroke: INK, fill: "none", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (el.k) {
    case "player":
      return (
        <g>
          <circle cx={el.x} cy={el.y} r="5" fill="#fff" stroke={INK} strokeWidth="1.4" />
          <text x={el.x} y={el.y} textAnchor="middle" dominantBaseline="central" fontSize="6.5" fontWeight="700" fill={INK}>
            {el.n}
          </text>
        </g>
      );
    case "defender":
      return (
        <path
          d={`M ${el.x - 4} ${el.y - 4} L ${el.x + 4} ${el.y + 4} M ${el.x + 4} ${el.y - 4} L ${el.x - 4} ${el.y + 4}`}
          {...stroke}
          strokeWidth="1.8"
        />
      );
    case "ball":
      return (
        <g>
          <circle cx={el.x} cy={el.y} r="3.2" fill={BALL} />
          <path d={`M ${el.x} ${el.y - 3.2} L ${el.x} ${el.y + 3.2}`} stroke="#fff" strokeWidth="0.7" fill="none" />
        </g>
      );
    case "cone":
      return <path d={`M ${el.x} ${el.y - 5} L ${el.x + 4.5} ${el.y + 4} L ${el.x - 4.5} ${el.y + 4} Z`} fill={CONE} />;
    case "move":
      return (
        <g>
          <path d={`M ${el.x1} ${el.y1} L ${el.x2} ${el.y2}`} {...stroke} />
          <path d={arrowHead(el.x1, el.y1, el.x2, el.y2)} fill={INK} stroke="none" />
        </g>
      );
    case "pass":
      return (
        <g>
          <path d={`M ${el.x1} ${el.y1} L ${el.x2} ${el.y2}`} {...stroke} strokeDasharray="4 3" />
          <path d={arrowHead(el.x1, el.y1, el.x2, el.y2)} fill={INK} stroke="none" />
        </g>
      );
    case "dribble":
      return (
        <g>
          <path d={wavePath(el.x1, el.y1, el.x2, el.y2)} {...stroke} />
          <path d={arrowHead(el.x1, el.y1, el.x2, el.y2)} fill={INK} stroke="none" />
        </g>
      );
    case "screen":
      return (
        <g>
          <path d={`M ${el.x1} ${el.y1} L ${el.x2} ${el.y2}`} {...stroke} />
          <path d={screenBar(el.x1, el.y1, el.x2, el.y2)} {...stroke} strokeWidth="1.8" />
        </g>
      );
    case "pen": {
      // Live previews skip normalisation, so this is the one place a half-formed stroke
      // can arrive. Rendering nothing beats unmounting the form the coach is filling.
      if (!Array.isArray(el.p) || el.p.length < 4) return null;
      let d = `M ${el.p[0]} ${el.p[1]}`;
      for (let i = 2; i + 1 < el.p.length; i += 2) d += ` L ${el.p[i]} ${el.p[i + 1]}`;
      return <path d={d} {...stroke} />;
    }
    default:
      return null;
  }
}

export function SketchLayer({ elements }) {
  return (
    <g>
      {(elements || []).map((el, i) => (
        <Element key={i} el={el} />
      ))}
    </g>
  );
}

export function viewBoxOf(court) {
  const c = courtOf(court);
  return `${-PAD} ${-PAD} ${c.w + PAD * 2} ${c.h + PAD * 2}`;
}

// The diagram as it appears inside the plan — no interaction, no chrome.
export function CourtSketchView({ sketch, className = "", title }) {
  const s = normalizeSketch(sketch);
  if (!s) return null;
  return (
    <svg
      viewBox={viewBoxOf(s.court)}
      className={className}
      role="img"
      aria-label={title || `שרטוט על ${COURTS[s.court].label}`}
      style={{ background: "#fff" }}
    >
      <CourtMarkings court={s.court} />
      <SketchLayer elements={s.el} />
    </svg>
  );
}

// A court in the size of a text icon, for the button that opens the editor.
export function CourtGlyph({ size = 14, className = "" }) {
  return (
    <svg viewBox="0 0 16 15" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
      <rect x="1" y="1" width="14" height="13" rx="1" />
      <path d="M 5.5 1 L 5.5 5 L 10.5 5 L 10.5 1" />
      <path d="M 3 1 A 5 5 0 0 0 13 1" />
    </svg>
  );
}
