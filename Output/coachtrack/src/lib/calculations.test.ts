/**
 * טסטים ל-lib/calculations.ts
 *
 * המקרים שנדרשים ב-TASKS.md שלב 1: אפס דיווחים, מעל 100%, תרגיל בלי דיווחים בכלל,
 * ו-target שאינו חיובי. בנוסף — ההפרדה שקל לטעות בה (מלכודת #3): חסימה ב-100
 * קיימת רק בממוצע הכללי, לא בתרגיל הבודד.
 */

import { describe, it, expect } from 'vitest';
import {
  capPct,
  groupEntriesByExercise,
  meetsStreakThreshold,
  overallPct,
  pctForExercise,
  roundPct,
  sumEntries,
} from './calculations';

const amounts = (...values: number[]) => values.map((amount) => ({ amount }));

describe('sumEntries', () => {
  it('רשימה ריקה, undefined ו-null מחזירים 0', () => {
    expect(sumEntries([])).toBe(0);
    expect(sumEntries(undefined)).toBe(0);
    expect(sumEntries(null)).toBe(0);
  });

  it('מסכם דיווחים', () => {
    expect(sumEntries(amounts(50, 100, 25))).toBe(175);
  });

  it('מדלג על דיווח שנמחק-רכות', () => {
    expect(
      sumEntries([
        { amount: 100 },
        { amount: 50, deleted: true },
        { amount: 25, deleted: false },
      ]),
    ).toBe(125);
  });

  it('מדלג על כמויות פגומות במקום להחזיר NaN', () => {
    const dirty = [
      { amount: 100 },
      { amount: Number.NaN },
      { amount: Number.POSITIVE_INFINITY },
      { amount: -30 },
      { amount: 0 },
      { amount: '40' as unknown as number },
    ];
    expect(sumEntries(dirty)).toBe(100);
  });
});

describe('pctForExercise', () => {
  it('אפס דיווחים — 0%', () => {
    expect(pctForExercise([], 300)).toBe(0);
    expect(pctForExercise(undefined, 300)).toBe(0);
  });

  it('חישוב רגיל', () => {
    expect(pctForExercise(amounts(150), 300)).toBe(50);
    expect(pctForExercise(amounts(100, 100, 100), 300)).toBe(100);
    expect(pctForExercise(amounts(75), 300)).toBe(25);
  });

  it('מעל 100% — לא נחסם', () => {
    expect(pctForExercise(amounts(900), 300)).toBe(300);
    expect(pctForExercise(amounts(300, 300, 301), 300)).toBeCloseTo(300.333, 3);
  });

  it('יעד לא חיובי או פגום מחזיר 0 ולא Infinity או NaN', () => {
    expect(pctForExercise(amounts(100), 0)).toBe(0);
    expect(pctForExercise(amounts(100), -50)).toBe(0);
    expect(pctForExercise(amounts(100), Number.NaN)).toBe(0);
    expect(pctForExercise([], 0)).toBe(0);
    expect(Number.isFinite(pctForExercise(amounts(100), 0))).toBe(true);
  });

  it('שומר על שברים ולא מעגל', () => {
    expect(pctForExercise(amounts(1), 3)).toBeCloseTo(33.3333, 4);
  });
});

describe('capPct', () => {
  it('חוסם ב-100 ומרצפה ב-0', () => {
    expect(capPct(45)).toBe(45);
    expect(capPct(100)).toBe(100);
    expect(capPct(300)).toBe(100);
    expect(capPct(-10)).toBe(0);
    expect(capPct(Number.NaN)).toBe(0);
  });
});

