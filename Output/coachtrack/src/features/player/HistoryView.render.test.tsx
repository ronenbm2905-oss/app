/**
 * טסטי רינדור למסך ההיסטוריה.
 *
 * הבדיקה המרכזית כאן היא **ששבוע מוצג מול היעד שהיה בו** ולא מול היעד של
 * היום: שני שבועות, אותו תרגיל, יעד שהשתנה — וכל שבוע שומר על האחוז שלו.
 * זו מלכודת 2 ב-TASKS.md, והיא נראית על המסך רק אם היא נשברה.
 *
 * בנוסף: שבוע בלי תוכנית מסומן ככזה ולא מוצג כ-0%, כי 0% אומר "נכשלת".
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { HistoryView } from './HistoryView';
import type { HistoryViewProps } from './HistoryView';
import {
  buildWeekSummaries,
  currentStreak,
  entryDateForDay,
  exerciseTrends,
} from '../../lib/entries';
import { he, t } from '../../i18n/he';
import { dictionaryStrings, unknownHebrewText } from '../../testing/hebrewText';
import type { EntryDoc, PlanCycleDoc, PlanItem } from '../../types/types';

const WEEK = '2026-08-16';
const PREVIOUS_WEEK = '2026-08-09';
const NOW = new Date('2026-08-20T09:00:00Z');

const SHOOTING: PlanItem = {
  exerciseId: 'shoot_form',
  exerciseName: 'זריקות טכניקה מקרוב',
  unit: 'count',
  target: 500,
  notes: '',
};

let seq = 0;

function entry(dayKey: string, amount: number): EntryDoc {
  seq += 1;
  return {
    id: `entry_${seq}`,
    playerUid: 'uid_player',
    teamId: 'team_yeladim_a',
    orgId: 'org_kiryat_ono',
    cycleId: null,
    exerciseId: SHOOTING.exerciseId,
    amount,
    successAmount: null,
    date: entryDateForDay(dayKey),
    note: '',
    createdAt: Timestamp.fromDate(NOW),
    createdBy: 'uid_player',
    deleted: false,
  };
}

function cycle(weekKey: string, target: number): PlanCycleDoc {
  return {
    id: `team_yeladim_a_${weekKey}`,
    planId: 'plan_1',
    teamId: 'team_yeladim_a',
    orgId: 'org_kiryat_ono',
    weekStart: Timestamp.fromDate(entryDateForDay(weekKey).toDate()),
    weekEnd: Timestamp.fromDate(entryDateForDay(weekKey).toDate()),
    itemsSnapshot: [{ ...SHOOTING, target }],
    createdAt: Timestamp.fromDate(NOW),
  };
}

function render(overrides: Partial<HistoryViewProps> = {}): string {
  const summaries =
    overrides.summaries ??
    buildWeekSummaries(
      [cycle(WEEK, 500), cycle(PREVIOUS_WEEK, 200)],
      [entry('2026-08-18', 250), entry('2026-08-12', 200)],
      { threshold: 80 },
    );

  const props: HistoryViewProps = {
    status: 'ready',
    hasTeam: true,
    summaries,
    currentWeekKey: WEEK,
    streak: currentStreak(summaries, WEEK),
    threshold: 80,
    trends: exerciseTrends(summaries),
    ...overrides,
  };

  return renderToStaticMarkup(
    <MemoryRouter>
      <HistoryView {...props} />
    </MemoryRouter>,
  );
}

describe('מצבים', () => {
  it('טעינה ושגיאה הם שני מסכים שונים', () => {
    expect(render({ status: 'loading' })).toContain(he.player.history.loading);
    expect(render({ status: 'error' })).toContain(he.player.history.loadError);
  });

  it('בלי היסטוריה — הסבר וקישור חזרה, לא מסך ריק', () => {
    const html = render({ summaries: [], trends: [], streak: 0 });
    expect(html).toContain(he.player.history.empty);
    expect(html).toContain(he.player.history.backToWeek);
  });
});

describe('שבוע אחר שבוע', () => {
  it('כל שבוע מוצג מול היעד שהיה בו — מלכודת 2', () => {
    const html = render();

    // השבוע הנוכחי: 250 מתוך 500 = 50%. השבוע שעבר: 200 מתוך 200 = 100%.
    expect(html).toContain(
      t('player.history.weekExercise', {
        name: SHOOTING.exerciseName,
        total: 250,
        target: 500,
        unit: he.units.count,
      }),
    );
    expect(html).toContain(
      t('player.history.weekExercise', {
        name: SHOOTING.exerciseName,
        total: 200,
        target: 200,
        unit: he.units.count,
      }),
    );
  });

  it('השבוע הנוכחי מסומן', () => {
    expect(render()).toContain(he.player.history.currentWeek);
  });

  it('שבוע בלי תוכנית מסומן ואינו מוצג כ-0%', () => {
    const summaries = buildWeekSummaries([cycle(WEEK, 500)], [entry('2026-08-12', 90)], {
      threshold: 80,
    });
    const html = render({ summaries, trends: exerciseTrends(summaries) });

    expect(html).toContain(he.player.history.noPlanWeek);
    expect(html).toContain(he.player.history.noPlanWeekHint);
  });

  it('גרף העמודות מצייר עמודה לכל שבוע', () => {
    const html = render();
    const bars = html.match(/role="img"/g) ?? [];
    expect(bars.length).toBe(2);
  });
});

describe('רצף ופילוח', () => {
  it('רצף של שבוע אחד מנוסח ביחיד', () => {
    const html = render({ streak: 1 });
    expect(html).toContain(he.player.history.streakOne);
  });

  it('בלי רצף מוצג מה פותח אותו', () => {
    const html = render({ streak: 0 });
    expect(html).toContain(he.player.history.streakNone);
    expect(html).toContain(t('player.history.streakOpenHint', { threshold: 80 }));
  });

  it('הפילוח מסכם את התרגיל על פני השבועות', () => {
    const html = render();
    expect(html).toContain(he.player.history.breakdownTitle);
    expect(html).toContain(
      t('player.history.breakdownTotals', { total: 450, target: 700, unit: he.units.count }),
    );
    expect(html).toContain(t('player.history.breakdownWeeks', { count: 2 }));
  });
});

describe('אין עברית שנשארה בקוד במקום במילון', () => {
  it('כל טקסט על המסך מגיע מ-i18n/he.ts', () => {
    const known = dictionaryStrings([
      SHOOTING.exerciseName,
      t('player.myWeek.weekRange', { start: '16.08.2026', end: '22.08.2026' }),
      t('player.myWeek.weekRange', { start: '09.08.2026', end: '15.08.2026' }),
      t('player.history.weekEntries', { count: 1 }),
      t('player.history.weekExercise', {
        name: SHOOTING.exerciseName,
        total: 250,
        target: 500,
        unit: he.units.count,
      }),
      t('player.history.weekExercise', {
        name: SHOOTING.exerciseName,
        total: 200,
        target: 200,
        unit: he.units.count,
      }),
      t('player.history.streakWeeks', { count: 2 }),
      t('player.history.streakHint', { threshold: 80 }),
      t('player.history.breakdownTotals', { total: 450, target: 700, unit: he.units.count }),
      t('player.history.breakdownWeeks', { count: 2 }),
    ]);

    expect(unknownHebrewText(render(), known)).toEqual([]);
  });
});
