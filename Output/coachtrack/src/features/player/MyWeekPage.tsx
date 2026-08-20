/** "השבוע שלי" — כותרת בלבד בשלב 1. התוכן נבנה בשלב 4. */

import { AppShell } from '../../components/AppShell';
import { PlaceholderPage } from '../../components/PlaceholderPage';
import { t } from '../../i18n/he';

export function MyWeekPage() {
  return (
    <AppShell title={t('player.myWeek.title')}>
      <PlaceholderPage />
    </AppShell>
  );
}
