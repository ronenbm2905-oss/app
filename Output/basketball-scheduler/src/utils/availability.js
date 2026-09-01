// Dated unavailability — "מאמן X לא זמין ב-9/9", "האולם תפוס ב-14/9".
//
// This is the one-off twin of `constraints`. A constraint is a standing fact about a
// week ("never on Tuesday afternoons"); an absence is a phone call ("can't make it next
// Wednesday", "the municipality took the hall on the 14th"). Storing the second as the
// first was the trap worth avoiding: a recurring rule entered for a single date silently
// blocks that weekday forever.
//
// Shape: { id, coachId? | hallId?, date: "YYYY-MM-DD", start?: "HH:MM", end?: "HH:MM", note?: string }
//
// **Exactly one of `coachId` / `hallId` is set** — that is what says whether the record is
// a coach out or a hall taken. It is deliberately not a `type` field like `constraints`
// has: records were already in production when halls were added, and a record with only
// `coachId` keeps meaning exactly what it meant before, with no migration to get wrong.
//
// No start/end = the whole day. That is the common case and the default, and it is the
// absence of the times rather than a separate flag — one fact, one place to be wrong.
//
// Lives on the club document beside `constraints` and `holidays`, so managers write it
// through the same `save()` and the Firestore rules need no change at all.

import { overlaps, toISODate } from "./dates.js";
import { DAYS } from "../constants.js";

const arr = (list) => (Array.isArray(list) ? list : []);

// What this record is about. A hall closure is recognised by carrying `hallId`; anything
// else is read as a coach absence, which is what every record written before halls existed
// actually is.
export function subjectOf(absence) {
  if (!absence) return { kind: "", id: "" };
  if (absence.hallId) return { kind: "hall", id: absence.hallId };
  return { kind: "coach", id: absence.coachId || "" };
}

export function isHallClosure(absence) {
  return subjectOf(absence).kind === "hall";
}

const isAbout = (absence, kind, refId) => {
  const s = subjectOf(absence);
  return s.kind === kind && !!s.id && s.id === refId;
};

// The session field a subject is matched against: a coach absence hits the sessions he
// runs, a hall closure hits everything standing in that hall — including the imported home
// games, which carry `hallId` too.
const sessionRefFor = (kind, session) =>
  kind === "hall" ? session.hallId : session.coachId;

export function isAllDay(absence) {
  return !absence || !absence.start || !absence.end;
}

// Every absence for one subject on one date. A day can hold more than one — a coach out
// 09:00–11:00 and again in the evening is two separate windows, not one long one.
export function absencesOn(absences, refId, iso, kind = "coach") {
  if (!refId || !iso) return [];
  return arr(absences)
    .filter((a) => a && a.date === iso && isAbout(a, kind, refId))
    .sort((a, b) => (a.start || "").localeCompare(b.start || ""));
}

export function absencesInMonth(absences, refId, ym, kind = "coach") {
  if (!refId || !ym) return [];
  return arr(absences)
    .filter((a) => a && String(a.date || "").startsWith(ym) && isAbout(a, kind, refId))
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.start || "").localeCompare(b.start || ""));
}

