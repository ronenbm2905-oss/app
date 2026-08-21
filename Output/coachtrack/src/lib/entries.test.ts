/**
 * טסטים ל-lib/entries.ts — שכבת החישוב של מסכי השחקן.
 *
 * שני דברים שהטסטים כאן נועדו לתפוס, כי הם לא נראים על המסך אלא בנתונים:
 *
 * 1. **שיוך לשבוע.** דיווח של מוצאי שבת שנרשם ביום ראשון חייב ליפול בשבוע
 *    שעבר. הטסטים רצים ב-`TZ=UTC` (ראה `vitest.config.mts`), כלומר על מכשיר
 *    שאזור הזמן שלו אינו ישראל — המקרה המסוכן, לא הנוח.
 *
 * 2. **מאיפה מגיעים היעדים.** כל שבוע נמדד מול `itemsSnapshot` של המחזור שלו.
 *    יש כאן טסט מפורש ששני שבועות עם יעדים שונים שומרים כל אחד על שלו, כי זו
 *    בדיוק מלכודת 2 — היעד שמשתנה למפרע.
 */

import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  EDIT_WINDOW_DAYS,
  MAX_BACKDATE_DAYS,
  MAX_ENTRY_AMOUNT,
  NOTE_MAX_LENGTH,
  buildWeekSummaries,
  canEditEntry,
  currentStreak,
  cycleIdForEntryDay,
  dateOptions,
  draftFromEntry,
  entriesForWeek,
  entryDateForDay,
  entryInstantForDay,
  exerciseTrends,
  isDayKeyAllowed,
  isEntryDraftValid,
  isOutlierAmount,
  newEntryDraft,
  parseAmount,
  quickAddValues,
  summarizeWeek,
  validateEntryDraft,
  visibleEntries,
  type EntryDraft,
} from './entries';
import { getWeekKey, toIsraeliDayKey } from './dates';
import type { EntryDoc, PlanCycleDoc, PlanItem } from '../types/types';

/* ------------------------------------------------------------------ */
/* נתוני בדיקה                                                         */
/* ------------------------------------------------------------------ */

/** שישי 21.8.2026, 09:00 בשעון ישראל. השבוע: ראשון 16.8 עד שבת 22.8. */
const NOW = new Date('2026-08-21T06:00:00Z');
const WEEK = '2026-08-16';
const PREVIOUS_WEEK = '2026-08-09';

const SHOOTING: PlanItem = {
  exerciseId: 'shoot_form',
  exerciseName: 'זריקות טכניקה מקרוב',
  unit: 'count',
  target: 500,
  notes: 'מהצד הימני של הסל',
};

const STANCE: PlanItem = {
  exerciseId: 'def_stance',
  exerciseName: 'החזקת עמידת הגנה',
  unit: 'minutes',
  target: 15,
  notes: '',
};

let entrySeq = 0;

function entry(overrides: Partial<EntryDoc> & { dayKey?: string } = {}): EntryDoc {
  const { dayKey, ...rest } = overrides;
  entrySeq += 1;

  return {
    id: `entry_${entrySeq}`,
    playerUid: 'uid_player',
    teamId: 'team_yeladim_a',
    orgId: 'org_kiryat_ono',
    cycleId: null,
    exerciseId: SHOOTING.exerciseId,
    amount: 100,
    successAmount: null,
    date: dayKey ? entryDateForDay(dayKey) : entryDateForDay(toIsraeliDayKey(NOW)),
    note: '',
    createdAt: Timestamp.fromDate(NOW),
    createdBy: 'uid_player',
    deleted: false,
    ...rest,
  };
}

function cycle(weekKey: string, items: PlanItem[]): PlanCycleDoc {
  return {
    id: `team_yeladim_a_${weekKey}`,
    planId: 'plan_1',
    teamId: 'team_yeladim_a',
    orgId: 'org_kiryat_ono',
    weekStart: Timestamp.fromDate(entryInstantForDay(weekKey)),
    weekEnd: Timestamp.fromDate(entryInstantForDay(weekKey)),
    itemsSnapshot: items,
    createdAt: Timestamp.fromDate(NOW),
  };
}

function draft(overrides: Partial<EntryDraft> = {}): EntryDraft {
  return { ...newEntryDraft(NOW), amount: '50', ...overrides };
}

/* ------------------------------------------------------------------ */

