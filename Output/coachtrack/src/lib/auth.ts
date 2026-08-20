/**
 * CoachTrack — הגשר בין "שם משתמש" ל-Firebase Auth
 *
 * המשתמשים מתחברים ב**שם משתמש** (`emanuel`), אבל Firebase Auth יודע רק אימיילים.
 * המיפוי הוא `<username>@coachtrack.local` — אימייל סינתטי שאין מאחוריו תיבת דואר.
 *
 * ⚠️ הדומיין מוגדר **כאן בלבד**. אותו ערך מופיע גם ב-`scripts/seed.js` וב-
 * `scripts/reset-password.js` (סקריפטים של Node, שלא יכולים לייבא מודול TS של האפליקציה).
 * שינוי כאן מחייב שינוי גם שם — אחרת מי שנוצר בסקריפט לא יוכל להתחבר מהאפליקציה.
 *
 * מכיוון שאין תיבת דואר אמיתית, `sendPasswordResetEmail` לא רלוונטי:
 * איפוס סיסמה נעשה ב-`node scripts/reset-password.js` (CLAUDE.md → איפוס סיסמה).
 *
 * הקובץ טהור — אין בו קריאות רשת. לכן הוא נבדק ביוניט-טסטים.
 */

import type { TranslationKey } from '../i18n/he';

/** הדומיין של האימיילים הסינתטיים. מקור אמת יחיד. */
export const AUTH_EMAIL_DOMAIN = 'coachtrack.local';

/** אורך סיסמה מינימלי. גבוה מהמינימום של Firebase (6) בכוונה. */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * שמות משתמש חוקיים: אותיות לטיניות קטנות, ספרות, נקודה, מקף ומקף תחתון.
 * בלי עברית ובלי רווחים — השם נכנס לתוך כתובת אימייל.
 */
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,29}$/;

/** מנרמל קלט של משתמש: מוריד רווחים, אותיות גדולות, ו-`@domain` שהודבק בטעות. */
export function normalizeUsername(raw: string): string {
  const trimmed = (raw ?? '').trim().toLowerCase();
  const atIndex = trimmed.indexOf('@');
  return atIndex === -1 ? trimmed : trimmed.slice(0, atIndex);
}

/** האם שם המשתמש חוקי (אחרי נירמול). */
export function isValidUsername(raw: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(raw));
}

/** `emanuel` → `emanuel@coachtrack.local`. */
export function usernameToEmail(raw: string): string {
  const username = normalizeUsername(raw);
  if (!username) throw new Error('שם משתמש ריק');
  return `${username}@${AUTH_EMAIL_DOMAIN}`;
}

/** `emanuel@coachtrack.local` → `emanuel`. */
export function emailToUsername(email: string): string {
  return normalizeUsername(email);
}

/** תוצאת בדיקת סיסמה חדשה — מפתח תרגום או `null` כשהכל תקין. */
export function validateNewPassword(password: string, confirmation: string): TranslationKey | null {
  if (!password) return 'auth.errors.missingPassword';
  if (password.length < PASSWORD_MIN_LENGTH) return 'auth.errors.weakPassword';
  if (password !== confirmation) return 'auth.errors.passwordMismatch';
  return null;
}

/** מוציא את קוד השגיאה של Firebase מתוך אובייקט שגיאה כלשהו. */
export function firebaseErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return '';
}

/**
 * ממפה שגיאת Firebase למפתח תרגום. מחזיר מפתח ולא מחרוזת עברית,
 * כדי שכל הטקסט יישאר ב-`i18n/he.ts` (כלל 8).
 *
 * `auth/invalid-credential` הוא הקוד שמוחזר בגרסאות החדשות של Firebase גם על
 * סיסמה שגויה וגם על משתמש שלא קיים — בכוונה, כדי לא לחשוף אילו שמות משתמש קיימים.
 * לכן שניהם מקבלים את אותה הודעה.
 */
export function authErrorKey(error: unknown): TranslationKey {
  switch (firebaseErrorCode(error)) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'auth.errors.invalidCredentials';
    case 'auth/user-disabled':
      return 'auth.errors.userDisabled';
    case 'auth/too-many-requests':
      return 'auth.errors.tooManyAttempts';
    case 'auth/network-request-failed':
      return 'auth.errors.network';
    case 'auth/weak-password':
      return 'auth.errors.weakPassword';
    case 'auth/requires-recent-login':
      return 'auth.errors.requiresRecentLogin';
    case 'permission-denied':
      return 'errors.permission';
    case 'unavailable':
      return 'errors.network';
    default:
      return 'auth.errors.generic';
  }
}
