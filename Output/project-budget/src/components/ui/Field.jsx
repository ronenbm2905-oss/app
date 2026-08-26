// רכיבי טופס בסיסיים: Field (label+input), Select, Checkbox, Textarea.
// מערכת העיצוב: גבול מלא hairline, focus brand-blue, label קליל.
// כולם נגישים (label מקושר ל-id), עובדים RTL/LTR מעצם הזרימה של הדוקומנט.
import { useId } from "react";

const LABEL = "text-[13px] font-semibold font-ui text-ink-body";
const CONTROL =
  "w-full rounded-sm border border-border bg-white px-3 py-2 text-sm text-navy outline-none focus:border-accent focus-visible:shadow-focus placeholder:text-ink-faint disabled:bg-surface-alt disabled:text-ink-muted";

export function Field({ label, value, onChange, type = "text", placeholder, hint, required, disabled }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={LABEL}>
        {label}
        {required && <span className="text-danger-text"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={CONTROL}
      />
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </div>
  );
}

export function Select({ label, value, onChange, options, disabled, required }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className={LABEL}>
          {label}
          {required && <span className="text-danger-text"> *</span>}
        </label>
      )}
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={CONTROL}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Checkbox({ label, checked, onChange, disabled }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-ink-body">
      <input
        id={id}
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded-sm border-border text-navy focus-visible:shadow-focus"
      />
      {label}
    </label>
  );
}

export function Textarea({ label, value, onChange, rows = 3, disabled, placeholder }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className={LABEL}>
          {label}
        </label>
      )}
      <textarea
        id={id}
        rows={rows}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`${CONTROL} min-h-[88px]`}
      />
    </div>
  );
}
