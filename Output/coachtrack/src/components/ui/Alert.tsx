/**
 * הודעת מצב (שגיאה / מידע / הצלחה).
 *
 * שגיאה מקבלת `role="alert"` כדי שקורא מסך יקריא אותה מיד — זו הודעה
 * שהמשתמש חייב לשמוע, למשל "שם המשתמש או הסיסמה שגויים".
 */

import type { ReactNode } from 'react';

type Tone = 'error' | 'info' | 'success';

interface AlertProps {
  tone?: Tone;
  children: ReactNode;
}

const TONE_CLASSES: Record<Tone, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-slate-200 bg-slate-100 text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

export function Alert({ tone = 'info', children }: AlertProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border px-3 py-2.5 text-sm ${TONE_CLASSES[tone]}`}
    >
      {children}
    </div>
  );
}
