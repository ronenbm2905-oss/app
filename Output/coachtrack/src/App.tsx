import { t } from './i18n/he';

/**
 * שלב 0 — דף בדיקה בלבד.
 * מטרתו לאמת RTL, פונט עברי ו-Tailwind. הראוטים האמיתיים נבנים בשלב 1.
 */
function App() {
  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-md">
        <h1 className="text-3xl font-bold">{t('common.appName')}</h1>
        <p className="mt-2 text-slate-600">{t('common.tagline')}</p>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">שלב 0 — הקמה</p>
          <ul className="mt-3 space-y-1 text-sm">
            <li className="flex items-center gap-2">
              <span aria-hidden="true">•</span>
              <span>הטקסט הזה מיושר לימין — כיוון RTL פעיל</span>
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden="true">•</span>
              <span>הפונט הוא Rubik</span>
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden="true">•</span>
              <span>המחרוזות נטענות מ-src/i18n/he.ts</span>
            </li>
          </ul>
          <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-500">
            בדיקת מספרים ביחידות: 300 {t('units.count')} · 20 {t('units.minutes')}
          </p>
        </div>
      </div>
    </main>
  );
}

export default App;
