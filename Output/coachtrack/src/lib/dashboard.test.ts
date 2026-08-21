/**
 * טסטים למטריצת המאמן.
 *
 * מה שנבדק כאן הוא בדיוק מה שאי אפשר לראות בעין על המסך: שהאחוז בתא לא נחסם
 * אבל הממוצעים כן, שדיווח מחוק לא נספר בשום מקום, ושהמיון יציב.
 *
 * הנתונים מחקים את המצב האמיתי במסד (21.8.2026): שחקן אחד עם 11 מתוך 15 דקות
 * (73%) ועוד שלושה בלי דיווחים כלל.
 */

import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  DEFAULT_MATRIX_SORT,
  buildTeamMatrix,
  entriesForPlayer,
  historicalPlanItems,
  isSortedBy,
  matrixPlayers,
  sortMatrixRows,
  toggleSort,
  type MatrixPlayer,
} from './dashboard';
import type { EntryDoc, PlanCycleDoc, PlanItem, UserDoc } from '../types/types';

const ORG = 'org_kiryat_ono';
const TEAM = 'team_yeladim_a';

const STANCE: PlanItem = {
  exerciseId: 'def_stance',
  exerciseName: 'עמידת הגנה',
  unit: 'minutes',
  target: 15,
  notes: '',
};

const SHOOT: PlanItem = {
  exerciseId: 'shoot_form',
  exerciseName: 'זריקות טכניקה מקרוב',
  unit: 'count',
  target: 300,
  notes: '',
};

const PLAYERS: MatrixPlayer[] = [
  { uid: 'uid_a', displayName: 'אורי א.' },
  { uid: 'uid_b', displayName: 'בן ב.' },
  { uid: 'uid_c', displayName: 'גיא ג.' },
];

let entrySeq = 0;

function entry(overrides: Partial<EntryDoc> = {}): EntryDoc {
  entrySeq += 1;
  return {
    id: `entry_${entrySeq}`,
    playerUid: 'uid_a',
    teamId: TEAM,
    orgId: ORG,
    cycleId: 'cycle_1',
    exerciseId: STANCE.exerciseId,
    amount: 5,
    successAmount: null,
    date: Timestamp.fromMillis(Date.UTC(2026, 7, 18, 9)),
    note: '',
    createdAt: Timestamp.fromMillis(Date.UTC(2026, 7, 18, 10)),
    createdBy: 'uid_a',
    deleted: false,
    ...overrides,
  };
}

describe('buildTeamMatrix — מבנה ואחוזים', () => {
  it('שחקן עם 11 מתוך 15 מקבל 73%, ומי שלא דיווח מקבל 0%', () => {
    const matrix = buildTeamMatrix(
      PLAYERS,
      [STANCE],
      [entry({ amount: 5 }), entry({ amount: 6 })],
    );

    const rowA = matrix.rows.find((row) => row.playerUid === 'uid_a');
    expect(rowA?.cells[0].total).toBe(11);
    expect(Math.round(rowA?.cells[0].pct ?? 0)).toBe(73);
    expect(Math.round(rowA?.overall ?? 0)).toBe(73);

    const rowB = matrix.rows.find((row) => row.playerUid === 'uid_b');
    expect(rowB?.cells[0].total).toBe(0);
    expect(rowB?.overall).toBe(0);
    expect(rowB?.reported).toBe(false);
  });

  it('התא הבודד אינו נחסם, והממוצעים כן', () => {
    // 60 דקות מול יעד 15 = 400% בתא; בממוצע הכללי זה נספר כ-100 בלבד.
    const matrix = buildTeamMatrix(
      [PLAYERS[0]],
      [STANCE, SHOOT],
      [entry({ amount: 60 })],
    );

    const row = matrix.rows[0];
    expect(row.cells[0].pct).toBe(400);
    // (100 + 0) / 2 — החסימה חלה על התרגיל הראשון לפני הממוצע.
    expect(row.overall).toBe(50);
    expect(matrix.columns[0].avgPct).toBe(100);
    expect(matrix.columns[0].total).toBe(60);
  });

  it('דיווח שנמחק-רכות לא נספר — לא בסכום, לא באחוז ולא במונה', () => {
    const matrix = buildTeamMatrix(
      [PLAYERS[0]],
      [STANCE],
      [entry({ amount: 5 }), entry({ amount: 7, deleted: true })],
    );

    const row = matrix.rows[0];
    expect(row.cells[0].total).toBe(5);
    expect(row.cells[0].entryCount).toBe(1);
    expect(row.entryCount).toBe(1);
  });

  it('תרגיל בלי דיווחים נספר כ-0 ולא מושמט מהממוצע', () => {
    const matrix = buildTeamMatrix([PLAYERS[0]], [STANCE, SHOOT], [entry({ amount: 15 })]);
    expect(matrix.rows[0].overall).toBe(50);
  });

  it('בלי פריטי תוכנית אין עמודות, וכל האחוזים 0', () => {
    const matrix = buildTeamMatrix(PLAYERS, null, [entry({ amount: 5 })]);
    expect(matrix.columns).toHaveLength(0);
    expect(matrix.rows[0].cells).toHaveLength(0);
    expect(matrix.kpi.averagePct).toBe(0);
  });

  it('סדר התאים זהה לסדר העמודות', () => {
    const matrix = buildTeamMatrix(PLAYERS, [SHOOT, STANCE], []);
    expect(matrix.rows[0].cells.map((cell) => cell.exerciseId)).toEqual([
      SHOOT.exerciseId,
      STANCE.exerciseId,
    ]);
    expect(matrix.columns.map((column) => column.exerciseId)).toEqual([
      SHOOT.exerciseId,
      STANCE.exerciseId,
    ]);
  });
});