describe('טיוטת הדיווח', () => {
  it('טיוטה חדשה מתחילה מהיום, ריקה', () => {
    const fresh = newEntryDraft(NOW);
    expect(fresh).toEqual({ amount: '', dayKey: '2026-08-21', note: '' });
  });

  it('טיוטה מדיווח קיים מחזירה את היום הישראלי שלו', () => {
    const existing = entry({ dayKey: '2026-08-18', amount: 40, note: 'במגרש' });
    expect(draftFromEntry(existing)).toEqual({ amount: '40', dayKey: '2026-08-18', note: 'במגרש' });
  });

  it('parseAmount מקבל מספר, ודוחה טקסט וריק', () => {
    expect(parseAmount(' 50 ')).toBe(50);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('הרבה')).toBeNull();
  });
});

describe('בורר התאריך — 7 ימים אחורה', () => {
  it('שמונה אפשרויות: היום ועוד שבעה ימים אחורה', () => {
    const options = dateOptions(NOW);
    expect(options).toHaveLength(MAX_BACKDATE_DAYS + 1);
    expect(options[0]).toEqual({ dayKey: '2026-08-21', daysAgo: 0 });
    expect(options.at(-1)).toEqual({ dayKey: '2026-08-14', daysAgo: MAX_BACKDATE_DAYS });
  });

  it('הגבול: 7 ימים מותר, 8 ימים ומחר — לא', () => {
    expect(isDayKeyAllowed('2026-08-14', NOW)).toBe(true);
    expect(isDayKeyAllowed('2026-08-13', NOW)).toBe(false);
    expect(isDayKeyAllowed('2026-08-22', NOW)).toBe(false);
  });

  it('חצות בישראל: ראשון ב-00:30 עדיין מציע את שבת כאתמול', () => {
    // המכשיר ב-UTC (ראה vitest.config.mts) — שם עוד יום שבת ב-21:30.
    const sundayNight = new Date('2026-08-23T00:30:00+03:00');
    const options = dateOptions(sundayNight);
    expect(options[0].dayKey).toBe('2026-08-23');
    expect(options[1].dayKey).toBe('2026-08-22');
  });
});

describe('ולידציה', () => {
  it('טיוטה תקינה עוברת', () => {
    expect(isEntryDraftValid(validateEntryDraft(draft(), NOW))).toBe(true);
  });

  it('כמות ריקה, אפס, שלילית או טקסט — נחסמות', () => {
    expect(validateEntryDraft(draft({ amount: '' }), NOW).amount).toBe(
      'player.report.errors.amountRequired',
    );
    expect(validateEntryDraft(draft({ amount: 'הרבה' }), NOW).amount).toBe(
      'player.report.errors.amountRequired',
    );
    expect(validateEntryDraft(draft({ amount: '0' }), NOW).amount).toBe(
      'player.report.errors.amountPositive',
    );
    expect(validateEntryDraft(draft({ amount: '-5' }), NOW).amount).toBe(
      'player.report.errors.amountPositive',
    );
  });

  it('כמות מעל התקרה נחסמת', () => {
    expect(validateEntryDraft(draft({ amount: String(MAX_ENTRY_AMOUNT + 1) }), NOW).amount).toBe(
      'player.report.errors.amountTooLarge',
    );
  });

  it('תאריך מחוץ לחלון נחסם — גם אחורה וגם קדימה', () => {
    expect(validateEntryDraft(draft({ dayKey: '2026-08-11' }), NOW).date).toBe(
      'player.report.errors.dateOutOfWindow',
    );
    expect(validateEntryDraft(draft({ dayKey: '2026-08-25' }), NOW).date).toBe(
      'player.report.errors.dateOutOfWindow',
    );
  });

  it('הערה ארוכה מדי נחסמת, ובאורך המקסימלי — עוברת', () => {
    expect(validateEntryDraft(draft({ note: 'א'.repeat(NOTE_MAX_LENGTH) }), NOW).note).toBeUndefined();
    expect(validateEntryDraft(draft({ note: 'א'.repeat(NOTE_MAX_LENGTH + 1) }), NOW).note).toBe(
      'player.report.errors.noteTooLong',
    );
  });

  it('ערך חריג הוא מעל פי שלושה מהיעד, ולא בדיוק פי שלושה', () => {
    expect(isOutlierAmount(1500, 500)).toBe(false);
    expect(isOutlierAmount(1501, 500)).toBe(true);
    expect(isOutlierAmount(50, 0)).toBe(false);
  });
});

