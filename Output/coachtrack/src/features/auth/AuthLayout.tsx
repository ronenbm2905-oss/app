/** מסגרת משותפת למסכי האימות: כותרת, כרטיס ממורכז, רוחב נוח ל-375px. */

import type { ReactNode } from 'react';
import { t } from '../../i18n/he';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** טקסט עזר בתחתית המסך. */
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <header className="mb-6 text-center">
          <p className="text-sm font-medium tracking-wide text-slate-500">{t('common.appName')}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-slate-600">{subtitle}</p> : null}
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{children}</div>

        {footer ? <div className="mt-4 text-center text-xs text-slate-500">{footer}</div> : null}
      </div>
    </main>
  );
}
