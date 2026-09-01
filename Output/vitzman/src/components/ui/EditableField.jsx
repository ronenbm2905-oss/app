import { useEffect, useRef, useState } from "react";

/**
 * שדה שנערך במקום.
 *
 * לחיצה הופכת את הערך לשדה קלט; `Enter` או יציאה שומרים, `Escape` מבטל.
 * המטרה היא שעריכה תהיה זולה כמו קריאה — 131 בניינים × 6 שדות זה הרבה
 * מסכי-עריכה נפרדים אם כל שינוי דורש טופס.
 *
 * `readOnly` נאכף כאן ולא רק בקורא: כשמסתכלים על תאריך עבר, שום שדה לא נפתח.
 */
export function EditableField({
  value,
  onSave,
  type = "text",          // text | number | select | checkbox
  options = [],           // ל-select: [{ value, label }]
  placeholder = "—",
  readOnly = false,
  validate,               // (v) => { ok, reason }
  className = "",
  title,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [error, setError] = useState("");
  const ref = useRef(null);

  useEffect(() => { if (!editing) setDraft(value ?? ""); }, [value, editing]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  // סימון ובחירה נשמרים מיד — אין להם "טיוטה" שצריך לאשר.
  if (type === "checkbox") {
    return (
      <label className={`inline-flex cursor-pointer items-center gap-1.5 text-sm ${readOnly ? "cursor-not-allowed opacity-60" : ""} ${className}`} title={title}>
        <input type="checkbox" checked={!!value} disabled={readOnly}
          onChange={(e) => onSave(e.target.checked)} className="cursor-pointer" />
        {placeholder}
      </label>
    );
  }

  if (type === "select") {
    return (
      <select
        value={value ?? ""}
        disabled={readOnly}
        title={title}
        onChange={(e) => onSave(e.target.value || null)}
        className={`rounded border border-transparent bg-transparent px-1.5 py-0.5 text-sm
          hover:border-slate-300 hover:bg-white focus:border-slate-400 focus:bg-white focus:outline-none
          disabled:cursor-not-allowed disabled:hover:border-transparent ${className}`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  const commit = () => {
    const next = type === "number" ? Number(String(draft).replace(/,/g, "")) : String(draft).trim();
    if (type === "number" && !Number.isFinite(next)) { setError("לא מספר"); return; }
    const v = validate?.(next);
    if (v && !v.ok) { setError(v.reason); return; }
    setError("");
    setEditing(false);
    if (next !== (value ?? "")) onSave(next);
  };

  if (!editing) {
    return (
      <button
        type="button"
        disabled={readOnly}
        title={title || (readOnly ? "צפייה בתאריך עבר — קריאה בלבד" : "לחץ לעריכה")}
        onClick={() => setEditing(true)}
        className={`rounded border border-transparent px-1.5 py-0.5 text-right text-sm
          hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:hover:border-transparent
          ${value ? "" : "text-slate-400"} ${className}`}
      >
        {value || placeholder}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col">
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(value ?? ""); setError(""); setEditing(false); }
        }}
        className={`rounded border border-slate-400 px-1.5 py-0.5 text-sm ${type === "number" ? "tnum" : ""} ${className}`}
      />
      {error && <span className="mt-0.5 text-[11px] text-red-700">{error}</span>}
    </span>
  );
}