describe('buildTeamMatrix — KPI', () => {
  it('ממוצע קבוצתי, כמה דיווחו וכמה ב-0%', () => {
    const matrix = buildTeamMatrix(
      PLAYERS,
      [STANCE],
      [entry({ playerUid: 'uid_a', amount: 15 }), entry({ playerUid: 'uid_b', amount: 3 })],
    );

    expect(matrix.kpi.playerCount).toBe(3);
    expect(matrix.kpi.reportedCount).toBe(2);
    expect(matrix.kpi.zeroCount).toBe(1);
    // (100 + 20 + 0) / 3
    expect(Math.round(matrix.kpi.averagePct)).toBe(40);
  });

  it('שחקן שדיווח רק על תרגיל שאינו בתוכנית — נספר כמי שדיווח, ועדיין ב-0%', () => {
    const matrix = buildTeamMatrix(
      [PLAYERS[0]],
      [STANCE],
      [entry({ exerciseId: 'ex_not_in_plan', amount: 40 })],
    );

    expect(matrix.kpi.reportedCount).toBe(1);
    expect(matrix.kpi.zeroCount).toBe(1);
    expect(matrix.rows[0].entryCount).toBe(1);
  });

  it('קבוצה בלי שחקנים לא מחזירה NaN', () => {
    const matrix = buildTeamMatrix([], [STANCE], []);
    expect(matrix.kpi.averagePct).toBe(0);
    expect(matrix.columns[0].avgPct).toBe(0);
    expect(matrix.columns[0].total).toBe(0);
  });
});

describe('מיון', () => {
  const matrix = buildTeamMatrix(
    PLAYERS,
    [STANCE, SHOOT],
    [
      entry({ playerUid: 'uid_a', amount: 15 }),
      entry({ playerUid: 'uid_b', exerciseId: SHOOT.exerciseId, amount: 300 }),
    ],
  );

  it('ברירת המחדל היא הנמוך ביותר למעלה', () => {
    expect(DEFAULT_MATRIX_SORT).toEqual({ key: { kind: 'overall' }, direction: 'asc' });
    const rows = sortMatrixRows(matrix.rows, DEFAULT_MATRIX_SORT);
    expect(rows[0].playerUid).toBe('uid_c');
  });

  it('מיון לפי שם, בשני הכיוונים', () => {
    const asc = sortMatrixRows(matrix.rows, { key: { kind: 'name' }, direction: 'asc' });
    expect(asc.map((row) => row.displayName)).toEqual(['אורי א.', 'בן ב.', 'גיא ג.']);

    const desc = sortMatrixRows(matrix.rows, { key: { kind: 'name' }, direction: 'desc' });
    expect(desc.map((row) => row.displayName)).toEqual(['גיא ג.', 'בן ב.', 'אורי א.']);
  });

  it('מיון לפי עמודת תרגיל מסתכל על התא הנכון', () => {
    const rows = sortMatrixRows(matrix.rows, {
      key: { kind: 'exercise', exerciseId: SHOOT.exerciseId },
      direction: 'desc',
    });
    expect(rows[0].playerUid).toBe('uid_b');
  });

  it('שוויון נשבר לפי שם, וסדר הקלט אינו משנה', () => {
    const rows = sortMatrixRows(matrix.rows, DEFAULT_MATRIX_SORT);
    const reversed = sortMatrixRows([...matrix.rows].reverse(), DEFAULT_MATRIX_SORT);
    expect(rows.map((row) => row.playerUid)).toEqual(reversed.map((row) => row.playerUid));
  });

  it('המיון אינו משנה את המערך המקורי', () => {
    const original = matrix.rows.map((row) => row.playerUid);
    sortMatrixRows(matrix.rows, { key: { kind: 'name' }, direction: 'desc' });
    expect(matrix.rows.map((row) => row.playerUid)).toEqual(original);
  });

  it('לחיצה על אותה עמודה הופכת כיוון; על עמודה אחרת מתחילה בעולה', () => {
    const first = toggleSort(DEFAULT_MATRIX_SORT, { kind: 'overall' });
    expect(first.direction).toBe('desc');

    const second = toggleSort(first, { kind: 'name' });
    expect(second).toEqual({ key: { kind: 'name' }, direction: 'asc' });

    const third = toggleSort(second, { kind: 'exercise', exerciseId: STANCE.exerciseId });
    expect(third.direction).toBe('asc');
  });

  it('שני תרגילים שונים אינם נחשבים לאותה עמודה', () => {
    const sort = { key: { kind: 'exercise' as const, exerciseId: STANCE.exerciseId }, direction: 'asc' as const };
    expect(isSortedBy(sort, { kind: 'exercise', exerciseId: STANCE.exerciseId })).toBe(true);
    expect(isSortedBy(sort, { kind: 'exercise', exerciseId: SHOOT.exerciseId })).toBe(false);
    expect(toggleSort(sort, { kind: 'exercise', exerciseId: SHOOT.exerciseId }).direction).toBe(
      'asc',
    );
  });
});

