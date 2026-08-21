/**
 * CoachTrack — הלוגיקה הטהורה של הדיווח ושל מסך השחקן.
 *
 * אין כאן Firestore ואין `Date.now()`. הרגע הנוכחי מוזרק תמיד כפרמטר `now`,
 * בדיוק כמו ב-`lib/plans.ts` — זה מה שמאפשר לבדוק חלון של 7 ימים בלי לגעת
 * בשעון המכשיר. הכתיבות עצמן יושבות ב-`lib/entryAdmin.ts`.
 *
 * ## חמישה דברים שקל לטעות בהם, ולמה הם נראים כאן כך
 *
 * 1. **האחוזים מחושבים מ-`itemsSnapshot` של המחזור, לא מ-`plan.items`**
 *    (מלכודת 2 ב-TASKS.md). `buildWeekSummaries` מקבל מחזורים בלבד ואינו יודע
 *    בכלל מהי תוכנית. מי שיזין לו את התוכנית ישכתב היסטוריה בכל שינוי יעד.
 *
 * 2. **החסימה ב-100% היא בממוצע הכללי בלבד** (מלכודת 3). בכרטיס התרגיל
 *    מוצג האחוז המלא, גם 130%. שתי הפונקציות כבר קיימות ב-`lib/calculations.ts`
 *    (`pctForExercise` ללא חסימה, `overallPct` עם חסימה) ולא נכתבות כאן מחדש.
 *
 * 3. **השיוך לשבוע נעשה לפי `entry.date`, לא לפי `cycleId` ולא לפי `createdAt`.**
 *    `cycleId` הוא שדה נוחות שאיש אינו מאמת ב-`firestore.rules`, ו-`createdAt`
 *    הוא מתי נרשם ולא מתי בוצע. דיווח של מוצאי שבת שנרשם ביום ראשון שייך לשבוע
 *    שעבר, וזו כל הנקודה של עיגון `date` ל-12:00 בשעון ישראל.
 *
 * 4. **שני חלונות "7 ימים" שונים באותו אורך.** דיווח רטרואקטיבי נמדד על
 *    `date` (תאריך הביצוע) — `dateOptions`. חלון העריכה נמדד על `createdAt`
 *    (מתי נרשם) — `canEditEntry`. לא לאחד אותם: איחוד היה מונע תיקון של דיווח
 *    שנרשם היום על ביצוע מלפני שישה ימים.
 *
 * 5. **שבוע בלי מחזור אינו שבוע של 0%.** הוא שבוע בלי יעדים (PRD §8.4):
 *    הדיווחים נשמרים ומוצגים, אבל אין מולם אחוז ואין להם השפעה על הרצף.
 */

import {
  getWeekBounds,
  getWeekKey,
  israeliWallTime,
  toDate,
  toEntryDate,
  toIsraeliDayKey,
  type DateInput,
  type DayKey,
} from './dates';
import {
  groupEntriesByExercise,
  overallPct,
  pctForExercise,
  sumEntries,
  meetsStreakThreshold,
} from './calculations';
import type { TranslationKey } from '../i18n/he';
import type { EntryDoc, PlanCycleDoc, PlanItem, Unit, WeekStartDay } from '../types/types';

/* ------------------------------------------------------------------ */
/* מגבלות                                                              */
/* ------------------------------------------------------------------ */

/**
 * כמה ימים אחורה מותר לדווח (PRD §7.2ב, §8.4).
 *
 * הערך נמדד על **תאריך הביצוע**. הכלל ב-`firestore.rules` מתיר
 * `date >= request.time - 8d`, כלומר יום שלם של מרווח מעל מה שהמסך מציע —
 * המרווח קיים כדי לספוג את עיגון הצהריים מול `request.time`, ולא כדי להרחיב
 * את החלון. שינוי הקבוע הזה כלפי מעלה ידרוש גם שינוי בכלל.
 */
export const MAX_BACKDATE_DAYS = 7;

/** חלון העריכה, נמדד על `createdAt`. זהה ל-`withinEditWindow` ב-`firestore.rules`. */
export const EDIT_WINDOW_DAYS = 7;

