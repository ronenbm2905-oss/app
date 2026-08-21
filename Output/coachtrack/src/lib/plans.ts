/**
 * CoachTrack — הלוגיקה הטהורה של התוכנית המתמשכת (PRD §7.4).
 *
 * כל מה שכאן הוא פונקציה טהורה: אין קריאה ל-Firestore ואין `Date.now()`. הרגע
 * הנוכחי מוזרק תמיד כפרמטר `now` — זה מה שמאפשר לבדוק בקוד את מעבר השבוע
 * (קריטריון הסיום של שלב 3) בלי לגעת בשעון המערכת. הכתיבות עצמן יושבות
 * ב-`lib/planAdmin.ts`, והן רק **מבצעות** את מה שהבנאים כאן מחשבים.
 *
 * ## ארבעה דברים שקל לטעות בהם, ולמה הם נראים כאן כך
 *
 * 1. **מזהה המחזור דטרמיניסטי ולא `addDoc`.** היצירה היא עצלה: כל מי שנכנס
 *    בתחילת שבוע עלול לפתוח את המחזור. שני מכשירים באותה שנייה עם `addDoc` היו
 *    יוצרים שני מחזורים לאותו שבוע, והדיווחים היו מתפצלים בין שניהם. מזהה נגזר
 *    (`${teamId}_${weekKey}`) הופך את היצירה השנייה לכתיבה על מסמך קיים —
 *    ו-`getOrCreateCurrentCycle` עוטף אותה בטרנזקציה שמוותרת כשהמסמך כבר שם.
 *
 * 2. **`itemsSnapshot` מועתק מהתוכנית כמות שהוא.** `firestore.rules` דורשים
 *    `itemsSnapshot == plan.items` בהשוואה מדויקת, וההשוואה הזו רגישה לסדר
 *    האיברים במערך ולקבוצת השדות בכל איבר. לכן `buildCycleData` **לא** מנרמל
 *    ולא ממיין — הוא מעביר את `plan.items` ישירות. הנרמול קורה רק בכתיבה
 *    לתוכנית (`toPlanItems`), כלומר במקום היחיד שבו נוצרים פריטים חדשים.
 *
 * 3. **הצילום הוא צילום, לא רפרנס** (מלכודת 2 ב-TASKS.md). מסך השחקן והדשבורד
 *    קוראים יעדים מהמחזור. מי שיקרא אותם מהתוכנית ישכתב היסטוריה בכל שינוי יעד.
 *
 * 4. **גבולות התוכנית מיושרים לשבוע.** `effectiveFrom` הוא תחילת השבוע ו-
 *    `effectiveTo` הוא סוף שבוע — כי היחידה שהמערכת סופרת בה היא שבוע. תוכנית
 *    שנפתחת ביום שלישי בצהריים הייתה יוצרת שבוע ראשון "חצי", בלי שאף מסך יודע
 *    להציג את זה.
 */

import { Timestamp } from 'firebase/firestore';
import type { FieldValue } from 'firebase/firestore';
import {
  getNextWeekBounds,
  getWeekBounds,
  getWeekKey,
  toDate,
  type DateInput,
} from './dates';
import { suggestedTarget } from './exercises';
import type { TranslationKey } from '../i18n/he';
import type {
  ExerciseDoc,
  Plan,
  PlanCycle,
  PlanCycleDoc,
  PlanDoc,
  PlanItem,
  PlanTemplate,
  PlanTemplateDoc,
  Unit,
  WeekStartDay,
} from '../types/types';

/* ------------------------------------------------------------------ */
/* מגבלות                                                              */
/* ------------------------------------------------------------------ */

/** מספר התרגילים המרבי בתוכנית. מעבר לזה מסך השחקן הופך לרשימת מטלות. */
export const MAX_PLAN_ITEMS = 12;
export const MAX_TARGET = 100000;
export const PLAN_NOTES_MAX_LENGTH = 300;
export const TEMPLATE_NAME_MAX_LENGTH = 40;

