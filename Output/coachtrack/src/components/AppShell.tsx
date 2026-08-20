/**
 * מסגרת המסכים המחוברים: כותרת עליונה עם זהות המשתמש וכפתור התנתקות, ותוכן מתחתיה.
 *
 * הכותרת מציגה את התפקיד כטקסט. זו לא הרשאה — ההרשאה נאכפת ב-`firestore.rules` —
 * אלא אמצעי כדי שרונן יראה בעין שהתפקיד נקרא נכון ממסמך `users/{uid}`.
 */

import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { t } from '../i18n/he';
import type { TranslationKey } from '../i18n/he';
import { Button } from './ui/Button';

interface AppShellProps {
  title: string;
  children: ReactNode;
}

export function AppShell({ title, children }: AppShellProps) {
  const { profile, signOut } = useAuth();
  const roleKey = profile ? (`roles.${profile.role}` as TranslationKey) : null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {profile ? profile.displayName : t('common.appName')}
            </p>
            {roleKey ? <p className="truncate text-xs text-slate-500">{t(roleKey)}</p> : null}
          </div>

          <Button variant="secondary" fullWidth={false} onClick={() => void signOut()}>
            {t('common.signOut')}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <div className="mt-4">{children}</div>
      </main>
    </div>
  );
}
