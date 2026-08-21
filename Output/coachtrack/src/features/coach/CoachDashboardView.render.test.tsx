/**
 * טסטי רינדור לדשבורד המאמן.
 *
 * אין כאן דפדפן ואין קליקים, ולכן נבדק מה שאפשר לבדוק באמת:
 *
 * • **מה המסך אומר בכל מצב** — טעינה, שגיאה, בלי קבוצה, בלי שחקנים, בלי תוכנית.
 *   ההבחנה בין "אין תוכנית" ל-0% היא החלטת מוצר, וקל להחליק אותה בטעות.
 * • **שקריטריון הסיום של שלב 5 מתקיים במספרים** — 15 שחקנים × 5 תרגילים
 *   מרונדרים במלואם, עם שורת סיכום ועמודת סיכום.
 * • **שהצבע תואם לאחוז** — 30% אדום, 60% כתום, 90% ירוק, לפי `pctTone` ולא
 *   לפי ספים שנכתבו כאן מחדש.
 * • **שהמחלקות של העמודה הנעוצה נמצאות על התאים הנכונים.**
 *
 * ⚠️ מה שהטסט הזה **אינו** מוכיח: שהעמודה באמת נשארת במקום בגלילה, ושהטבלה
 * נקראת בטלפון. `sticky` הוא התנהגות של מנוע רינדור, ואין לי דפדפן. את זה
 * רונן חייב לראות בעין.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { CoachDashboardView } from './CoachDashboardView';
import type { CoachDashboardViewProps } from './CoachDashboardView';
import { DEFAULT_MATRIX_SORT, buildTeamMatrix, type MatrixPlayer } from '../../lib/dashboard';
import { getWeekBounds } from '../../lib/dates';
import { roundPct } from '../../lib/calculations';
import { t } from '../../i18n/he';
import { dictionaryStrings, unknownHebrewText } from '../../testing/hebrewText';
import type { EntryDoc, PlanItem, TeamDoc } from '../../types/types';

const ORG = 'org_kiryat_ono';
const TEAM = 'team_yeladim_a';

/** שישי 21.8.2026, 09:00 בשעון ישראל. */
const NOW = new Date('2026-08-21T06:00:00Z');
const BOUNDS = getWeekBounds(NOW);

const team: TeamDoc = {
  id: TEAM,
  orgId: ORG,
  coachUid: 'uid_coach',
  name: 'ילדים א',
  season: '2026',
  active: true,
  settings: { leaderboardEnabled: false, streakThreshold: 80, weekStartDay: 0 },
};

/** חמישה תרגילים — הרוחב שקריטריון הסיום של שלב 5 מדבר עליו. */
const ITEMS: PlanItem[] = [
  { exerciseId: 'shoot_form', exerciseName: 'זריקות טכניקה', unit: 'count', target: 300, notes: '' },
  { exerciseId: 'def_stance', exerciseName: 'עמידת הגנה', unit: 'minutes', target: 15, notes: '' },
  { exerciseId: 'dribble_low', exerciseName: 'כדרור נמוך', unit: 'minutes', target: 20, notes: '' },
  { exerciseId: 'core_work', exerciseName: 'חיזוק ליבה', unit: 'sessions', target: 3, notes: '' },
  { exerciseId: 'run_easy', exerciseName: 'ריצה קלה', unit: 'distance_km', target: 5, notes: '' },
];

/** 15 שחקנים, שמות מהאלפבית העברי. */
const LETTERS = 'אבגדהוזחטיכלמנס';
const PLAYERS: MatrixPlayer[] = [...LETTERS].map((letter, index) => ({
  uid: `uid_${index}`,
  displayName: `שחקן ${letter}.`,
}));

let seq = 0;

function entry(overrides: Partial<EntryDoc> = {}): EntryDoc {
  seq += 1;
  return {
    id: `entry_${seq}`,
    playerUid: PLAYERS[0].uid,
    teamId: TEAM,
    orgId: ORG,
    cycleId: 'cycle_1',
    exerciseId: ITEMS[0].exerciseId,
    amount: 100,
    successAmount: null,
    date: Timestamp.fromDate(new Date('2026-08-19T09:00:00Z')),
    note: '',
    createdAt: Timestamp.fromDate(new Date('2026-08-19T10:00:00Z')),
    createdBy: PLAYERS[0].uid,
    deleted: false,
    ...overrides,
  };
}

