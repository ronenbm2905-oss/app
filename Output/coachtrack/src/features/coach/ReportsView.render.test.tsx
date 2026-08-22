/**
 * טסטי רינדור למסך הסיכום השבועי (TASKS שלב 6).
 *
 * מה שנבדק כאן הוא **שכל מצב אומר משהו** — כי זו הדרישה המפורשת של שלב 6
 * ("מסכי טעינה ושגיאה בכל מסך"), ובגלל שהמסך הזה הוא הראשון שיש בו טווח
 * שהמשתמש בוחר, כלומר הרבה יותר מצבים ריקים אפשריים:
 *
 * • טעינה / שגיאה / אין קבוצה — שלוש הודעות שונות.
 * • טווח בלי תוכנית → "אין מול מה למדוד", **לא** 0% ולא טבלה של אפסים.
 * • קבוצה בלי שחקנים → הפניה למסך הקבוצה.
 * • תיבת התצוגה המקדימה מופיעה רק אחרי שנוצר טקסט, ומכילה אותו.
 *
 * מה שלא נבדק כאן ודורש עין: שההעתקה ללוח באמת עובדת בטלפון. זו
 * אינטראקציה מול API של הדפדפן, והיא רשומה בדיווח כפריט לבדיקה ידנית.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { ReportsView } from './ReportsView';
import type { ReportsViewProps } from './ReportsView';
import { buildTeamWhatsAppText, buildWeeklyReport, type ReportRange } from '../../lib/report';
import { entryDateForDay } from '../../lib/entries';
import { formatIsraeliDate, getWeekKey, israeliWallTime } from '../../lib/dates';
import { roundPct } from '../../lib/calculations';
import { t } from '../../i18n/he';
import { dictionaryStrings, unknownHebrewText } from '../../testing/hebrewText';
import type { EntryDoc, PlanCycleDoc, PlanItem, TeamDoc } from '../../types/types';
import type { MatrixPlayer } from '../../lib/dashboard';

const NOW = new Date('2026-08-20T09:00:00Z');
const WEEK = getWeekKey(NOW);
const TEAM_ID = 'team_yeladim_a';
const ORG_ID = 'org_kiryat_ono';
const TEAM_NAME = 'ילדים א';

const ITEM: PlanItem = {
  exerciseId: 'def_stance',
  exerciseName: 'החזקת עמידת הגנה',
  unit: 'minutes',
  target: 15,
  notes: '',
};

const PLAYERS: MatrixPlayer[] = [
  { uid: 'uid_a', displayName: 'דניאל כ' },
  { uid: 'uid_b', displayName: 'יונתן ל' },
  { uid: 'uid_c', displayName: 'עומר ב' },
];

const team: TeamDoc = {
  id: TEAM_ID,
  orgId: ORG_ID,
  coachUid: 'uid_coach',
  name: TEAM_NAME,
  season: '2026/27',
  active: true,
  settings: { leaderboardEnabled: false, streakThreshold: 80, weekStartDay: 0 },
};

const CYCLE: PlanCycleDoc = {
  id: `${TEAM_ID}_${WEEK}`,
  planId: 'plan_1',
  teamId: TEAM_ID,
  orgId: ORG_ID,
  weekStart: Timestamp.fromDate(israeliWallTime(WEEK, '00:00:00.000')),
  weekEnd: Timestamp.fromDate(israeliWallTime('2026-08-22', '23:59:59.999')),
  itemsSnapshot: [ITEM],
  createdAt: Timestamp.fromDate(NOW),
};

let seq = 0;

function entry(playerUid: string, amount: number): EntryDoc {
  seq += 1;
  return {
    id: `entry_${seq}`,
    playerUid,
    teamId: TEAM_ID,
    orgId: ORG_ID,
    cycleId: CYCLE.id,
    exerciseId: ITEM.exerciseId,
    amount,
    successAmount: null,
    date: entryDateForDay('2026-08-18'),
    note: '',
    createdAt: Timestamp.fromDate(NOW),
    createdBy: playerUid,
    deleted: false,
  };
}

const RANGE: ReportRange = { kind: 'current', from: WEEK, to: '2026-08-22' };

/** דניאל 100%, יונתן 87%, עומר 27% — שלוש הקבוצות של ההודעה מיוצגות. */
const ENTRIES: EntryDoc[] = [
  entry(PLAYERS[0].uid, 15),
  entry(PLAYERS[1].uid, 13),
  entry(PLAYERS[2].uid, 4),
];

