/**
 * טסטי רינדור לכרטיס השחקן.
 *
 * מה שנבדק כאן הוא מה שאי אפשר "לראות שנכון" בלי לפתוח את הקוד:
 *
 * • **ארבעת החלקים של TASKS שלב 5ב** קיימים על המסך: גרף, פילוח, יומן, הערות.
 * • **דיווח שנמחק-רכות מוצג ומסומן, ובלי כפתורי עריכה** — המאמן צריך לדעת
 *   שהיה דיווח, ולא להמשיך לערוך אותו.
 * • **למאמן אין חלון עריכה של 7 ימים** — דיווח בן חודשיים עדיין ניתן לעריכה,
 *   בניגוד למסך השחקן. זה מראה של `firestore.rules`, ואם מישהו "יתקן" את זה
 *   לעקביות עם השחקן, הטסט ייפול.
 * • **המיתון של דגל תיקון 13** על הערות המאמן: טקסט עזר מגביל, שורת פרטיות,
 *   ו-`maxLength` בפועל על השדה.
 *
 * מה שלא נבדק כאן: שהשחקן באמת לא רואה את ההערה — זו שאלה של הרשאות, והיא
 * נבדקת ב-`rules-tests/firestore.rules.test.ts` מול האמולטור.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Timestamp } from 'firebase/firestore';
import { PlayerCard } from './PlayerCard';
import type { PlayerCardProps } from './PlayerCard';
import { PAGE_SIZE } from './PlayerEntryLog';
import { COACH_NOTE_MAX_LENGTH } from '../../lib/coachNotes';
import { buildWeekSummaries, currentStreak, exerciseTrends } from '../../lib/entries';
import { getWeekKey } from '../../lib/dates';
import { historicalPlanItems } from '../../lib/dashboard';
import { t } from '../../i18n/he';
import { dictionaryStrings, unknownHebrewText } from '../../testing/hebrewText';
import type { EntryDoc, PlanCycleDoc, PlanItem, UserDoc } from '../../types/types';

const ORG = 'org_kiryat_ono';
const TEAM = 'team_yeladim_a';
const PLAYER_UID = 'uid_player_a';
const COACH_UID = 'uid_coach';

/** שישי 21.8.2026. השבוע: ראשון 16.8 עד שבת 22.8. */
const NOW = new Date('2026-08-21T06:00:00Z');
const WEEK_KEY = getWeekKey(NOW);

const STANCE: PlanItem = {
  exerciseId: 'def_stance',
  exerciseName: 'עמידת הגנה',
  unit: 'minutes',
  target: 15,
  notes: '',
};

const player: UserDoc = {
  uid: PLAYER_UID,
  role: 'player',
  orgId: ORG,
  displayName: 'בודק ב.',
  username: 'tester',
  teamIds: [TEAM],
  active: true,
  mustChangePassword: false,
  createdAt: Timestamp.fromDate(new Date('2026-08-01T09:00:00Z')),
};

function cycle(weekKey: string, items: PlanItem[]): PlanCycleDoc {
  const start = new Date(`${weekKey}T00:00:00Z`);
  return {
    id: `${TEAM}_${weekKey}`,
    planId: 'plan_1',
    teamId: TEAM,
    orgId: ORG,
    weekStart: Timestamp.fromDate(start),
    weekEnd: Timestamp.fromDate(new Date(start.getTime() + 6 * 24 * 3600 * 1000)),
    itemsSnapshot: items,
    createdAt: Timestamp.fromDate(start),
  };
}

let seq = 0;

function entry(overrides: Partial<EntryDoc> = {}): EntryDoc {
  seq += 1;
  return {
    id: `entry_${seq}`,
    playerUid: PLAYER_UID,
    teamId: TEAM,
    orgId: ORG,
    cycleId: `${TEAM}_${WEEK_KEY}`,
    exerciseId: STANCE.exerciseId,
    amount: 5,
    successAmount: null,
    date: Timestamp.fromDate(new Date('2026-08-19T09:00:00Z')),
    note: '',
    createdAt: Timestamp.fromDate(new Date('2026-08-19T10:00:00Z')),
    createdBy: PLAYER_UID,
    deleted: false,
    ...overrides,
  };
}

const CYCLES = [cycle(WEEK_KEY, [STANCE]), cycle('2026-08-09', [STANCE])];

