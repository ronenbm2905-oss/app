const VARIANTS = {
  primary: "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 border-rose-600",
  secondary: "bg-white text-ink hover:bg-sand border-line",
  ghost: "bg-transparent text-ink hover:bg-sand border-transparent",
  whatsapp: "bg-[#128C7E] text-white hover:bg-[#0F6F64] border-[#128C7E]",
  danger: "bg-white text-red-700 hover:bg-red-50 border-red-300",
};

const SIZES = {
  // min-h-11 = 44px — יעד המגע המינימלי של WCAG 2.5.5.
  md: "min-h-11 px-4 text-base",
  lg: "min-h-12 px-6 text-base sm:text-lg",
  sm: "min-h-9 px-3 text-sm",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export default function Button({
  as = "button",
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) {
  const Tag = as;
  const cls = `${BASE} ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${className}`;
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
