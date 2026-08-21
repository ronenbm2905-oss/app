/**
 * טסטים ל-lib/dates.ts
 *
 * זה אחד משני המקומות שבהם באג לא ייראה על המסך אבל יהרוס את הנתונים
 * (CLAUDE.md → בדיקות). הבדיקות הקריטיות לפי TASKS.md שלב 1:
 *   1. שבת 23:30 מול ראשון 00:30 — שבועות שונים
 *   2. toEntryDate נשאר על אותו יום לוח גם כשקוראים אותו ב-UTC
 *   3. שני צידי מעבר שעון קיץ בישראל
 *
 * עובדות שאומתו מול ה-ICU של Node לפני כתיבת הטסטים (שעון ישראל 2026):
 *   שעון קיץ מתחיל  — שישי 27.3.2026 ב-02:00 (UTC+2 ← UTC+3)
 *   שעון קיץ מסתיים — ראשון 25.10.2026 ב-02:00 (UTC+3 ← UTC+2)
 */

import { describe, it, expect } from 'vitest';
import { formatInTimeZone } from 'date-fns-tz';
import {
  TIME_ZONE,
  addDaysToDayKey,
  daysLeftInWeek,
  formatIsraeliDate,
  getNextWeekBounds,
  getWeekBounds,
  getWeekKey,
  isInWeek,
  toDate,
  toEntryDate,
  toEntryInstant,
  toIsraeliDayKey,
  toIsraeliWeekday,
} from './dates';

/** קיצור קריאוּת: רגע בזמן מתוך ISO ב-UTC. */
const utc = (iso: string) => new Date(iso);

/** איך הרגע הזה נראה על שעון קיר בישראל. */
const israeliWall = (date: Date) => formatInTimeZone(date, TIME_ZONE, 'yyyy-MM-dd HH:mm:ss.SSS');

describe('toDate', () => {
  it('מקבל Date, מספר ואובייקט עם toDate', () => {
    const ms = Date.UTC(2026, 7, 20, 9, 0, 0);
    expect(toDate(new Date(ms)).getTime()).toBe(ms);
    expect(toDate(ms).getTime()).toBe(ms);
    const tsLike = { toDate: () => new Date(ms) } as unknown as Parameters<typeof toDate>[0];
    expect(toDate(tsLike).getTime()).toBe(ms);
  });

  it('מחזיר עותק ולא את אותו אובייקט — אין תופעות לוואי על הקלט', () => {
    const original = new Date(Date.UTC(2026, 7, 20));
    const copy = toDate(original);
    copy.setUTCFullYear(2000);
    expect(original.getUTCFullYear()).toBe(2026);
  });

  it('זורק על תאריך לא חוקי', () => {
    expect(() => toDate(new Date(Number.NaN))).toThrow(RangeError);
    expect(() => toDate(Number.NaN)).toThrow(RangeError);
  });
});

describe('toIsraeliDayKey / toIsraeliWeekday', () => {
  it('מחשב את יום הלוח לפי שעון ישראל ולא לפי UTC', () => {
    // 22:30 UTC ב-20.8 הוא כבר 01:30 של ה-21.8 בישראל
    const late = utc('2026-08-20T22:30:00Z');
    expect(late.toISOString().slice(0, 10)).toBe('2026-08-20');
    expect(toIsraeliDayKey(late)).toBe('2026-08-21');
  });

  it('ראשון הוא 0 ושבת היא 6', () => {
    expect(toIsraeliWeekday(utc('2026-08-23T09:00:00Z'))).toBe(0);
    expect(toIsraeliWeekday(utc('2026-08-24T09:00:00Z'))).toBe(1);
    expect(toIsraeliWeekday(utc('2026-08-22T09:00:00Z'))).toBe(6);
  });
});

