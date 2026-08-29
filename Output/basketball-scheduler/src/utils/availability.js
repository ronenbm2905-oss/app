// Dated coach absences — "מאמן X לא זמין ב-9/9".
//
// This is the one-off twin of `constraints`. A constraint is a standing fact about a
// week ("never on Tuesday afternoons"); an absence is a phone call ("can't make it next
// Wednesday"). Storing the second as the first was the trap worth avoiding: a recurring
// rule entered for a single date silently blocks that weekday forever.
//
// Shape: { id, coachId, date: "YYYY-MM-DD", start?: "HH:MM", end?: "HH:MM", note?: string }
// No start/end = the whole day. That is the common case and the default, and it is the
// absence of the times rather than a separate flag — one fact, one place to be wrong.
//
// Lives on the club document beside `constraints` and `holidays`, so managers write it
// through the same `save()` and the Firestore rules need no change at all.

import { overlaps, toISODate } from "./dates.js";
import { DAYS } from "../constants.js";

const arr = (list) => (Array.isArray(list) ? list : []);

export function isAllDay(absence) {
  return !absence || !absence.start || !absence.end;
}

// Every absence for one coach on one date. A day can hold more than one — a coach out
// 09:00–11:00 and again in the evening is two separate windows, not one long one.
export function absencesOn(absences, coachId, iso) {
  if (!coachId || !iso) return [];
  return arr(absences)
    .filter((a) => a && a.coachId === coachId && a.date === iso)
    .sort((a, b) => (a.start || "").localeCompare(b.start || ""));
}

export function absencesInMonth(absences, coachId, ym) {
  if (!coachId || !ym) return [];
  return arr(absences)
    .filter((a) => a && a.coachId === coachId && String(a.date || "").startsWith(ym))
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.start || "").localeCompare(b.start || ""));
}

// Does this absence actually cover this session? An all-day absence covers everything on
// the date; a windowed one only what it overlaps. Getting this wrong in the permissive
// direction is the expensive mistake — a board that cries wolf gets ignored — so a
// session that merely touches the edge of the window (ends exactly when it starts) is
// left alone, which is what `overlaps` already does.
export function absenceCoversSession(absence, session) {
  if (!absence || !session) return false;
  if (isAllDay(absence)) return true;
  if (!session.start || !session.end) return true;
  return overlaps(absence.start, absence.end, session.start, session.end);
}

// { sessionId: [absence, ...] } for a set of sessions, given a way to date each one.
// The caller supplies `dateOf` because the board already knows each session's real date
// (weekOf + day) and this module should not have to rebuild it.
export function findAbsenceHits(sessions, dateOf, absences) {
  const hits = {};
  const list = arr(absences);
  if (!list.length) return hits;
  arr(sessions).forEach((s) => {
    if (!s || !s.coachId) return;
    const iso = dateOf(s);
    if (!iso) return;
    const covering = list.filter(
      (a) => a && a.coachId === s.coachId && a.date === iso && absenceCoversSession(a, s)
    );
    if (covering.length) hits[s.id] = covering;
  });
  return hits;
}

// The date a session actually falls on: the week's Sunday plus the weekday's offset.
// Same arithmetic the hours report does, kept here so both the board and the month grid
// agree on which day a session belongs to.
export function sessionDateIso(session) {
  if (!session || !session.weekOf) return "";
  const idx = DAYS.indexOf(session.day);
  if (idx < 0) return "";
  const d = new Date(session.weekOf + "T00:00:00");
  d.setDate(d.getDate() + idx);
  return toISODate(d);
}

// A coach's sessions on one calendar date.
export function sessionsOnDate(sessions, coachId, iso) {
  if (!coachId || !iso) return [];
  return arr(sessions)
    .filter((s) => s && s.coachId === coachId && sessionDateIso(s) === iso)
    .sort((a, b) => (a.start || "").localeCompare(b.start || ""));
}

// `withNote` defaults to FALSE on purpose, and that default is the privacy control.
//
// The reason is written by a manager about an employee who did not write it and may not
// know it exists. Another coach needs to know a training has nobody to run it — they have
// no business knowing why. Making silence the default means a call site nobody thought
// about leaks nothing; the three places that legitimately show it (the manager's own
// screen, and a coach reading their own board) ask for it explicitly.
export function absenceLabel(absence, withNote = false) {
  if (!absence) return "";
  const note = withNote ? String(absence.note || "").trim() : "";
  const when = isAllDay(absence) ? "לא זמין כל היום" : `לא זמין ${absence.start}–${absence.end}`;
  return note ? `${when} — ${note}` : when;
}

// Short form for a calendar cell, where there is room for about four words.
export function absenceChip(absence) {
  if (!absence) return "";
  return isAllDay(absence) ? "לא זמין" : `${absence.start}–${absence.end}`;
}

// Reject what cannot be acted on: no coach, no date, or a window that ends before it
// starts. A half-filled window is refused rather than quietly treated as all-day —
// "unavailable from 16:00" saved as "unavailable all day" is a different sentence.
export function absenceValid(a) {
  if (!a || !a.coachId || !a.date) return false;
  if (!a.start && !a.end) return true;
  if (!a.start || !a.end) return false;
  return timeLess(a.start, a.end);
}

function timeLess(a, b) {
  const [ah, am] = String(a).split(":").map(Number);
  const [bh, bm] = String(b).split(":").map(Number);
  return ah * 60 + am < bh * 60 + bm;
}

// Add or replace by id, and strip the times off an all-day entry so a window left over
// from an earlier edit cannot outlive the checkbox that turned it off.
export function upsertAbsence(absences, absence) {
  const clean = {
    id: absence.id,
    coachId: absence.coachId,
    date: absence.date,
    start: absence.start || "",
    end: absence.end || "",
    note: String(absence.note || "").trim(),
  };
  if (!clean.start || !clean.end) {
    clean.start = "";
    clean.end = "";
  }
  const list = arr(absences);
  return list.some((a) => a.id === clean.id)
    ? list.map((a) => (a.id === clean.id ? clean : a))
    : [...list, clean];
}

export function removeAbsence(absences, id) {
  return arr(absences).filter((a) => a && a.id !== id);
}

// Absences from `fromIso` onward, soonest first — the list a manager scans to remember
// what is coming.
//
// Past ones stay in the data, and nothing in the app reads them: the hours report counts
// sessions, not absences. So a finished absence is a record about a person that is kept
// for no purpose — see the season-end step in docs/data-deletion-procedure.md, which is
// the only thing that removes them.
export function upcomingAbsences(absences, fromIso, limit = 0) {
  const list = arr(absences)
    .filter((a) => a && a.date && a.date >= fromIso)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start || "").localeCompare(b.start || ""));
  return limit > 0 ? list.slice(0, limit) : list;
}
