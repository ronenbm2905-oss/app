/**
 * מסך כשל טעינה — מוצג כשעץ האפליקציה בכלל לא הצליח להיטען.
 * המקרה המעשי היחיד: קונפיג Firebase חסר (build שנעשה בלי .env.local).
 *
 * הקומפוננטה הזו לא נוגעת ב-Firebase ולא ב-Router, כדי שתמיד תוכל להיטען.
 */

import { t } from '../i18n/he';

export function FatalScreen({ detail }: { detail: string }) {
  return (
    <main className="flex min-h-screen flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-red-200 bg-red-50 p-5">
        <h1 className="text-lg font-bold text-red-900">{t('errors.configMissing')}</h1>
        <p className="mt-2 whitespace-pre-wrap text-sm text-red-800">{detail}</p>
      </div>
    </main>
  );
}
