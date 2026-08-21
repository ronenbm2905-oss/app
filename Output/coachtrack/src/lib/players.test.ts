/**
 * טסטים ל-lib/players.ts
 *
 * שלוש נקודות שמצדיקות טסט ולא בדיקה בעין:
 *
 * 1. **מזעור נתונים (כלל 7).** הוולידציה היא מה שעוצר ת.ז. או טלפון שנדחפו
 *    לשדה השם. השחקנים קטינים, וזו לא בדיקה קוסמטית.
 * 2. **הסינון לפי קבוצה נעשה בלקוח** (השאילתה מסננת ב-orgId בלבד), ולכן הוא
 *    קוד שאפשר לטעות בו — ואם יטעה, מאמן יראה שחקנים של קבוצה אחרת.
 * 3. **הפקודה לאיפוס סיסמה** מוצגת למאמן כהוראה להעתקה. אם היא לא תואמת לסקריפט
 *    שקיים בפועל, ההוראה חסרת ערך.
 */

import { existsSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  DISPLAY_NAME_MAX_LENGTH,
  generateInitialPassword,
  isPlayerFormValid,
  onlyPlayers,
  playersOfTeam,
  resetPasswordCommand,
  searchPlayers,
  sortPlayers,
  validateNewPlayer,
  visiblePlayers,
} from './players';
import type { NewPlayerFormValues } from './players';
import { t } from '../i18n/he';
import type { Role, UserDoc } from '../types/types';

const VALID: NewPlayerFormValues = {
  displayName: 'יונתן ב.',
  username: 'yonatan.b',
  password: 'Basket2026',
};

function user(uid: string, overrides: Partial<UserDoc> & { role?: Role } = {}): UserDoc {
  return {
    uid,
    role: 'player',
    orgId: 'org_kiryat_ono',
    displayName: 'בדיקה א.',
    username: uid,
    teamIds: ['team_yeladim_a'],
    active: true,
    mustChangePassword: false,
    createdAt: undefined as unknown as UserDoc['createdAt'],
    ...overrides,
  };
}

describe('ולידציה של טופס הוספת שחקן', () => {
  it('טופס תקין לא מחזיר שגיאות', () => {
    const errors = validateNewPlayer(VALID);
    expect(errors).toEqual({});
    expect(isPlayerFormValid(errors)).toBe(true);
  });

  it('שם חסר וארוך מדי', () => {
    expect(validateNewPlayer({ ...VALID, displayName: '   ' }).displayName).toBe(
      'coach.team.errors.nameRequired',
    );
    expect(
      validateNewPlayer({ ...VALID, displayName: 'א'.repeat(DISPLAY_NAME_MAX_LENGTH + 1) })
        .displayName,
    ).toBe('coach.team.errors.nameTooLong');
  });

  it('כלל 7 — ת.ז. או טלפון בשדה השם נעצרים', () => {
    // בדיוק המצב שהכלל בא למנוע: מאמן שמדביק מספר זהות לשדה "שם השחקן".
    expect(validateNewPlayer({ ...VALID, displayName: 'יונתן ב. 039456123' }).displayName).toBe(
      'coach.team.errors.nameHasNumbers',
    );
    expect(validateNewPlayer({ ...VALID, displayName: '0501234567' }).displayName).toBe(
      'coach.team.errors.nameHasNumbers',
    );
  });

  it('מספר קצר בשם עובר — הכלל מכוון למספרים מזהים', () => {
    expect(validateNewPlayer({ ...VALID, displayName: 'יונתן ב 2' }).displayName).toBeUndefined();
  });

  it('שם משתמש: חסר, לא חוקי, ותפוס', () => {
    expect(validateNewPlayer({ ...VALID, username: '' }).username).toBe(
      'auth.errors.missingUsername',
    );
    expect(validateNewPlayer({ ...VALID, username: 'יונתן' }).username).toBe(
      'auth.errors.invalidUsername',
    );
    expect(validateNewPlayer(VALID, ['yonatan.b']).username).toBe('auth.errors.usernameTaken');
  });

  it('בדיקת "תפוס" מנרמלת — אותיות גדולות ודומיין שהודבק נחשבים לאותו שם', () => {
    expect(validateNewPlayer({ ...VALID, username: 'YONATAN.B' }, ['yonatan.b']).username).toBe(
      'auth.errors.usernameTaken',
    );
    expect(validateNewPlayer(VALID, ['yonatan.b@coachtrack.local']).username).toBe(
      'auth.errors.usernameTaken',
    );
  });

  it('סיסמה: חסרה וקצרה מדי', () => {
    expect(validateNewPlayer({ ...VALID, password: '' }).password).toBe(
      'auth.errors.missingPassword',
    );
    expect(validateNewPlayer({ ...VALID, password: 'Bas26' }).password).toBe(
      'auth.errors.weakPassword',
    );
  });

  it('כל מפתח שגיאה שהוולידציה מחזירה קיים במילון העברי', () => {
    const cases: NewPlayerFormValues[] = [
      { displayName: '', username: '', password: '' },
      { displayName: '123456789', username: 'שם', password: 'קצר' },
      { displayName: 'א'.repeat(80), username: 'a', password: '' },
    ];

    for (const values of cases) {
      for (const key of Object.values(validateNewPlayer(values, ['taken']))) {
        // t מחזיר את המפתח עצמו כשהוא חסר — כאן זה ייראה כטקסט אנגלי על המסך.
        expect(t(key), `מפתח חסר במילון: ${key}`).not.toBe(key);
      }
    }
  });
});

