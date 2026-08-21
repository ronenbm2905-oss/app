/** שדה טקסט רב-שורתי — הנחיות הביצוע של תרגיל. אותה מוסכמה כמו `TextField`. */

import type { ReactNode, TextareaHTMLAttributes } from 'react';

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
}

export function TextAreaField({
  id,
  label,
  hint,
  error,
  className = '',
  rows = 4,
  ...rest
}: TextAreaFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>

      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={[
          'block w-full rounded-xl border bg-white px-3 py-2.5 text-base',
          'text-slate-900 placeholder:text-slate-400',
          'focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-slate-900',
          error ? 'border-red-500' : 'border-slate-300',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      />

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