/* ------------------------------------------------------------------ */
/* מזהה המחזור                                                         */
/* ------------------------------------------------------------------ */

/**
 * מזהה המחזור השבועי — נגזר ולא מוגרל.
 *
 * `team_yeladim_a_2026-08-16`. שני מכשירים שנכנסים באותו רגע מחשבים את אותו
 * מזהה, ולכן אין מצב של שני מחזורים לאותו שבוע.
 */
export function cycleIdFor(teamId: string, weekKey: string): string {
  return `${teamId}_${weekKey}`;
}

/** המזהה של המחזור שאליו שייך הרגע `at`. */
export function cycleIdForDate(
  teamId: string,
  at: DateInput,
  weekStartDay: WeekStartDay = 0,
): string {
  return cycleIdFor(teamId, getWeekKey(at, weekStartDay));
}

/* ------------------------------------------------------------------ */
/* פריטי תוכנית                                                        */
/* ------------------------------------------------------------------ */

/**
 * פריט תוכנית בצורתו הקנונית — **בדיוק חמישה שדות, בלי `undefined`.**
 *
 * זו לא קוסמטיקה: `undefined` נופל בכתיבה ל-Firestore, ואז `itemsSnapshot`
 * לא ישווה ל-`plan.items` ויצירת המחזור תיחסם ב-rules.
 */
export function normalizePlanItem(item: PlanItem): PlanItem {
  return {
    exerciseId: item.exerciseId,
    exerciseName: item.exerciseName,
    unit: item.unit,
    target: item.target,
    notes: item.notes ?? '',
  };
}

/** השוואת תוכן בין שתי רשימות פריטים — כולל סדר, כי הסדר הוא מה שהשחקן רואה. */
export function planItemsEqual(a: readonly PlanItem[], b: readonly PlanItem[]): boolean {
  if (a.length !== b.length) return false;

  return a.every((item, index) => {
    const other = normalizePlanItem(b[index]);
    const mine = normalizePlanItem(item);
    return (
      mine.exerciseId === other.exerciseId &&
      mine.exerciseName === other.exerciseName &&
      mine.unit === other.unit &&
      mine.target === other.target &&
      mine.notes === other.notes
    );
  });
}

/* ------------------------------------------------------------------ */
/* טיוטת התוכנית (מה שהטופס מחזיק)                                    */
/* ------------------------------------------------------------------ */

/** פריט בטופס. `target` הוא מחרוזת כי זה מה ששדה קלט מחזיק. */
export interface PlanDraftItem {
  exerciseId: string;
  exerciseName: string;
  unit: Unit;
  target: string;
  notes: string;
}

/**
 * פריט טיוטה מתוך תרגיל בספרייה.
 *
 * **היעד נטען מראש מ-`defaultTargets.cadets_13_15`** (CLAUDE.md → בניית תוכנית).
 * זו הצעה בלבד — המאמן דורס אותה בשדה. תרגיל בלי הצעה נשאר ריק ולא מקבל 0,
 * כי 0 הוא יעד לא חוקי ולא "בלי דעה".
 */
export function draftFromExercise(exercise: ExerciseDoc): PlanDraftItem {
  const target = suggestedTarget(exercise);

  return {
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    unit: exercise.unit,
    target: target === null ? '' : String(target),
    notes: exercise.description ?? '',
  };
}

/** טיוטה מתוך תוכנית קיימת — זה מה שנפתח כשלוחצים "עדכון תוכנית". */
export function draftFromItems(items: readonly PlanItem[]): PlanDraftItem[] {
  return items.map((item) => ({
    exerciseId: item.exerciseId,
    exerciseName: item.exerciseName,
    unit: item.unit,
    target: String(item.target),
    notes: item.notes ?? '',
  }));
}

/** שגיאות הטופס: שגיאה ברמת התוכנית, ושגיאה לכל פריט לפי מזהה התרגיל. */
export interface PlanDraftErrors {
  form?: TranslationKey;
  items: Record<string, TranslationKey>;
}

