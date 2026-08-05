// Special-day (holiday) helpers. A holiday = { id, date: "YYYY-MM-DD", name }.
import { toISODate } from "./dates";

// Holiday name for a given Date (or null if none). `holidays` may be undefined.
// Matches on the local calendar date, aligning with getWeekDates() and the date input.
export function holidayNameOn(holidays, date) {
  if (!date) return null;
  const iso = toISODate(date);
  const hit = (holidays || []).find((h) => h.date === iso);
  return hit ? hit.name : null;
}

// "YYYY-MM-DD" → "DD/MM/YYYY" for display.
export function formatISODate(iso) {
  if (!iso) return "";
  const p = String(iso).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}
