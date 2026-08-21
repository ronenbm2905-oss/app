/**
 * שדה טקסט עם תווית קשורה והודעת שגיאה נגישה.
 *
 * ה-`id` נדרש ולא נוצר אוטומטית, כדי שהקשר `label`↔`input` יהיה מפורש ובר-בדיקה.
 * שדות סיסמה מקבלים `dir="ltr"` עם יישור לימין: הסיסמה עצמה לטינית, אבל המסך RTL.
 */

import type { InputHTMLAttributes, ReactNode, Ref } from 'react';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  /**
   * ref ל-input עצמו. ב-React 19 `ref` הוא prop רגיל של קומפוננטת פונקציה,
   * ולכן אין כאן `forwardRef` — הוא נכנס ל-`rest` ונפרש על ה-input.
   * חלון הדיווח משתמש בו כדי למקד את שדה הכמות ברגע שהוא נפתח.
   */
  ref?: Ref<HTMLInputElement>;
  label: string;
  /** הודעת שגיאה מתורגמת. קיומה מסמן את השדה כלא-תקין. */
  error?: string | null;
  /** טקסט עזר קבוע מתחת לשדה. */
  hint?: ReactNode;
  /** כופה כיוון LTR — לשם משתמש ולסיסמה, שהם תמיד לטיניים. */
  latin?: boolean;
}

export function TextField({
  id,
  label,
  error,
  hint,
  latin = false,
  className = '',
  ...rest
}: TextFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>

      <input
        id={id}
        dir={latin ? 'ltr' : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={[
          'block min-h-[44px] w-full rounded-xl border bg-white px-3 py-2.5 text-base',
          'text-slate-900 placeholder:text-slate-400',
          'focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-slate-900',
          latin ? 'text-start' : '',
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
