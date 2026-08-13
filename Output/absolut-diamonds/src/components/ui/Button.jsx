// ============================================================================
// Button — שלוש רמות היררכיה, כמו בשפה: מלא / מסגרת / קו-תחתון.
// radius 0, בלי צל, בלי צבע. `primary`(rose) ו-`whatsapp`(ירוק) ירדו.
//
// focus-visible: על `filled` ה-outline הכהה בלתי-נראה על מילוי ink — לכן
// `.on-ink` מחליף אותו ל-paper (ראה index.css).
// ============================================================================

const VARIANTS = {
  filled: "on-ink bg-ink text-paper hover:bg-ink-80 active:bg-[#2C2825]",
  outline: "border border-ink text-ink hover:bg-ink hover:text-paper",
  link: "text-ink border-b border-current pb-1 hover:border-gold hover:text-ink-80",
  // 🔴 מסך הניהול בלבד. לא באתר הפומבי.
  danger: "border border-danger text-danger hover:bg-danger hover:text-paper",
};

// תאימות לאחור: השמות הישנים ממופים להיררכיה החדשה במקום להישבר בשקט.
const ALIASES = { primary: "filled", secondary: "outline", ghost: "link", whatsapp: "filled" };

const SIZES = {
  // גובה כפתור 48px מובייל / 52px דסקטופ (יעד מגע WCAG 2.5.5 בנוי פנימה).
  md: "min-h-12 px-6 lg:min-h-[3.25rem]",
  lg: "min-h-12 px-8 lg:min-h-[3.25rem]",
  sm: "min-h-11 px-4",
  // `link` לא צריך גובה כפתור — הוא טקסט עם קו.
  none: "min-h-0 px-0",
};

const BASE =
  "inline-flex items-center justify-center gap-2 text-button font-medium transition-colors duration-hover " +
  "disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-muted";

export default function Button({
  as = "button",
  variant = "filled",
  size,
  className = "",
  children,
  ...props
}) {
  const Tag = as;
  const v = ALIASES[variant] || variant;
  const s = size || (v === "link" ? "none" : "md");
  const cls = `${BASE} ${VARIANTS[v] || VARIANTS.filled} ${SIZES[s] || SIZES.md} ${className}`;
  // תגית <a> בלי href אינה ניתנת למיקוד — נופלים ל-<button> כדי לא לייצר
  // "כפתור" שהמקלדת לא מגיעה אליו.
  if (Tag === "a" && !props.href) {
    return (
      <button type="button" className={cls} {...props}>
        {children}
      </button>
    );
  }
  if (Tag === "button" && !props.type) props.type = "button";
  return (
    <Tag className={cls} {...props}>
      {children}
    </Tag>
  );
}
