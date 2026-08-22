/**
 * תיבת סימון עם תווית — כרגע יש בדיוק אחת באפליקציה: אישור הסכמת ההורה
 * בטופס הוספת שחקן (`features/coach/AddPlayerForm.tsx`).
 *
 * שתי החלטות נגישות שקל לפספס:
 * • התווית עוטפת את התיבה ו**גם** מקושרת ב-`htmlFor`, כך שהקלקה על הטקסט מסמנת.
 * • שטח המגע הוא לפחות 44px גם כשהתיבה עצמה 20px — הכלל המובייל-פירסט של
 *   CLAUDE.md חל גם על תיבת סימון, שהיא הרכיב הכי קל לפספס באצבע.
 *
 * `hint` מוצג מתחת לתווית ומקושר ב-`aria-describedby`, כדי שקורא מסך יקריא
 * *למה* התיבה חובה ולא רק שהיא קיימת.
 */

import type { InputHTMLAttributes, ReactNode } from 'react';

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
}

export function CheckboxField({ id, label, hint, className = '', ...rest }: CheckboxFieldProps) {
  const hintId = `${id}-hint`;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="flex min-h-[44px] cursor-pointer items-start gap-3 py-1 text-sm text-slate-700"
      >
        <input
          id={id}
          type="checkbox"
          aria-describedby={hint ? hintId : undefined}
          className={[
            'mt-0.5 h-5 w-5 shrink-0 rounded border-slate-400 text-slate-900',
            'focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-slate-900',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />
        <span>{label}</span>
      </label>

      {hint ? (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
