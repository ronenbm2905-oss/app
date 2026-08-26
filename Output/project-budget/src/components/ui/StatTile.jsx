import { fmtILS, fmtNum } from "../../utils/money.js";

const TONES = {
  default: "border-border bg-white",
  warning: "border-warning-solid/40 bg-warning-fill",
  danger: "border-danger-solid/40 bg-danger-fill",
  success: "border-success-solid/40 bg-success-fill",
};

const VALUE_TONES = {
  default: "text-navy",
  warning: "text-warning-text",
  danger: "text-danger-text",
  success: "text-success-text",
};

/**
 * אריח מדד. `raw` = הצג כמספר ולא כמטבע (למשל ספירת חשבוניות) —
 * הצגת "3 ₪" במקום "3" היא טעות קריאה, לא רק אסתטיקה.
 */
export default function StatTile({ label, value, hint, tone = "default", raw = false }) {
  return (
    <div className={`rounded-lg border p-4 ${TONES[tone]}`}>
      <div className="text-eyebrow uppercase text-ink-muted">{label}</div>
      <div className={`num mt-1.5 text-stat ${VALUE_TONES[tone]}`}>
        {raw ? fmtNum(value) : fmtILS(value)}
      </div>
      {hint && <div className="mt-1 text-xs text-ink-muted">{hint}</div>}
    </div>
  );
}