const ENTRIES: EntryDoc[] = [
  entry({ id: 'e_fresh', amount: 5 }),
  entry({ id: 'e_second', amount: 6, note: 'עשיתי בבית' }),
  entry({ id: 'e_deleted', amount: 7, deleted: true }),
  entry({
    id: 'e_ancient',
    amount: 9,
    date: Timestamp.fromDate(new Date('2026-06-21T09:00:00Z')),
    createdAt: Timestamp.fromDate(new Date('2026-06-21T10:00:00Z')),
    createdBy: COACH_UID,
  }),
];

function render(overrides: Partial<PlayerCardProps> = {}): string {
  const summaries = buildWeekSummaries(CYCLES, ENTRIES, { threshold: 80 });

  const props: PlayerCardProps = {
    player,
    teamName: 'ילדים א',
    summaries,
    currentWeekKey: WEEK_KEY,
    streak: currentStreak(summaries, WEEK_KEY),
    threshold: 80,
    trends: exerciseTrends(summaries),
    entries: ENTRIES,
    items: historicalPlanItems(CYCLES),
    busyEntryId: null,
    feedback: null,
    noteStatus: 'ready',
    noteText: '',
    noteUpdatedAt: null,
    noteBusy: false,
    noteError: null,
    noteSaved: false,
    onSaveNote: () => {},
    onBack: () => {},
    onEditEntry: () => {},
    onDeleteEntry: () => {},
    ...overrides,
  };

  return renderToStaticMarkup(<PlayerCard {...props} />);
}

describe('ארבעת החלקים של הכרטיס', () => {
  const html = render();

  it('גרף, פילוח, יומן והערות — כולם על המסך', () => {
    expect(html).toContain(t('coach.player.chartTitle'));
    expect(html).toContain(t('coach.player.breakdownTitle'));
    expect(html).toContain(t('coach.player.log.title'));
    expect(html).toContain(t('coach.player.note.title'));
  });

  it('הכותרת מציגה שם, שם משתמש, קבוצה ותאריך יצירה — ולא יותר מזה', () => {
    expect(html).toContain(player.displayName);
    expect(html).toContain(t('coach.team.usernameLine', { username: player.username }));
    expect(html).toContain('ילדים א');
    expect(html).toContain(t('coach.player.joined', { date: '01.08.2026' }));
  });

  it('האחוז השבועי מחושב מהמחזור: 11 מתוך 15 = 73%', () => {
    expect(html).toContain(t('coach.player.weekOverall', { pct: 73 }));
  });

  it('כפתור חזרה לדשבורד קיים — הכרטיס אינו מסך ללא מוצא', () => {
    expect(html).toContain(t('coach.player.back'));
  });
});

describe('יומן הדיווחים', () => {
  const html = render();

  it('דיווח שנמחק מוצג, מסומן, ובלי כפתורי עריכה', () => {
    expect(html).toContain(t('coach.player.log.deletedBadge'));

    // שלושה דיווחים פעילים → שלושה כפתורי עריכה, לא ארבעה.
    const editButtons = html.match(new RegExp(`>${t('coach.player.log.edit')}<`, 'g')) ?? [];
    expect(editButtons).toHaveLength(3);
  });

  it('למאמן אין חלון עריכה — דיווח בן חודשיים עדיין ניתן לעריכה', () => {
    // אצל השחקן היה כאן "אי אפשר לערוך אחרי 7 ימים". למאמן הכלל מתיר תמיד.
    expect(html).not.toContain(t('player.log.locked', { days: 7 }));
  });

  it('דיווח שהמאמן הזין מסומן ככזה', () => {
    expect(html).toContain(t('coach.player.log.coachBadge'));
  });

  it('הערת השחקן מוצגת עם ההקשר שלה', () => {
    expect(html).toContain(t('coach.player.log.playerNote', { note: 'עשיתי בבית' }));
  });

  it('רשימה ארוכה נחתכת עם כפתור להצגת עוד', () => {
    const many = Array.from({ length: PAGE_SIZE + 5 }, (_unused, index) =>
      entry({ id: `bulk_${index}` }),
    );
    const html2 = render({ entries: many });

    expect(html2).toContain(t('coach.player.log.showMore'));
    expect(html2).toContain(
      t('coach.player.log.shown', { shown: PAGE_SIZE, total: PAGE_SIZE + 5 }),
    );
  });

  it('שחקן בלי דיווחים — הודעה, לא רשימה ריקה', () => {
    const html2 = render({ entries: [], summaries: [], trends: [] });
    expect(html2).toContain(t('coach.player.log.empty'));
  });
});

