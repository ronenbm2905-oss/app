/**
 * מסך ריק עם כותרת בלבד.
 *
 * שלב 1 בונה אימות וניתוב, לא מסכים. הדשבורד ("השבוע שלי", מטריצת המאמן וכו')
 * נבנים בשלבים 2–5, ו-TASKS.md דורש במפורש שעד אז המסכים יישארו ריקים —
 * כדי שקריטריון הסיום ייבדק על הניתוב ולא על תוכן שעוד לא קיים.
 */

import { t } from '../i18n/he';

export function PlaceholderPage() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
      <p className="text-sm text-slate-500">{t('common.comingSoon')}</p>
    </div>
  );
}