/** מעל זה נדרש אישור "האם התכוונת ל-X?" — הגנה מטעות הקלדה (PRD §8.4). */
export const OUTLIER_TARGET_MULTIPLIER = 3;

/** תקרת כמות ברישום בודד. 100,000 חזרות בשבוע אינן טעות שכדאי לשמור. */
export const MAX_ENTRY_AMOUNT = 100000;

/**
 * אורך ההערה החופשית.
 *
 * ⚠️ קצר בכוונה. השדה מסומן כדגל M1 בסקירת עדי (21.8.2026): טקסט חופשי של
 * קטין עלול להכיל מידע רפואי ("כאב לי הברך") ולהעלות את כל המאגר לרמת אבטחה
 * בינונית לפי תיקון 13. עד להכרעה, המיתון הוא **טקסט עזר מגביל** ליד השדה
 * (`player.report.note.hint`) ואורך מוגבל — לא ביטול השדה, שהוא ב-PRD.
 */
export const NOTE_MAX_LENGTH = 200;

/* ------------------------------------------------------------------ */
/* טיוטת הדיווח                                                        */
/* ------------------------------------------------------------------ */

/**
 * מה שהטופס מחזיק. `amount` הוא מחרוזת כי זה מה ששדה קלט מחזיק,
 * ו-`dayKey` הוא `yyyy-MM-dd` בשעון ישראל ולא `Date` — יום לוח, לא רגע בזמן.
 */
export interface EntryDraft {
  amount: string;
  dayKey: DayKey;
  note: string;
}

/** טיוטה ריקה לדיווח חדש: היום, בלי כמות ובלי הערה. */
export function newEntryDraft(now: DateInput): EntryDraft {
  return { amount: '', dayKey: toIsraeliDayKey(now), note: '' };
}

/** טיוטה מתוך דיווח קיים — זה מה שנפתח בעריכה. */
export function draftFromEntry(entry: EntryDoc): EntryDraft {
  return {
    amount: String(entry.amount),
    dayKey: toIsraeliDayKey(entry.date),
    note: entry.note ?? '',
  };
}

/** תאריך אפשרי לבחירה: מפתח-היום וכמה ימים אחורה הוא. */
export interface EntryDateOption {
  dayKey: DayKey;
  /** 0 = היום, 1 = אתמול, וכן הלאה. */
  daysAgo: number;
}

/**
 * התאריכים שהבורר מציע: היום ועד `MAX_BACKDATE_DAYS` ימים אחורה.
 *
 * בלי תאריכים עתידיים — הכלל חוסם אותם ממילא, ואין משמעות לדיווח על אימון
 * שעוד לא קרה.
 */
export function dateOptions(now: DateInput, maxDays: number = MAX_BACKDATE_DAYS): EntryDateOption[] {
  const options: EntryDateOption[] = [];
  const nowTime = toDate(now).getTime();

  for (let daysAgo = 0; daysAgo <= maxDays; daysAgo += 1) {
    const at = new Date(nowTime - daysAgo * 24 * 60 * 60 * 1000);
    options.push({ dayKey: toIsraeliDayKey(at), daysAgo });
  }
  return options;
}

/** האם מפתח-היום נמצא בחלון המותר. אותה בדיקה שהבורר עושה, לקלט שלא ממנו. */
export function isDayKeyAllowed(
  dayKey: DayKey,
  now: DateInput,
  maxDays: number = MAX_BACKDATE_DAYS,
): boolean {
  return dateOptions(now, maxDays).some((option) => option.dayKey === dayKey);
}

/** שגיאות הטופס, שדה-שדה. הערכים הם מפתחות תרגום ולא טקסט (כלל 8). */
export interface EntryDraftErrors {
  amount?: TranslationKey;
  date?: TranslationKey;
  note?: TranslationKey;
}

/** הכמות כמספר, או `null` כשהיא אינה מספר חוקי. */
export function parseAmount(raw: string): number | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;

  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  return value;
}

/**
 * ולידציית הטופס. **מראה של `firestore.rules`, לא תחליף לו** (כלל 4):
 * כמות חיובית, תאריך בחלון, ואורך הערה. הכלל אוכף את שניים הראשונים בשרת.
 */
