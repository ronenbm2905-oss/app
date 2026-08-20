/** דשבורד המאמן — כותרת בלבד בשלב 1. התוכן נבנה בשלב 5. */

import { AppShell } from '../../components/AppShell';
import { PlaceholderPage } from '../../components/PlaceholderPage';
import { t } from '../../i18n/he';

export function CoachDashboardPage() {
  return (
    <AppShell title={t('coach.dashboard.title')}>
      <PlaceholderPage />
    </AppShell>
  );
}
