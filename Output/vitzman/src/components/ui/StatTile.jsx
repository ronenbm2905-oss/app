/**
 * אריח מדד. `hint` נועד לנשיאת ההסתייגות ליד המספר ולא בהערת שוליים —
 * מספר שהוא אומדן חייב לומר זאת במקום שבו קוראים אותו.
 */
export function StatTile({ label, value, hint, tone = "neutral", className = "" }) {
  const tones = {
    neutral: "text-slate-900",
    good: "text-emerald-700",
    warn: "text-amber-700",
    bad: "text-red-700",
  };
  return (
    <div className={`card p-4 ${className}`}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tnum ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs leading-snug text-slate-500">{hint}</div>}
    </div>
  );
}
