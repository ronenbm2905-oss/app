// Sessions of one kind that repeat every week — the specialist's standing slot.
//
// The club has rows that are fixed by a person rather than by a team: יורם takes the
// קט-סל squads every Sunday, and the same four rows are re-entered by hand every week.
// `fixedTeams.js` already solves the equivalent problem for a whole SQUAD, but it cannot
// help here, and the reason is worth writing down: it offers a team only when that team
// has NO session that week. The קט-סל squads always have their own trainings, so the strip
// stays quiet and the one row that actually repeats is the one that gets forgotten.
//
// So this module keys on the session TYPE instead, and follows the same three rules
// fixedTeams.js chose deliberately:
//
// 1. NOT a separate recurrence store. The template is simply the most recent week those
//    sessions actually ran. Move יורם's hour once and every later week inherits it.
// 2. NOT automatic. Filling writes the whole club document, and paging forward through ten
//    weeks would silently create ten weeks nobody asked for. One click, once, per week.
// 3. NOT a different kind of session. What lands is an ordinary session with a fresh id.
//
// One rule differs, on purpose. A team is skipped entirely once it has any session that
// week, because half a week entered by hand is a decision. A specialist's slot is a narrow
// slice — four rows, not a week — so a week that already has two of them is topped up
// rather than left alone, and `sessionKey` keeps that from ever producing a double. That
// is the same key `handleCopyPrevWeek` compares on: one definition of a duplicate for the
// whole app, and the control that the 30.8 duplication incident turned out to need.
//
// The DAY is not part of any of this. Sunday is where these sessions happen to sit today;
// it is carried over because the template carries it, not because anything here knows it.
// The week יורם moves to Monday, this keeps working and nobody has to remember why.

import { shiftWeek } from "./dates.js";
import { sessionKey } from "./rowCopy.js";

const arr = (list) => (Array.isArray(list) ? list : []);
const str = (v) => String(v ?? "").trim();

// The manual sessions of one type in one week. Imported fixtures are excluded: the
// federation owns those dates, and a game is not a recurring training.
export function sessionsOfType(sessions, type, week) {
  const t = str(type);
  if (!t) return [];
  return arr(sessions).filter(
    (s) => s && str(s.type) === t && (s.weekOf || "") === (week || "") && !s.fromGame
  );
}

// The most recent week at or before `weekStart` in which this type actually ran, or "".
//
// Bounded rather than open-ended — a slot that stopped running two months ago should stop
// being offered rather than resurrect itself from the middle of last season.
export function templateWeekForType(sessions, type, weekStart, maxBack = 8) {
  if (!str(type) || !weekStart) return "";
  for (let back = 1; back <= maxBack; back++) {
    const week = shiftWeek(weekStart, -back);
    if (sessionsOfType(sessions, type, week).length > 0) return week;
  }
  return "";
}

// What this week is missing: the template's sessions minus the ones already here.
//
// Returns `{ from, sessions }` — `from` is the week they were taken from, so the button can
// say where they came from rather than asking the manager to trust it. Empty `sessions`
// means there is nothing to offer, either because the week is complete or because no
// template exists.
//
// The template is de-duplicated against ITSELF before anything else, and that is not
// defensive tidiness — the live data needs it. The 30.8 copy-week incident left the source
// weeks holding the same row twice (קטסל ב 15:45 appears twice in both 30.8 and 6.9), and
// without this a doubled row would be copied twice into every week from here on: one
// mistake made permanent, spreading forward, by a button meant to save typing. The last
// occurrence wins, matching how the board reads a week top to bottom.
export function pendingTypeSessions(data, type, weekStart, maxBack = 8) {
  const sessions = arr((data || {}).sessions);
  const from = templateWeekForType(sessions, type, weekStart, maxBack);
  if (!from) return { from: "", sessions: [] };
  const here = new Set(sessionsOfType(sessions, type, weekStart).map(sessionKey));
  const template = new Map();
  sessionsOfType(sessions, type, from).forEach((s) => template.set(sessionKey(s), s));
  return {
    from,
    sessions: [...template.values()].filter((s) => !here.has(sessionKey(s))),
  };
}

// The sessions to append. `makeId` is injected so the caller owns id generation and this
// stays testable.
//
// `timeOverride` and `cancelled` are dropped for the same reason fixedTeams.js drops them:
// they belong to the week they were set in. A session moved by a quarter of an hour three
// weeks ago says nothing about this Sunday, and a training cancelled once is not cancelled
// for ever.
export function buildTypeCopies(pending, weekStart, makeId) {
  return (pending?.sessions || []).map((s) => {
    const { id, weekOf, timeOverride, cancelled, cancelledAt, ...rest } = s;
    return { ...rest, id: makeId(), weekOf: weekStart };
  });
}
