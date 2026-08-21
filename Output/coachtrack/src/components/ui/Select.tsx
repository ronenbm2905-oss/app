/**
 * בורר עם תווית קשורה.
 *
 * אותה מוסכמה כמו ב-`TextField`: ה-`id` נדרש ולא נוצר אוטומטית, כדי שהקשר
 * `label`↔`select` יהיה מפורש ובר-בדיקה. גובה 44px למגע בטלפון.
 */

import type { ReactNode, SelectHTMLAttributes } from 'react';

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}

export function SelectField({
  id,
  label,
  hint,
  error,
  className = '',
  children,
  ...rest
}: SelectFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>

      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={[
          'block min-h-[44px] w-full rounded-xl border bg-white px-3 py-2.5 text-base',
          'text-slate-900',
          'focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-slate-900',
          error ? 'border-red-500' : 'border-slate-300',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {children}
      </select>

      {hint ? (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
