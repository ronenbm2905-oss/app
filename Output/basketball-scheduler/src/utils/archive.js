// Moving finished months out of the club document.
//
// Everything about this club lives in one Firestore document, and that document is capped
// at 1 MiB. Sessions are 72% of it — 182 bytes each, ~130 a week — so a fully scheduled
// season adds roughly 950 KB and the ceiling arrives mid-season rather than at the end of
// it. When it does, Firestore does not truncate or warn: it refuses the write, and because
// the whole club is one document EVERY save fails at once. The app goes read-only.
//
// So finished months move to `clubs/{id}/archive/{YYYY-MM}`, one document per month.
//
// **Per month, not per season, and that is the load-bearing choice.** A season's sessions
// are ~950 KB — an archive document that would itself sit at the ceiling, which is the bug
// this feature exists to avoid, moved one level down. A month is ~100 KB and can never get
// close. It is also the unit the hours report already works in, so restoring one for an old
// payroll question is a single document read.
//
// Two rules that are safety, not tidiness:
//
// 1. **A session whose month cannot be derived is never archived.** `monthOfSession`
//    returns "" for a session with no week or an unrecognised weekday. Archiving those by
//    guess would file them under a month nobody will look in — which is indistinguishable
//    from losing them. They stay live, visible, and fixable.
// 2. **The recent window is untouchable.** Only months strictly older than the keep window
//    are offered. The current month is still being scheduled and the one before it is still
//    being settled against; archiving either would move data out from under work in progress.

import { monthOfSession } from "./hoursReport.js";

// The current month and the one before it stay in the live document. Two, not one: the
// hours report for a month is usually settled during the following month, and a manager
// answering a question about it should not have to think about where the data is.
export const ARCHIVE_KEEP_MONTHS = 2;

const arr = (list) => (Array.isArray(list) ? list : []);
const str = (v) => String(v ?? "").trim();

// "YYYY-MM" for a Date, in local time — never toISOString(), which shifts a date near
// midnight into the previous month for anyone east of UTC.
export function monthKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// The newest month that may be archived — everything at or before it is fair game.
export function cutoffMonth(today = new Date(), keep = ARCHIVE_KEEP_MONTHS) {
  const d = today instanceof Date ? today : new Date(today);
  if (isNaN(d.getTime())) return "";
  return monthKey(new Date(d.getFullYear(), d.getMonth() - keep, 1));
}

// How many sessions sit in each month, oldest first. Sessions with no derivable month are
// grouped under "" so a caller can surface them rather than have them disappear.
export function sessionsByMonth(sessions) {
  const map = new Map();
  arr(sessions).forEach((s) => {
    const m = monthOfSession(s);
    if (!map.has(m)) map.set(m, []);
    map.get(m).push(s);
  });
  return map;
}

// What the button may offer: months no newer than the cutoff, that still hold sessions and
// have not been archived already. Oldest first — the order they should be moved in.
export function archivableMonths(data, today = new Date(), keep = ARCHIVE_KEEP_MONTHS) {
  const cutoff = cutoffMonth(today, keep);
  if (!cutoff) return [];
  const done = new Set(arr((data || {}).archivedMonths).map(str));
  const out = [];
  sessionsByMonth((data || {}).sessions).forEach((list, month) => {
    if (!month || month > cutoff || done.has(month)) return;
    out.push({ month, count: list.length, bytes: bytesOf(list) });
  });
  return out.sort((a, b) => a.month.localeCompare(b.month));
}

// Rough on-the-wire size. Used only to tell the manager what a month is worth before they
// move it, so an approximation is honest and a precise figure would be false precision.
export function bytesOf(list) {
  try {
    return new TextEncoder().encode(JSON.stringify(list ?? [])).length;
  } catch {
    return 0;
  }
}

// Split the live sessions into "these go to the archive" and "these stay".
//
// Returns the archived sessions grouped by month, so the caller writes one document per
// month, and the sessions that remain. A month not in `months` is untouched, and so is any
// session whose month could not be derived.
export function splitForArchive(sessions, months) {
  const wanted = new Set(arr(months).map(str).filter(Boolean));
  const byMonth = {};
  const kept = [];
  arr(sessions).forEach((s) => {
    const m = monthOfSession(s);
    if (m && wanted.has(m)) {
      (byMonth[m] = byMonth[m] || []).push(s);
    } else {
      kept.push(s);
    }
  });
  return { byMonth, kept };
}

// The document written to clubs/{id}/archive/{month}.
export function archiveDoc(month, sessions, now = new Date().toISOString()) {
  return { month: str(month), sessions: arr(sessions), count: arr(sessions).length, archivedAt: now };
}

// The club document after a successful archive: the sessions removed, and the month
// recorded so the UI knows an archive exists without reading it.
//
// The index is a plain list of month strings — a few dozen bytes — precisely so that
// "which months are archived" costs nothing to answer. Reading the archive documents
// themselves to find out would defeat the point of moving them out.
export function withArchived(data, months, kept) {
  const done = new Set(arr((data || {}).archivedMonths).map(str));
  arr(months).map(str).filter(Boolean).forEach((m) => done.add(m));
  return { ...data, sessions: kept, archivedMonths: [...done].sort() };
}

export function isArchivedMonth(data, month) {
  return arr((data || {}).archivedMonths).map(str).includes(str(month));
}
