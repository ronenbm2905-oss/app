/**
 * הראוטר של CoachTrack.
 *
 * המבנה הוא מכונת-מצבים ולא עץ ראוטים שטוח, כי ההחלטה "מה מציגים" תלויה
 * במצב האימות ולא רק בכתובת:
 *
 *   initializing / loadingProfile → מסך טעינה. **חובה.** בלעדיו הניתוב היה
 *     מחליט לפי `profile === null` וקופץ למסך ההתחברות לרגע, בכל רענון של דף.
 *   signedOut                     → מסך התחברות בלבד
 *   noProfile / inactive / error  → מסך מצב חוסם עם התנתקות
 *   ready + mustChangePassword    → מסך החלפת סיסמה, ואין ממנו יציאה
 *   ready                         → מסך הבית של התפקיד
 *
 * המיפוי תפקיד→נתיב יושב ב-`lib/routing.ts` ונבדק ביוניט-טסט, כדי שלא תהיה
 * החלטה שנייה שסותרת אותו.
 */

import type { ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { FullScreenLoader } from './components/ui/Spinner';
import { StatusScreen } from './components/StatusScreen';
import { ChangePasswordPage } from './features/auth/ChangePasswordPage';
import { SignInPage } from './features/auth/SignInPage';
import { AdminHomePage } from './features/admin/AdminHomePage';
import { CoachDashboardPage } from './features/coach/CoachDashboardPage';
import { MyWeekPage } from './features/player/MyWeekPage';
import { useAuth } from './hooks/useAuth';
import { ROUTES, landingPathForRole } from './lib/routing';
import { t } from './i18n/he';
import type { Role } from './types/types';

/** מסך הבית של כל תפקיד. המפתחות זהים ל-`landingPathForRole`. */
const HOME_SCREENS: Record<Role, ComponentType> = {
  coach: CoachDashboardPage,
  player: MyWeekPage,
  admin: AdminHomePage,
};

function App() {
  const { status, profile, signOut } = useAuth();

  if (status === 'initializing') {
    return <FullScreenLoader />;
  }

  if (status === 'loadingProfile') {
    // מצב הביניים: מחובר ל-Auth, מסמך users/{uid} עוד בדרך.
    return <FullScreenLoader label={t('auth.profile.loading')} />;
  }

  if (status === 'signedOut') {
    return (
      <Routes>
        <Route path={ROUTES.signIn} element={<SignInPage />} />
        <Route path="*" element={<Navigate to={ROUTES.signIn} replace />} />
      </Routes>
    );
  }

  if (status === 'noProfile') {
    return (
      <StatusScreen
        title={t('auth.profile.missingTitle')}
        body={t('auth.profile.missingBody')}
        onSignOut={() => void signOut()}
      />
    );
  }

  if (status === 'inactive') {
    return (
      <StatusScreen
        title={t('auth.profile.inactiveTitle')}
        body={t('auth.profile.inactiveBody')}
        onSignOut={() => void signOut()}
      />
    );
  }

  if (status === 'profileError' || !profile) {
    return (
      <StatusScreen
        title={t('auth.profile.errorTitle')}
        body={t('auth.profile.errorBody')}
        onSignOut={() => void signOut()}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (profile.mustChangePassword) {
    // אין Routes כאן בכוונה: כל כתובת מובילה למסך הזה עד שהסיסמה תוחלף.
    return <ChangePasswordPage />;
  }

  const home = landingPathForRole(profile.role);
  const HomeScreen = HOME_SCREENS[profile.role];

  return (
    <Routes>
      <Route path={home} element={<HomeScreen />} />
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}

export default App;
