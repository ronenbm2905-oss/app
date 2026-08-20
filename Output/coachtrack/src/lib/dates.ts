/**
 * CoachTrack — כל פעולת תאריך במערכת
 *
 * כלל 6 ב-CLAUDE.md: **תאריכים בשעון ישראל.** גבולות שבוע מחושבים ב-`Asia/Jerusalem`,
 * לא ב-UTC ולא בשעון המכשיר. מלכודת #1 ב-TASKS.md: חישוב ב-UTC היה מזליג דיווח של
 * שבת בערב לשבוע הבא.
 *
 * אין `new Date()` מפוזר בקוד — הכל עובר דרך כאן.
 *
 * ## למה עובדים על מפתחות-יום (`yyyy-MM-dd`) ולא על אובייקטי Date
 *
 * חשבון קלנדרי על `Date` מתבצע תמיד באזור הזמן של המכשיר. אם המכשיר יושב באזור זמן
 * שבו יש מעבר שעון בחצות (יש כאלה), בניית "חצות" תיפול בחור ותסטה בשעה. לכן:
 * מוציאים מהתאריך את **יום הלוח בישראל** כמחרוזת, עושים את החשבון על המחרוזת
 * (חיבור וחיסור ימים ב-UTC — חשבון מדויק בהגדרה), וממירים חזרה לרגע בזמן דרך
 * `fromZonedTime`. כך התוצאה זהה בכל מכשיר בעולם.
 */

import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { Timestamp } from 'firebase/firestore';
import type { WeekStartDay } from '../types/types';

/** אזור הזמן היחיד של המערכת. */
export const TIME_ZONE = 'Asia/Jerusalem';

/**
 * השעה שאליה מקובע `entries.date` — 12:00 בשעון ישראל.
 * צהריים אף פעם לא קרוב לגבול שבוע בשום אזור זמן (CLAUDE.md → פורמט תאריכים).
 */
export const ENTRY_HOUR_ISRAEL = 12;

/** יום לוח בישראל בפורמט `yyyy-MM-dd`. טיפוס-כינוי, לקריאוּת בלבד. */
export type DayKey = string;

/** קלט תאריך מקובל בכל הפונקציות כאן: Date, Timestamp של Firestore, או מילישניות. */
export type DateInput = Date | Timestamp | number;

/** גבולות שבוע כרגעים בזמן (UTC instants), לא כמחרוזות. */
export interface WeekBounds {
  /** ראשון 00:00:00.000 בשעון ישראל. */
  weekStart: Date;
  /**
   * שבת 23:59:59.**999** בשעון ישראל.
   * האלפיות נכללות בכוונה: גבול על 23:59:59.000 היה מפיל דיווח שנרשם באלפית שאחריה.
   */
  weekEnd: Date;
}

/* ------------------------------------------------------------------ */
/* המרות בסיס                                                          */
/* ------------------------------------------------------------------ */

/** מנרמל כל קלט תאריך ל-`Date`. זורק על קלט לא חוקי — עדיף ליפול מאשר לכתוב זבל למסד. */
export function toDate(value: DateInput): Date {
  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : typeof value === 'number'
        ? new Date(value)
        : value.toDate();

  if (Number.isNaN(date.getTime())) {
    throw new RangeError('תאריך לא חוקי הועבר ל-lib/dates.ts');
  }
  return date;
}

/** יום הלוח **בישראל** של רגע נתון, כמחרוזת `yyyy-MM-dd`. */
export function toIsraeliDayKey(value: DateInput): DayKey {
  return formatInTimeZone(toDate(value), TIME_ZONE, 'yyyy-MM-dd');
}

/**
 * יום בשבוע **בישראל**: 0 = ראשון … 6 = שבת.
 * נגזר מ-`i` (ISO: 1=שני … 7=ראשון) ולא מ-`getDay()` של המכשיר.
 */
export function toIsraeliWeekday(value: DateInput): number {
  return Number(formatInTimeZone(toDate(value), TIME_ZONE, 'i')) % 7;
}

