/**
 * טסטי רינדור ל-App — מכונת המצבים של האימות.
 *
 * CLAUDE.md אומר שלא נדרשים טסטים לקומפוננטות ב-MVP, והטסטים כאן הם חריגה
 * מכוונת וצרה: הם בודקים **רק** את ההחלטה "איזה מסך מוצג באיזה מצב", שהיא
 * בדיוק קריטריון הסיום של שלב 1. אין כאן בדיקות עיצוב, אינטראקציה או קליקים.
 *
 * הרינדור נעשה עם `react-dom/server` ולכן לא דורש DOM ולא ספרייה נוספת.
 * הוא אפשרי כי עץ ה-App **לא נוגע ב-Firebase**: הוא צורך את `AuthContext` בלבד,
 * וה-Provider האמיתי (שכן מייבא firebase) יושב מחוץ לעץ הזה.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { User as FirebaseUser } from 'firebase/auth';
import App from './App';
import { AuthContext } from './features/auth/authContext';
import type { AuthContextValue, AuthStatus } from './features/auth/authContext';
import { he, t } from './i18n/he';
import { PASSWORD_MIN_LENGTH } from './lib/auth';
import { ROUTES, landingPathForRole } from './lib/routing';
import { dictionaryStrings, unknownHebrewText } from './testing/hebrewText';
import type { Role, UserDoc } from './types/types';

const fakeUser = { uid: 'uid_1' } as FirebaseUser;

function fakeProfile(role: Role, overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    uid: 'uid_1',
    role,
    orgId: 'org_kiryat_ono',
    displayName: 'בודק ב.',
    username: 'tester',
    teamIds: ['team_yeladim_a'],
    active: true,
    mustChangePassword: false,
    // createdAt לא נקרא במסכים של שלב 1
    createdAt: undefined as unknown as UserDoc['createdAt'],
    ...overrides,
  };
}

function render(
  status: AuthStatus,
  profile: UserDoc | null,
  path = '/',
): string {
  const value: AuthContextValue = {
    status,
    user: status === 'signedOut' || status === 'initializing' ? null : fakeUser,
    profile,
    errorKey: null,
    signIn: async () => {},
    signOut: async () => {},
    changePassword: async () => {},
  };

  return renderToStaticMarkup(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('מצבי טעינה — המסך שלא מרצד', () => {
  it('initializing מציג טעינה, לא את מסך ההתחברות', () => {
    const html = render('initializing', null);
    expect(html).toContain(he.common.loading);
    expect(html).not.toContain(he.auth.signIn.submit);
  });

  it('loadingProfile מציג טעינת פרופיל, לא את מסך ההתחברות ולא מסך תפקיד', () => {
    // זה בדיוק הרגע שבו הניתוב היה קופץ למסך הלא נכון:
    // מחובר ל-Auth, אבל users/{uid} עדיין בדרך.
    const html = render('loadingProfile', null);
    expect(html).toContain(he.auth.profile.loading);
    expect(html).not.toContain(he.auth.signIn.submit);
    expect(html).not.toContain(he.coach.dashboard.title);
    expect(html).not.toContain(he.player.myWeek.title);
  });
});

describe('מנותק', () => {
  it('מציג את מסך ההתחברות', () => {
    const html = render('signedOut', null, '/login');
    expect(html).toContain(he.auth.signIn.title);
    expect(html).toContain(he.auth.signIn.username);
    expect(html).toContain(he.auth.signIn.password);
    expect(html).toContain(he.auth.signIn.submit);
  });

  it('מסך ההתחברות לא מזכיר אימייל — המשתמש מתחבר בשם משתמש', () => {
    const html = render('signedOut', null, '/login');
    expect(html).not.toContain('coachtrack.local');
    expect(html).not.toContain('@');
  });
});

describe('ניתוב לפי תפקיד — קריטריון הסיום של שלב 1', () => {
  it('מאמן מגיע לדף שכתוב עליו "דשבורד"', () => {
    const profile = fakeProfile('coach');
    const html = render('ready', profile, landingPathForRole('coach'));
    expect(html).toContain(he.coach.dashboard.title);
    expect(html).not.toContain(he.player.myWeek.title);
  });

  it('שחקן מגיע לדף שכתוב עליו "השבוע שלי"', () => {
    const profile = fakeProfile('player');
    const html = render('ready', profile, landingPathForRole('player'));
    expect(html).toContain(he.player.myWeek.title);
    expect(html).not.toContain(he.coach.dashboard.title);
  });

  it('admin מגיע למסך הניהול', () => {
    const profile = fakeProfile('admin');
    const html = render('ready', profile, landingPathForRole('admin'));
    expect(html).toContain(he.admin.home.title);
  });

  it('המסכים ריקים בכוונה — כותרת והודעה שהתוכן ייבנה בשלב הבא', () => {
    const html = render('ready', fakeProfile('player'), landingPathForRole('player'));
    expect(html).toContain(he.common.comingSoon);
  });

  it('הכותרת מציגה את השם ואת התפקיד שנקראו ממסמך המשתמש', () => {
    const html = render('ready', fakeProfile('coach'), landingPathForRole('coach'));
    expect(html).toContain('בודק ב.');
    expect(html).toContain(he.roles.coach);
    expect(html).toContain(he.common.signOut);
  });
});

describe('מסכי המאמן של שלב 2', () => {
  it('כל נתיב בתפריט המאמן מגיע למסך שלו', () => {
    const profile = fakeProfile('coach');
    expect(render('ready', profile, ROUTES.coachTeam)).toContain(he.coach.team.title);
    expect(render('ready', profile, ROUTES.coachExercises)).toContain(he.coach.exercises.title);
  });

  it('התפריט מוצג למאמן', () => {
    const html = render('ready', fakeProfile('coach'), ROUTES.coach);
    expect(html).toContain(he.coach.nav.team);
    expect(html).toContain(he.coach.nav.exercises);
  });

  it('לשחקן אין תפריט — יש לו מסך אחד', () => {
    const html = render('ready', fakeProfile('player'), ROUTES.player);
    expect(html).not.toContain('<nav');
    expect(html).not.toContain(he.coach.nav.team);
  });

  it('שחקן שמנסה נתיב של מאמן לא מקבל את המסך', () => {
    // הנתיב פשוט לא רשום בעץ שלו, ולכן הוא נופל ל-catch-all שמנווט הביתה.
    // הניווט עצמו לא מתרחש ברינדור סטטי (אין דפדפן), ולכן נבדק מה שכן ודאי:
    // מסך המאמן אינו מוצג. זו ממילא נוחות — החסימה היא ב-firestore.rules.
    const html = render('ready', fakeProfile('player'), ROUTES.coachTeam);
    expect(html).not.toContain(he.coach.team.title);
    expect(html).not.toContain(he.coach.team.add.toggle);
  });
});
describe('החלפת סיסמה כפויה', () => {
  it('גוברת על מסך התפקיד', () => {
    const profile = fakeProfile('coach', { mustChangePassword: true });
    const html = render('ready', profile, landingPathForRole('coach'));
    expect(html).toContain(he.auth.changePassword.title);
    expect(html).toContain(he.auth.changePassword.forcedNotice);
    expect(html).not.toContain(he.coach.dashboard.title);
  });

  it('חלה גם על שחקן, ובכל כתובת', () => {
    const profile = fakeProfile('player', { mustChangePassword: true });
    for (const path of ['/', '/player', '/coach', '/משהו-אחר']) {
      const html = render('ready', profile, path);
      expect(html).toContain(he.auth.changePassword.title);
      expect(html).not.toContain(he.player.myWeek.title);
    }
  });
});

describe('מצבים חוסמים', () => {
  it('אין מסמך פרופיל — מסך מפורש עם התנתקות, לא מסך לבן', () => {
    const html = render('noProfile', null);
    expect(html).toContain(he.auth.profile.missingTitle);
    expect(html).toContain(he.common.signOut);
  });

  it('חשבון מושבת', () => {
    const html = render('inactive', fakeProfile('player', { active: false }));
    expect(html).toContain(he.auth.profile.inactiveTitle);
    expect(html).not.toContain(he.player.myWeek.title);
  });

  it('טעינת הפרופיל נכשלה — מוצע ניסיון חוזר', () => {
    const html = render('profileError', null);
    expect(html).toContain(he.auth.profile.errorTitle);
    expect(html).toContain(he.common.retry);
  });
});

describe('אין עברית שנשארה בקוד במקום במילון', () => {
  it('כל טקסט שמוצג במסכים של שלב 1 מגיע מ-i18n/he.ts', () => {
    const known = dictionaryStrings([
      'בודק ב.', // displayName מגיע מהמסד, לא מהמילון
      t('auth.session.signedInAs', { name: 'בודק ב.' }),
      t('auth.changePassword.hint', { min: PASSWORD_MIN_LENGTH }),
    ]);

    const screens = [
      render('signedOut', null, '/login'),
      render('ready', fakeProfile('coach'), landingPathForRole('coach')),
      render('ready', fakeProfile('player'), landingPathForRole('player')),
      render('ready', fakeProfile('player', { mustChangePassword: true }), '/player'),
      render('noProfile', null),
    ];

    for (const html of screens) {
      expect(unknownHebrewText(html, known)).toEqual([]);
    }
  });
});