export function validateEntryDraft(draft: EntryDraft, now: DateInput): EntryDraftErrors {
  const errors: EntryDraftErrors = {};

  const amount = parseAmount(draft.amount);
  if (amount === null) {
    errors.amount = 'player.report.errors.amountRequired';
  } else if (amount <= 0) {
    errors.amount = 'player.report.errors.amountPositive';
  } else if (amount > MAX_ENTRY_AMOUNT) {
    errors.amount = 'player.report.errors.amountTooLarge';
  }

  if (!isDayKeyAllowed(draft.dayKey, now)) {
    errors.date = 'player.report.errors.dateOutOfWindow';
  }

  if ((draft.note ?? '').length > NOTE_MAX_LENGTH) {
    errors.note = 'player.report.errors.noteTooLong';
  }

  return errors;
}

export function isEntryDraftValid(errors: EntryDraftErrors): boolean {
  return Object.keys(errors).length === 0;
}

/**
 * ערך חריג — מעל פי שלושה מהיעד **ברישום בודד** (PRD §8.4).
 *
 * הבדיקה היא על הרישום ולא על הסכום השבועי בכוונה: שחקן שהגיע ל-400% בזריקות
 * לאורך השבוע עשה בדיוק את מה שהמערכת מעודדת, ואין מה לאשר לו. מי שהקליד 5000
 * במקום 50 — כן.
 */
export function isOutlierAmount(amount: number, target: number): boolean {
  if (!Number.isFinite(amount) || !Number.isFinite(target) || target <= 0) return false;
  return amount > target * OUTLIER_TARGET_MULTIPLIER;
}

/* ------------------------------------------------------------------ */
/* כפתורי הקיצור                                                       */
/* ------------------------------------------------------------------ */

/**
 * סולם "מספרים עגולים". כפתור `+7` נראה כמו באג; `+5` ו-`+10` נראים כמו החלטה.
 * אין כאן 3 בכוונה — הוא נופל בין 2 ל-5 ומייצר סולם צפוף מדי בטווח הקטן.
 */
const NICE_STEPS = [
  1, 2, 5, 10, 15, 20, 25, 30, 50, 75, 100, 150, 200, 250, 300, 500, 750, 1000, 1500, 2000, 2500,
  5000,
];

/** המספר העגול הקרוב ביותר. שוויון מעגל כלפי מעלה — כפתור גדול יותר חוסך הקלדה. */
function snapToNice(value: number): number {
  if (!Number.isFinite(value) || value <= 1) return 1;

  let best = NICE_STEPS[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const step of NICE_STEPS) {
    const distance = Math.abs(step - value);
    if (distance <= bestDistance) {
      best = step;
      bestDistance = distance;
    }
  }
  return best;
}

/** השברים שמהם נגזרים הכפתורים, מהקטן לגדול. */
const QUICK_FRACTIONS = [1 / 50, 1 / 20, 1 / 10, 1 / 5, 1 / 2, 1];

/**
 * כפתורי הקיצור, **נגזרים מהיעד** ולא קבועים (PRD §7.2ב).
 *
 * יעד 500 מייצר בדיוק את מה שה-PRD מדגים — `+10 / +25 / +50 / +100`. יעד קטן
 * (15 דקות) היה מייצר את אותם ארבעה שברים ומקבל ערכים זהים אחרי העיגול, ולכן
 * הרשימה עוברת דה-דופליקציה וממשיכה לשברים גדולים יותר עד שיש ארבעה כפתורים.
 */
export function quickAddValues(target: number, count = 4): number[] {
  if (!Number.isFinite(target) || target <= 0) return [];

  const values: number[] = [];
  for (const fraction of QUICK_FRACTIONS) {
    const value = snapToNice(target * fraction);
    if (!values.includes(value)) values.push(value);
    if (values.length === count) break;
  }
  return values;
}

/* ------------------------------------------------------------------ */
/* חלון העריכה                                                         */
/* ------------------------------------------------------------------ */