describe('addDaysToDayKey', () => {
  it('חוצה גבול חודש ושנה', () => {
    expect(addDaysToDayKey('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDaysToDayKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDaysToDayKey('2026-03-22', 6)).toBe('2026-03-28');
  });

  it('חוצה 29 בפברואר בשנה מעוברת', () => {
    expect(addDaysToDayKey('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysToDayKey('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('זורק על מפתח לא חוקי', () => {
    expect(() => addDaysToDayKey('not-a-day', 1)).toThrow(RangeError);
  });
});

describe('getWeekBounds — שבוע רגיל', () => {
  it('מחזיר ראשון בחצות ושבת בסוף היום, בשעון ישראל', () => {
    const { weekStart, weekEnd } = getWeekBounds(utc('2026-08-19T12:00:00Z')); // רביעי
    expect(israeliWall(weekStart)).toBe('2026-08-16 00:00:00.000');
    expect(israeliWall(weekEnd)).toBe('2026-08-22 23:59:59.999');
  });

  it('יום ראשון עצמו הוא תחילת השבוע, לא סופו', () => {
    const sunday = utc('2026-08-16T05:00:00Z');
    expect(israeliWall(getWeekBounds(sunday).weekStart)).toBe('2026-08-16 00:00:00.000');
  });

  it('שבת עצמה נופלת בסוף אותו שבוע', () => {
    const saturday = utc('2026-08-22T05:00:00Z');
    expect(getWeekKey(saturday)).toBe('2026-08-16');
  });

  it('מכבד weekStartDay אחר — הפרמטר קיים בסכמה גם אם ה-MVP לא משתמש בו', () => {
    const sunday = utc('2026-08-16T09:00:00Z');
    expect(getWeekKey(sunday, 0)).toBe('2026-08-16');
    expect(getWeekKey(sunday, 1)).toBe('2026-08-10');
  });
});

describe('הבדיקה הקריטית: שבת 23:30 מול ראשון 00:30', () => {
  // שני הרגעים האלה מרוחקים שעה אחת בלבד, ובכל זאת חייבים ליפול בשבועות שונים.
  const saturdayNight = utc('2026-08-22T20:30:00Z');
  const sundayNight = utc('2026-08-22T21:30:00Z');

  it('אימות מקדים: אלה באמת שבת 23:30 וראשון 00:30 בשעון ישראל', () => {
    expect(israeliWall(saturdayNight)).toBe('2026-08-22 23:30:00.000');
    expect(israeliWall(sundayNight)).toBe('2026-08-23 00:30:00.000');
  });

  it('נופלים בשבועות שונים', () => {
    expect(getWeekKey(saturdayNight)).toBe('2026-08-16');
    expect(getWeekKey(sundayNight)).toBe('2026-08-23');
    expect(getWeekKey(saturdayNight)).not.toBe(getWeekKey(sundayNight));
  });

  it('isInWeek מפריד ביניהם', () => {
    const week = getWeekBounds(saturdayNight);
    expect(isInWeek(saturdayNight, week.weekStart)).toBe(true);
    expect(isInWeek(sundayNight, week.weekStart)).toBe(false);
  });

  it('הגבול עצמו כלול משני הצדדים, ואלפית מחוצה לו כבר לא', () => {
    const { weekStart, weekEnd } = getWeekBounds(saturdayNight);
    expect(isInWeek(weekStart, weekStart)).toBe(true);
    expect(isInWeek(weekEnd, weekStart)).toBe(true);
    expect(isInWeek(new Date(weekStart.getTime() - 1), weekStart)).toBe(false);
    expect(isInWeek(new Date(weekEnd.getTime() + 1), weekStart)).toBe(false);
  });

  it('השבועות רצופים — אין חור של אלפית בין שבוע לשבוע', () => {
    const first = getWeekBounds(saturdayNight);
    const second = getWeekBounds(sundayNight);
    expect(second.weekStart.getTime() - first.weekEnd.getTime()).toBe(1);
  });
});

describe('הבדיקה הקריטית: מעבר שעון קיץ בישראל', () => {
  it('שבוע שמכיל מעבר לשעון קיץ — הגבולות נשארים על שעון הקיר הנכון', () => {
    const { weekStart, weekEnd } = getWeekBounds(utc('2026-03-27T00:30:00Z')); // שישי 03:30 בישראל
    expect(israeliWall(weekStart)).toBe('2026-03-22 00:00:00.000');
    expect(israeliWall(weekEnd)).toBe('2026-03-28 23:59:59.999');
    // ההוכחה שהמעבר באמת קרה בתוך השבוע: ההיסט מ-UTC שונה בין הקצוות
    expect(formatInTimeZone(weekStart, TIME_ZONE, 'xxx')).toBe('+02:00');
    expect(formatInTimeZone(weekEnd, TIME_ZONE, 'xxx')).toBe('+03:00');
    // ולכן השבוע קצר בשעה מ-7 יממות מלאות
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(weekEnd.getTime() - weekStart.getTime()).toBe(sevenDaysMs - 60 * 60 * 1000 - 1);
  });

  it('רגע לפני ורגע אחרי הקפיצה — אותו שבוע', () => {
    const before = utc('2026-03-26T23:59:00Z'); // שישי 01:59 בישראל
    const after = utc('2026-03-27T00:01:00Z'); // שישי 03:01 בישראל
    expect(getWeekKey(before)).toBe('2026-03-22');
    expect(getWeekKey(after)).toBe('2026-03-22');
  });

  // החזרה משעון קיץ נופלת בדיוק ביום ראשון — כלומר ביום שהוא תחילת שבוע.
  // זה הצד המסוכן יותר של המעבר.
  it('שבוע שמתחיל ביום שבו מסתיים שעון הקיץ', () => {
    const { weekStart, weekEnd } = getWeekBounds(utc('2026-10-25T23:00:00Z')); // שני 01:00 בישראל
    expect(israeliWall(weekStart)).toBe('2026-10-25 00:00:00.000');
    expect(israeliWall(weekEnd)).toBe('2026-10-31 23:59:59.999');
    expect(formatInTimeZone(weekStart, TIME_ZONE, 'xxx')).toBe('+03:00');
    expect(formatInTimeZone(weekEnd, TIME_ZONE, 'xxx')).toBe('+02:00');
  });

  it('שעת קיר שקיימת פעמיים ביום החזרה משעון קיץ — שתי הפעמים באותו שבוע ובאותו יום', () => {
    const firstPass = utc('2026-10-24T22:30:00Z');
    const secondPass = utc('2026-10-24T23:30:00Z');
    expect(israeliWall(firstPass)).toBe('2026-10-25 01:30:00.000');
    expect(israeliWall(secondPass)).toBe('2026-10-25 01:30:00.000');
    expect(getWeekKey(firstPass)).toBe('2026-10-25');
    expect(getWeekKey(secondPass)).toBe('2026-10-25');
  });

  it('השבוע שלפני החזרה משעון קיץ מסתיים אלפית לפני שהבא מתחיל', () => {
    const previous = getWeekBounds(utc('2026-10-20T09:00:00Z'));
    const current = getWeekBounds(utc('2026-10-25T23:00:00Z'));
    expect(current.weekStart.getTime() - previous.weekEnd.getTime()).toBe(1);
  });
});

describe('toEntryInstant / toEntryDate', () => {
  it('מקבע ל-12:00 בשעון ישראל', () => {
    expect(israeliWall(toEntryInstant(utc('2026-08-20T05:13:00Z')))).toBe('2026-08-20 12:00:00.000');
    expect(israeliWall(toEntryInstant(utc('2026-08-20T20:45:00Z')))).toBe('2026-08-20 12:00:00.000');
  });

  it('הבדיקה הקריטית: נשאר על אותו יום לוח גם כשקוראים אותו ב-UTC', () => {
    const days = [
      '2026-01-15',
      '2026-03-22',
      '2026-03-28',
      '2026-06-30',
      '2026-10-25',
      '2026-12-31',
    ];
    for (const day of days) {
      const instant = toEntryInstant(new Date(`${day}T00:00:00Z`));
      expect(toIsraeliDayKey(instant)).toBe(day);
      // אותו יום גם ב-UTC — זו כל הסיבה שנבחרו צהריים ולא חצות
      expect(instant.toISOString().slice(0, 10)).toBe(day);
    }
  });

  it('חצות בישראל היה נופל ליום הקודם ב-UTC — הנימוק לקיבוע בצהריים', () => {
    const midnightIsrael = utc('2026-08-19T21:00:00Z'); // 20.8 בחצות בישראל
    expect(toIsraeliDayKey(midnightIsrael)).toBe('2026-08-20');
    expect(midnightIsrael.toISOString().slice(0, 10)).toBe('2026-08-19');

    const entry = toEntryInstant(midnightIsrael);
    expect(toIsraeliDayKey(entry)).toBe('2026-08-20');
    expect(entry.toISOString().slice(0, 10)).toBe('2026-08-20');
  });

  it('שומר על היום גם בשני צידי מעבר שעון הקיץ', () => {
    for (const day of ['2026-03-26', '2026-03-27', '2026-03-28', '2026-10-24', '2026-10-25']) {
      const instant = toEntryInstant(new Date(`${day}T10:00:00Z`));
      expect(toIsraeliDayKey(instant)).toBe(day);
      expect(instant.toISOString().slice(0, 10)).toBe(day);
    }
  });

  it('דיווח של שבת בערב נשאר בשבוע של שבת', () => {
    const saturdayNight = utc('2026-08-22T20:30:00Z');
    const entryDate = toEntryDate(saturdayNight);
    expect(getWeekKey(entryDate.toDate())).toBe('2026-08-16');
  });

  it('מחזיר Timestamp של Firestore עם אותו רגע כמו toEntryInstant', () => {
    const source = utc('2026-08-20T05:13:00Z');
    const ts = toEntryDate(source);
    expect(typeof ts.seconds).toBe('number');
    expect(ts.toDate().getTime()).toBe(toEntryInstant(source).getTime());
    // ואפשר להזין אותו בחזרה לפונקציות התאריך
    expect(toIsraeliDayKey(ts)).toBe('2026-08-20');
  });

  it('אידמפוטנטי — הרצה חוזרת לא מזיזה את התאריך', () => {
    const once = toEntryInstant(utc('2026-08-22T20:30:00Z'));
    const twice = toEntryInstant(once);
    expect(twice.getTime()).toBe(once.getTime());
  });
});

describe('formatIsraeliDate / daysLeftInWeek', () => {
  it('מציג תאריך לפי שעון ישראל', () => {
    expect(formatIsraeliDate(utc('2026-08-20T22:30:00Z'))).toBe('21.08.2026');
  });

  it('סופר את היום הנוכחי בכלל הימים שנותרו', () => {
    expect(daysLeftInWeek(utc('2026-08-16T09:00:00Z'))).toBe(7); // ראשון
    expect(daysLeftInWeek(utc('2026-08-19T09:00:00Z'))).toBe(4); // רביעי
    expect(daysLeftInWeek(utc('2026-08-22T09:00:00Z'))).toBe(1); // שבת
  });
});

describe('getNextWeekBounds — הבסיס של "מהשבוע הבא"', () => {
  it('מהשבוע של רביעי 19.8.2026 עוברים לראשון 23.8 עד שבת 29.8', () => {
    // 19.8.2026 הוא רביעי. השבוע שלו: 16.8–22.8. הבא: 23.8–29.8.
    const { weekStart, weekEnd } = getNextWeekBounds(utc('2026-08-19T09:00:00Z'));

    expect(israeliWall(weekStart)).toBe('2026-08-23 00:00:00.000');
    expect(israeliWall(weekEnd)).toBe('2026-08-29 23:59:59.999');
  });

  it('סוף השבוע הנוכחי ותחילת הבא צמודים באלפית — בלי חור ובלי חפיפה', () => {
    const at = utc('2026-08-19T09:00:00Z');
    const current = getWeekBounds(at);
    const next = getNextWeekBounds(at);

    expect(next.weekStart.getTime() - current.weekEnd.getTime()).toBe(1);
  });

  it('שבת 23:30 קופצת לשבוע שאחרי זה שראשון 00:30 כבר נמצא בו', () => {
    // שבת 22.8.2026 23:30 בישראל (UTC+3) = 20:30Z.
    const saturday = utc('2026-08-22T20:30:00Z');
    // ראשון 23.8.2026 00:30 בישראל = 21:30Z של שבת.
    const sunday = utc('2026-08-22T21:30:00Z');

    expect(getWeekKey(getNextWeekBounds(saturday).weekStart)).toBe(getWeekKey(sunday));
    expect(getWeekKey(getNextWeekBounds(sunday).weekStart)).toBe('2026-08-30');
  });

  it('קפיצה מעל תחילת שעון קיץ נשארת על ראשון בחצות בשעון ישראל', () => {
    // שעון קיץ מתחיל בשישי 27.3.2026. השבוע 22.3–28.3 חוצה אותו.
    const { weekStart, weekEnd } = getNextWeekBounds(utc('2026-03-24T10:00:00Z'));

    expect(israeliWall(weekStart)).toBe('2026-03-29 00:00:00.000');
    expect(israeliWall(weekEnd)).toBe('2026-04-04 23:59:59.999');
  });

  it('קפיצה מעל סוף שעון קיץ — אותו דבר לכיוון השני', () => {
    // שעון קיץ מסתיים בראשון 25.10.2026 ב-02:00.
    const { weekStart, weekEnd } = getNextWeekBounds(utc('2026-10-21T10:00:00Z'));

    expect(israeliWall(weekStart)).toBe('2026-10-25 00:00:00.000');
    expect(israeliWall(weekEnd)).toBe('2026-10-31 23:59:59.999');
  });
});
