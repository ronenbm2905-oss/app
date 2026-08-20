/** מסך טעינה מלא — מצב הביניים בין onAuthStateChanged לבין טעינת מסמך users. */

import { t } from '../../i18n/he';

interface FullScreenLoaderProps {
  /** מה בדיוק נטען. ברירת המחדל היא "טוען…". */
  label?: string;
}

export function FullScreenLoader({ label }: FullScreenLoaderProps) {
  const text = label ?? t('common.loading');

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-3 px-4"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"
      />
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}