/** דיווח לכל שחקן על התרגיל הראשון, באחוז עולה — כדי שיהיו כל שלושת הצבעים. */
const SPREAD_ENTRIES: EntryDoc[] = PLAYERS.map((player, index) =>
  entry({ playerUid: player.uid, amount: index * 20 + 20 }),
);

function render(overrides: Partial<CoachDashboardViewProps> = {}): string {
  const matrix = buildTeamMatrix(PLAYERS, ITEMS, SPREAD_ENTRIES);

  const props: CoachDashboardViewProps = {
    status: 'ready',
    hasTeam: true,
    teams: [team],
    selectedTeamId: TEAM,
    onSelectTeam: () => {},
    weekStart: BOUNDS.weekStart,
    weekEnd: BOUNDS.weekEnd,
    daysLeft: 2,
    hasPlan: true,
    cycleError: false,
    matrix,
    sort: DEFAULT_MATRIX_SORT,
    onSort: () => {},
    onOpenPlayer: () => {},
    ...overrides,
  };

  return renderToStaticMarkup(
    <MemoryRouter>
      <CoachDashboardView {...props} />
    </MemoryRouter>,
  );
}

describe('מצבי המסך', () => {
  it('בלי קבוצה — הודעה, בלי טבלה', () => {
    const html = render({ hasTeam: false });
    expect(html).toContain(t('coach.dashboard.noTeam'));
    expect(html).not.toContain('<table');
  });

  it('טעינה ושגיאה — שני מסכים שונים', () => {
    expect(render({ status: 'loading' })).toContain(t('coach.dashboard.loading'));
    expect(render({ status: 'error' })).toContain(t('coach.dashboard.loadError'));
  });

  it('אין תוכנית לשבוע — הודעה והפניה, ולא טבלה של אפסים', () => {
    const html = render({ hasPlan: false });
    expect(html).toContain(t('coach.dashboard.noPlan'));
    expect(html).toContain(t('coach.dashboard.noPlanLink'));
    expect(html).not.toContain('<table');
    // 0% היה אומר "לא עשו"; אין תוכנית אומר "לא ביקשו מהם".
    expect(html).not.toContain(t('coach.dashboard.kpi.average'));
  });

  it('אין שחקנים פעילים — הפניה למסך הקבוצה', () => {
    const html = render({ matrix: buildTeamMatrix([], ITEMS, []) });
    expect(html).toContain(t('coach.dashboard.noPlayers'));
    expect(html).not.toContain('<table');
  });

  it('כשלון בפתיחת המחזור מוצג בנפרד מכשלון טעינה', () => {
    const html = render({ cycleError: true });
    expect(html).toContain(t('coach.dashboard.cycleFailed'));
    expect(html).toContain('<table');
  });
});

