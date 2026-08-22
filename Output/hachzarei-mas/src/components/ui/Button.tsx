import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'choice';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  selected?: boolean;
}

/** כל אזור מגע לפחות 48px גובה, וטקסט 17px ומעלה (§8.1) */
const styles: Record<Variant, string> = {
  primary:
    'w-full bg-brand text-white font-semibold hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed',
  ghost: 'text-muted hover:text-ink underline underline-offset-4 font-normal',
  choice:
    'w-full bg-white border-2 text-right font-semibold hover:border-brand hover:bg-surface',
};

export function Button({ variant = 'primary', selected, className = '', ...rest }: Props) {
  const base =
    variant === 'ghost'
      ? 'inline-flex min-h-touch items-center gap-1 py-2'
      : 'inline-flex items-center justify-center min-h-touch rounded-xl px-5 py-3 text-base transition-colors';

  const selection =
    variant === 'choice'
      ? selected
        ? 'border-brand bg-surface'
        : 'border-line'
      : '';

  return <button className={`${base} ${styles[variant]} ${selection} ${className}`} {...rest} />;
}
