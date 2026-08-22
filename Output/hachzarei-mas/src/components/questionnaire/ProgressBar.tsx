interface Props {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: Props) {
  const pct = Math.round((current / total) * 100);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm text-muted">
        {/* aria-live כדי שקורא מסך ידווח על ההתקדמות בלי לגנוב פוקוס */}
        <span aria-live="polite">
          שאלה {current} מתוך {total}
        </span>
        <span aria-hidden="true">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-label="התקדמות בשאלון"
        className="h-1.5 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
