/**
 * מסגרת המסכים המחוברים: כותרת עליונה עם זהות המשתמש וכפתור התנתקות,
 * תפריט ניווט לתפקיד שיש לו יותר ממסך אחד, ותוכן מתחתיהם.
 *
 * הכותרת מציגה את התפקיד כטקסט. זו לא הרשאה — ההרשאה נאכפת ב-`firestore.rules` —
 * אלא אמצעי כדי שרונן יראה בעין שהתפקיד נקרא נכון ממסמך `users/{uid}`.
 *
 * התפריט נבנה מ-`navItemsForRole` ולא מרשימה מקומית, כדי שלא ייווצר מצב שבו
 * מופיע בו קישור לנתיב שלא רשום ב-`App.tsx`.
 */

import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { t } from '../i18n/he';
import type { TranslationKey } from '../i18n/he';
import { navItemsForRole } from '../lib/routing';
import { Button } from './ui/Button';

interface AppShellProps {
  title: string;
  children: ReactNode;
}

export function AppShell({ title, children }: AppShellProps) {
  const { profile, signOut } = useAuth();
  const roleKey = profile ? (`roles.${profile.role}` as TranslationKey) : null;
  const navItems = profile ? navItemsForRole(profile.role) : [];

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

        {/* תפריט רק כשיש לאן לנווט. גלילה אופקית כדי שלא יישבר ב-375px. */}
        {navItems.length > 1 ? (
          <nav className="mx-auto max-w-3xl overflow-x-auto px-2 pb-2">
            <ul className="flex gap-1">
              {navItems.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end
                    className={({ isActive }) =>
                      [
                        'block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      ].join(' ')
                    }
                  >
                    {t(item.labelKey)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <div className="mt-4">{children}</div>
      </main>
    </div>
  );
}
