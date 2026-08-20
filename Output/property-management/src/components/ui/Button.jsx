// כפתורים — מערכת העיצוב של האפליקציה (סגנון navy תאגידי).
// primary=navy fill · secondary=navy outline (מתהפך ב-hover) · danger · ghost · onNavy=brand-blue.
const VARIANTS = {
  primary: "bg-navy text-white hover:bg-link",
  secondary: "border border-navy text-navy bg-transparent hover:bg-navy hover:text-white",
  danger: "bg-danger-fill text-danger-text hover:brightness-95",
  ghost: "text-ink-body hover:bg-surface-sunk",
  onNavy: "bg-accent text-navy hover:bg-accent-light", // CTA על TopBar / אזור כהה
};

export function Button({ variant = "primary", children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-sm px-4 py-2 text-sm font-semibold font-sans transition disabled:opacity-50 focus-visible:shadow-focus focus-visible:outline-none ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// תג סטטוס צבעוני — שמות ה-tone נשמרים (green/red/amber/blue/slate),
// ממופים לצבעים הסמנטיים של המערכת (success/danger/warning/info/neutral).
const PILL_TONES = {
  green: "bg-success-fill text-success-text",
  red: "bg-danger-fill text-danger-text",
  amber: "bg-warning-fill text-warning-text",
  blue: "bg-info-fill text-info-text",
  slate: "bg-surface-sunk text-ink-body",
};

export function Pill({ tone = "slate", children }) {
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold font-ui ${PILL_TONES[tone]}`}>
      {children}
    </span>
  );
}
