// Special-day (holiday) helpers. A holiday = { id, date: "YYYY-MM-DD", endDate?: "YYYY-MM-DD", name }.
// endDate is optional — when set, the holiday spans date..endDate (inclusive).
import { toISODate } from "./dates";

// Holiday name for a given Date (or null if none). Matches on the local calendar date,
// aligning with getWeekDates() and the date input; covers multi-day ranges via endDate.
export function holidayNameOn(holidays, date) {
  if (!date) return null;
  const iso = toISODate(date);
  const hit = (holidays || []).find((h) => {
    const start = h.date;
    const end = h.endDate || h.date;
    return start && iso >= start && iso <= end;
  });
  return hit ? hit.name : null;
}

// "YYYY-MM-DD" → "DD/MM/YYYY" for display.
export function formatISODate(iso) {
  if (!iso) return "";
  const p = String(iso).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

// A holiday as "DD/MM/YYYY" (single day) or "DD/MM/YYYY – DD/MM/YYYY" (range).
export function formatHolidayRange(h) {
  const start = formatISODate(h.date);
  if (!h.endDate || h.endDate === h.date) return start;
  return `${start} – ${formatISODate(h.endDate)}`;
}

// Any supported date token → "YYYY-MM-DD" (or "" if invalid).
// Accepts DD/MM/YYYY, DD/MM/YY, DD.MM.YYYY, and YYYY-MM-DD.
function normDate(tok) {
  const t = String(tok).trim();
  let y, m, d;
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    y = +iso[1]; m = +iso[2]; d = +iso[3];
  } else {
    const dmy = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
    if (!dmy) return "";
    d = +dmy[1]; m = +dmy[2]; y = +dmy[3];
    if (y < 100) y += 2000;
  }
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return "";
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Parse a pasted list of holidays. Each non-empty line: one date (or a two-date range) then a name.
// Returns [{ date, endDate, name }]; lines without a valid date are skipped.
export function parseHolidaysText(text) {
  const out = [];
  const dateRe = /(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[./]\d{1,2}[./]\d{2,4})/g;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const dates = line.match(dateRe);
    if (!dates || dates.length === 0) continue;
    const start = normDate(dates[0]);
    if (!start) continue;
    const end2 = dates[1] ? normDate(dates[1]) : "";
    const endDate = end2 && end2 >= start ? end2 : start;
    // Name = the line minus the date tokens and any leading bullets/separators.
    let name = line;
    dates.forEach((dstr) => { name = name.replace(dstr, " "); });
    name = name.replace(/[•●*\-–,\t ]+/g, " ").trim();
    if (!name) continue;
    out.push({ date: start, endDate, name });
  }
  return out;
}