/**
 * האם השחקן עדיין רשאי לגעת בדיווח — עד 7 ימים **מרגע הרישום**.
 *
 * מראה של `withinEditWindow` ב-`firestore.rules`. למאמן אין חלון (שלב 5),
 * ולכן הפונקציה הזו מתארת את השחקן בלבד.
 *
 * `createdAt` שעוד לא חזר מהשרת (`serverTimestamp()` בהמתנה) מקבל `true`:
 * הדיווח נרשם ממש עכשיו, ולהסתיר ממנו את כפתור העריכה לשנייה זה באג נראה לעין.
 */
export function canEditEntry(
  entry: Pick<EntryDoc, 'createdAt'>,
  now: DateInput,
  windowDays: number = EDIT_WINDOW_DAYS,
): boolean {
  if (!entry.createdAt) return true;

  const created = toDate(entry.createdAt).getTime();
  return toDate(now).getTime() < created + windowDays * 24 * 60 * 60 * 1000;
}

/* ------------------------------------------------------------------ */
/* מיון וסינון                                                         */
/* ------------------------------------------------------------------ */

/** הדיווחים שנספרים — בלי מחוקים-רכות. */
export function visibleEntries(entries: readonly EntryDoc[]): EntryDoc[] {
  return entries.filter((entry) => entry.deleted !== true);
}

/**
 * הדיווחים ששייכים לשבוע שמתחיל ב-`weekStart`, לפי `entry.date`.
 * ממוינים מהחדש לישן — כך נראה יומן.
 */
export function entriesForWeek(
  entries: readonly EntryDoc[],
  weekStart: DateInput,
  weekStartDay: WeekStartDay = 0,
): EntryDoc[] {
  const key = getWeekKey(weekStart, weekStartDay);

  return entries
    .filter((entry) => entry.date && getWeekKey(entry.date, weekStartDay) === key)
    .sort((a, b) => toDate(b.date).getTime() - toDate(a.date).getTime());
}

/* ------------------------------------------------------------------ */
/* סיכומי שבוע                                                         */
/* ------------------------------------------------------------------ */

/** שורת תרגיל בשבוע: היעד מהצילום, מה שנצבר, והאחוז **הלא חסום**. */
export interface WeekExerciseStat {
  exerciseId: string;
  exerciseName: string;
  unit: Unit;
  target: number;
  notes: string;
  total: number;
  /** לא נחסם ב-100 — זו התצוגה בכרטיס (מלכודת 3). */
  pct: number;
  /** כמה חסר להשלמה מלאה. 0 כשהיעד הושג. */
  remaining: number;
  entryCount: number;
}

/** שבוע אחד בהיסטוריה של השחקן. */
export interface WeekSummary {
  /** מפתח-היום של ראשון — מזהה יציב וממויין לקסיקוגרפית. */
  weekKey: DayKey;
  weekStart: Date;
  weekEnd: Date;
  /** המחזור שממנו נלקחו היעדים, או null בשבוע בלי תוכנית. */
  cycleId: string | null;
  hasPlan: boolean;
  items: WeekExerciseStat[];
  /** ממוצע כללי, כל תרגיל חסום ב-100 קודם. 0 בשבוע בלי תוכנית. */
  overall: number;
  entryCount: number;
  /** דיווחים באותו שבוע על תרגיל שאינו בצילום — נשמרים, לא נספרים (PRD §8.4). */
  offPlanCount: number;
  meetsThreshold: boolean;
}

function statFor(item: PlanItem, entries: readonly EntryDoc[]): WeekExerciseStat {
  const total = sumEntries(entries);

  return {
    exerciseId: item.exerciseId,
    exerciseName: item.exerciseName,
    unit: item.unit,
    target: item.target,
    notes: item.notes ?? '',
    total,
    pct: pctForExercise(entries, item.target),
    remaining: Math.max(0, item.target - total),
    entryCount: entries.length,
  };
}

/**
 * הסיכום של שבוע יחיד, מתוך צילום היעדים והדיווחים שנפלו בו.
 *
 * `items` מגיע מ-`cycle.itemsSnapshot` ולעולם לא מ-`plan.items`.
 */
