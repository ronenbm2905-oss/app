import { useId } from "react";

// שדה טופס נגיש: label מקושר, שגיאה מקושרת ב-aria-describedby, aria-invalid.
// שגיאה בלי הקישור הזה פשוט לא קיימת עבור קורא מסך.
export function Field({ label, error, hint, required, children, id: idProp, className = "" }) {
  const autoId = useId();
  const id = idProp || autoId;
  const errorId = `${id}-err`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {required ? (
          <span className="text-rose-700" aria-hidden="true">
            {" *"}
          </span>
        ) : null}
      </label>
      {children({ id, "aria-invalid": error ? "true" : undefined, "aria-describedby": describedBy })}
      {hint ? (
        <p id={hintId} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({ error, className = "", ...props }) {
  return <input className={`input ${error ? "input-error" : ""} ${className}`} {...props} />;
}

export function TextArea({ error, className = "", ...props }) {
  return <textarea className={`input ${error ? "input-error" : ""} ${className}`} rows={4} {...props} />;
}

export function SelectInput({ error, className = "", children, ...props }) {
  return (
    <select className={`input ${error ? "input-error" : ""} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ label, id: idProp, error, ...props }) {
  const autoId = useId();
  const id = idProp || autoId;
  const errorId = `${id}-err`;
  return (
    <div>
      <div className="flex items-start gap-2.5">
        <input
          id={id}
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0 rounded border-line text-rose-600 focus:ring-rose-600"
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />
        <label htmlFor={id} className="text-sm leading-relaxed text-ink">
          {label}
        </label>
      </div>
      {error ? (
        <p id={errorId} className="mt-1 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