export function validatePlanDraft(draft: readonly PlanDraftItem[]): PlanDraftErrors {
  const errors: PlanDraftErrors = { items: {} };

  if (draft.length === 0) {
    errors.form = 'coach.plan.errors.noItems';
  } else if (draft.length > MAX_PLAN_ITEMS) {
    errors.form = 'coach.plan.errors.tooManyItems';
  }

  const seen = new Set<string>();
  for (const item of draft) {
    if (seen.has(item.exerciseId)) {
      errors.form = 'coach.plan.errors.duplicate';
    }
    seen.add(item.exerciseId);

    const target = Number(item.target);
    if (!item.target.trim() || !Number.isFinite(target) || target <= 0) {
      errors.items[item.exerciseId] = 'coach.plan.errors.targetInvalid';
    } else if (!Number.isInteger(target) || target > MAX_TARGET) {
      errors.items[item.exerciseId] = 'coach.plan.errors.targetOutOfRange';
    } else if (item.notes.length > PLAN_NOTES_MAX_LENGTH) {
      errors.items[item.exerciseId] = 'coach.plan.errors.notesTooLong';
    }
  }

  return errors;
}

export function isPlanDraftValid(errors: PlanDraftErrors): boolean {
  return !errors.form && Object.keys(errors.items).length === 0;
}

/** מהטיוטה למסמך. נקרא רק אחרי `validatePlanDraft`. */
export function toPlanItems(draft: readonly PlanDraftItem[]): PlanItem[] {
  return draft.map((item) =>
    normalizePlanItem({
      exerciseId: item.exerciseId,
      exerciseName: item.exerciseName.trim(),
      unit: item.unit,
      target: Number(item.target),
      notes: item.notes.trim(),
    }),
  );
}

/* ------------------------------------------------------------------ */
/* בחירת התוכנית הפעילה                                                */
/* ------------------------------------------------------------------ */

/**
 * התוכנית שרצה ברגע `at`.
 *
 * הבחירה נעשית **בלקוח** מתוך כל התוכניות של הקבוצה, ולא בשאילתה: שאילתה עם
 * `status` + `effectiveFrom` הייתה דורשת אינדקס מורכב, ופריסת אינדקסים חסומה
 * לסוכן (מלכודת 8 + CLAUDE.md). בקבוצה יש קומץ תוכניות לעונה.
 *
 * "פעילה" = `status === 'active'`, התחילה לפני `at`, ולא נסגרה לפניו. אם יש
 * יותר מאחת (לא אמור לקרות) — המאוחרת מנצחת, כי היא זו שהמאמן פרסם אחרונה.
 */
