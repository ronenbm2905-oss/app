import { timeToMinutes } from "./dates.js";
import { hallClosuresOn, isAllDay, sessionDateIso } from "./availability.js";

// What a hall still has free on one day — asked BEFORE a time is chosen, not after.
//
// The board already tells a manager that 17:00 clashes, but only once 17:00 has been typed.
// That is the wrong order: choosing a slot is a search, and the app was making the manager
// guess and then scoring the guess. This module answers the question they actually have —
// "what is open in this hall on Tuesday?" — so the free slot is picked, not found by
// trial and error.
//
// Three sources make a hall busy, and all three count:
//   1. trainings booked into it
//   2. games, which occupy the hall exactly like a training (`fromGame` is not special here)
//   3. a hall CLOSURE for that date — the municipality took the gym. A closure that
//      reports no hours is an all-day one and swallows the whole day.
//
// Deliberately NOT included: a coach being unavailable. That is a different question with a
// different answer — the hall is free, the person is not — and folding the two together
// would tell the manager an hour is unavailable when a substitute would solve it.

const arr = (list) => (Array.isArray(list) ? list : []);

// The club's day. Wide enough for a 08:00 Friday morning and a 22:30 senior session, and
// bounded so the free list does not open with "פנוי 00:00–15:00", which is true and useless.
export const DAY_START = "08:00";
export const DAY_END = "23:00";

export function minutesToTime(min) {
  const m = Math.max(0, Math.min(24 * 60, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// Everything occupying one hall on one day of one week, sorted, each with a label saying
// WHO — because "16:00–17:30 תפוס" invites a phone call and "16:00–17:30 נערים א" answers it.
//
// `excludeId` drops the session being edited: a session must not be reported as clashing
// with itself, which is what makes the strip usable while changing an existing row.
export function hallBusyBlocks(data, { hallId, day, weekOf, excludeId } = {}) {
  if (!hallId || !day || !weekOf) return [];
  const d = data || {};
  const teamName = (id) => arr(d.teams).find((t) => t && t.id === id)?.name || "";

  const booked = arr(d.sessions)
    .filter(
      (s) =>
        s &&
        s.id !== excludeId &&
        s.hallId === hallId &&
        s.day === day &&
        (s.weekOf || "") === weekOf &&
        s.start &&
        s.end
    )
    .map((s) => ({
      start: s.start,
      end: s.end,
      label: teamName(s.teamId) || s.type || "משובץ",
      kind: "session",
    }));

  // The closure is looked up by the real calendar date, not by weekday — it is a one-off
  // fact about the 17th, not about every Tuesday.
  const iso = sessionDateIso({ weekOf, day });
  const closures = hallClosuresOn(d.absences, iso)
    .filter((a) => a.hallId === hallId)
    .map((a) => ({
      start: isAllDay(a) ? DAY_START : a.start,
      end: isAllDay(a) ? DAY_END : a.end,
      label: String(a.note || "").trim() || "האולם תפוס",
      kind: "closure",
    }));

  return [...booked, ...closures].sort(
    (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start) || timeToMinutes(a.end) - timeToMinutes(b.end)
  );
}

// The gaps left over. Blocks are merged first, so two back-to-back trainings do not
// manufacture a zero-length "free" slot between them.
//
// `minMinutes` drops slivers: a free eleven minutes is not something anyone can book, and
// listing it pushes the real openings off the line.
export function freeGaps(blocks, { dayStart = DAY_START, dayEnd = DAY_END, minMinutes = 30 } = {}) {
  const open = timeToMinutes(dayStart);
  const close = timeToMinutes(dayEnd);
  const merged = [];
  arr(blocks)
    .map((b) => ({ s: timeToMinutes(b.start), e: timeToMinutes(b.end) }))
    .filter((b) => Number.isFinite(b.s) && Number.isFinite(b.e) && b.e > b.s)
    .sort((a, b) => a.s - b.s)
    .forEach((b) => {
      const last = merged[merged.length - 1];
      if (last && b.s <= last.e) last.e = Math.max(last.e, b.e);
      else merged.push({ ...b });
    });

  const gaps = [];
  let cursor = open;
  merged.forEach((b) => {
    if (b.s > cursor) gaps.push({ start: cursor, end: Math.min(b.s, close) });
    cursor = Math.max(cursor, b.e);
  });
  if (cursor < close) gaps.push({ start: cursor, end: close });

  return gaps
    .filter((g) => g.end - g.start >= minMinutes)
    .map((g) => ({ start: minutesToTime(g.start), end: minutesToTime(g.end) }));
}

// Does a proposed slot sit inside a free gap? Used to colour the strip, never to block a
// save — the manager may know something the board does not, and a schedule tool that
// refuses is a schedule tool people work around.
export function slotIsFree(blocks, start, end) {
  if (!start || !end) return true;
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (!(e > s)) return true;
  return !arr(blocks).some((b) => s < timeToMinutes(b.end) && e > timeToMinutes(b.start));
}

// Move a session into a gap while keeping how long it is.
//
// Keeping the duration is the point: the manager already decided this is an hour and a
// half, and a click on a free slot should answer "when", not silently re-answer "how long".
// A gap too short to hold it gives back the whole gap rather than spilling past its end.
export function fitIntoGap(gap, start, end) {
  if (!gap) return null;
  const gs = timeToMinutes(gap.start);
  const ge = timeToMinutes(gap.end);
  const want = Math.max(0, timeToMinutes(end) - timeToMinutes(start)) || 60;
  const fits = ge - gs >= want;
  return { start: minutesToTime(gs), end: minutesToTime(fits ? gs + want : ge) };
}