describe('קריטריון הסיום: 15 שחקנים × 5 תרגילים', () => {
  const html = render();

  it('כל 15 השחקנים מרונדרים', () => {
    for (const player of PLAYERS) {
      expect(html).toContain(player.displayName);
    }
    // 15 שורות גוף — כפתור פתיחת כרטיס לכל שחקן.
    const openButtons = html.match(/aria-label="פתיחת הכרטיס של/g) ?? [];
    expect(openButtons).toHaveLength(15);
  });

  it('כל 5 התרגילים מופיעים ככותרות עמודה, עם היעד שלהם', () => {
    for (const item of ITEMS) {
      expect(html).toContain(item.exerciseName);
      expect(html).toContain(
        t('coach.dashboard.matrix.columnTarget', {
          target: item.target,
          unit: t(`units.${item.unit}`),
        }),
      );
    }
  });

  it('יש עמודת סיכום לשחקן ושורת סיכום לתרגיל', () => {
    expect(html).toContain(t('coach.dashboard.matrix.overallColumn'));
    expect(html).toContain(t('coach.dashboard.matrix.teamRow'));

    const matrix = buildTeamMatrix(PLAYERS, ITEMS, SPREAD_ENTRIES);
    // ממוצע הקבוצה מופיע בשורת הסיכום.
    expect(html).toContain(`${roundPct(matrix.kpi.averagePct)}%`);
  });

  it('שלושת ה-KPI מציגים את המספרים של המטריצה', () => {
    const { kpi } = buildTeamMatrix(PLAYERS, ITEMS, SPREAD_ENTRIES);
    expect(html).toContain(
      t('coach.dashboard.kpi.reportedValue', { count: kpi.reportedCount, total: kpi.playerCount }),
    );
    expect(kpi.reportedCount).toBe(15);
    expect(html).toContain(t('coach.dashboard.kpi.zero'));
  });
});

describe('צבע מול אחוז', () => {
  function cellHtml(amount: number): string {
    const matrix = buildTeamMatrix(
      [PLAYERS[0]],
      [ITEMS[0]],
      [entry({ playerUid: PLAYERS[0].uid, amount })],
    );
    return render({ matrix });
  }

  it('מתחת ל-50% אדום', () => {
    const html = cellHtml(90); // 30%
    expect(html).toContain('bg-red-100');
    expect(html).toContain('30%');
  });

  it('50–79% כתום', () => {
    const html = cellHtml(180); // 60%
    expect(html).toContain('bg-amber-100');
    expect(html).not.toContain('bg-red-100');
  });

  it('80% ומעלה ירוק', () => {
    const html = cellHtml(270); // 90%
    expect(html).toContain('bg-emerald-100');
    expect(html).not.toContain('bg-amber-100');
  });

  it('התא מציג את האחוז המלא, והסיכום נחסם ב-100', () => {
    // 1200 מתוך 300 = 400% בתא, 100% בעמודת הסיכום ובשורת הסיכום.
    const html = cellHtml(1200);
    expect(html).toContain('400%');
    expect(html).toContain('100%');
  });
});

describe('העמודה הנעוצה', () => {
  const html = render();

  it('תא השם בכל שורה נעוץ ל-inline-start, לא ל-right', () => {
    const sticky = html.match(/sticky start-0/g) ?? [];
    // 15 שורות + כותרת + שורת סיכום.
    expect(sticky).toHaveLength(17);
    expect(html).not.toContain('sticky right-0');
  });

  it('התא הנעוץ אטום — אחרת העמודות נראות דרכו בגלילה', () => {
    expect(html).toMatch(/sticky start-0[^"]*bg-white/);
  });

  it('הטבלה היא border-separate, אחרת הגבולות נשברים מתחת לתא הנעוץ', () => {
    expect(html).toContain('border-separate');
    expect(html).toContain('border-spacing-0');
  });

  it('המכל גולל אופקית', () => {
    expect(html).toContain('overflow-x-auto');
  });
});

describe('מיון', () => {
  it('העמודה שממוינת לפיה מסומנת ב-aria-sort', () => {
    const html = render({ sort: { key: { kind: 'name' }, direction: 'desc' } });
    expect(html).toContain('aria-sort="descending"');
    expect(html).toContain(t('coach.dashboard.matrix.sortDesc'));
  });

  it('לכל כותרת יש כפתור מיון עם שם נגיש', () => {
    const html = render();
    expect(html).toContain(
      t('coach.dashboard.matrix.sortAction', { column: t('coach.dashboard.matrix.playerColumn') }),
    );
    expect(html).toContain(
      t('coach.dashboard.matrix.sortAction', { column: ITEMS[0].exerciseName }),
    );
  });
});

describe('כלל 8 — אין עברית מחוץ למילון', () => {
  it('כל טקסט עברי על המסך מגיע מ-i18n/he.ts', () => {
    const matrix = buildTeamMatrix(PLAYERS, ITEMS, SPREAD_ENTRIES);

    const known = dictionaryStrings([
      team.name,
      ...PLAYERS.map((player) => player.displayName),
      ...ITEMS.map((item) => item.exerciseName),
      ...ITEMS.map((item) =>
        t('coach.dashboard.matrix.columnTarget', {
          target: item.target,
          unit: t(`units.${item.unit}`),
        }),
      ),
      ...matrix.rows.map((row) =>
        t('coach.dashboard.matrix.openPlayer', { name: row.displayName }),
      ),
      t('coach.dashboard.weekRange', { start: '16.08.2026', end: '22.08.2026' }),
      t('coach.dashboard.daysLeft', { count: 2 }),
      t('coach.dashboard.kpi.reportedValue', { count: 15, total: 15 }),
      t('coach.dashboard.matrix.sortAction', {
        column: t('coach.dashboard.matrix.playerColumn'),
      }),
      t('coach.dashboard.matrix.sortAction', {
        column: t('coach.dashboard.matrix.overallColumn'),
      }),
      ...ITEMS.map((item) =>
        t('coach.dashboard.matrix.sortAction', { column: item.exerciseName }),
      ),
    ]);

    const screens = [
      render(),
      render({ hasPlan: false }),
      render({ status: 'error' }),
      render({ cycleError: true }),
      render({ matrix: buildTeamMatrix([], ITEMS, []) }),
    ];

    for (const html of screens) {
      expect(unknownHebrewText(html, known)).toEqual([]);
    }
  });
});