describe('כפתורי הקיצור', () => {
  it('יעד 500 מייצר בדיוק את מה שה-PRD מדגים: 10, 25, 50, 100', () => {
    expect(quickAddValues(500)).toEqual([10, 25, 50, 100]);
  });

  it('יעד קטן מקבל ארבעה ערכים שונים ועולים, בלי כפילויות', () => {
    const values = quickAddValues(15);
    expect(values).toHaveLength(4);
    expect(new Set(values).size).toBe(4);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
    expect(values.every((value) => Number.isInteger(value) && value >= 1)).toBe(true);
  });

  it('בלי יעד אין כפתורים', () => {
    expect(quickAddValues(0)).toEqual([]);
  });
});

describe('חלון העריכה — נמדד על createdAt, לא על date', () => {
  it('שישה ימים מהרישום — פתוח; שמונה — סגור', () => {
    const day = 24 * 60 * 60 * 1000;
    const created = entry({ createdAt: Timestamp.fromMillis(NOW.getTime() - 6 * day) });
    const old = entry({ createdAt: Timestamp.fromMillis(NOW.getTime() - 8 * day) });

    expect(canEditEntry(created, NOW)).toBe(true);
    expect(canEditEntry(old, NOW)).toBe(false);
    expect(EDIT_WINDOW_DAYS).toBe(7);
  });

  it('דיווח ישן על ביצוע חדש עדיין ניתן לעריכה — שני חלונות שונים', () => {
    // נרשם היום על ביצוע מלפני שישה ימים: תאריך הביצוע ישן, הרישום חדש.
    const backdated = entry({ dayKey: '2026-08-15', createdAt: Timestamp.fromDate(NOW) });
    expect(canEditEntry(backdated, NOW)).toBe(true);
  });

  it('createdAt שעוד לא חזר מהשרת אינו נועל את הכפתור', () => {
    const pending = entry({ createdAt: undefined as unknown as EntryDoc['createdAt'] });
    expect(canEditEntry(pending, NOW)).toBe(true);
  });
});

describe('שיוך לשבוע — מלכודת 1', () => {
  it('מוצאי שבת ויום ראשון נופלים בשבועות שונים', () => {
    const saturday = entry({ dayKey: '2026-08-15' });
    const sunday = entry({ dayKey: '2026-08-16' });

    expect(getWeekKey(saturday.date)).toBe(PREVIOUS_WEEK);
    expect(getWeekKey(sunday.date)).toBe(WEEK);
  });

  it('entryDateForDay מעגן ב-12:00 בשעון ישראל ולא בחצות', () => {
    const stamp = entryDateForDay('2026-08-15');
    expect(stamp.toDate().toISOString()).toBe('2026-08-15T09:00:00.000Z'); // 12:00 בישראל (UTC+3)
  });

  it('גם בצד השני של מעבר השעון היום הקלנדרי נשמר', () => {
    // סוף אוקטובר 2026 — אחרי המעבר לשעון חורף (UTC+2).
    expect(entryDateForDay('2026-11-02').toDate().toISOString()).toBe('2026-11-02T10:00:00.000Z');
    expect(toIsraeliDayKey(entryDateForDay('2026-11-02'))).toBe('2026-11-02');
  });

  it('דיווח מלפני שלושה ימים נספר בשבוע הנוכחי; מלפני שישה — בשבוע שעבר', () => {
    const threeDays = entry({ dayKey: '2026-08-18' });
    const sixDays = entry({ dayKey: '2026-08-15' });
    const week = entriesForWeek([threeDays, sixDays], NOW);

    expect(week.map((item) => item.id)).toEqual([threeDays.id]);
  });

  it('דיווחי השבוע ממוינים מהחדש לישן', () => {
    const older = entry({ dayKey: '2026-08-17' });
    const newer = entry({ dayKey: '2026-08-20' });
    expect(entriesForWeek([older, newer], NOW).map((item) => item.id)).toEqual([
      newer.id,
      older.id,
    ]);
  });

  it('דיווח מחוק לא נספר ולא מוצג', () => {
    const deleted = entry({ deleted: true });
    expect(visibleEntries([deleted, entry()])).toHaveLength(1);
  });
});

