/**
 * טסטי רינדור למסך ניהול הקבוצה.
 *
 * אין כאן דפדפן ואין קליקים — `renderToStaticMarkup` מרנדר את המצב ההתחלתי
 * בלבד. לכן נבדק מה שאפשר לבדוק כך באמת: מה המסך אומר בכל מצב (טעינה, שגיאה,
 * קבוצה ריקה, שחקן מושבת), ושהטופס אוסף בדיוק את מה שמותר לו לאסוף.
 *
 * הבדיקה החשובה כאן היא **כלל 7**: לטופס הוספת שחקן יש שלושה שדות קלט, ואף אחד
 * מהם אינו ת.ז., טלפון או תאריך לידה. אם מישהו יוסיף שדה — הטסט ייפול.
 *
 * מה שלא נבדק כאן ודורש עין אנושית: פתיחת פאנל איפוס הסיסמה (תלוי בלחיצה),
 * והמראה ב-RTL.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TeamView } from './TeamView';
import type { TeamViewProps } from './TeamView';
import { AddPlayerForm } from './AddPlayerForm';
import { he, t } from '../../i18n/he';
import { PASSWORD_MIN_LENGTH } from '../../lib/auth';
import { dictionaryStrings, unknownHebrewText } from '../../testing/hebrewText';
import type { Role, TeamDoc, UserDoc } from '../../types/types';

const ORG_ID = 'org_kiryat_ono';
const TEAM_ID = 'team_yeladim_a';

const team: TeamDoc = {
  id: TEAM_ID,
  orgId: ORG_ID,
  coachUid: 'uid_coach',
  name: 'ילדים א',
  season: '2026',
  active: true,
  settings: { leaderboardEnabled: false, streakThreshold: 80, weekStartDay: 0 },
};

function user(uid: string, overrides: Partial<UserDoc> & { role?: Role } = {}): UserDoc {
  return {
    uid,
    role: 'player',
    orgId: ORG_ID,
    displayName: 'בדיקה א.',
    username: uid,
    teamIds: [TEAM_ID],
    active: true,
    mustChangePassword: false,
    createdAt: undefined as unknown as UserDoc['createdAt'],
    ...overrides,
  };
}

const players: UserDoc[] = [
  user('bdika_a', { displayName: 'בדיקה א.', mustChangePassword: true }),
  user('bdika_b', { displayName: 'בדיקה ב.' }),
  user('bdika_g', { displayName: 'בדיקה ג.', active: false }),
  user('coach_1', { role: 'coach', displayName: 'עמנואל מ.' }),
  user('other_team', { displayName: 'שחקן בוגרים', teamIds: ['team_bogrim'] }),
];

function render(overrides: Partial<TeamViewProps> = {}): string {
  const props: TeamViewProps = {
    status: 'ready',
    teams: [team],
    selectedTeamId: TEAM_ID,
    onSelectTeam: () => {},
    users: players,
    onAddPlayer: async () => true,
    onSetActive: async () => true,
    busyUid: null,
    feedback: null,
    ...overrides,
  };

  return renderToStaticMarkup(<TeamView {...props} />);
}

describe('מצבי המסך', () => {
  it('טעינה — הודעת טעינה, בלי רשימה חלקית', () => {
    const html = render({ status: 'loading' });
    expect(html).toContain(he.coach.team.loading);
    expect(html).not.toContain('בדיקה א.');
  });

  it('שגיאה — הודעה שמסבירה שזו תקלה ולא קבוצה ריקה', () => {
    const html = render({ status: 'error' });
    expect(html).toContain(he.coach.team.loadError);
    expect(html).not.toContain(he.coach.team.empty);
  });

  it('אין קבוצה — הודעה מפורשת ובלי כפתור הוספת שחקן', () => {
    const html = render({ teams: [], selectedTeamId: null, users: [] });
    expect(html).toContain(he.coach.team.noTeam);
    expect(html).not.toContain(he.coach.team.add.toggle);
  });

  it('קבוצה ריקה — הודעה, וכפתור הוספה כן מוצג', () => {
    const html = render({ users: [] });
    expect(html).toContain(he.coach.team.empty);
    expect(html).toContain(he.coach.team.add.toggle);
  });
});

describe('רשימת השחקנים', () => {
  it('מציגה את שחקני הקבוצה בלבד — לא את המאמן ולא שחקן של קבוצה אחרת', () => {
    const html = render();
    expect(html).toContain('בדיקה א.');
    expect(html).toContain('בדיקה ב.');
    expect(html).toContain('בדיקה ג.');
    expect(html).not.toContain('עמנואל מ.');
    expect(html).not.toContain('שחקן בוגרים');
  });

  it('סופרת פעילים מתוך הסך הכול', () => {
    const html = render();
    expect(html).toContain(t('coach.team.playersCount', { active: 2, total: 3 }));
  });

  it('מציגה שם משתמש לכל שחקן — זה מה שהמאמן מוסר לו', () => {
    const html = render();
    expect(html).toContain(t('coach.team.usernameLine', { username: 'bdika_a' }));
  });

  it('מסמנת שחקן מושבת ושחקן שטרם החליף סיסמה', () => {
    const html = render();
    expect(html).toContain(he.coach.team.inactiveBadge);
    expect(html).toContain(he.coach.team.pendingPasswordBadge);
  });

  it('מושבת מקבל כפתור הפעלה מחדש, ואין בשום מקום כפתור מחיקה', () => {
    const html = render();
    expect(html).toContain(he.coach.team.actions.activate);
    expect(html).toContain(he.coach.team.actions.deactivate);
    // כלל 5: אין מחיקה קשיחה, ולכן גם אין כפתור כזה.
    expect(html).not.toContain(he.common.delete);
  });

  it('פעילים מוצגים לפני מושבתים', () => {
    const html = render();
    expect(html.indexOf('בדיקה ב.')).toBeLessThan(html.indexOf('בדיקה ג.'));
  });

  it('כל שחקן מקבל גישה להנחיית איפוס הסיסמה', () => {
    const html = render();
    expect(html).toContain(he.coach.team.actions.resetPassword);
  });
});

describe('טופס הוספת שחקן — כלל 7', () => {
  const formHtml = renderToStaticMarkup(
    <AddPlayerForm
      teamName={team.name}
      takenUsernames={[]}
      onSubmit={async () => true}
      onClose={() => {}}
    />,
  );

  it('שלושה שדות קלט בלבד: שם, שם משתמש, סיסמה', () => {
    const inputs = formHtml.match(/<input[^>]*>/g) ?? [];
    const checkboxes = inputs.filter((tag) => tag.includes('type="checkbox"'));
    // ארבעה תגי input: שלושה שדות נתונים + תיבת אישור ההסכמה, שאינה שדה
    // נתונים ואינה נשמרת למסד (ראה `validateParentConsent` ב-lib/players.ts).
    expect(inputs).toHaveLength(4);
    expect(checkboxes).toHaveLength(1);
    expect(formHtml).toContain(he.coach.team.add.displayName);
    expect(formHtml).toContain(he.coach.team.add.username);
    expect(formHtml).toContain(he.coach.team.add.password);
  });

  it('אין שדה לת.ז., טלפון, תאריך לידה או תמונה — גם לא אופציונלי', () => {
    for (const forbidden of ['ת.ז', 'תעודת זהות', 'טלפון', 'תאריך לידה', 'כתובת', 'תמונה', 'מייל']) {
      expect(formHtml.replace(he.coach.team.add.minimalDataNotice, '')).not.toContain(forbidden);
    }
    expect(formHtml).not.toContain('type="tel"');
    expect(formHtml).not.toContain('type="date"');
    expect(formHtml).not.toContain('type="file"');
    expect(formHtml).not.toContain('type="email"');
  });

  it('מציג את תזכורת הסכמת ההורה ואת הודעת מזעור הנתונים', () => {
    expect(formHtml).toContain(he.coach.team.add.consentReminder);
    expect(formHtml).toContain(he.coach.team.add.minimalDataNotice);
  });

  it('אומר לאיזו קבוצה השחקן מצורף', () => {
    expect(formHtml).toContain(t('coach.team.add.teamNotice', { team: team.name }));
  });
});

/**
 * ⚖️ שער ההסכמה — דרישת עדי (סקירת השער 21.8.2026, חלק ה'1).
 *
 * הטסטים כאן שומרים על **הצד החוסם**: `renderToStaticMarkup` מרנדר את המצב
 * ההתחלתי, שבו תיבת האישור אינה מסומנת, ולכן זה בדיוק המצב שבו אסור שכפתור
 * היצירה יהיה לחיץ. הכיוון ההפוך (סימון → כפתור פתוח) נבדק ב-`lib/players.test.ts`
 * על `validateParentConsent`, כי לחיצה דורשת DOM שאין בו כאן.
 */
