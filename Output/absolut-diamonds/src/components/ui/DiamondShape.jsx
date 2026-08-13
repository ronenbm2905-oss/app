// ============================================================================
// DiamondShape — איור סכמטי של צורת הליטוש.
//
// 🔴 הנחיית עדי (2026-08-13): תמונת **דגם** לגיטימית. תמונת **אבן ספציפית**
// רגישה — אבן עם 4C + מספר תעודת IGI + מחיר לא יכולה להיות תמונת סטוק, כי
// היא משתמעת כצילום של האבן עצמה (פרסום מטעה).
//
// לכן ברירת המחדל לאבן היא **איור סכמטי מפורש** ולא תצלום מתחזה. אם לאבן יש
// `images[]` אמיתיות — מציגים אותן במקום (הרכיב הקורא מחליט).
//
// המימוש: קו מתאר לכל צורה + "טבלה" פנימית (אותו קו מוקטן) + קווי מחבר.
// זה נראה כמו יהלום, וברור שזה שרטוט.
// ============================================================================

const OUTLINES = {
  round: <circle cx="50" cy="50" r="43" />,
  oval: <ellipse cx="50" cy="50" rx="31" ry="45" />,
  princess: <rect x="9" y="9" width="82" height="82" rx="2" />,
  cushion: <rect x="9" y="9" width="82" height="82" rx="22" />,
  emerald: <polygon points="34,5 66,5 79,18 79,82 66,95 34,95 21,82 21,18" />,
  asscher: <polygon points="31,7 69,7 93,31 93,69 69,93 31,93 7,69 7,31" />,
  radiant: <polygon points="30,9 70,9 87,26 87,74 70,91 30,91 13,74 13,26" />,
  pear: <path d="M50 4 C68 25 86 45 86 62 A36 36 0 0 1 14 62 C14 45 32 25 50 4 Z" />,
  marquise: <path d="M50 3 C70 25 79 50 79 50 C79 50 70 75 50 97 C30 75 21 50 21 50 C21 50 30 25 50 3 Z" />,
  heart: <path d="M50 93 C18 68 6 53 6 37 A21 21 0 0 1 50 27 A21 21 0 0 1 94 37 C94 53 82 68 50 93 Z" />,
};

const CONNECTORS = {
  round: "M50 7 L50 27 M93 50 L73 50 M50 93 L50 73 M7 50 L27 50",
  oval: "M50 5 L50 27 M81 50 L69 50 M50 95 L50 73 M19 50 L31 50",
  princess: "M9 9 L31 31 M91 9 L69 31 M91 91 L69 69 M9 91 L31 69",
  cushion: "M20 20 L34 34 M80 20 L66 34 M80 80 L66 66 M20 80 L34 66",
  emerald: "M34 5 L40 25 M66 5 L60 25 M34 95 L40 75 M66 95 L60 75",
  asscher: "M31 7 L38 22 M69 7 L62 22 M69 93 L62 78 M31 93 L38 78",
  radiant: "M30 9 L37 24 M70 9 L63 24 M70 91 L63 76 M30 91 L37 76",
  pear: "M50 4 L50 26 M86 62 L68 60 M50 98 L50 76 M14 62 L32 60",
  marquise: "M50 3 L50 26 M79 50 L67 50 M50 97 L50 74 M21 50 L33 50",
  heart: "M6 37 L26 44 M50 27 L50 45 M94 37 L74 44 M50 93 L50 72",
};

export default function DiamondShape({ shape = "round", className = "", title, size }) {
  const outline = OUTLINES[shape] || OUTLINES.round;
  const connectors = CONNECTORS[shape] || CONNECTORS.round;

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      width={size}
      height={size}
      role={title ? "img" : "presentation"}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : "true"}
      focusable="false"
    >
      <defs>
        <linearGradient id={`ds-${shape}`} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="45%" stopColor="#EAF4FA" />
          <stop offset="100%" stopColor="#C7DEED" />
        </linearGradient>
      </defs>
      <g fill={`url(#ds-${shape})`} stroke="#7E99AA" strokeWidth="2.2" strokeLinejoin="round">
        {outline}
      </g>
      {/* הטבלה — אותו קו מתאר, מוקטן למרכז */}
      <g
        fill="none"
        stroke="#7E99AA"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.85"
        transform="translate(50 50) scale(0.5) translate(-50 -50)"
      >
        {outline}
      </g>
      <path d={connectors} fill="none" stroke="#7E99AA" strokeWidth="1.4" opacity="0.7" />
    </svg>
  );
}