export function summarizeWeek(
  weekKey: DayKey,
  items: readonly PlanItem[] | null,
  weekEntries: readonly EntryDoc[],
  threshold: number,
  cycleId: string | null = null,
  weekStartDay: WeekStartDay = 0,
): WeekSummary {
  const bounds = getWeekBounds(israeliWallTime(weekKey, '12:00:00.000'), weekStartDay);
  const counted = visibleEntries(weekEntries);
  const grouped = groupEntriesByExercise(counted);

  const planItems = items ?? [];
  const stats = planItems.map((item) => statFor(item, grouped[item.exerciseId] ?? []));
  const planned = new Set(planItems.map((item) => item.exerciseId));
  const overall = items ? overallPct(planItems, grouped) : 0;

  return {
    weekKey,
    weekStart: bounds.weekStart,
    weekEnd: bounds.weekEnd,
    cycleId,
    hasPlan: Boolean(items),
    items: stats,
    overall,
    entryCount: counted.length,
    offPlanCount: counted.filter((entry) => !planned.has(entry.exerciseId)).length,
    meetsThreshold: Boolean(items) && meetsStreakThreshold(overall, threshold),
  };
}

export interface WeekSummaryOptions {
  /** `teams.settings.streakThreshold` — האחוז שמעליו שבוע נחשב לרצף. */
  threshold: number;
  weekStartDay?: WeekStartDay;
}

/**
 * כל השבועות שיש עליהם מה לספר — מהחדש לישן.
 *
 * המקור לשבועות הוא **המחזורים**; שבוע שיש בו דיווחים בלי מחזור נכנס גם הוא
 * לרשימה, כשבוע בלי תוכנית. כך דיווח רטרואקטיבי לשבוע שלא נפתח בו מחזור אינו
 * נעלם מההיסטוריה (PRD §8.4 — "נשמר בהיסטוריה, לא משויך לתוכנית").
 */
export function buildWeekSummaries(
  cycles: readonly PlanCycleDoc[],
  entries: readonly EntryDoc[],
  { threshold, weekStartDay = 0 }: WeekSummaryOptions,
): WeekSummary[] {
  const cycleByWeek = new Map<DayKey, PlanCycleDoc>();
  for (const cycle of cycles) {
    if (!cycle.weekStart) continue;
    cycleByWeek.set(getWeekKey(cycle.weekStart, weekStartDay), cycle);
  }

  const entriesByWeek = new Map<DayKey, EntryDoc[]>();
  for (const entry of visibleEntries(entries)) {
    if (!entry.date) continue;
    const key = getWeekKey(entry.date, weekStartDay);
    const bucket = entriesByWeek.get(key);
    if (bucket) bucket.push(entry);
    else entriesByWeek.set(key, [entry]);
  }

  const keys = new Set<DayKey>([...cycleByWeek.keys(), ...entriesByWeek.keys()]);

  return [...keys]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .map((weekKey) => {
      const cycle = cycleByWeek.get(weekKey) ?? null;
      return summarizeWeek(
        weekKey,
        cycle ? cycle.itemsSnapshot : null,
        entriesByWeek.get(weekKey) ?? [],
        threshold,
        cycle ? cycle.id : null,
        weekStartDay,
      );
    });
}

/**
 * רצף ההתמדה: כמה שבועות **רצופים** מעל הסף, סופרים אחורה.
 *
 * שתי הכרעות שקובעות את המספר, ושתיהן לטובת השחקן:
 *
 * • **השבוע הנוכחי לא שובר רצף.** הוא עדיין רץ; אם הוא כבר מעל הסף הוא נספר,
 *   ואם לא — פשוט מדלגים עליו ומתחילים מהשבוע שנסגר. אחרת הרצף היה מתאפס
 *   כל יום ראשון בבוקר.
 *
 * • **שבוע בלי תוכנית אינו שובר רצף.** זו חופשה שהמאמן נתן (PRD §8.4), לא
 *   כישלון של השחקן. מדלגים עליו ולא סופרים אותו.
 *
 * שבוע חסר לגמרי (אין מחזור ואין דיווחים) מטופל כשבוע בלי תוכנית — מדלגים.
 */
