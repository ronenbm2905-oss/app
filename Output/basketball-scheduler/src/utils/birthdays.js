import { DAYS } from "../constants";

// Coach birthdays, matched to the week being viewed rather than to a rolling window from
// today. The board, the notice and everything else in this app are organised by week, so
// "whose birthday is this week" is the question that actually gets asked — and it keeps
// working when the manager looks ahead at next week.
//
// Only month and day are used. The stored year is deliberately ignored and no age is
// derived: this is published to every coach in the club, and nobody asked for their age
// to be on the notice board.

const MS_PER_DAY = 86400000;

function parseIsoDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, mo - 1, d);
  // Rejects impossible dates that Date would roll over (31/02 → 03/03).
  if (date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return { y, mo, d, date };
}

const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

// Does a birthday of month/day fall on this calendar date?
// 29 February is observed on 28 February in a common year — otherwise a coach born on the
// 29th would silently never appear, which is worse than a day's approximation.
function fallsOn(bMonth, bDay, date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if (bMonth === m && bDay === d) return true;
  if (bMonth === 2 && bDay === 29 && m === 2 && d === 28 && !isLeapYear(date.getFullYear())) {
    return true;
  }
  return false;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// weekStartIso is the Sunday that keys the week, exactly as everywhere else in this app.
// Returns one entry per coach whose birthday falls inside that Sunday→Saturday window,
// ordered by the day it lands on.
export function birthdaysInWeek(coaches, weekStartIso) {
  const start = parseIsoDate(weekStartIso);
  if (!start) return [];
  const out = [];
  for (const coach of coaches || []) {
    const name = String(coach?.name || "").trim();
    if (!name) continue;
    const born = parseIsoDate(coach?.birthDate);
    if (!born) continue;
    for (let offset = 0; offset < 7; offset++) {
      const day = new Date(start.date.getTime() + offset * MS_PER_DAY);
      if (!fallsOn(born.mo, born.d, day)) continue;
      out.push({
        id: coach.id,
        name,
        offset,
        dayName: DAYS[day.getDay()],
        dateLabel: `${pad(day.getDate())}/${pad(day.getMonth() + 1)}`,
        observed: !(born.mo === day.getMonth() + 1 && born.d === day.getDate()), // 29/02 in a common year
      });
      break;
    }
  }
  return out.sort((a, b) => a.offset - b.offset || a.name.localeCompare(b.name, "he"));
}

// "יום שלישי, 12/08" — or "היום" / "מחר" when the week being viewed is the current one,
// which is the common case and reads far better on a notice.
export function birthdayWhen(entry, todayOffset) {
  if (!entry) return "";
  if (todayOffset === entry.offset) return "היום 🎉";
  if (todayOffset === entry.offset - 1) return "מחר";
  return `יום ${entry.dayName}, ${entry.dateLabel}`;
}

// Which slot of the displayed week today occupies, or -1 when the week shown is not the
// current one. Lets the caller say "today" only when it is genuinely today.
export function todayOffsetInWeek(weekStartIso, todayIso) {
  const start = parseIsoDate(weekStartIso);
  const today = parseIsoDate(todayIso);
  if (!start || !today) return -1;
  const diff = Math.round((today.date - start.date) / MS_PER_DAY);
  return diff >= 0 && diff < 7 ? diff : -1;
}