export function activePlanFor(plans: readonly PlanDoc[], at: DateInput): PlanDoc | null {
  const time = toDate(at).getTime();

  const candidates = plans.filter((plan) => {
    if (plan.status !== 'active') return false;
    if (toDate(plan.effectiveFrom).getTime() > time) return false;
    if (plan.effectiveTo && toDate(plan.effectiveTo).getTime() < time) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  return candidates.reduce((latest, plan) =>
    toDate(plan.effectiveFrom).getTime() >= toDate(latest.effectiveFrom).getTime() ? plan : latest,
  );
}

/** המחזור של השבוע שאליו שייך `at`, מתוך המחזורים שנטענו. */
export function cycleForDate(
  cycles: readonly PlanCycleDoc[],
  teamId: string,
  at: DateInput,
  weekStartDay: WeekStartDay = 0,
): PlanCycleDoc | null {
  const id = cycleIdForDate(teamId, at, weekStartDay);
  return cycles.find((cycle) => cycle.id === id) ?? null;
}

/* ------------------------------------------------------------------ */
/* בנאי מסמכים                                                         */
/* ------------------------------------------------------------------ */

/** ערך שנכתב לשדה זמן: Timestamp אמיתי בבדיקות, `serverTimestamp()` בייצור. */
export type WriteTime = Timestamp | FieldValue;

export interface NewPlanInput {
  teamId: string;
  orgId: string;
  coachUid: string;
  items: readonly PlanItem[];
  /** הרגע שממנו התוכנית מתחילה. מיושר לתחילת השבוע שלו. */
  now: DateInput;
  createdAt: WriteTime;
  weekStartDay?: WeekStartDay;
}

/** מסמך תוכנית חדשה. `effectiveFrom` מיושר לתחילת השבוע — ראה הערה 4 בראש הקובץ. */
export function buildNewPlan({
  teamId,
  orgId,
  coachUid,
  items,
  now,
  createdAt,
  weekStartDay = 0,
}: NewPlanInput): Omit<Plan, 'createdAt'> & { createdAt: WriteTime } {
  const { weekStart } = getWeekBounds(now, weekStartDay);

  return {
    teamId,
    orgId,
    status: 'active',
    effectiveFrom: Timestamp.fromDate(weekStart),
    effectiveTo: null,
    createdBy: coachUid,
    createdAt,
    items: items.map(normalizePlanItem),
  };
}

export interface CycleBuildInput {
  plan: PlanDoc;
  now: DateInput;
  createdAt: WriteTime;
  weekStartDay?: WeekStartDay;
}

/** מסמך מחזור + המזהה הדטרמיניסטי שלו. */
export interface CycleBuildResult {
  id: string;
  data: Omit<PlanCycle, 'createdAt'> & { createdAt: WriteTime };
}

/**
 * המחזור של השבוע שאליו שייך `now`, נגזר מהתוכנית.
 *
 * ⚠️ `itemsSnapshot: plan.items` — **בלי `map`, בלי מיון, בלי נרמול.** ה-rules
 * משווים אותו מול `plan.items` בהשוואה מדויקת; כל נגיעה במערך עלולה לשנות סדר
 * או קבוצת שדות ולהפיל את היצירה. מונים לא מועתקים כי אין כאלה — המחזור מחזיק
 * יעדים בלבד, והספירה מחושבת מ-`entries` (וזו הסיבה ששבוע חדש מתחיל מאופס).
 */
export function buildCycleData({
  plan,
  now,
  createdAt,
  weekStartDay = 0,
}: CycleBuildInput): CycleBuildResult {
  const { weekStart, weekEnd } = getWeekBounds(now, weekStartDay);

  return {
    id: cycleIdFor(plan.teamId, getWeekKey(now, weekStartDay)),
    data: {
      planId: plan.id,
      teamId: plan.teamId,
      orgId: plan.orgId,
      weekStart: Timestamp.fromDate(weekStart),
      weekEnd: Timestamp.fromDate(weekEnd),
      itemsSnapshot: plan.items,
      createdAt,
    },
  };
}

/* ------------------------------------------------------------------ */
/* שתי אפשרויות העריכה                                                 */
/* ------------------------------------------------------------------ */

/** "מהשבוע הנוכחי" — שני מסמכים, ולכן שני עדכונים שחייבים לצאת יחד. */
export interface CurrentWeekEdit {
  /** העדכון ל-`plans/{planId}`. */
  planUpdate: { items: PlanItem[] };
  /** העדכון ל-`planCycles/{cycleId}`, או null כשעוד לא נפתח מחזור לשבוע הזה. */
  cycleUpdate: { cycleId: string; itemsSnapshot: PlanItem[] } | null;
}

/**
 * עדכון "מהשבוע הנוכחי".
 *
 * מחזיר את שני העדכונים **מאותו מערך פריטים** — `planUpdate.items` ו-
 * `cycleUpdate.itemsSnapshot` הם אותו אובייקט. אם אחד ייכתב והשני לא,
 * ההיסטוריה והתוכנית מתפצלות; לכן `lib/planAdmin.ts` שולח אותם ב-batch אחד.
 */
export function buildCurrentWeekEdit(
  cycle: PlanCycleDoc | null,
  items: readonly PlanItem[],
): CurrentWeekEdit {
  const normalized = items.map(normalizePlanItem);

  return {
    planUpdate: { items: normalized },
    cycleUpdate: cycle ? { cycleId: cycle.id, itemsSnapshot: normalized } : null,
  };
}

/** "מהשבוע הבא" — סוגרים את הישנה בסוף השבוע הנוכחי ופותחים חדשה מראשון. */
export interface NextWeekSwitch {
  /** העדכון לתוכנית היוצאת. */
  closeUpdate: { planId: string; status: 'archived'; effectiveTo: Timestamp };
  /** התוכנית הנכנסת — בלי מזהה; הוא ייקבע בכתיבה. */
  nextPlan: Omit<Plan, 'createdAt'> & { createdAt: WriteTime };
}

/**
 * מעבר "מהשבוע הבא".
 *
 * השבוע הנוכחי לא זז: המחזור שלו כבר מחזיק את הצילום הישן, והתוכנית היוצאת
 * נסגרת בדיוק בסוף השבוע (שבת 23:59:59.999). התוכנית החדשה מתחילה בראשון
 * 00:00 — אין חפיפה ואין חור.
 */
export function buildNextWeekSwitch({
  plan,
  items,
  now,
  createdAt,
  weekStartDay = 0,
}: {
  plan: PlanDoc;
  items: readonly PlanItem[];
  now: DateInput;
  createdAt: WriteTime;
  weekStartDay?: WeekStartDay;
}): NextWeekSwitch {
  const { weekEnd } = getWeekBounds(now, weekStartDay);
  const { weekStart: nextStart } = getNextWeekBounds(now, weekStartDay);

  return {
    closeUpdate: {
      planId: plan.id,
      status: 'archived',
      effectiveTo: Timestamp.fromDate(weekEnd),
    },
    nextPlan: {
      teamId: plan.teamId,
      orgId: plan.orgId,
      status: 'active',
      effectiveFrom: Timestamp.fromDate(nextStart),
      effectiveTo: null,
      createdBy: plan.createdBy,
      createdAt,
      items: items.map(normalizePlanItem),
    },
  };
}

/* ------------------------------------------------------------------ */
/* תבניות                                                              */
/* ------------------------------------------------------------------ */

export function validateTemplateName(
  name: string,
  takenNames: readonly string[] = [],
): TranslationKey | null {
  const trimmed = name.trim();
  if (!trimmed) return 'coach.plan.errors.templateNameRequired';
  if (trimmed.length > TEMPLATE_NAME_MAX_LENGTH) return 'coach.plan.errors.templateNameTooLong';
  if (takenNames.some((taken) => taken.trim() === trimmed)) {
    return 'coach.plan.errors.templateNameTaken';
  }
  return null;
}

export function buildTemplate(
  name: string,
  items: readonly PlanItem[],
  orgId: string,
  coachUid: string,
): PlanTemplate {
  return {
    orgId,
    coachUid,
    name: name.trim(),
    items: items.map(normalizePlanItem),
  };
}

/**
 * טעינת תבנית לטיוטה.
 *
 * התבנית נשמרה בעבר, והתרגילים שבה יכולים בינתיים להיות מושבתים או להיעלם
 * מהספרייה. מה שלא קיים יותר נשמט, והמסך מדווח כמה — עדיף מלהראות למאמן
 * תרגיל שהשחקן לא יראה.
 */
export function templateToDraft(
  template: PlanTemplateDoc,
  availableExerciseIds: readonly string[],
): { draft: PlanDraftItem[]; droppedCount: number } {
  const available = new Set(availableExerciseIds);
  const kept = template.items.filter((item) => available.has(item.exerciseId));

  return {
    draft: draftFromItems(kept),
    droppedCount: template.items.length - kept.length,
  };
}
