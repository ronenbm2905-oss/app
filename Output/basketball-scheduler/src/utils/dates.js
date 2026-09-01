import { DAYS } from "../constants.js";

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  return (
    timeToMinutes(aStart) < timeToMinutes(bEnd) &&
    timeToMinutes(bStart) < timeToMinutes(aEnd)
  );
}

export const HEB_DAY_MAP = {
  "א": "ראשון", "ב": "שני", "ג": "שלישי", "ד": "רביעי",
  "ה": "חמישי", "ו": "שישי", "ש": "שבת", "שש": "שישי",
  "1": "ראשון", "2": "שני", "3": "שלישי", "4": "רביעי",
  "5": "חמישי", "6": "שישי", "7": "שבת",
};

export function formatDateFromExcel(val) {
  if (!val) return "";
  // If it's a Date object (from SheetJS with cellDates:true), extract UTC date directly
  // to avoid timezone shifting (Israel UTC+3 would shift 12/07 -> 11/07)
  if (val instanceof Date) {
    const d = val.getUTCDate(),
      m = val.getUTCMonth() + 1,
      y = val.getUTCFullYear();
    return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`;
  }
  const s = String(val).trim();
  // ISO format 2026-07-12...
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  return s;
}

export function parseDateDMY(str) {
  if (!str) return null;
  const s = String(str).trim();
  const m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1]);
}

export function formatDateHe(str) {
  const d = parseDateDMY(str);
  if (!d) return str;
  return d.toLocaleDateString("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });
}

export function getWeekDates(sundayDate) {
  // sundayDate: "YYYY-MM-DD" string
  if (!sundayDate) return {};
  const base = new Date(sundayDate + "T00:00:00");
  const result = {};
  DAYS.forEach((day, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    result[day] = d;
  });
  return result;
}

export function formatDate(d) {
  if (!d) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}/${d.getFullYear()}`;
}

// ---------- Week helpers (week = Sunday→Saturday, keyed by that Sunday's ISO date) ----------

// Date -> "YYYY-MM-DD" (local, no timezone shift)
export function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// Given a Date, return the ISO date of the Sunday that starts its week.
export function weekStartOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // getDay: 0=Sun -> back to Sunday
  return toISODate(d);
}

// ISO Sunday of the week containing today.
export function todayWeekStart() {
  return weekStartOf(new Date());
}

// Shift a Sunday-ISO string by whole weeks (delta can be negative).
export function shiftWeek(sundayIso, deltaWeeks) {
  const d = new Date(sundayIso + "T00:00:00");
  d.setDate(d.getDate() + deltaWeeks * 7);
  return toISODate(d);
}

// "DD-MM-YYYY" / "DD/MM/YYYY" / "DD.MM.YYYY" -> Sunday-ISO of that date's week (or "").
export function weekStartOfDMY(dmy) {
  const d = parseDateDMY(dmy);
  return d ? weekStartOf(d) : "";
}

// Human label for a week, e.g. "24/05–30/05/2026".
export function formatWeekRange(sundayIso) {
  if (!sundayIso) return "";
  const start = new Date(sundayIso + "T00:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const dm = (x) => `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}`;
  return `${dm(start)}–${dm(end)}/${end.getFullYear()}`;
}

// ---- Month helpers ----
// Ported with the availability screen: a dated absence is entered on a month grid, not
// on the Sunday-anchored week the rest of the app navigates by.
// Lived in ReportView until the availability screen needed the same four functions.
// Two copies of "which month is it" is how one screen ends up a month behind the other.

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Shift a "YYYY-MM" by whole months. Day 1 is used deliberately: rolling from the 31st
// would land on the wrong month whenever the next one is shorter.
export function shiftMonth(ym, delta) {
  const [y, m] = String(ym).split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(ym) {
  const [y, m] = String(ym).split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

// "YYYY-MM-DD" -> "YYYY-MM".
export function monthOf(iso) {
  return String(iso).slice(0, 7);
}

// The calendar grid for a month: whole Sunday→Saturday weeks covering it, so every row
// has seven cells and the columns line up with DAYS. Days spilling in from the
// neighbouring months are kept (marked `inMonth: false`) rather than blanked — a Tuesday
// that is the 1st still belongs in the Tuesday column, and an empty cell there reads as
// "nothing scheduled" instead of "not this month".
export function monthGrid(ym) {
  const [y, m] = String(ym).split("-").map(Number);
  if (!y || !m) return [];
  const first = new Date(y, m - 1, 1);
  const cursor = new Date(first);
  cursor.setDate(1 - first.getDay()); // back to that week's Sunday
  const last = new Date(y, m, 0); // day 0 of next month = last day of this one
  const weeks = [];
  // `cursor` starts on a Sunday and advances a whole week at a time, so the loop ends on
  // its own once the month is covered — between 4 and 6 rows, never a partial one.
  while (cursor <= last) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push({
        iso: toISODate(cursor),
        date: new Date(cursor),
        dayNum: cursor.getDate(),
        inMonth: cursor.getMonth() === m - 1 && cursor.getFullYear() === y,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}