describe('סיסמה ראשונית מוגרלת', () => {
  it('באורך צפוי, נגמרת בסימן, ובלי תווים שקל לבלבל ביניהם', () => {
    for (let index = 0; index < 50; index += 1) {
      const password = generateInitialPassword();
      expect(password).toHaveLength(11);
      expect(password.endsWith('!')).toBe(true);
      // O/0, l/1/I — הסיסמה מוכתבת בקול לילד בן 13.
      expect(password).not.toMatch(/[0O1lI]/);
      expect(validateNewPlayer({ ...VALID, password }).password).toBeUndefined();
    }
  });

  it('לא מחזירה את אותה סיסמה פעמיים', () => {
    const generated = new Set(Array.from({ length: 20 }, () => generateInitialPassword()));
    expect(generated.size).toBe(20);
  });
});

describe('סינון ומיון הרשימה', () => {
  const users: UserDoc[] = [
    user('coach_1', { role: 'coach', displayName: 'עמנואל מ.' }),
    user('admin_1', { role: 'admin', displayName: 'רונן ב.', teamIds: [] }),
    user('p_bet', { displayName: 'בדיקה ב.' }),
    user('p_alef', { displayName: 'אבי ג.' }),
    user('p_other', { displayName: 'שחקן אחר', teamIds: ['team_bogrim'] }),
    user('p_off', { displayName: 'אורי ד.', active: false }),
  ];

  it('onlyPlayers מסנן את המאמן ואת ה-admin', () => {
    expect(onlyPlayers(users).map((player) => player.uid)).toEqual([
      'p_bet',
      'p_alef',
      'p_other',
      'p_off',
    ]);
  });

  it('playersOfTeam מסנן לפי הקבוצה — הסינון שהשאילתה לא עושה', () => {
    const inTeam = playersOfTeam(onlyPlayers(users), 'team_yeladim_a');
    expect(inTeam.map((player) => player.uid)).toEqual(['p_bet', 'p_alef', 'p_off']);
  });

  it('searchPlayers מוצא לפי שם ולפי שם משתמש, בלי תלות ברישיות', () => {
    const players = onlyPlayers(users);
    expect(searchPlayers(players, 'בדיקה').map((player) => player.uid)).toEqual(['p_bet']);
    expect(searchPlayers(players, 'P_ALEF').map((player) => player.uid)).toEqual(['p_alef']);
    expect(searchPlayers(players, '   ')).toHaveLength(players.length);
  });

  it('sortPlayers — פעילים קודם, ובתוכם לפי אלפבית עברי', () => {
    const sorted = sortPlayers(playersOfTeam(onlyPlayers(users), 'team_yeladim_a'));
    expect(sorted.map((player) => player.displayName)).toEqual(['אבי ג.', 'בדיקה ב.', 'אורי ד.']);
  });

  it('sortPlayers לא משנה את המערך המקורי', () => {
    const players = onlyPlayers(users);
    const before = players.map((player) => player.uid);
    sortPlayers(players);
    expect(players.map((player) => player.uid)).toEqual(before);
  });

  it('visiblePlayers מרכיב את השלושה', () => {
    expect(
      visiblePlayers(users, 'team_yeladim_a', 'א').map((player) => player.displayName),
    ).toEqual(['אבי ג.', 'אורי ד.']);
  });
});

describe('הפקודה לאיפוס סיסמה', () => {
  it('מנוסחת בדיוק כמו שמריצים אותה', () => {
    expect(resetPasswordCommand('dani')).toBe('node scripts/reset-password.js dani');
    expect(resetPasswordCommand(' Dani@coachtrack.local ')).toBe(
      'node scripts/reset-password.js dani',
    );
  });

  it('הסקריפט שהמסך מפנה אליו קיים בפרויקט', () => {
    // בלי זה המסך מציג הוראה שאי אפשר לבצע.
    expect(existsSync('scripts/reset-password.js')).toBe(true);
  });
});