describe('overallPct', () => {
  const items = [
    { exerciseId: 'shoot_form', target: 300 },
    { exerciseId: 'dribble_cones', target: 100 },
    { exerciseId: 'fitness_run', target: 20 },
  ];

  it('תוכנית בלי פריטים — 0, לא NaN', () => {
    expect(overallPct([], {})).toBe(0);
    expect(overallPct(undefined, {})).toBe(0);
    expect(Number.isNaN(overallPct([], {}))).toBe(false);
  });

  it('אפס דיווחים בכלל — 0%', () => {
    expect(overallPct(items, {})).toBe(0);
    expect(overallPct(items, undefined)).toBe(0);
  });

  it('ממוצע רגיל', () => {
    const entries = {
      shoot_form: amounts(150), // 50%
      dribble_cones: amounts(100), // 100%
      fitness_run: amounts(3), // 15%
    };
    expect(overallPct(items, entries)).toBeCloseTo((50 + 100 + 15) / 3, 10);
  });

  it('הבדיקה הקריטית: תרגיל מעל 100% נחסם לפני הממוצע', () => {
    const entries = {
      shoot_form: amounts(900), // 300% בתרגיל הבודד
      dribble_cones: [],
      fitness_run: [],
    };
    // בלי החסימה הממוצע היה 100% — 300% בזריקות מכסים על 0% בשאר
    expect(pctForExercise(entries.shoot_form, 300)).toBe(300);
    expect(overallPct(items, entries)).toBeCloseTo(100 / 3, 10);
    expect(overallPct(items, entries)).toBeLessThan(100);
  });

  it('גם כשכל התרגילים מעל היעד — לא עוברים 100', () => {
    const entries = {
      shoot_form: amounts(1200),
      dribble_cones: amounts(500),
      fitness_run: amounts(60),
    };
    expect(overallPct(items, entries)).toBe(100);
  });

  it('תרגיל בלי דיווחים בכלל נספר כ-0 ולא מושמט מהממוצע', () => {
    const entries = {
      shoot_form: amounts(300), // 100%
      // dribble_cones ו-fitness_run לא מופיעים כלל במיפוי
    };
    expect(overallPct(items, entries)).toBeCloseTo(100 / 3, 10);
  });

  it('דיווח שנמחק-רכות לא מעלה את האחוז הכללי', () => {
    const withDeleted = {
      shoot_form: [{ amount: 300, deleted: true }],
      dribble_cones: amounts(100),
      fitness_run: [],
    };
    expect(overallPct(items, withDeleted)).toBeCloseTo(100 / 3, 10);
  });

  it('פריט עם יעד 0 נספר כ-0 ולא מפיל את החישוב', () => {
    const broken = [...items, { exerciseId: 'broken', target: 0 }];
    const entries = { broken: amounts(50) };
    expect(Number.isFinite(overallPct(broken, entries))).toBe(true);
    expect(overallPct(broken, entries)).toBe(0);
  });

  it('אותו תרגיל פעמיים בתוכנית נספר פעמיים — הממוצע לפי מספר הפריטים', () => {
    const duplicated = [
      { exerciseId: 'shoot_form', target: 300 },
      { exerciseId: 'shoot_form', target: 600 },
    ];
    const entries = { shoot_form: amounts(300) }; // 100% ו-50%
    expect(overallPct(duplicated, entries)).toBe(75);
  });
});

describe('groupEntriesByExercise', () => {
  it('מקבץ לפי תרגיל ושומר על הסדר', () => {
    const entries = [
      { exerciseId: 'a', amount: 10 },
      { exerciseId: 'b', amount: 20 },
      { exerciseId: 'a', amount: 30 },
    ];
    const grouped = groupEntriesByExercise(entries);
    expect(Object.keys(grouped).sort()).toEqual(['a', 'b']);
    expect(grouped.a.map((e) => e.amount)).toEqual([10, 30]);
    expect(grouped.b.map((e) => e.amount)).toEqual([20]);
  });

  it('רשימה ריקה מחזירה אובייקט ריק', () => {
    expect(groupEntriesByExercise([])).toEqual({});
    expect(groupEntriesByExercise(undefined)).toEqual({});
  });

  it('משתלב עם overallPct מקצה לקצה', () => {
    const flat = [
      { exerciseId: 'shoot_form', amount: 150 },
      { exerciseId: 'shoot_form', amount: 150 },
      { exerciseId: 'dribble_cones', amount: 50 },
    ];
    const items = [
      { exerciseId: 'shoot_form', target: 300 },
      { exerciseId: 'dribble_cones', target: 100 },
    ];
    expect(overallPct(items, groupEntriesByExercise(flat))).toBe(75);
  });
});

describe('roundPct / meetsStreakThreshold', () => {
  it('מעגל להצגה', () => {
    expect(roundPct(33.3333)).toBe(33);
    expect(roundPct(66.6666)).toBe(67);
    expect(roundPct(Number.NaN)).toBe(0);
  });

  it('סף ההתמדה כולל את הסף עצמו', () => {
    expect(meetsStreakThreshold(80, 80)).toBe(true);
    expect(meetsStreakThreshold(79.9, 80)).toBe(false);
    expect(meetsStreakThreshold(Number.NaN, 80)).toBe(false);
  });
});