describe('matrixPlayers', () => {
  function user(overrides: Partial<UserDoc>): UserDoc {
    return {
      uid: 'uid_x',
      role: 'player',
      orgId: ORG,
      displayName: 'שחקן ש.',
      username: 'player',
      teamIds: [TEAM],
      active: true,
      createdAt: Timestamp.fromMillis(0),
      mustChangePassword: false,
      ...overrides,
    };
  }

  it('מסנן מושבתים וממיין בעברית', () => {
    const players = matrixPlayers([
      user({ uid: '1', displayName: 'גיא ג.' }),
      user({ uid: '2', displayName: 'אורי א.' }),
      user({ uid: '3', displayName: 'דן ד.', active: false }),
    ]);

    expect(players.map((player) => player.displayName)).toEqual(['אורי א.', 'גיא ג.']);
  });
});

describe('entriesForPlayer', () => {
  it('מחזיר רק את השחקן המבוקש, מהחדש לישן, כולל מחוקים', () => {
    const old = entry({
      id: 'old',
      date: Timestamp.fromMillis(Date.UTC(2026, 7, 10, 9)),
    });
    const fresh = entry({ id: 'fresh', date: Timestamp.fromMillis(Date.UTC(2026, 7, 20, 9)) });
    const deleted = entry({
      id: 'deleted',
      date: Timestamp.fromMillis(Date.UTC(2026, 7, 15, 9)),
      deleted: true,
    });
    const other = entry({ id: 'other', playerUid: 'uid_b' });

    const result = entriesForPlayer([old, fresh, deleted, other], 'uid_a');
    expect(result.map((item) => item.id)).toEqual(['fresh', 'deleted', 'old']);
  });
});

describe('historicalPlanItems', () => {
  function cycle(weekStartMs: number, items: PlanItem[], id: string): PlanCycleDoc {
    return {
      id,
      planId: 'plan_1',
      teamId: TEAM,
      orgId: ORG,
      weekStart: Timestamp.fromMillis(weekStartMs),
      weekEnd: Timestamp.fromMillis(weekStartMs + 6 * 24 * 3600 * 1000),
      itemsSnapshot: items,
      createdAt: Timestamp.fromMillis(weekStartMs),
    };
  }

  it('מאחד תרגילים מכל המחזורים, גם כאלה שכבר לא בתוכנית', () => {
    const items = historicalPlanItems([
      cycle(Date.UTC(2026, 7, 16), [STANCE], 'c2'),
      cycle(Date.UTC(2026, 7, 9), [SHOOT], 'c1'),
    ]);

    expect(items.map((item) => item.exerciseId)).toEqual([STANCE.exerciseId, SHOOT.exerciseId]);
  });

  it('הגרסה מהמחזור החדש ביותר מנצחת', () => {
    const renamed: PlanItem = { ...STANCE, exerciseName: 'עמידת הגנה — שם חדש', target: 20 };
    const items = historicalPlanItems([
      cycle(Date.UTC(2026, 7, 9), [STANCE], 'c1'),
      cycle(Date.UTC(2026, 7, 16), [renamed], 'c2'),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].exerciseName).toBe('עמידת הגנה — שם חדש');
  });
});
