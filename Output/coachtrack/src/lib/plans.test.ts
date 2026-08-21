/**
 * טסטים ל-lib/plans.ts — התוכנית המתמשכת.
 *
 * זה השלב הכי מורכב לוגית בפרויקט, ורוב הבאגים שלו **לא נראים על המסך**: הם
 * נראים כמו אחוז שיורד בחצי, או כמו היסטוריה שמשתנה למפרע. לכן כל ההחלטות
 * נשאבו לפונקציות טהורות עם `now` מוזרק, והקובץ הזה בודק אותן.
 *
 * ארבע הבדיקות שנושאות את כל השלב:
 *   1. **מזהה מחזור דטרמיניסטי** — שני מכשירים באותו שבוע מחשבים אותו מזהה.
 *   2. **`itemsSnapshot` זהה ל-`plan.items` בדיוק** — אחרת ה-rules חוסמים יצירה.
 *   3. **"מהשבוע הנוכחי" נוגע בשני מסמכים עם אותו מערך** — אחרת הם מתפצלים.
 *   4. **"מהשבוע הבא" לא מזיז את השבוע הנוכחי** — קריטריון הסיום של שלב 3.
 */

import { describe, it, expect } from 'vitest';
import { formatInTimeZone } from 'date-fns-tz';
import { Timestamp } from 'firebase/firestore';
import { TIME_ZONE, getWeekBounds } from './dates';
import {
  MAX_PLAN_ITEMS,
  MAX_TARGET,
  activePlanFor,
  buildCurrentWeekEdit,
  buildCycleData,
  buildNewPlan,
  buildNextWeekSwitch,
  buildTemplate,
  cycleForDate,
  cycleIdFor,
  cycleIdForDate,
  draftFromExercise,
  draftFromItems,
  isPlanDraftValid,
  normalizePlanItem,
  planItemsEqual,
  templateToDraft,
  toPlanItems,
  validatePlanDraft,
  validateTemplateName,
} from './plans';
import type { PlanDraftItem } from './plans';
import type {
  ExerciseDoc,
  PlanCycleDoc,
  PlanDoc,
  PlanItem,
  PlanTemplateDoc,
} from '../types/types';

const TEAM = 'team_yeladim_a';
const ORG = 'org_kiryat_ono';
const COACH = 'uid_coach';

/** רגע בזמן מתוך ISO ב-UTC. */
const utc = (iso: string) => new Date(iso);

/** איך הרגע הזה נראה על שעון קיר בישראל. */
const israeliWall = (value: Timestamp | Date) =>
  formatInTimeZone(
    value instanceof Timestamp ? value.toDate() : value,
    TIME_ZONE,
    'yyyy-MM-dd HH:mm:ss.SSS',
  );

/** רביעי, 19.8.2026 בצהריים בישראל. */
const WEDNESDAY = utc('2026-08-19T09:00:00Z');
/** אותו יום בשבוע, שבוע אחרי. */
const NEXT_WEDNESDAY = utc('2026-08-26T09:00:00Z');

const STAMP = Timestamp.fromMillis(1_700_000_000_000);

const ITEM: PlanItem = {
  exerciseId: 'shoot_form',
  exerciseName: 'זריקות טכניקה מקרוב',
  unit: 'count',
  target: 300,
  notes: 'מהצד הימני של הסל',
};

const ITEM_B: PlanItem = {
  exerciseId: 'fitness_core',
  exerciseName: 'חיזוק ליבה',
  unit: 'minutes',
  target: 60,
  notes: '',
};

function planDoc(overrides: Partial<PlanDoc> = {}): PlanDoc {
  return {
    id: 'plan_1',
    teamId: TEAM,
    orgId: ORG,
    status: 'active',
    effectiveFrom: Timestamp.fromDate(getWeekBounds(WEDNESDAY).weekStart),
    effectiveTo: null,
    createdBy: COACH,
    createdAt: STAMP,
    items: [ITEM],
    ...overrides,
  };
}

