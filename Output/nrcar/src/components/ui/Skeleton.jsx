// ============================================================================
// Skeleton — מקור: itai/Outputs/2026-08-13-nrcar-design.md §7.2.
//
// **בלי מסך ספינר.** Skeletons בצורת התוכן האמיתי, ולצדם **שורת טקסט אנושית**
// עם aria-live="polite": משתמש מבוגר צריך מילים, לא אנימציה.
// ה-pulse מכובה אוטומטית תחת prefers-reduced-motion (index.css).
// ============================================================================

export function Skeleton({ className = "" }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function LoadingBlock({ label, lines = 3, className = "" }) {
  return (
    <div className={`space-y-4 ${className}`}>
      <p className="text-lg text-ink-muted" aria-live="polite">
        {label}
      </p>
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={i === 0 ? "h-[200px]" : i === 1 ? "h-6 w-2/3" : "h-5 w-1/3"} />
        ))}
      </div>
    </div>
  );
}

export default Skeleton;
