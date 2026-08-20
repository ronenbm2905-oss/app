/**
 * טסטים ל-lib/auth.ts ול-lib/routing.ts
 *
 * המיפוי שם-משתמש ↔ אימייל הוא נקודת כשל שקטה: אם הוא יסטה מהסקריפטים
 * ב-scripts/, משתמש שנוצר בסקריפט פשוט לא יצליח להתחבר מהאפליקציה.
 * ההחלטה "לאן שולחים את המשתמש" נבדקת כאן כפונקציה טהורה, בלי דפדפן.
 */

import { describe, it, expect } from 'vitest';
import {
  AUTH_EMAIL_DOMAIN,
  PASSWORD_MIN_LENGTH,
  authErrorKey,
  emailToUsername,
  firebaseErrorCode,
  isValidUsername,
  normalizeUsername,
  usernameToEmail,
  validateNewPassword,
} from './auth';
import { ROUTES, isPathAllowedForRole, landingPathForRole } from './routing';
import { t } from '../i18n/he';

describe('מיפוי שם משתמש לאימייל', () => {
  it('הדומיין תואם למה שהסקריפטים ב-scripts/ יוצרים', () => {
    expect(AUTH_EMAIL_DOMAIN).toBe('coachtrack.local');
    // אלה בדיוק המשתמשים שנוצרו ב-seed
    expect(usernameToEmail('emanuel')).toBe('emanuel@coachtrack.local');
    expect(usernameToEmail('ronen')).toBe('ronen@coachtrack.local');
  });

  it('מנרמל קלט אנושי: רווחים, אותיות גדולות ודומיין שהודבק', () => {
    expect(normalizeUsername('  Emanuel  ')).toBe('emanuel');
    expect(normalizeUsername('EMANUEL@coachtrack.local')).toBe('emanuel');
    expect(usernameToEmail(' Emanuel ')).toBe('emanuel@coachtrack.local');
    expect(usernameToEmail('emanuel@coachtrack.local')).toBe('emanuel@coachtrack.local');
  });

  it('הלוך ושוב מחזיר את המקור', () => {
    expect(emailToUsername(usernameToEmail('dani.k'))).toBe('dani.k');
  });

  it('זורק על שם ריק', () => {
    expect(() => usernameToEmail('   ')).toThrow();
  });
});

describe('isValidUsername', () => {
  it('מקבל שמות סבירים', () => {
    for (const name of ['emanuel', 'dani.k', 'yoav_2', 'player-12', 'ab']) {
      expect(isValidUsername(name)).toBe(true);
    }
  });

  it('דוחה עברית, רווחים, תו פותח לא חוקי ושם קצר מדי', () => {
    for (const name of ['עמנואל', 'dani k', '.dani', 'a', '', 'dani!']) {
      expect(isValidUsername(name)).toBe(false);
    }
  });
});

describe('validateNewPassword', () => {
  it('מחזיר null כשהסיסמה תקינה', () => {
    expect(validateNewPassword('Basket2026!', 'Basket2026!')).toBeNull();
  });

  it('סיסמה ריקה, קצרה, או אימות שלא תואם', () => {
    expect(validateNewPassword('', '')).toBe('auth.errors.missingPassword');
    expect(validateNewPassword('short', 'short')).toBe('auth.errors.weakPassword');
    expect(validateNewPassword('Basket2026!', 'Basket2026')).toBe('auth.errors.passwordMismatch');
  });

  it('הסף הוא בדיוק PASSWORD_MIN_LENGTH', () => {
    const exact = 'a'.repeat(PASSWORD_MIN_LENGTH);
    const short = 'a'.repeat(PASSWORD_MIN_LENGTH - 1);
    expect(validateNewPassword(exact, exact)).toBeNull();
    expect(validateNewPassword(short, short)).toBe('auth.errors.weakPassword');
  });

  it('כל מפתח שגיאה שהוא מחזיר קיים במילון העברי', () => {
    const keys = [
      validateNewPassword('', ''),
      validateNewPassword('short', 'short'),
      validateNewPassword('Basket2026!', 'x'),
    ];
    for (const key of keys) {
      expect(key).not.toBeNull();
      // t מחזיר את המפתח עצמו כשהוא חסר — אז שוויון למפתח פירושו תרגום חסר
      expect(t(key!)).not.toBe(key);
    }
  });
});