function exerciseDoc(overrides: Partial<ExerciseDoc> = {}): ExerciseDoc {
  return {
    id: 'shoot_form',
    scope: 'global',
    orgId: null,
    name: 'זריקות טכניקה מקרוב',
    category: 'זריקה',
    unit: 'count',
    description: 'מהצד הימני של הסל',
    videoUrl: null,
    tracksSuccess: false,
    successCapable: true,
    defaultTargets: { cadets_13_15: 300 },
    active: true,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* 1. מזהה המחזור                                                      */
/* ------------------------------------------------------------------ */

describe('מזהה המחזור — דטרמיניסטי, לא מוגרל', () => {
  it('המזהה מורכב מהקבוצה ומתחילת השבוע', () => {
    expect(cycleIdFor(TEAM, '2026-08-16')).toBe('team_yeladim_a_2026-08-16');
    expect(cycleIdForDate(TEAM, WEDNESDAY)).toBe('team_yeladim_a_2026-08-16');
  });

  it('שני מכשירים באותו שבוע מחשבים בדיוק אותו מזהה', () => {
    // זה מה שמונע שני מחזורים לאותו שבוע ביצירה עצלה ממקביל: השני נופל על
    // מסמך קיים במקום ליצור חדש, והאחוזים לא מתפצלים בין שני מחזורים.
    const sundayMorning = utc('2026-08-15T21:30:00Z'); // ראשון 00:30 בישראל
    const saturdayNight = utc('2026-08-22T20:30:00Z'); // שבת 23:30 בישראל

    expect(cycleIdForDate(TEAM, sundayMorning)).toBe(cycleIdForDate(TEAM, saturdayNight));
  });

  it('שבת 23:30 וראשון 00:30 שאחריה — מזהים שונים', () => {
    const saturdayNight = utc('2026-08-22T20:30:00Z');
    const sundayJustAfter = utc('2026-08-22T21:30:00Z');

    expect(cycleIdForDate(TEAM, saturdayNight)).toBe('team_yeladim_a_2026-08-16');
    expect(cycleIdForDate(TEAM, sundayJustAfter)).toBe('team_yeladim_a_2026-08-23');
  });

  it('קבוצה אחרת באותו שבוע — מזהה אחר', () => {
    expect(cycleIdForDate('team_b', WEDNESDAY)).not.toBe(cycleIdForDate(TEAM, WEDNESDAY));
  });
});

/* ------------------------------------------------------------------ */
/* 2. פריטים ונרמול                                                    */
/* ------------------------------------------------------------------ */

describe('normalizePlanItem — הצורה שה-rules משווים מולה', () => {
  it('בדיוק חמישה שדות, בלי שדות עודפים', () => {
    const withExtra = { ...ITEM, computedPct: 42 } as unknown as PlanItem;
    expect(Object.keys(normalizePlanItem(withExtra)).sort()).toEqual(
      ['exerciseId', 'exerciseName', 'notes', 'target', 'unit'].sort(),
    );
  });

  it('notes חסר הופך למחרוזת ריקה ולא ל-undefined', () => {
    // undefined נופל בכתיבה ל-Firestore, וההשוואה מול plan.items הייתה נכשלת.
    const missing = { ...ITEM, notes: undefined } as unknown as PlanItem;
    expect(normalizePlanItem(missing).notes).toBe('');
  });
});

describe('planItemsEqual — סדר האיברים נחשב', () => {
  it('אותם פריטים באותו סדר — שווים', () => {
    expect(planItemsEqual([ITEM, ITEM_B], [{ ...ITEM }, { ...ITEM_B }])).toBe(true);
  });

  it('אותם פריטים בסדר הפוך — לא שווים', () => {
    // ה-rules משווים מערכים, ומערך הוא סדור. זו בדיוק הסיבה ש-buildCycleData
    // לא ממיין ולא נוגע ב-plan.items.
    expect(planItemsEqual([ITEM, ITEM_B], [ITEM_B, ITEM])).toBe(false);
  });

  it('יעד שונה — לא שווים', () => {
    expect(planItemsEqual([ITEM], [{ ...ITEM, target: 301 }])).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* 3. הטיוטה                                                           */
/* ------------------------------------------------------------------ */

describe('draftFromExercise — היעד נטען מראש מהקטלוג', () => {
  it('היעד מגיע מ-defaultTargets.cadets_13_15', () => {
    expect(draftFromExercise(exerciseDoc()).target).toBe('300');
  });

  it('תרגיל בלי הצעה נשאר ריק ולא 0', () => {
    // 0 היה נראה כמו יעד שהמאמן קבע, והוא גם לא חוקי בוולידציה.
    expect(draftFromExercise(exerciseDoc({ defaultTargets: {} })).target).toBe('');
  });

  it('ההנחיות של התרגיל נטענות כברירת מחדל להנחיות הפריט', () => {
    expect(draftFromExercise(exerciseDoc()).notes).toBe('מהצד הימני של הסל');
  });
});

describe('validatePlanDraft', () => {
  const draft = (overrides: Partial<PlanDraftItem> = {}): PlanDraftItem => ({
    exerciseId: 'shoot_form',
    exerciseName: 'זריקות',
    unit: 'count',
    target: '300',
    notes: '',
    ...overrides,
  });

  it('טיוטה תקינה עוברת', () => {
    expect(isPlanDraftValid(validatePlanDraft([draft()]))).toBe(true);
  });

  it('תוכנית ריקה נחסמת', () => {
    expect(validatePlanDraft([]).form).toBe('coach.plan.errors.noItems');
  });

  it('יותר מדי תרגילים נחסמים', () => {
    const many = Array.from({ length: MAX_PLAN_ITEMS + 1 }, (_, index) =>
      draft({ exerciseId: `ex_${index}` }),
    );
    expect(validatePlanDraft(many).form).toBe('coach.plan.errors.tooManyItems');
  });

  it('אותו תרגיל פעמיים נחסם', () => {
    expect(validatePlanDraft([draft(), draft()]).form).toBe('coach.plan.errors.duplicate');
  });

  it('יעד ריק, אפס, שלילי או לא-מספר נחסם', () => {
    for (const target of ['', '0', '-5', 'שלוש']) {
      expect(validatePlanDraft([draft({ target })]).items.shoot_form).toBe(
        'coach.plan.errors.targetInvalid',
      );
    }
  });

  it('יעד שבור או גדול מדי נחסם', () => {
    expect(validatePlanDraft([draft({ target: '12.5' })]).items.shoot_form).toBe(
      'coach.plan.errors.targetOutOfRange',
    );
    expect(validatePlanDraft([draft({ target: String(MAX_TARGET + 1) })]).items.shoot_form).toBe(
      'coach.plan.errors.targetOutOfRange',
    );
  });

  it('הנחיות ארוכות מדי נחסמות', () => {
    expect(validatePlanDraft([draft({ notes: 'א'.repeat(400) })]).items.shoot_form).toBe(
      'coach.plan.errors.notesTooLong',
    );
  });
});

describe('toPlanItems', () => {
  it('ממיר יעד למספר ומקצץ רווחים', () => {
    const items = toPlanItems([
      { exerciseId: 'a', exerciseName: '  זריקות  ', unit: 'count', target: '300', notes: ' יד ימין ' },
    ]);

    expect(items).toEqual([
      { exerciseId: 'a', exerciseName: 'זריקות', unit: 'count', target: 300, notes: 'יד ימין' },
    ]);
  });

  it('הלוך-חזור מהתוכנית לטיוטה ובחזרה לא משנה דבר', () => {
    expect(toPlanItems(draftFromItems([ITEM, ITEM_B]))).toEqual([ITEM, ITEM_B]);
  });
});

/* ------------------------------------------------------------------ */
/* 4. התוכנית הפעילה                                                   */
/* ------------------------------------------------------------------ */

describe('activePlanFor', () => {
  it('אין תוכניות — null', () => {
    expect(activePlanFor([], WEDNESDAY)).toBeNull();
  });

  it('תוכנית בארכיון לא נחשבת', () => {
    expect(activePlanFor([planDoc({ status: 'archived' })], WEDNESDAY)).toBeNull();
  });

  it('תוכנית שמתחילה בשבוע הבא לא רצה השבוע', () => {
    const future = planDoc({
      effectiveFrom: Timestamp.fromDate(getWeekBounds(NEXT_WEDNESDAY).weekStart),
    });
    expect(activePlanFor([future], WEDNESDAY)).toBeNull();
    expect(activePlanFor([future], NEXT_WEDNESDAY)?.id).toBe('plan_1');
  });

  it('תוכנית שנסגרה בסוף השבוע הקודם לא רצה', () => {
    const closed = planDoc({
      effectiveTo: Timestamp.fromDate(getWeekBounds(utc('2026-08-12T09:00:00Z')).weekEnd),
    });
    expect(activePlanFor([closed], WEDNESDAY)).toBeNull();
  });

  it('תוכנית שנסגרת בסוף השבוע הנוכחי עדיין רצה בו', () => {
    const closing = planDoc({
      effectiveTo: Timestamp.fromDate(getWeekBounds(WEDNESDAY).weekEnd),
    });
    expect(activePlanFor([closing], WEDNESDAY)?.id).toBe('plan_1');
  });

  it('כששתיים מתאימות — המאוחרת מנצחת', () => {
    const older = planDoc({
      id: 'plan_old',
      effectiveFrom: Timestamp.fromDate(utc('2026-07-05T00:00:00Z')),
    });
    expect(activePlanFor([older, planDoc()], WEDNESDAY)?.id).toBe('plan_1');
  });
});

describe('cycleForDate', () => {
  const cycle = (id: string): PlanCycleDoc => ({
    id,
    planId: 'plan_1',
    teamId: TEAM,
    orgId: ORG,
    weekStart: STAMP,
    weekEnd: STAMP,
    itemsSnapshot: [ITEM],
    createdAt: STAMP,
  });

  it('מוצא לפי המזהה הנגזר, ולא לפי סדר הרשימה', () => {
    const cycles = [cycle('team_yeladim_a_2026-08-09'), cycle('team_yeladim_a_2026-08-16')];
    expect(cycleForDate(cycles, TEAM, WEDNESDAY)?.id).toBe('team_yeladim_a_2026-08-16');
  });

  it('אין מחזור לשבוע הזה — null', () => {
    expect(cycleForDate([cycle('team_yeladim_a_2026-08-09')], TEAM, WEDNESDAY)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* 5. בניית מסמכים                                                     */
/* ------------------------------------------------------------------ */

describe('buildNewPlan', () => {
  it('פעילה, בלי תאריך סיום, ומיושרת לתחילת השבוע', () => {
    const plan = buildNewPlan({
      teamId: TEAM,
      orgId: ORG,
      coachUid: COACH,
      items: [ITEM],
      now: WEDNESDAY,
      createdAt: STAMP,
    });

    expect(plan.status).toBe('active');
    expect(plan.effectiveTo).toBeNull();
    expect(israeliWall(plan.effectiveFrom)).toBe('2026-08-16 00:00:00.000');
  });

  it('הפריטים נשמרים מנורמלים', () => {
    const plan = buildNewPlan({
      teamId: TEAM,
      orgId: ORG,
      coachUid: COACH,
      items: [{ ...ITEM, notes: undefined } as unknown as PlanItem],
      now: WEDNESDAY,
      createdAt: STAMP,
    });

    expect(plan.items[0].notes).toBe('');
  });
});

describe('buildCycleData — הצילום חייב להיות זהה לתוכנית', () => {
  it('itemsSnapshot הוא בדיוק המערך של התוכנית', () => {
    // ה-rules דורשים itemsSnapshot == plan.items בהשוואה מדויקת. כל map/sort
    // כאן היה עלול לשנות סדר או קבוצת שדות ולהפיל את היצירה.
    const plan = planDoc({ items: [ITEM, ITEM_B] });
    const { data } = buildCycleData({ plan, now: WEDNESDAY, createdAt: STAMP });

    expect(data.itemsSnapshot).toBe(plan.items);
    expect(planItemsEqual(data.itemsSnapshot, plan.items)).toBe(true);
  });

  it('המזהה, הקבוצה, הארגון והתוכנית נגזרים מהתוכנית', () => {
    const { id, data } = buildCycleData({ plan: planDoc(), now: WEDNESDAY, createdAt: STAMP });

    expect(id).toBe('team_yeladim_a_2026-08-16');
    expect(data.planId).toBe('plan_1');
    expect(data.teamId).toBe(TEAM);
    expect(data.orgId).toBe(ORG);
  });

  it('גבולות השבוע הם ראשון 00:00 עד שבת 23:59:59.999 בשעון ישראל', () => {
    const { data } = buildCycleData({ plan: planDoc(), now: WEDNESDAY, createdAt: STAMP });

    expect(israeliWall(data.weekStart)).toBe('2026-08-16 00:00:00.000');
    expect(israeliWall(data.weekEnd)).toBe('2026-08-22 23:59:59.999');
  });
});

/* ------------------------------------------------------------------ */
/* 6. קריטריון הסיום של שלב 3                                          */
/* ------------------------------------------------------------------ */

describe('מעבר שבוע — מחזור חדש, אותם יעדים, מונים מאופסים', () => {
  it('אותה תוכנית בשבוע הבא נותנת מחזור אחר עם אותם יעדים', () => {
    const plan = planDoc();
    const thisWeek = buildCycleData({ plan, now: WEDNESDAY, createdAt: STAMP });
    const nextWeek = buildCycleData({ plan, now: NEXT_WEDNESDAY, createdAt: STAMP });

    expect(nextWeek.id).not.toBe(thisWeek.id);
    expect(nextWeek.id).toBe('team_yeladim_a_2026-08-23');
    expect(planItemsEqual(nextWeek.data.itemsSnapshot, thisWeek.data.itemsSnapshot)).toBe(true);
    expect(israeliWall(nextWeek.data.weekStart)).toBe('2026-08-23 00:00:00.000');
  });

  it('המחזור לא נושא מונים — הספירה מגיעה מהדיווחים, ולכן שבוע חדש מתחיל מאפס', () => {
    const { data } = buildCycleData({ plan: planDoc(), now: NEXT_WEDNESDAY, createdAt: STAMP });
    const fields = Object.keys(data).sort();

    expect(fields).toEqual(
      ['createdAt', 'itemsSnapshot', 'orgId', 'planId', 'teamId', 'weekEnd', 'weekStart'].sort(),
    );
  });
});

describe('"מהשבוע הנוכחי" — שני מסמכים שאסור להם להתפצל', () => {
  const cycle: PlanCycleDoc = {
    id: 'team_yeladim_a_2026-08-16',
    planId: 'plan_1',
    teamId: TEAM,
    orgId: ORG,
    weekStart: STAMP,
    weekEnd: STAMP,
    itemsSnapshot: [ITEM],
    createdAt: STAMP,
  };

  it('התוכנית והמחזור מקבלים את **אותו** מערך פריטים', () => {
    const edit = buildCurrentWeekEdit(cycle, [{ ...ITEM, target: 500 }]);

    expect(edit.cycleUpdate?.cycleId).toBe(cycle.id);
    expect(edit.cycleUpdate?.itemsSnapshot).toBe(edit.planUpdate.items);
    expect(edit.planUpdate.items[0].target).toBe(500);
  });

  it('אין עדיין מחזור לשבוע הזה — מתעדכנת התוכנית בלבד', () => {
    const edit = buildCurrentWeekEdit(null, [{ ...ITEM, target: 500 }]);

    expect(edit.cycleUpdate).toBeNull();
    expect(edit.planUpdate.items[0].target).toBe(500);
  });
});

describe('"מהשבוע הבא" — השבוע הנוכחי לא זז', () => {
  const plan = planDoc();
  const newItems: PlanItem[] = [{ ...ITEM, target: 500 }];

  it('הישנה נסגרת בסוף השבוע הנוכחי והחדשה נפתחת בראשון שאחריו', () => {
    const { closeUpdate, nextPlan } = buildNextWeekSwitch({
      plan,
      items: newItems,
      now: WEDNESDAY,
      createdAt: STAMP,
    });

    expect(closeUpdate.planId).toBe('plan_1');
    expect(closeUpdate.status).toBe('archived');
    expect(israeliWall(closeUpdate.effectiveTo)).toBe('2026-08-22 23:59:59.999');
    expect(israeliWall(nextPlan.effectiveFrom)).toBe('2026-08-23 00:00:00.000');
    expect(nextPlan.effectiveTo).toBeNull();
    expect(nextPlan.items[0].target).toBe(500);
  });

  it('בין הסגירה לפתיחה אין חור ואין חפיפה', () => {
    const { closeUpdate, nextPlan } = buildNextWeekSwitch({
      plan,
      items: newItems,
      now: WEDNESDAY,
      createdAt: STAMP,
    });

    expect(nextPlan.effectiveFrom.toMillis() - closeUpdate.effectiveTo.toMillis()).toBe(1);
  });

  it('המחזור של השבוע הנוכחי ממשיך להחזיק את היעד הישן', () => {
    // זה הלב של מלכודת 2: הצילום הוא צילום. שינוי יעד היום לא משכתב היסטוריה.
    const currentCycle = buildCycleData({ plan, now: WEDNESDAY, createdAt: STAMP });
    const { closeUpdate, nextPlan } = buildNextWeekSwitch({
      plan,
      items: newItems,
      now: WEDNESDAY,
      createdAt: STAMP,
    });

    expect(currentCycle.data.itemsSnapshot[0].target).toBe(300);

    // וכך נראה העולם אחרי הכתיבה: הישנה סגורה, החדשה פעילה מהשבוע הבא.
    const after: PlanDoc[] = [
      { ...plan, status: closeUpdate.status, effectiveTo: closeUpdate.effectiveTo },
      { ...nextPlan, id: 'plan_2', createdAt: STAMP },
    ];

    expect(activePlanFor(after, WEDNESDAY)).toBeNull();
    expect(activePlanFor(after, NEXT_WEDNESDAY)?.id).toBe('plan_2');

    const nextCycle = buildCycleData({
      plan: after[1],
      now: NEXT_WEDNESDAY,
      createdAt: STAMP,
    });
    expect(nextCycle.data.itemsSnapshot[0].target).toBe(500);
    expect(nextCycle.id).not.toBe(currentCycle.id);
  });

  it('אחרי הסגירה אין תוכנית פעילה לשבוע הנוכחי — ולכן גם לא ייפתח לו מחזור חדש', () => {
    // PRD §8.4: "אם אין תוכנית פעילה — לא נוצר מחזור". המחזור שכבר קיים נשאר.
    const { closeUpdate } = buildNextWeekSwitch({
      plan,
      items: newItems,
      now: WEDNESDAY,
      createdAt: STAMP,
    });
    const archived: PlanDoc[] = [
      { ...plan, status: closeUpdate.status, effectiveTo: closeUpdate.effectiveTo },
    ];

    expect(activePlanFor(archived, WEDNESDAY)).toBeNull();
    expect(activePlanFor(archived, NEXT_WEDNESDAY)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* 7. תבניות                                                           */
/* ------------------------------------------------------------------ */

describe('תבניות', () => {
  const template: PlanTemplateDoc = {
    id: 'tpl_1',
    orgId: ORG,
    coachUid: COACH,
    name: 'שבוע לפני משחק',
    items: [ITEM, ITEM_B],
  };

  it('buildTemplate שומר בעלות ופריטים מנורמלים', () => {
    const built = buildTemplate('  לפני משחק  ', [ITEM], ORG, COACH);

    expect(built).toEqual({
      orgId: ORG,
      coachUid: COACH,
      name: 'לפני משחק',
      items: [ITEM],
    });
  });

  it('טעינה מלאה כשכל התרגילים עדיין בספרייה', () => {
    const { draft, droppedCount } = templateToDraft(template, ['shoot_form', 'fitness_core']);

    expect(droppedCount).toBe(0);
    expect(draft.map((item) => item.exerciseId)).toEqual(['shoot_form', 'fitness_core']);
    expect(draft[0].target).toBe('300');
  });

  it('תרגיל שכבר לא קיים בספרייה מושמט ונספר', () => {
    const { draft, droppedCount } = templateToDraft(template, ['shoot_form']);

    expect(droppedCount).toBe(1);
    expect(draft).toHaveLength(1);
  });

  it('שם תבנית: ריק, ארוך מדי או תפוס', () => {
    expect(validateTemplateName('  ')).toBe('coach.plan.errors.templateNameRequired');
    expect(validateTemplateName('א'.repeat(60))).toBe('coach.plan.errors.templateNameTooLong');
    expect(validateTemplateName('שבוע לפני משחק', [template.name])).toBe(
      'coach.plan.errors.templateNameTaken',
    );
    expect(validateTemplateName('שבוע קל', [template.name])).toBeNull();
  });
});
