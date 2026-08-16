import { useId } from "react";

const inputCls =
  "w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
  "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 " +
  "disabled:bg-slate-50 disabled:text-slate-500";

export function Field({ label, hint, error, required, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="mb-1 block text-xs font-medium text-slate-600">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function TextInput({ className = "", ...rest }) {
  return <input className={`${inputCls} ${className}`} {...rest} />;
}

export function NumberInput({ className = "", ...rest }) {
  return <input type="number" inputMode="numeric" className={`${inputCls} ${className}`} {...rest} />;
}

export function DateInput({ className = "", ...rest }) {
  // dir=ltr על שדות תאריך/מספר — הדפדפן מציג אותם LTR גם בעמוד RTL.
  return <input type="date" dir="ltr" className={`${inputCls} ${className}`} {...rest} />;
}

export function TimeInput({ className = "", ...rest }) {
  return <input type="time" dir="ltr" className={`${inputCls} ${className}`} {...rest} />;
}

export function TextArea({ className = "", rows = 3, ...rest }) {
  return <textarea rows={rows} className={`${inputCls} ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }) {
  return (
    <select className={`${inputCls} ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({ label, className = "", ...rest }) {
  const id = useId();
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        {...rest}
      />
      <label htmlFor={id} className="text-sm text-slate-700 select-none">
        {label}
      </label>
    </div>
  );
}

export default Field;