describe('הערות מאמן — המיתון של דגל תיקון 13', () => {
  const html = render();

  it('שורת פרטיות מפורשת: השחקן אינו רואה', () => {
    expect(html).toContain(t('coach.player.note.privacy'));
  });

  it('טקסט עזר עובדתי שמגביל מה נכתב בשדה — בניסוח של עדי', () => {
    const hint = t('coach.player.note.notesPrivacyHint');
    expect(html).toContain(hint);
    // ההנחיה חייבת להישאר קונקרטית — לא "כתוב בזהירות".
    expect(hint).toContain('מידע רפואי');
    expect(hint).toContain('אישיותו');
  });

  it('לצד ההנחיה המשפטית — מה כן כותבים ומה האורך המרבי', () => {
    expect(html).toContain(t('coach.player.note.writingHint', { max: COACH_NOTE_MAX_LENGTH }));
  });

  it('אורך השדה מוגבל בפועל, לא רק בהנחיה', () => {
    // React מרנדר את התכונה בשמה ה-camelCase; זה מה שמגיע ל-DOM בפועל.
    expect(html).toContain(`maxLength="${COACH_NOTE_MAX_LENGTH}"`);
  });

  it('מצבי טעינה ושגיאה של ההערה נפרדים משאר המסך', () => {
    expect(render({ noteStatus: 'loading' })).toContain(t('coach.player.note.loading'));
    expect(render({ noteStatus: 'error' })).toContain(t('coach.player.note.loadError'));
  });

  it('כשיש הערה שמורה מוצג מתי עודכנה', () => {
    const html2 = render({
      noteText: 'סוכם שיעלה לשלושה אימוני כוח.',
      noteUpdatedAt: new Date('2026-08-20T09:00:00Z'),
    });
    expect(html2).toContain(t('coach.player.note.savedAt', { date: '20.08.2026' }));
  });
});

describe('כלל 8 — אין עברית מחוץ למילון', () => {
  it('כל טקסט עברי על המסך מגיע מ-i18n/he.ts', () => {
    const known = dictionaryStrings([
      player.displayName,
      'ילדים א',
      STANCE.exerciseName,
      'עשיתי בבית',
      'סוכם שיעלה לשלושה אימוני כוח.',
      t('coach.team.usernameLine', { username: player.username }),
      t('coach.player.joined', { date: '01.08.2026' }),
      t('coach.player.weekOverall', { pct: 73 }),
      t('coach.player.streak', { count: 2, threshold: 80 }),
      t('coach.player.streakOne', { threshold: 80 }),
      t('coach.player.log.playerNote', { note: 'עשיתי בבית' }),
      t('coach.player.log.shown', { shown: PAGE_SIZE, total: PAGE_SIZE + 5 }),
      t('coach.player.note.writingHint', { max: COACH_NOTE_MAX_LENGTH }),
      t('coach.player.note.savedAt', { date: '20.08.2026' }),
      t('player.history.breakdownTotals', {
        total: 11,
        target: 30,
        unit: t('units.minutes'),
      }),
      t('player.history.breakdownWeeks', { count: 2 }),
      t('coach.player.log.amount', { amount: 5, unit: t('units.minutes') }),
      t('coach.player.log.amount', { amount: 6, unit: t('units.minutes') }),
      t('coach.player.log.amount', { amount: 7, unit: t('units.minutes') }),
      t('coach.player.log.amount', { amount: 9, unit: t('units.minutes') }),
      t('player.history.noPlanWeek'),
    ]);

    const screens = [
      render(),
      render({ noteStatus: 'error' }),
      render({ entries: [], summaries: [], trends: [] }),
      render({
        noteText: 'סוכם שיעלה לשלושה אימוני כוח.',
        noteUpdatedAt: new Date('2026-08-20T09:00:00Z'),
      }),
    ];

    for (const html of screens) {
      expect(unknownHebrewText(html, known)).toEqual([]);
    }
  });
});
