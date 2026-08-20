/**
 * הטיפוסים וה-Context של האימות.
 *
 * מופרד מ-`AuthProvider.tsx` בכוונה: קובץ שמייצא גם קומפוננטה וגם ערך רגיל
 * שובר את Fast Refresh של Vite, וגם יוצר תלות מעגלית עם ה-hook.
 *
 * ⚠️ העיקרון שבלעדיו כל השאר נשבר (CLAUDE.md → "איפה נשמר התפקיד"):
 * `role` ו-`orgId` **לא** מגיעים מ-Custom Claims אלא ממסמך `users/{uid}`.
 * לכן אין `getIdToken(true)`, ולכן יש כאן מצב ביניים מפורש: המשתמש כבר מחובר
 * ל-Auth, אבל הפרופיל שלו עדיין בדרך. בלי המצב הזה הניתוב היה קופץ למסך הלא נכון.
 */

import { createContext } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import type { TranslationKey } from '../../i18n/he';
import type { UserDoc } from '../../types/types';

/**
 * מצבי האימות. כל אחד מהם מוביל למסך אחר, ואף אחד מהם אינו "אולי":
 *
 * `initializing`   — Firebase עדיין לא אמר אם יש סשן שמור
 * `signedOut`      — אין משתמש מחובר
 * `loadingProfile` — מחובר ל-Auth, מסמך users/{uid} בדרך. **מצב הביניים.**
 * `ready`          — יש משתמש ויש פרופיל פעיל
 * `noProfile`      — מחובר, אבל אין לו מסמך users (מלכודת #5 ב-TASKS.md)
 * `inactive`       — יש פרופיל אבל `active: false`
 * `profileError`   — הקריאה למסמך נכשלה (הרשאה, רשת)
 */
export type AuthStatus =
  | 'initializing'
  | 'signedOut'
  | 'loadingProfile'
  | 'ready'
  | 'noProfile'
  | 'inactive'
  | 'profileError';

export interface AuthState {
  status: AuthStatus;
  user: FirebaseUser | null;
  /** מסמך `users/{uid}` — מקור ה-role/orgId/teamIds. `null` עד שהוא נטען. */
  profile: UserDoc | null;
  /** מפתח תרגום של השגיאה האחרונה ברמת הסשן. */
  errorKey: TranslationKey | null;
}

export interface AuthContextValue extends AuthState {
  /** מקבל **שם משתמש**, לא אימייל. הזורק הוא Firebase — הקורא ממפה עם `authErrorKey`. */
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * מחליף סיסמה ומכבה את `mustChangePassword`.
   * שני הצעדים בסדר הזה: אם העדכון במסד ייכשל, המשתמש פשוט יתבקש שוב.
   */
  changePassword: (newPassword: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