const REPORT = buildWeeklyReport({
  players: PLAYERS,
  cycles: [CYCLE],
  entries: ENTRIES,
  range: RANGE,
});

function render(overrides: Partial<ReportsViewProps> = {}): string {
  const props: ReportsViewProps = {
    status: 'ready',
    hasTeam: true,
    teams: [team],
    selectedTeamId: TEAM_ID,
    onSelectTeam: () => {},
    range: RANGE,
    onSelectRangeKind: () => {},
    onChangeFrom: () => {},
    onChangeTo: () => {},
    maxDay: '2026-08-22',
    report: REPORT,
    previousPct: 71,
    previewText: null,
    onPreviewChange: () => {},
    copyFeedback: null,
    onCopyTeam: () => {},
    onCopyPlayer: () => {},
    ...overrides,
  };

  return renderToStaticMarkup(
    <MemoryRouter>
      <ReportsView {...props} />
    </MemoryRouter>,
  );
}

/* ------------------------------------------------------------------ */

describe('מצבי המסך', () => {
  it('בלי קבוצה — הודעה, בלי בורר טווח', () => {
    const html = render({ hasTeam: false });
    expect(html).toContain(t('coach.reports.noTeam'));
    expect(html).not.toContain(t('coach.reports.rangeLabel'));
  });

  it('טעינה ושגיאה — שני מסכים שונים, ואף אחד מהם אינו ריק', () => {
    expect(render({ status: 'loading' })).toContain(t('coach.reports.loading'));
    expect(render({ status: 'error' })).toContain(t('coach.reports.loadError'));
  });

  it('אין תוכנית בטווח — הסבר והפניה, ולא 0%', () => {
    const html = render({
      report: buildWeeklyReport({ players: PLAYERS, cycles: [], entries: [], range: RANGE }),
    });

    expect(html).toContain(t('coach.reports.noPlanTitle'));
    expect(html).toContain(t('coach.reports.noPlanBody'));
    // ה-KPI לא מוצג בכלל: "ממוצע קבוצתי 0%" בשבוע בלי יעדים הוא מספר שקרי.
    expect(html).not.toContain(t('coach.reports.kpiAverage'));
    expect(html).not.toContain(t('coach.reports.copyTeam'));
  });

  it('אין שחקנים — הפניה למסך הקבוצה', () => {
    const html = render({
      report: buildWeeklyReport({ players: [], cycles: [CYCLE], entries: [], range: RANGE }),
    });

    expect(html).toContain(t('coach.reports.noPlayers'));
    expect(html).not.toContain(t('coach.reports.playersTitle'));
  });

  it('בורר הטווח תמיד מציג את התאריכים אחרי ההצמדה לשבוע', () => {
    const html = render();
    expect(html).toContain(
      t('coach.reports.snapNote', {
        start: formatIsraeliDate(REPORT.weekStart),
        end: formatIsraeliDate(REPORT.weekEnd),
      }),
    );
  });

  it('שדות התאריך מופיעים רק בטווח חופשי', () => {
    expect(render()).not.toContain(t('coach.reports.from'));
    expect(render({ range: { ...RANGE, kind: 'custom' } })).toContain(t('coach.reports.from'));
  });
});

