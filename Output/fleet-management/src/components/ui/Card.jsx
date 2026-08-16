export function Card({ title, action, children, className = "", padded = true }) {
  return (
    <section className={`rounded-md border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {action}
        </header>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="max-w-md text-xs text-slate-500">{hint}</p>}
      {action}
    </div>
  );
}

export function Stat({ label, value, tone = "slate", sub }) {
  const toneCls = {
    slate: "text-slate-900",
    red: "text-red-700",
    amber: "text-amber-700",
    green: "text-emerald-700",
    blue: "text-brand-700",
  }[tone];
  return (
    <div className="rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export default Card;
