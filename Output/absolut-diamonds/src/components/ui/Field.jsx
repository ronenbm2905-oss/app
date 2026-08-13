import { useId } from "react";

// ============================================================================
// שדה טופס נגיש: label מקושר, שגיאה מקושרת ב-aria-describedby, aria-invalid.
// שגיאה בלי הקישור הזה פשוט לא קיימת עבור קורא מסך.
//
// עיצוב: התווית **תמיד מעל** — לעולם לא placeholder כתווית (O5.6).
// גבול הרכיב הוא `line.strong` ולא `line`: `line` נותן 1.23:1 ונכשל ב-1.4.11.
// שגיאה = גבול danger + `.flag` + טקסט — שלושה ערוצים, לא צבע בלבד.
// ============================================================================

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
          <span className="text-ink" aria-hidden="true">
            {" *"}
          </span>
        ) : null}
      </label>
      {children({ id, "aria-invalid": error ? "true" : undefined, "aria-describedby": describedBy })}
      {hint ? (
        <p id={hintId} className="mt-2 text-meta text-muted">
          {hint}
        </p>
      ) : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

export function FieldError({ id, children }) {
  return (
    <p id={id} className="flag flag-danger mt-2 text-meta font-medium text-danger">
      {children}
    </p>
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

// תיבת סימון: **ריבוע**, radius 0, גבול line.strong. מסומן = מילוי ink.
// `accent-color` נותן את המילוי הזה בלי לזייף checkbox מ-div.
export function Checkbox({ label, id: idProp, error, ...props }) {
  const autoId = useId();
  const id = idProp || autoId;
  const errorId = `${id}-err`;
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0 rounded-none border border-line-strong accent-ink"
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />
        {/* טקסט הסכמה הוא 15px `ink` ולא `muted` — הוא יוצר תוקף משפטי,
            הוא לא "משני". */}
        <label htmlFor={id} className="text-spec text-ink">
          {label}
        </label>
      </div>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}
