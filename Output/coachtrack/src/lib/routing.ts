/**
 * CoachTrack — הנתיבים והחלטת "לאן שולחים את המשתמש"
 *
 * ההחלטה עצמה היא פונקציה טהורה ולא לוגיקה שקבורה בתוך קומפוננטה, כדי שאפשר
 * יהיה לבדוק אותה ביוניט-טסט בלי דפדפן — ושלא יהיה מקום שני שמחליט אחרת.
 *
 * מ-שלב 2 יש למאמן יותר ממסך אחד, ולכן הרשימה `navItemsForRole` היא **מקור
 * האמת היחיד** לשלושה דברים: אילו ראוטים נרשמים ב-`App.tsx`, מה מופיע בתפריט
 * ב-`AppShell`, ומה מותר לתפקיד. שלוש רשימות נפרדות היו נסדקות זו מזו.
 */

import type { TranslationKey } from '../i18n/he';
import type { Role } from '../types/types';

export const ROUTES = {
  signIn: '/login',
  changePassword: '/change-password',
  coach: '/coach',
  coachTeam: '/coach/team',
  coachPlan: '/coach/plan',
  coachExercises: '/coach/exercises',
  player: '/player',
  playerHistory: '/player/history',
  admin: '/admin',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/** פריט ניווט: הנתיב והתווית שלו. התווית היא מפתח תרגום, לא טקסט (כלל 8). */
export interface NavItem {
  path: RoutePath;
  labelKey: TranslationKey;
}

/**
 * המסכים של כל תפקיד, לפי הסדר שבו הם מוצגים בתפריט.
 * **הפריט הראשון הוא מסך הבית** של אותו תפקיד.
 */
const NAV_ITEMS: Record<Role, NavItem[]> = {
  coach: [
    { path: ROUTES.coach, labelKey: 'coach.nav.dashboard' },
    { path: ROUTES.coachTeam, labelKey: 'coach.nav.team' },
    { path: ROUTES.coachPlan, labelKey: 'coach.nav.plan' },
    { path: ROUTES.coachExercises, labelKey: 'coach.nav.exercises' },
  ],
  player: [
    { path: ROUTES.player, labelKey: 'player.nav.myWeek' },
    { path: ROUTES.playerHistory, labelKey: 'player.nav.history' },
  ],
  admin: [{ path: ROUTES.admin, labelKey: 'admin.home.title' }],
};

/** פריטי הניווט של התפקיד. */
export function navItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS[role];
}

/**
 * מסך הבית לפי תפקיד.
 *
 * `admin` מקבל מסך משלו ולא את הדשבורד של המאמן: ה-admin אינו מאמן של אף קבוצה
 * (`teams.coachUid` מצביע על המאמן, ו-`teamIds` שלו ריק), ולכן דשבורד קבוצה
 * לא היה מוצא לו קבוצה להציג. תפקידו לנהל ארגון וספרייה גלובלית.
 */
export function landingPathForRole(role: Role): RoutePath {
  return NAV_ITEMS[role][0].path;
}

/** האם התפקיד רשאי לפתוח את הנתיב. הגנת נוחות בלבד — האכיפה היא ב-firestore.rules. */
export function isPathAllowedForRole(path: string, role: Role): boolean {
  return NAV_ITEMS[role].some((item) => item.path === path);
}
