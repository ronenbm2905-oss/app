/**
 * טסטים ל-lib/routing.ts
 *
 * משלב 2 יש למאמן שלושה מסכים, ורשימת הניווט היא **מקור אמת יחיד** לשלושה
 * צרכנים: הראוטים שנרשמים ב-`App.tsx`, התפריט ב-`AppShell`, וההחלטה מה מותר
 * לתפקיד. הטסטים כאן שומרים על התכונות שמונעות סדק בין השלושה.
 *
 * (המיפוי תפקיד→מסך בית נבדק גם ב-`lib/auth.test.ts`, שם הוא נולד.)
 */

import { describe, it, expect } from 'vitest';
import { ROUTES, isPathAllowedForRole, landingPathForRole, navItemsForRole } from './routing';
import { t } from '../i18n/he';
import type { Role } from '../types/types';

const ROLES: Role[] = ['coach', 'player', 'admin'];

describe('פריטי הניווט', () => {
  it('הפריט הראשון של כל תפקיד הוא מסך הבית שלו', () => {
    for (const role of ROLES) {
      expect(navItemsForRole(role)[0].path).toBe(landingPathForRole(role));
    }
  });

  it('למאמן חמישה מסכים: דשבורד, קבוצה, תוכנית, ספרייה, דוחות', () => {
    expect(navItemsForRole('coach').map((item) => item.path)).toEqual([
      ROUTES.coach,
      ROUTES.coachTeam,
      ROUTES.coachPlan,
      ROUTES.coachExercises,
      ROUTES.coachReports,
    ]);
  });

  it('לשחקן שני מסכים משלב 4: השבוע שלי והיסטוריה', () => {
    expect(navItemsForRole('player').map((item) => item.path)).toEqual([
      ROUTES.player,
      ROUTES.playerHistory,
    ]);
  });

  it('ל-admin מסך אחד — ולכן לא יוצג לו תפריט', () => {
    expect(navItemsForRole('admin')).toHaveLength(1);
  });

  it('כל תווית בתפריט קיימת במילון העברי', () => {
    for (const role of ROLES) {
      for (const item of navItemsForRole(role)) {
        // t מחזיר את המפתח עצמו כשהוא חסר — כאן זו הייתה תווית באנגלית בתפריט.
        expect(t(item.labelKey), `תווית חסרה: ${item.labelKey}`).not.toBe(item.labelKey);
      }
    }
  });

  it('אין נתיב שמופיע אצל שני תפקידים', () => {
    const all = ROLES.flatMap((role) => navItemsForRole(role).map((item) => item.path));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('מה מותר לתפקיד', () => {
  it('כל מסך בתפריט של התפקיד מותר לו', () => {
    for (const role of ROLES) {
      for (const item of navItemsForRole(role)) {
        expect(isPathAllowedForRole(item.path, role)).toBe(true);
      }
    }
  });

  it('מסכי המאמן החדשים חסומים לשחקן ול-admin', () => {
    for (const path of [ROUTES.coachTeam, ROUTES.coachExercises]) {
      expect(isPathAllowedForRole(path, 'coach')).toBe(true);
      expect(isPathAllowedForRole(path, 'player')).toBe(false);
      expect(isPathAllowedForRole(path, 'admin')).toBe(false);
    }
  });

  it('מסך ההיסטוריה של השחקן חסום למאמן ול-admin', () => {
    expect(isPathAllowedForRole(ROUTES.playerHistory, 'player')).toBe(true);
    expect(isPathAllowedForRole(ROUTES.playerHistory, 'coach')).toBe(false);
    expect(isPathAllowedForRole(ROUTES.playerHistory, 'admin')).toBe(false);
  });

  it('נתיב שלא קיים אינו מותר לאיש', () => {
    for (const role of ROLES) {
      expect(isPathAllowedForRole('/משהו-אחר', role)).toBe(false);
    }
  });
});