describe('authErrorKey', () => {
  const code = (value: string) => ({ code: value, message: value });

  it('סיסמה שגויה ומשתמש שלא קיים מקבלים את אותה הודעה', () => {
    expect(authErrorKey(code('auth/invalid-credential'))).toBe('auth.errors.invalidCredentials');
    expect(authErrorKey(code('auth/wrong-password'))).toBe('auth.errors.invalidCredentials');
    expect(authErrorKey(code('auth/user-not-found'))).toBe('auth.errors.invalidCredentials');
  });

  it('ממפה את שאר המקרים שאנחנו מצפים להם', () => {
    expect(authErrorKey(code('auth/user-disabled'))).toBe('auth.errors.userDisabled');
    expect(authErrorKey(code('auth/too-many-requests'))).toBe('auth.errors.tooManyAttempts');
    expect(authErrorKey(code('auth/network-request-failed'))).toBe('auth.errors.network');
    expect(authErrorKey(code('auth/weak-password'))).toBe('auth.errors.weakPassword');
    expect(authErrorKey(code('permission-denied'))).toBe('errors.permission');
  });

  it('שגיאה לא מוכרת, undefined ומחרוזת — נופלים להודעה גנרית ולא קורסים', () => {
    expect(authErrorKey(code('auth/משהו-חדש'))).toBe('auth.errors.generic');
    expect(authErrorKey(undefined)).toBe('auth.errors.generic');
    expect(authErrorKey('boom')).toBe('auth.errors.generic');
    expect(authErrorKey(new Error('boom'))).toBe('auth.errors.generic');
  });

  it('כל מפתח שהוא מחזיר מתורגם בפועל — אין הודעת שגיאה שמציגה מפתח באנגלית', () => {
    const codes = [
      'auth/invalid-credential',
      'auth/user-disabled',
      'auth/too-many-requests',
      'auth/network-request-failed',
      'auth/weak-password',
      'auth/requires-recent-login',
      'permission-denied',
      'unavailable',
      'unknown/code',
    ];
    for (const value of codes) {
      const key = authErrorKey(code(value));
      expect(t(key)).not.toBe(key);
      expect(t(key).length).toBeGreaterThan(0);
    }
  });

  it('firebaseErrorCode מחלץ קוד ומחזיר מחרוזת ריקה כשאין', () => {
    expect(firebaseErrorCode(code('auth/x'))).toBe('auth/x');
    expect(firebaseErrorCode({})).toBe('');
    expect(firebaseErrorCode(null)).toBe('');
  });
});

describe('ניתוב לפי תפקיד', () => {
  it('מאמן לדשבורד, שחקן להשבוע שלי, admin לניהול', () => {
    expect(landingPathForRole('coach')).toBe(ROUTES.coach);
    expect(landingPathForRole('player')).toBe(ROUTES.player);
    expect(landingPathForRole('admin')).toBe(ROUTES.admin);
  });

  it('שחקן לא מורשה לנתיב של המאמן ולהפך', () => {
    expect(isPathAllowedForRole(ROUTES.coach, 'player')).toBe(false);
    expect(isPathAllowedForRole(ROUTES.player, 'coach')).toBe(false);
    expect(isPathAllowedForRole(ROUTES.player, 'player')).toBe(true);
    expect(isPathAllowedForRole(ROUTES.coach, 'coach')).toBe(true);
  });

  it('שלושת התפקידים מקבלים שלושה מסכי בית שונים', () => {
    const landings = (['admin', 'coach', 'player'] as const).map(landingPathForRole);
    expect(new Set(landings).size).toBe(3);
  });
});