export function currentStreak(summaries: readonly WeekSummary[], currentWeekKey: DayKey): number {
  if (summaries.length === 0) return 0;

  const byWeek = new Map(summaries.map((summary) => [summary.weekKey, summary]));
  const oldest = summaries[summaries.length - 1].weekKey;

  let streak = 0;
  let cursor = currentWeekKey;

  while (cursor >= oldest) {
    const summary = byWeek.get(cursor);

    if (summary?.hasPlan) {
      if (summary.meetsThreshold) streak += 1;
      else if (cursor !== currentWeekKey) break;
    }

    cursor = toIsraeliDayKey(
      new Date(israeliWallTime(cursor, '12:00:00.000').getTime() - 7 * 24 * 60 * 60 * 1000),
    );
  }

  return streak;
}

/** פילוח לפי תרגיל על פני כל השבועות — "איפה אני חזק ואיפה נופל". */
export interface ExerciseTrend {
  exerciseId: string;
  exerciseName: string;
  unit: Unit;
  /** סך הכמות בכל השבועות שבהם התרגיל היה בתוכנית. */
  total: number;
  /** סך היעדים באותם שבועות. */
  target: number;
  /** ממוצע האחוזים השבועיים — לא נחסם. */
  pct: number;
  weeks: number;
}

/** פילוח לפי תרגיל, ממוין מהחלש לחזק — מה שדורש תשומת לב מופיע ראשון. */
export function exerciseTrends(summaries: readonly WeekSummary[]): ExerciseTrend[] {
  const byExercise = new Map<string, ExerciseTrend>();

  for (const summary of summaries) {
    if (!summary.hasPlan) continue;

    for (const item of summary.items) {
      const existing = byExercise.get(item.exerciseId);
      if (existing) {
        existing.total += item.total;
        existing.target += item.target;
        existing.pct += item.pct;
        existing.weeks += 1;
      } else {
        byExercise.set(item.exerciseId, {
          exerciseId: item.exerciseId,
          exerciseName: item.exerciseName,
          unit: item.unit,
          total: item.total,
          target: item.target,
          pct: item.pct,
          weeks: 1,
        });
      }
    }
  }

  return [...byExercise.values()]
    .map((trend) => ({ ...trend, pct: trend.weeks > 0 ? trend.pct / trend.weeks : 0 }))
    .sort((a, b) => a.pct - b.pct);
}

/* ------------------------------------------------------------------ */
/* בניית מסמך הדיווח                                                   */
/* ------------------------------------------------------------------ */

/**
 * הרגע-בזמן של מפתח-יום, לפני העיגון של `toEntryDate`.
 *
 * צהריים ולא חצות — לא כי `toEntryDate` צריך את זה (הוא מעגן בעצמו), אלא כי
 * חצות בשעון ישראל הוא בדיוק הערך שאסור שיטייל בקוד. מי שיעתיק את השורה הזו
 * למקום אחר יעתיק ערך בטוח.
 */
export function entryInstantForDay(dayKey: DayKey): Date {
  return israeliWallTime(dayKey, '12:00:00.000');
}

/** `entries.date` מתוך מפתח-יום. עובר דרך `toEntryDate` — אין כאן חשבון תאריכים משלנו. */
export function entryDateForDay(dayKey: DayKey) {
  return toEntryDate(entryInstantForDay(dayKey));
}

/**
 * המחזור שאליו שייך יום הביצוע, מתוך המחזורים שנטענו.
 *
 * `null` כשאין מחזור לאותו שבוע — דיווח על שבוע חופשה נשמר בלי שיוך.
 * הבחירה נעשית לפי **התאריך שהוזן** ולא לפי השבוע הנוכחי, אחרת דיווח
 * רטרואקטיבי היה נספר לשבוע הלא נכון.
 */
export function cycleIdForEntryDay(
  cycles: readonly PlanCycleDoc[],
  dayKey: DayKey,
  weekStartDay: WeekStartDay = 0,
): string | null {
  const key = getWeekKey(entryInstantForDay(dayKey), weekStartDay);
  const match = cycles.find(
    (cycle) => cycle.weekStart && getWeekKey(cycle.weekStart, weekStartDay) === key,
  );
  return match ? match.id : null;
}