describe('סיכום שבוע', () => {
  it('צובר שלושה דיווחים לאותו תרגיל', () => {
    const summary = summarizeWeek(
      WEEK,
      [SHOOTING],
      [entry({ amount: 100 }), entry({ amount: 150 }), entry({ amount: 50 })],
      80,
    );

    expect(summary.items[0].total).toBe(300);
    expect(summary.items[0].entryCount).toBe(3);
    expect(summary.items[0].remaining).toBe(200);
    expect(summary.items[0].pct).toBe(60);
    expect(summary.overall).toBe(60);
  });

  it('בתרגיל בודד האחוז אינו נחסם, ובממוצע הכללי הוא כן — מלכודת 3', () => {
    const summary = summarizeWeek(
      WEEK,
      [SHOOTING, STANCE],
      [entry({ amount: 1500 })], // 300% בזריקות, 0% בעמידת הגנה
      80,
    );

    expect(summary.items[0].pct).toBe(300);
    expect(summary.items[0].remaining).toBe(0);
    expect(summary.items[1].pct).toBe(0);
    expect(summary.overall).toBe(50); // (100 + 0) / 2 — ולא 150
  });

  it('דיווח מחוק לא נספר', () => {
    const summary = summarizeWeek(
      WEEK,
      [SHOOTING],
      [entry({ amount: 100 }), entry({ amount: 400, deleted: true })],
      80,
    );

    expect(summary.items[0].total).toBe(100);
    expect(summary.entryCount).toBe(1);
  });

  it('דיווח על תרגיל שאינו בתוכנית נשמר ונספר בנפרד', () => {
    const summary = summarizeWeek(
      WEEK,
      [SHOOTING],
      [entry({ exerciseId: 'other', amount: 999 })],
      80,
    );

    expect(summary.items[0].total).toBe(0);
    expect(summary.offPlanCount).toBe(1);
    expect(summary.overall).toBe(0);
  });

  it('שבוע בלי תוכנית אינו שבוע של 0% אלא שבוע בלי אחוז', () => {
    const summary = summarizeWeek(WEEK, null, [entry({ amount: 100 })], 80);

    expect(summary.hasPlan).toBe(false);
    expect(summary.items).toEqual([]);
    expect(summary.entryCount).toBe(1);
    expect(summary.meetsThreshold).toBe(false);
  });

  it('סף הרצף נמדד על האחוז הכללי', () => {
    const under = summarizeWeek(WEEK, [SHOOTING], [entry({ amount: 395 })], 80);
    const over = summarizeWeek(WEEK, [SHOOTING], [entry({ amount: 400 })], 80);

    expect(under.meetsThreshold).toBe(false);
    expect(over.meetsThreshold).toBe(true);
  });

  it('גבולות השבוע נגזרים ממפתח-היום ולא מהדיווחים', () => {
    const summary = summarizeWeek(WEEK, [SHOOTING], [], 80);
    expect(toIsraeliDayKey(summary.weekStart)).toBe('2026-08-16');
    expect(toIsraeliDayKey(summary.weekEnd)).toBe('2026-08-22');
  });
});

describe('היסטוריה — כל שבוע מול היעדים שהיו בו', () => {
  it('שני שבועות עם יעדים שונים שומרים כל אחד על שלו — מלכודת 2', () => {
    const cycles = [
      cycle(WEEK, [{ ...SHOOTING, target: 500 }]),
      cycle(PREVIOUS_WEEK, [{ ...SHOOTING, target: 200 }]),
    ];
    const entries = [
      entry({ dayKey: '2026-08-18', amount: 200 }),
      entry({ dayKey: '2026-08-12', amount: 200 }),
    ];

    const [thisWeek, lastWeek] = buildWeekSummaries(cycles, entries, { threshold: 80 });

    expect(thisWeek.weekKey).toBe(WEEK);
    expect(thisWeek.items[0].pct).toBe(40); // 200 מתוך 500
    expect(lastWeek.weekKey).toBe(PREVIOUS_WEEK);
    expect(lastWeek.items[0].pct).toBe(100); // 200 מתוך 200
  });

  it('שבוע שיש בו דיווחים בלי מחזור מופיע כשבוע בלי תוכנית', () => {
    const summaries = buildWeekSummaries(
      [cycle(WEEK, [SHOOTING])],
      [entry({ dayKey: '2026-08-12', amount: 60 })],
      { threshold: 80 },
    );

    expect(summaries.map((summary) => summary.weekKey)).toEqual([WEEK, PREVIOUS_WEEK]);
    expect(summaries[1].hasPlan).toBe(false);
    expect(summaries[1].entryCount).toBe(1);
  });

  it('הרשימה ממוינת מהחדש לישן', () => {
    const summaries = buildWeekSummaries(
      [cycle(PREVIOUS_WEEK, [SHOOTING]), cycle(WEEK, [SHOOTING])],
      [],
      { threshold: 80 },
    );
    expect(summaries.map((summary) => summary.weekKey)).toEqual([WEEK, PREVIOUS_WEEK]);
  });

  it('מזהה המחזור נשמר בסיכום, ובשבוע בלי מחזור הוא null', () => {
    const summaries = buildWeekSummaries(
      [cycle(WEEK, [SHOOTING])],
      [entry({ dayKey: '2026-08-12' })],
      { threshold: 80 },
    );
    expect(summaries[0].cycleId).toBe(`team_yeladim_a_${WEEK}`);
    expect(summaries[1].cycleId).toBeNull();
  });
});

