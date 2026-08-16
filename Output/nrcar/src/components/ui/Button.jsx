import { Loader2 } from "lucide-react";

// ============================================================================
// Button — מקור: itai/Outputs/2026-08-13-nrcar-design.md §5.1.
// **לא הועתק מ-fleet**: שם הכפתורים הם text-xs/text-sm ו-slate-400, וכולם
// נופלים בסריקה הסטטית. מבנה הקבצים והחתימה — כן; המחלקות — מהמפרט.
//
// שני גדלים בלבד. סקאלה בת שלושה גדלים היא הזמנה ל-text-sm על כפתור.
// ⚠️ **אסור כפתור אייקון בלי טקסט.** אם אין מקום לטקסט — אין מקום לכפתור.
// זה גם מה שמייתר aria-label, שהוא הכשל שחזר בפרויקטים קודמים.
// ============================================================================

const VARIANTS = {
  // לבן על #1d4ed8 = 6.70:1 ✓
  primary: "bg-brand-600 text-white border-brand-600 hover:bg-brand-700 active:bg-brand-800",
  // 6.70:1 ✓ · גבול line 4.76:1 ✓
  secondary: "bg-surface text-brand-600 border-2 border-line hover:bg-brand-50 active:bg-brand-100",
  quiet: "bg-transparent text-brand-600 border-transparent underline underline-offset-4",
  // אדום = חירום בלבד. לא לשגיאת טופס, לא ל"מחיקה" רגילה, לא לקישוט.
  emergency: "bg-surface text-danger-600 border-2 border-danger-600 hover:bg-danger-50",
  // 5.48:1 ✓
  confirm: "bg-ok-600 text-white border-ok-600 hover:bg-ok-700",
};

const SIZES = {
  lg: "w-full min-h-14 px-6 text-lg font-semibold", // 63px — פעולה ראשית
  md: "min-h-12 px-4 text-lg font-medium", // 54px — פעולה משנית
};

export function Button({
  variant = "primary",
  size = "lg",
  className = "",
  type = "button",
  loading = false,
  loadingLabel = null,
  disabled = false,
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border transition
        disabled:opacity-60 disabled:cursor-not-allowed
        ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.lg} ${className}`}
      {...rest}
    >
      {/* מצב טעינה: הכפתור **לא** מתכווץ, והתווית מתחלפת לטקסט אנושי. */}
      {loading && <Loader2 size={24} className="animate-spin" aria-hidden="true" />}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
}

// כפתור שהוא קישור (ניווט hash). אותה טיפוגרפיה ואותו יעד מגע.
export function LinkButton({ href, variant = "primary", size = "lg", className = "", children, ...rest }) {
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border transition
        ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.lg} ${className}`}
      {...rest}
    >
      {children}
    </a>
  );
}

export default Button;
