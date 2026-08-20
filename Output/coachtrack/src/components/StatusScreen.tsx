/**
 * מסך מצב חוסם — לשלושת המצבים שבהם יש משתמש מחובר אבל אי אפשר להמשיך:
 * אין מסמך פרופיל, הפרופיל מושבת, או שקריאת הפרופיל נכשלה.
 *
 * בכל אחד מהם מוצג מוצא אחד: התנתקות. "מסך לבן" הוא לא מצב לגיטימי.
 */

import { Button } from './ui/Button';
import { t } from '../i18n/he';

interface StatusScreenProps {
  title: string;
  body: string;
  /** פעולת יציאה — תמיד התנתקות בשלב הזה. */
  onSignOut: () => void;
  /** ניסיון חוזר, כשיש טעם בו (שגיאת רשת). */
  onRetry?: () => void;
}

export function StatusScreen({ title, body, onSignOut, onRetry }: StatusScreenProps) {
  return (
    <main className="flex min-h-screen flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{body}</p>

        <div className="mt-5 space-y-2">
          {onRetry ? (
            <Button variant="primary" onClick={onRetry}>
              {t('common.retry')}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onSignOut}>
            {t('common.signOut')}
          </Button>
        </div>
      </div>
    </main>
  );
}