// Every hall closed on a date, whichever hall it is. The weekly board asks this question
// rather than "is hall X closed", because a closure concerns everyone standing in the
// building and the board does not know in advance which halls to ask about.
export function hallClosuresOn(absences, iso) {
  if (!iso) return [];
  return arr(absences)
    .filter((a) => a && a.date === iso && isHallClosure(a))
    .sort((a, b) => (a.start || "").localeCompare(b.start || ""));
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
//
// One session can be hit by both kinds at once — the coach is away AND the hall is taken.
// Both are returned, in that order, because they are two different problems and fixing one
// does not fix the other.
export function findAbsenceHits(sessions, dateOf, absences) {
  const hits = {};
  const list = arr(absences);
  if (!list.length) return hits;
  arr(sessions).forEach((s) => {
    if (!s) return;
    const iso = dateOf(s);
    if (!iso) return;
    const covering = list.filter((a) => {
      if (!a || a.date !== iso) return false;
      const { kind, id } = subjectOf(a);
      if (!id || id !== sessionRefFor(kind, s)) return false;
      return absenceCoversSession(a, s);
    });
    if (covering.length) {
      hits[s.id] = covering.sort((a, b) => Number(isHallClosure(a)) - Number(isHallClosure(b)));
    }
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

// One subject's sessions on one calendar date — a coach's trainings, or everything booked
// into a hall.
export function sessionsOnDate(sessions, refId, iso, kind = "coach") {
  if (!refId || !iso) return [];
  return arr(sessions)
    .filter((s) => s && sessionRefFor(kind, s) === refId && sessionDateIso(s) === iso)
    .sort((a, b) => (a.start || "").localeCompare(b.start || ""));
}

// `withNote` defaults to FALSE on purpose, and that default is the privacy control.
//
// The reason is written by a manager about an employee who did not write it and may not
// know it exists. Another coach needs to know a training has nobody to run it — they have
// no business knowing why. Making silence the default means a call site nobody thought
// about leaks nothing; the three places that legitimately show it (the manager's own
// screen, and a coach reading their own board) ask for it explicitly.
//
// A hall closure is the exception, and it is an exception about the data and not about
// convenience: "עירייה — אירוע התעמלות" is a fact about a building, not about a person, so
// there is nothing to protect and every coach standing outside a locked door benefits from
// reading it. The privacy default stays where the privacy question is.
// `withNote === true` and not merely truthy, which is not pedantry: `list.map(absenceLabel)`
// hands the array index in as the second argument, so every entry after the first would ask
// for the note. That leak has been written here once already. A strict comparison makes the
// mistake impossible to repeat rather than making it a thing to remember.
export function absenceLabel(absence, withNote = false) {
  if (!absence) return "";
  const hall = isHallClosure(absence);
  const note = withNote === true || hall ? String(absence.note || "").trim() : "";
  // No subject word in front of either: every call site that shows a closure has already
  // printed which hall it is, and "אולם הכפר — האולם תפוס" is one hall too many.
  const when = hall
    ? isAllDay(absence) ? "תפוס כל היום" : `תפוס ${absence.start}–${absence.end}`
    : isAllDay(absence) ? "לא זמין כל היום" : `לא זמין ${absence.start}–${absence.end}`;
  return note ? `${when} — ${note}` : when;
}

// Short form for a calendar cell, where there is room for about four words.
export function absenceChip(absence) {
  if (!absence) return "";
  if (!isAllDay(absence)) return `${absence.start}–${absence.end}`;
  return isHallClosure(absence) ? "תפוס" : "לא זמין";
}

// Reject what cannot be acted on: no subject, no date, or a window that ends before it
// starts. A half-filled window is refused rather than quietly treated as all-day —
// "unavailable from 16:00" saved as "unavailable all day" is a different sentence.
//
// A record carrying BOTH a coach and a hall is refused too. It would be ambiguous rather
// than generous: `subjectOf` would call it a hall closure and the coach half would sit in
// the document doing nothing, which is the kind of silence that gets found months later.
export function absenceValid(a) {
  if (!a || !a.date) return false;
  if (!!a.coachId === !!a.hallId) return false;
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
// from an earlier edit cannot outlive the checkbox that turned it off. Only the subject
// that was actually given is written — never both keys, see `absenceValid`.
export function upsertAbsence(absences, absence) {
  const clean = {
    id: absence.id,
    date: absence.date,
    start: absence.start || "",
    end: absence.end || "",
    note: String(absence.note || "").trim(),
  };
  if (absence.hallId) clean.hallId = absence.hallId;
  else clean.coachId = absence.coachId;
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
// what is coming. `kind` narrows it to one sort of subject; omitted, it returns both.
//
// Past ones stay in the data, and nothing in the app reads them: the hours report counts
// sessions, not absences. So a finished absence is a record about a person that is kept
// for no purpose — see the season-end step in docs/data-deletion-procedure.md, which is
// the only thing that removes them.
export function upcomingAbsences(absences, fromIso, limit = 0, kind = "") {
  const list = arr(absences)
    .filter((a) => a && a.date && a.date >= fromIso)
    .filter((a) => !kind || subjectOf(a).kind === kind)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start || "").localeCompare(b.start || ""));
  return limit > 0 ? list.slice(0, limit) : list;
}