/** מחבר (או מחסיר) ימים למפתח-יום. החשבון נעשה ב-UTC ולכן מדויק תמיד. */
export function addDaysToDayKey(dayKey: DayKey, days: number): DayKey {
  const utc = new Date(`${dayKey}T00:00:00.000Z`);
  if (Number.isNaN(utc.getTime())) {
    throw new RangeError(`מפתח-יום לא חוקי: ${dayKey}`);
  }
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

/** הופך מפתח-יום + שעת-קיר בישראל לרגע בזמן. */
export function israeliWallTime(dayKey: DayKey, wallTime: string): Date {
  return fromZonedTime(`${dayKey}T${wallTime}`, TIME_ZONE);
}

/* ------------------------------------------------------------------ */
/* גבולות שבוע                                                         */
/* ------------------------------------------------------------------ */

/**
 * גבולות השבוע שאליו שייך התאריך, בשעון ישראל.
 *
 * `weekStartDay` קיים בחתימה כי `teams.settings.weekStartDay` קיים בסכמה,
 * אבל **ה-MVP מקבע ראשון (0)** — אין UI לשינוי (CLAUDE.md → גבולות שבוע).
 */
export function getWeekBounds(value: DateInput, weekStartDay: WeekStartDay = 0): WeekBounds {
  const dayKey = toIsraeliDayKey(value);
  const weekday = toIsraeliWeekday(value);

  const daysSinceStart = (weekday - weekStartDay + 7) % 7;
  const startKey = addDaysToDayKey(dayKey, -daysSinceStart);
  const endKey = addDaysToDayKey(startKey, 6);

  return {
    weekStart: israeliWallTime(startKey, '00:00:00.000'),
    weekEnd: israeliWallTime(endKey, '23:59:59.999'),
  };
}

/** מפתח-היום של תחילת השבוע — מזהה יציב לשבוע, נוח למיון ולהשוואה. */
export function getWeekKey(value: DateInput, weekStartDay: WeekStartDay = 0): DayKey {
  return toIsraeliDayKey(getWeekBounds(value, weekStartDay).weekStart);
}

/**
 * האם התאריך נופל בשבוע שמתחיל ב-`weekStart`.
 *
 * הגבולות נגזרים מחדש מ-`weekStart` ולא נלקחים כמו שהם, כדי ש-`weekStart` שהגיע
 * מהמסד עם סטייה קטנה עדיין ייתן את השבוע הנכון.
 */
export function isInWeek(
  value: DateInput,
  weekStart: DateInput,
  weekStartDay: WeekStartDay = 0,
): boolean {
  const { weekStart: start, weekEnd: end } = getWeekBounds(weekStart, weekStartDay);
  const time = toDate(value).getTime();
  return time >= start.getTime() && time <= end.getTime();
}

/* ------------------------------------------------------------------ */
/* תאריך דיווח                                                         */
/* ------------------------------------------------------------------ */

/**
 * הרגע-בזמן שמייצג את **תאריך הביצוע**: 12:00 בשעון ישראל של אותו יום לוח.
 * זהו הגרעין הטהור של `toEntryDate` — קיים בנפרד כדי שאפשר יהיה לבדוק אותו
 * בלי לערב את `Timestamp` של Firestore.
 */
export function toEntryInstant(value: DateInput): Date {
  const dayKey = toIsraeliDayKey(value);
  return israeliWallTime(dayKey, `${String(ENTRY_HOUR_ISRAEL).padStart(2, '0')}:00:00.000`);
}

/**
 * `entries.date` — Timestamp מקובע ל-12:00 בשעון ישראל.
 * לא חצות (היה נופל במלכודת #1) ולא מחרוזת (ה-rules לא היו יכולים לאכוף חלון של 7 ימים).
 */
export function toEntryDate(value: DateInput): Timestamp {
  return Timestamp.fromDate(toEntryInstant(value));
}

/** ההפך מ-`toEntryDate` — הרגע-בזמן ששמור במסד. */
export function fromEntryDate(value: DateInput): Date {
  return toDate(value);
}

/* ------------------------------------------------------------------ */
/* תצוגה                                                               */
/* ------------------------------------------------------------------ */

/** תאריך לתצוגה בעברית: `22.08.2026`. */
export function formatIsraeliDate(value: DateInput): string {
  return formatInTimeZone(toDate(value), TIME_ZONE, 'dd.MM.yyyy');
}

/** מספר הימים המלאים שנותרו עד סוף השבוע, כולל היום הנוכחי. */
export function daysLeftInWeek(value: DateInput, weekStartDay: WeekStartDay = 0): number {
  const weekday = toIsraeliWeekday(value);
  const daysSinceStart = (weekday - weekStartDay + 7) % 7;
  return 7 - daysSinceStart;
}