describe('תוכן הדוח', () => {
  const html = render();

  it('כל שחקן מופיע עם האחוז שלו ועם כפתור סיכום אישי', () => {
    for (const player of REPORT.players) {
      expect(html).toContain(player.displayName);
      expect(html).toContain(`${roundPct(player.pct)}%`);
    }

    // נספר לפי ה-aria-label ולא לפי טקסט הכפתור: הטקסט מופיע גם בתוך
    // משפט ההסבר מעל הרשימה, וספירה שלו הייתה מחזירה אחד יותר.
    for (const player of REPORT.players) {
      expect(html).toContain(
        t('coach.reports.copyPlayerFor', { name: player.displayName }),
      );
    }
    const buttons = html.match(/aria-label="העתק סיכום אישי של/g) ?? [];
    expect(buttons).toHaveLength(PLAYERS.length);
  });

  it('הממוצע על המסך זהה לזה שייכנס להודעה', () => {
    // שני מקומות שמחשבים היו נותנים שני מספרים, והמאמן לא היה יודע מי צודק.
    const message = buildTeamWhatsAppText({
      report: REPORT,
      teamName: TEAM_NAME,
      previousPct: 71,
    });

    expect(html).toContain(`${roundPct(REPORT.averagePct)}%`);
    expect(message).toContain(`${roundPct(REPORT.averagePct)}%`);
  });

  it('התרגיל מוצג עם היעד והיחידה', () => {
    expect(html).toContain(ITEM.exerciseName);
    expect(html).toContain(t('units.minutes'));
  });
});

describe('תיבת התצוגה המקדימה', () => {
  it('לא מוצגת לפני שנוצר טקסט', () => {
    expect(render()).not.toContain(t('coach.reports.previewLabel'));
  });

  it('מציגה את הטקסט שנוצר, כדי שאפשר יהיה להעתיק ידנית כשה-API נכשל', () => {
    const message = buildTeamWhatsAppText({
      report: REPORT,
      teamName: TEAM_NAME,
      previousPct: 71,
    });

    const html = render({
      previewText: message,
      copyFeedback: { tone: 'error', text: t('coach.reports.copyFailed') },
    });

    expect(html).toContain(t('coach.reports.previewLabel'));
    expect(html).toContain(t('coach.reports.copyFailed'));
    // הטקסט עצמו בתוך ה-textarea — לא רק ההודעה שההעתקה נכשלה.
    expect(html).toContain('צריך דחיפה');
    expect(html).toContain(`${roundPct(REPORT.averagePct)}%`);
  });

  it('הודעת הצלחה מוצגת בגוון אחר מהודעת כשל', () => {
    const success = render({
      previewText: 'טקסט',
      copyFeedback: { tone: 'success', text: t('coach.reports.copied') },
    });

    expect(success).toContain(t('coach.reports.copied'));
    expect(success).toContain('role="status"');
  });
});

describe('כלל 8 — כל טקסט עברי מגיע מהמילון', () => {
  it('אין מחרוזת עברית שאינה במילון או בנתוני המסד', () => {
    const message = buildTeamWhatsAppText({
      report: REPORT,
      teamName: TEAM_NAME,
      previousPct: 71,
    });

    const known = dictionaryStrings([
      TEAM_NAME,
      ITEM.exerciseName,
      ...PLAYERS.map((player) => player.displayName),
      message,
      t('coach.reports.snapNote', {
        start: formatIsraeliDate(REPORT.weekStart),
        end: formatIsraeliDate(REPORT.weekEnd),
      }),
      t('coach.reports.kpiReportedValue', { count: 3, total: 3 }),
      t('coach.reports.text.previous', { pct: 71 }),
      // שורת התרגיל מרכיבה כמה מפתחות לצומת טקסט אחד, ולכן היא נמסרת שלמה.
      ...REPORT.exercises.map(
        (item) =>
          `${t('coach.reports.exerciseTotal')} ${item.total} · ${t('coach.reports.exerciseTarget')} ${item.target} ${t(`units.${item.unit}`)}`,
      ),
      ...REPORT.players.map((player) =>
        t('coach.reports.copyPlayerFor', { name: player.displayName }),
      ),
    ]);

    const screens = [
      render(),
      render({ status: 'error' }),
      render({ status: 'loading' }),
      render({ hasTeam: false }),
      render({ range: { ...RANGE, kind: 'custom' } }),
      render({ previewText: message }),
      render({
        report: buildWeeklyReport({ players: PLAYERS, cycles: [], entries: [], range: RANGE }),
      }),
      render({
        report: buildWeeklyReport({ players: [], cycles: [CYCLE], entries: [], range: RANGE }),
      }),
    ];

    for (const html of screens) {
      expect(unknownHebrewText(html, known)).toEqual([]);
    }
  });
});