describe('טופס הוספת שחקן — שער הסכמת ההורה', () => {
  const formHtml = renderToStaticMarkup(
    <AddPlayerForm
      teamName={team.name}
      takenUsernames={[]}
      onSubmit={async () => true}
      onClose={() => {}}
    />,
  );

  /** תג הכפתור שמכיל את תווית היצירה. */
  const submitButton = (() => {
    const labelAt = formHtml.indexOf(he.coach.team.add.submit);
    return formHtml.slice(formHtml.lastIndexOf('<button', labelAt), labelAt);
  })();

  it('יש תיבת סימון לאישור הסכמת ההורה, לא רק תזכורת', () => {
    expect(formHtml).toContain('type="checkbox"');
    expect(formHtml).toContain(he.coach.team.add.consentConfirm);
  });

  it('כפתור היצירה חסום כל עוד התיבה לא סומנה', () => {
    // התכונה עצמה, לא המחרוזת 'disabled' שמופיעה גם במחלקות Tailwind
    // (disabled:bg-slate-400). בלי הדיוק הזה הטסט היה עובר גם בלי החסימה.
    expect(submitButton).toContain('disabled=""');
  });

  it('מוסבר למה הכפתור חסום', () => {
    expect(formHtml).toContain(he.coach.team.add.consentRequired);
  });

  it('התיבה אינה שדה נתונים — היא לא מסומנת מראש ואין לה ערך שנשלח', () => {
    const checkbox = (formHtml.match(/<input[^>]*type="checkbox"[^>]*>/) ?? [''])[0];
    expect(checkbox).not.toContain('checked');
    expect(checkbox).not.toContain('name=');
  });
});

describe('אין עברית שנשארה בקוד במקום במילון', () => {
  it('כל טקסט עברי במסך ובטופס מגיע מ-i18n/he.ts', () => {
    const known = dictionaryStrings([
      // מגיעים מהמסד, לא מהמילון
      'בדיקה א.',
      'בדיקה ב.',
      'בדיקה ג.',
      team.name,
      t('coach.team.playersCount', { active: 2, total: 3 }),
      t('coach.team.playersCount', { active: 0, total: 0 }),
      ...players.map((player) => t('coach.team.usernameLine', { username: player.username })),
      t('coach.team.add.teamNotice', { team: team.name }),
      t('coach.team.add.passwordHint', { min: PASSWORD_MIN_LENGTH }),
    ]);

    const screens = [
      render(),
      render({ users: [] }),
      render({ status: 'error' }),
      render({ teams: [], selectedTeamId: null, users: [] }),
      renderToStaticMarkup(
        <AddPlayerForm
          teamName={team.name}
          takenUsernames={[]}
          onSubmit={async () => true}
          onClose={() => {}}
        />,
      ),
    ];

    for (const html of screens) {
      expect(unknownHebrewText(html, known)).toEqual([]);
    }
  });
});
