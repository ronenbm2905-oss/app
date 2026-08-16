const TONES = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  red: "bg-red-50 text-red-700 border-red-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  blue: "bg-brand-50 text-brand-700 border-brand-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

export function Pill({ tone = "slate", children, className = "", title }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
        TONES[tone] || TONES.slate
      } ${className}`}
    >
      {children}
    </span>
  );
}

export default Pill;
