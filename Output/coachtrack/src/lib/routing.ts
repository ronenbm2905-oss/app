/**
 * CoachTrack — הנתיבים והחלטת "לאן שולחים את המשתמש"
 *
 * ההחלטה עצמה היא פונקציה טהורה ולא לוגיקה שקבורה בתוך קומפוננטה, כדי שאפשר
 * יהיה לבדוק אותה ביוניט-טסט בלי דפדפן — ושלא יהיה מקום שני שמחליט אחרת.
 */

import type { Role } from '../types/types';

export const ROUTES = {
  signIn: '/login',
  changePassword: '/change-password',
  coach: '/coach',
  player: '/player',
  admin: '/admin',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * מסך הבית לפי תפקיד.
 *
 * `admin` מקבל מסך משלו ולא את הדשבורד של המאמן: ה-admin אינו מאמן של אף קבוצה
 * (`teams.coachUid` מצביע על המאמן, ו-`teamIds` שלו ריק), ולכן דשבורד קבוצה
 * לא היה מוצא לו קבוצה להציג. תפקידו לנהל ארגון וספרייה גלובלית.
 */
export function landingPathForRole(role: Role): RoutePath {
  switch (role) {
    case 'coach':
      return ROUTES.coach;
    case 'player':
      return ROUTES.player;
    case 'admin':
      return ROUTES.admin;
  }
}

/** האם התפקיד רשאי לפתוח את הנתיב. הגנת נוחות בלבד — האכיפה היא ב-firestore.rules. */
export function isPathAllowedForRole(path: string, role: Role): boolean {
  return path === landingPathForRole(role);
}
