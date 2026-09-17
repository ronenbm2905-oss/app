import { DAYS } from "../constants.js";
import { overlaps, uid } from "./dates.js";
import { sessionKey } from "./rowCopy.js";

// Copying ONE training from one day of the week to another, inside the same week.
//
// The board already had two copy tools and this is the third, so the first question is why
// it is not one of them. "שכפל שבוע קודם" moves a whole week; `rowCopy` moves one team's row
// between weeks. Both answer "this repeats". This answers a different sentence entirely:
// *this same training also happens on Monday* — same team, same coach, same hall, same
// hours, a different day of the SAME week. Editing the day on the form moves the training;
// nothing in the app duplicated it.
//
// The rules are deliberately the ones the other two already follow, because a third
// definition of "the same training" is how the three of them start disagreeing:
//
// 1. `sessionKey` decides what a duplicate is — the same key `handleCopyPrevWeek` and
//    `rowCopy` compare on, scoped here to the same week.
// 2. An imported fixture is never copied. The federation owns those dates.
// 3. What comes out is an ordinary session: a fresh id, and none of the marks that belong
//    to the day it was set on (a time override, a cancellation) carried across.
//
// Clashes are REPORTED, not refused. The form already says "התנגשות — אפשר לשמור בכל זאת",
// and a copy that silently refuses would be the one place in the app that decides for the
// manager.

const arr = (list) => (Array.isArray(list) ? list : []);

// The same clash the form draws under the time fields: one week, one day, overlapping
// hours, and either the room or the person is taken. Written once here so the copy button
// cannot end up warning about something different from what the form warns about.
export function clashesOn(sessions, candidate) {
  if (!candidate) return [];
  return arr(sessions).filter(
    (s) =>
      s &&
      s.id !== candidate.id &&
      (s.weekOf || "") === (candidate.weekOf || "") &&
      s.day === candidate.day &&
      overlaps(s.start, s.end, candidate.start, candidate.end) &&
      (s.hallId === candidate.hallId || s.coachId === candidate.coachId)
  );
}

// `makeId` is injectable so the tests can assert on the result instead of on a random id.
export function copyToDay(sessions, session, targetDay, makeId = uid) {
  if (!session || !DAYS.includes(targetDay)) return { ok: false, reason: "invalid" };
  if (session.fromGame) return { ok: false, reason: "game" };
  if (session.day === targetDay) return { ok: false, reason: "same-day" };

  const { id, timeOverride, cancelled, cancelledAt, ...rest } = session;
  const copy = { ...rest, id: makeId(), day: targetDay };

  const already = arr(sessions).some(
    (s) => s && (s.weekOf || "") === (copy.weekOf || "") && sessionKey(s) === sessionKey(copy)
  );
  if (already) return { ok: false, reason: "duplicate" };

  return { ok: true, session: copy, clashes: clashesOn(sessions, copy) };
}

// Which days are worth offering. The training's own day is out because copying onto it is
// the duplicate case, and saying so after the click is worse than not offering it.
export function targetDays(day) {
  return DAYS.filter((d) => d !== day);
}
