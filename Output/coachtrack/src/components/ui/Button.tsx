/**
 * כפתור משותף.
 *
 * מובייל-פירסט: גובה מגע 44px לפחות, וברירת המחדל היא רוחב מלא —
 * כך נראה כפתור ראשי במסך של 375px (כלל 2 ב-CLAUDE.md).
 * אין כאן טקסט — המחרוזת מגיעה מבחוץ דרך `t()` (כלל 8).
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** מציג מצב עבודה וחוסם לחיצה כפולה. */
  busy?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-slate-900 text-white hover:bg-slate-800 focus-visible:outline-slate-900 disabled:bg-slate-400',
  secondary:
    'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 focus-visible:outline-slate-900 disabled:text-slate-400',
  ghost:
    'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus-visible:outline-slate-900',
};

export function Button({
  variant = 'primary',
  busy = false,
  fullWidth = true,
  className = '',
  disabled,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      // eslint-disable-next-line react/button-has-type -- הטיפוס מגיע מ-props עם ברירת מחדל בטוחה
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={[
        'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5',
        'text-base font-medium transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed',
        fullWidth ? 'w-full' : '',
        VARIANT_CLASSES[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {busy ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}
