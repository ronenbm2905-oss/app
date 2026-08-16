const TONES = {
  neutral: "bg-paper text-ink-soft border-paper-line",
  accent: "bg-accent-soft text-accent border-accent/20",
  good: "bg-good-soft text-good border-good/20",
  warn: "bg-warn-soft text-warn border-warn/20",
  danger: "bg-danger-soft text-danger border-danger/20",
};

export function Badge({ tone = "neutral", children, title }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
        TONES[tone] || TONES.neutral
      }`}
    >
      {children}
    </span>
  );
}