describe('רצף התמדה', () => {
  const full = (weekKey: string) =>
    summarizeWeek(weekKey, [SHOOTING], [entry({ amount: 500 })], 80, `c_${weekKey}`);
  const empty = (weekKey: string) => summarizeWeek(weekKey, [SHOOTING], [], 80, `c_${weekKey}`);
  const noPlan = (weekKey: string) => summarizeWeek(weekKey, null, [], 80);

  it('שלושה שבועות רצופים מעל הסף', () => {
    const summaries = [full(WEEK), full(PREVIOUS_WEEK), full('2026-08-02')];
    expect(currentStreak(summaries, WEEK)).toBe(3);
  });

  it('שבוע נוכחי שעוד לא הגיע לסף לא שובר את הרצף', () => {
    const summaries = [empty(WEEK), full(PREVIOUS_WEEK), full('2026-08-02')];
    expect(currentStreak(summaries, WEEK)).toBe(2);
  });

  it('שבוע סגור מתחת לסף שובר', () => {
    const summaries = [full(WEEK), empty(PREVIOUS_WEEK), full('2026-08-02')];
    expect(currentStreak(summaries, WEEK)).toBe(1);
  });

  it('שבוע בלי תוכנית מדלג ולא שובר — זו חופשה, לא כישלון', () => {
    const summaries = [full(WEEK), noPlan(PREVIOUS_WEEK), full('2026-08-02')];
    expect(currentStreak(summaries, WEEK)).toBe(2);
  });

  it('בלי היסטוריה אין רצף', () => {
    expect(currentStreak([], WEEK)).toBe(0);
  });
});

describe('פילוח לפי תרגיל', () => {
  it('מסכם על פני שבועות וממיין מהחלש לחזק', () => {
    const summaries = [
      summarizeWeek(WEEK, [SHOOTING, STANCE], [entry({ amount: 500 })], 80),
      summarizeWeek(PREVIOUS_WEEK, [SHOOTING, STANCE], [entry({ amount: 250 })], 80),
    ];

    const trends = exerciseTrends(summaries);

    expect(trends.map((trend) => trend.exerciseId)).toEqual(['def_stance', 'shoot_form']);
    expect(trends[1].total).toBe(750);
    expect(trends[1].target).toBe(1000);
    expect(trends[1].pct).toBe(75); // ממוצע של 100% ו-50%
    expect(trends[1].weeks).toBe(2);
  });

  it('שבוע בלי תוכנית אינו נספר בפילוח', () => {
    const summaries = [summarizeWeek(WEEK, null, [entry({ amount: 500 })], 80)];
    expect(exerciseTrends(summaries)).toEqual([]);
  });
});

describe('שיוך הדיווח למחזור', () => {
  const cycles = [cycle(WEEK, [SHOOTING]), cycle(PREVIOUS_WEEK, [SHOOTING])];

  it('יום מהשבוע הנוכחי מקבל את המחזור הנוכחי', () => {
    expect(cycleIdForEntryDay(cycles, '2026-08-18')).toBe(`team_yeladim_a_${WEEK}`);
  });

  it('דיווח רטרואקטיבי מקבל את המחזור של השבוע שבו בוצע', () => {
    expect(cycleIdForEntryDay(cycles, '2026-08-15')).toBe(`team_yeladim_a_${PREVIOUS_WEEK}`);
  });

  it('שבוע בלי מחזור מחזיר null ולא נופל על המחזור הקרוב', () => {
    expect(cycleIdForEntryDay(cycles, '2026-07-20')).toBeNull();
  });
});
