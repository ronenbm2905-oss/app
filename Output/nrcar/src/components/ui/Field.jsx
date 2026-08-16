import { useId } from "react";
import { AlertCircle } from "lucide-react";

// ============================================================================
// Field — מקור: itai/Outputs/2026-08-13-nrcar-design.md §5.4.
//
// **התווית תמיד גלויה מעל השדה. בלי placeholder-כתווית** — הוא נעלם ברגע
// שמקלידים, וזה כשל מוכר אצל משתמשים מבוגרים.
// שגיאה אומרת **מה לעשות**, לא "שדה חובה".
// ============================================================================

const inputCls =
  "w-full h-14 rounded-xl border-2 border-line bg-surface px-4 text-lg text-ink " +
  "placeholder:text-ink-muted focus:border-brand-600 disabled:opacity-60";

export function Field({ label, hint, error, required, children, htmlFor, className = "" }) {
  const generated = useId();
  const id = htmlFor || generated;
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  return (
    <div className={`space-y-2 ${className}`}>
      <label htmlFor={id} className="block text-base font-medium text-ink-soft">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {typeof children === "function"
        ? children({ id, "aria-describedby": error ? errId : hint ? hintId : undefined })
        : children}
      {hint && !error && (
        <p id={hintId} className="max-w-prose text-base text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="flex items-center gap-2 text-base text-danger-700">
          <AlertCircle size={20} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({ className = "", invalid = false, ...rest }) {
  return (
    <input
      className={`${inputCls} ${invalid ? "border-danger-600" : ""} ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

// מספרים ותאריכים — dir="ltr" מפורש + `.num`, אחרת המקפים מתהפכים ב-RTL.
export function NumberInput({ className = "", ...rest }) {
  return <input type="text" inputMode="numeric" dir="ltr" className={`${inputCls} num ${className}`} {...rest} />;
}

export function DateInput({ className = "", ...rest }) {
  return <input type="date" dir="ltr" className={`${inputCls} num ${className}`} {...rest} />;
}

export function PhoneInput({ className = "", ...rest }) {
  return <input type="tel" dir="ltr" className={`${inputCls} num ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }) {
  return (
    <select className={`${inputCls} ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function TextArea({ className = "", rows = 3, ...rest }) {
  return <textarea rows={rows} className={`${inputCls} h-auto py-3 ${className}`} {...rest} />;
}

// מתג — 4.1.2 (שם/תפקיד/ערך) הוא הכשל מספר 1 באפליקציית React, והמתגים
// בהגדרות הם המקום המובהק שלו. role="switch" + aria-checked, לא div מעוצב.
export function Switch({ checked, onChange, label, hint, disabled = false, className = "" }) {
  const id = useId();
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="space-y-1">
        <label htmlFor={id} className="block text-lg text-ink">
          {label}
        </label>
        {hint && <p className="max-w-prose text-base text-ink-muted">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={`relative h-12 w-[72px] shrink-0 rounded-full border-2 transition
          ${checked ? "border-brand-600 bg-brand-600" : "border-line bg-surface-sunken"}
          disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-1 h-8 w-8 rounded-full bg-surface shadow-card transition-all
            ${checked ? "start-1" : "end-1"}`}
        />
      </button>
    </div>
  );
}

export default Field;
