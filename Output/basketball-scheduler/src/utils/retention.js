// Data that has outlived its purpose, and the one screen that removes it.
//
// Two records here are kept for nothing once their day has passed. An absence mark says a
// coach was unavailable on a date; after that date it is a line about a person, and nothing
// in the app reads it — the hours report counts sessions, not absences. A bus driver's name
// and phone are useful until the match they were entered for; after it they are a stranger's
// contact details sitting in a club's document.
//
// The service already sweeps the drivers, but only inside the federation-file import
// (`importGamesFile` calls `clearStaleDrivers`). A club that stopped importing — or never
// started — keeps them forever, and the privacy policy admits as much by telling that club
// to delete them by hand. "By hand" for a club with no Firebase console means opening every
// past away game one at a time. The absences had no sweep at all.
//
// So this is the deliberate shape: NOT an automatic background job, which would need a
// scheduled function (Blaze, still open) and would silently delete a manager's records with
// nobody watching; and NOT a console step in a runbook, because the CLUB is the controller
// and the club has no console. A pure calculation of what has expired, shown to a manager
// with counts, cleared when they press. What the documents may promise is exactly this.

import { clearStaleDrivers } from "./transport.js";

const arr = (v) => (Array.isArray(v) ? v : []);

// A past absence is kept for a month before it goes.
//
// Not zero: a manager reviewing last week's board would watch rows vanish under them, and
// a mark whose day has just passed is still part of the picture they are reading. Not a
// season either — "end of season" is a date nobody agrees on, and a club that plays through
// the summer would keep a year of marks about its employees while believing it kept none.
// A month is long enough to review and short enough to state.
export const ABSENCE_KEEP_DAYS = 30;

// The driver rule is NOT redefined here. It lives in `transport.js` at 14 days and runs on
// every import; a second copy would be a second answer to the same question.
export const DRIVER_KEEP_DAYS = 14;

// `todayIso` is passed in rather than read from the clock, so the result is deterministic.
export function expiredAbsences(absences, todayIso, days = ABSENCE_KEEP_DAYS) {
  const cutoff = new Date(`${String(todayIso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(cutoff.getTime())) return [];
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const limit = cutoff.toISOString().slice(0, 10);
  return arr(absences)
    // A mark with no readable date is not expired, it is unknown — and unknown is never a
    // reason to delete somebody's record.
    .filter((a) => a && typeof a.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.date) && a.date < limit)
    .map((a) => String(a.id));
}

// What a manager is shown before pressing, and what pressing produces. One function for
// both, so the number in the sentence and the number of records removed cannot disagree.
export function retentionReport(data, today = new Date()) {
  const d = data || {};
  const todayIso = (today instanceof Date ? today : new Date(today)).toISOString().slice(0, 10);
  const absenceIds = expiredAbsences(d.absences, todayIso);
  // `arr()` and not `d.games`: `clearStaleDrivers` guards against a missing list but not
  // against a malformed one, and a club document arriving with `games` as anything other
  // than an array would throw here — on the screen whose whole job is to be safe to press.
  const { games, cleared } = clearStaleDrivers(arr(d.games), today, DRIVER_KEEP_DAYS);
  const drop = new Set(absenceIds);
  return {
    absences: absenceIds.length,
    drivers: cleared,
    total: absenceIds.length + cleared,
    // The cleaned club document, ready to save. Built even when there is nothing to do —
    // the caller decides whether to write, and `total === 0` is the answer to that.
    next: { ...d, absences: arr(d.absences).filter((a) => !drop.has(String(a?.id))), games },
  };
}

export function retentionSummary(report) {
  const parts = [];
  if (report.absences) parts.push(report.absences === 1 ? "סימון היעדרות אחד" : `${report.absences} סימוני היעדרות`);
  if (report.drivers) parts.push(report.drivers === 1 ? "פרטי נהג אחד" : `פרטי נהג ב-${report.drivers} משחקים`);
  return parts.join(" · ");
}
