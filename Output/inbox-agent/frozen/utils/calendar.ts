// ============================================================================
// calendar.ts — ייצוא משימות כקובץ יומן (RFC 5545).
//
// ---------------------------------------------------------------------------
// מקור: `Output/basketball-scheduler/src/utils/calendar.js` — **הועתק כמעט
// כמות שהוא**, בכוונה.
// ---------------------------------------------------------------------------
// `escapeText` ו-`foldLine` מועברים מילה במילה. קיפול השורות ב-75 **אוקטטות**
// ולא בתווים כבר פתור שם לעברית, וכתיבה מחדש שלו היא בדיוק סוג השיפור שמחזיר
// באג שכבר שילמנו עליו. מה שהשתנה: מקור האירוע הוא משימה עם `scheduledAt`
// במקום אימון בשבוע, ולכן `icsDateTime` נכתב מחדש — הוא היחיד.
//
// למה קובץ ולא שליחה ליומן: פרוסה 0 היא בלי Google בכלל. פתיחת הקובץ בטלפון
// מוסרת אותו ישירות לאפליקציית היומן, וזה כל מה שנדרש כדי להוכיח את הזרימה.
// הסנכרון הדו-כיווני האמיתי מגיע בפרוסה 3.
// ============================================================================

import type { Task } from '../types';

// הזמנים נכתבים כזמן מקומי בלי אזור ובלי בלוק VTIMEZONE — "floating time"
// במפרט. כל מי שקורא את היומן הזה נמצא באותו מקום, ולכן 16:00 הוא 16:00 עבור
// כולם. החלופה, חותמות UTC, הייתה דורשת הגדרת אזור זמן מלאה ומזיזה שעה בצד
// הלא נכון של מעבר שעון קיץ.
const PRODID = '-//Inbox Agent//Tasks//HE';

// ערכי TEXT מחייבים escape ל-backslash, נקודה-פסיק, פסיק ושורה חדשה. פספוס של
// אחד מהם קוטע את האירוע בשקט באותו תו, בחלק מהיומנים.
export function escapeText(value: unknown): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// שורות מתקפלות ב-75 **אוקטטות**, לא תווים. אות עברית היא שני בתים ב-UTF-8,
// ולכן ספירת תווים הייתה מייצרת שורות שנראות חוקיות ולמעשה ארוכות מדי — ופיצול
// באמצע תו היה משבש את הטקסט לגמרי. כאן נספרים בתים, ולעולם אין פיצול בתוך תו.
export function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // נסיגה עד ש-`end` יושב על גבול תו (לעולם לא בתוך רצף UTF-8).
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    out.push(new TextDecoder().decode(bytes.slice(start, end)));
    start = end;
    limit = 74; // שורות המשך נושאות רווח מוביל
  }
  return out.join('\r\n ');
}

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * `"2026-08-25T09:30"` → `"20260825T093000"`, ועם `plusMinutes` לחישוב DTEND.
 * מחזיר `null` על קלט שאינו תואם — משימה בלי זמן פשוט לא תיוצא.
 *
 * הניתוח הוא regex ולא `new Date(...)`: מחרוזת ISO בלי אזור זמן מתפרשת
 * בדפדפנים שונים אחרת (מקומי מול UTC), וזה בדיוק הבאג של "האירוע נחת שלוש
 * שעות מוקדם מדי".
 */
export function icsDateTime(scheduledAt: string | null, plusMinutes = 0): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/.exec(String(scheduledAt ?? ''));
  if (!m) return null;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    0,
    0,
  );
  if (isNaN(d.getTime())) return null;
  if (plusMinutes) d.setMinutes(d.getMinutes() + plusMinutes);
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}00`
  );
}

export function taskEvent(task: Task, { dtstamp }: { dtstamp: string }): string[] | null {
  const start = icsDateTime(task.scheduledAt);
  const end = icsDateTime(task.scheduledAt, task.durationMinutes || 30);
  if (!start || !end) return null;

  return [
    'BEGIN:VEVENT',
    // יציב לכל משימה, כך שייבוא חוזר של אותו קובץ **מעדכן** את האירוע במקום
    // ליצור עותק שני של כל משימה.
    `UID:${task.id}@inbox-agent`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeText(task.title)}`,
    task.notes ? `DESCRIPTION:${escapeText(task.notes)}` : null,
    task.status === 'done' ? 'STATUS:CONFIRMED' : null,
    'END:VEVENT',
  ].filter(Boolean) as string[];
}

/** `now` מוזרק כדי שהפלט יהיה משוחזר במבחן. */
export function buildIcs(
  tasks: readonly Task[],
  { now = new Date(), calendarName = 'משימות' }: { now?: Date; calendarName?: string } = {},
): string {
  const dtstamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const events = (Array.isArray(tasks) ? tasks : [])
    .filter(Boolean)
    // משימה בלי זמן לא נכנסת ליומן — היקף שנקבע בתוכנית, ו-`taskEvent` ממילא
    // מחזיר null עליה.
    .map((t) => taskEvent(t, { dtstamp }))
    .filter(Boolean)
    .flat() as string[];

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    ...events,
    'END:VCALENDAR',
  ];

  // CRLF בין שורות נדרש במפרט, וחלק מהיומנים דוחים את הקובץ בלעדיו.
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export function icsFileName(label = 'משימות'): string {
  const safe = String(label).replace(/[/:*?"<>|]/g, '').trim() || 'משימות';
  const d = new Date();
  return `${safe}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.ics`;
}

/** הורדה בדפדפן. מופרד מ-`buildIcs` כדי שהבנייה תישאר טהורה וניתנת לבדיקה. */
export function downloadIcs(tasks: readonly Task[], label = 'משימות'): void {
  const blob = new Blob([buildIcs(tasks, { calendarName: label })], {
    type: 'text/calendar;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = icsFileName(label);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
