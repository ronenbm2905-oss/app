/**
 * מסך הבית של ה-admin — כותרת בלבד בשלב 1.
 *
 * ה-admin לא מקבל את הדשבורד של המאמן כי הוא אינו מאמן של אף קבוצה:
 * `teams.coachUid` מצביע על המאמן ו-`teamIds` שלו ריק, ולכן דשבורד קבוצה
 * לא היה מוצא לו מה להציג. תפקידו ניהול הארגון והספרייה הגלובלית (שלב 2).
 */

import { AppShell } from '../../components/AppShell';
import { PlaceholderPage } from '../../components/PlaceholderPage';
import { t } from '../../i18n/he';

export function AdminHomePage() {
  return (
    <AppShell title={t('admin.home.title')}>
      <PlaceholderPage />
    </AppShell>
  );
}
