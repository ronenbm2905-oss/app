import { DAYS } from "../constants.js";
import { parseDateDMY } from "./dates.js";
import { matchHall, withHallAliases } from "./halls.js";

// Training sessions as a calendar file (RFC 5545), so a coach can put the week in their
// own calendar instead of copying it by hand.
//
// A file rather than an email: sending mail needs a server and a mail provider, and what
// would arrive is this exact file anyway. Opening it on a phone hands it straight to the
// calendar app.

// Times are written as LOCAL time with no zone and no VTIMEZONE block — "floating time"
// in the spec. Every person reading this calendar is in the same place as the gym, so
// 16:00 means 16:00 to all of them. The alternative, UTC stamps, would need a full
// timezone definition and would shift by an hour on the wrong side of a DST change.
const PRODID = "-//Kiryat Ono Basketball//Weekly Schedule//HE";

// TEXT values escape backslash, semicolon, comma and newline. Miss one and the event
// silently truncates at that character in some calendars.
export function escapeText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Lines fold at 75 OCTETS, not characters. Hebrew is two bytes per letter in UTF-8, so
// counting characters would produce lines that are legal-looking and too long — and
// splitting mid-character would corrupt the text outright. This counts bytes and never
// splits inside one.
export function foldLine(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Back off until `end` sits on a character boundary (never mid UTF-8 sequence).
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    out.push(new TextDecoder().decode(bytes.slice(start, end)));
    start = end;
    limit = 74; // continuation lines carry a leading space
  }
  return out.join("\r\n ");
}

// "2026-08-23" + day offset + "16:00" -> "20260823T160000"
export function icsDateTime(weekOfIso, day, hhmm) {
  const idx = DAYS.indexOf(day);
  if (idx < 0) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(weekOfIso || ""));
  const t = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  if (!m || !t) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + idx);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(Number(t[1]))}${t[2]}00`;
}

const nameOf = (list, id) => (list || []).find((x) => x && x.id === id)?.name || "";

export function sessionEvent(session, data, { dtstamp, sequence = 0 }) {
  const start = icsDateTime(session.weekOf, session.day, session.start);
  const end = icsDateTime(session.weekOf, session.day, session.end);
  if (!start || !end) return null;

  const team = nameOf(data?.teams, session.teamId);
  const coach = nameOf(data?.coaches, session.coachId);
  const hall = nameOf(data?.halls, session.hallId);
  const type = session.type && session.type !== "אימון" ? session.type : "";

  const summary = [team || "אימון", type].filter(Boolean).join(" — ");
  const description = [coach && `מאמן: ${coach}`, session.notes].filter(Boolean).join("\n");

  return [
    "BEGIN:VEVENT",
    // Stable per session, so importing the same week twice updates the events instead of
    // creating a second copy of every training.
    `UID:${session.id}@kiryat-ono-basketball`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeText(summary)}`,
    hall ? `LOCATION:${escapeText(hall)}` : null,
    description ? `DESCRIPTION:${escapeText(description)}` : null,
    // The same revision number, for the same reason: the trainings file carried none at
    // all, which means 0 forever — so a week re-exported after a training moved was a
    // second copy at the same revision, and a calendar may ignore it outright.
    `SEQUENCE:${sequence}`,
    "END:VEVENT",
  ].filter(Boolean);
}

// DTSTAMP is "when this file was written" and is the one stamp the spec wants in UTC — it
// is not an event time and never moves with a timezone.
// SEQUENCE is the revision number of an event, and a calendar legitimately IGNORES an
// incoming copy whose sequence is not higher than the one it already holds. So it cannot be
// a flag. It was written as one — 1 for a cancelled fixture and 0 for a live one — and that
// is wrong in exactly one direction, which is the direction the federation actually uses:
// `findCancelledGames` produces `restored` because the federation reinstates fixtures as
// readily as it drops them. A fixture cancelled (sequence 1) and then reinstated would have
// gone out again at sequence 0, below the copy in the coach's calendar, and the calendar
// would have been right to ignore it — leaving "מבוטל" on a game that is back on.
//
// So it is derived from WHEN THE FILE WAS WRITTEN and is identical for every event in it:
// every new file outranks every older one, whatever changed. Minutes rather than seconds
// keep the number small, and counting from 2020 keeps it far from the 32-bit ceiling that
// epoch seconds reach in 2038.
const SEQ_EPOCH = Date.UTC(2020, 0, 1);

export function icsSequence(now = new Date()) {
  return Math.max(0, Math.floor((now.getTime() - SEQ_EPOCH) / 60000));
}

export function icsStamp(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}` +
    `T${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}Z`
  );
}

function wrapCalendar(events, calendarName) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    ...events,
    "END:VCALENDAR",
  ];

  // CRLF between lines is required by the spec, and some calendars reject the file
  // outright without it.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

// `now` is injected so the output is reproducible in a test.
export function buildIcs(sessions, data, { now = new Date(), calendarName = "אימונים" } = {}) {
  const dtstamp = icsStamp(now);
  const sequence = icsSequence(now);

  const events = (Array.isArray(sessions) ? sessions : [])
    .filter(Boolean)
    // A cancelled fixture is left out rather than exported: a phone calendar has no way to
    // show it as struck through, so it would just look like a game that is still on.
    .filter((s) => !s.cancelled)
    .map((s) => sessionEvent(s, data, { dtstamp, sequence }))
    .filter(Boolean)
    .flat();

  return wrapCalendar(events, calendarName);
}

// ---------- fixtures ----------
//
// A game is not a training, and four differences decide everything below.
//
//   • IT HAS A TIP-OFF AND NO END. The federation publishes one time and the club stores
//     exactly that, so an end time is an assumption — written here as one, once, by name.
//   • IT HAS A SEASON, NOT A WEEK. The trainings button exports the week on screen; there
//     is no equivalent for fixtures, because "when do we play" is a season question. What
//     goes out is everything still ahead.
//   • IT CAN BE CALLED OFF AFTER IT WAS EXPORTED. `buildIcs` leaves a cancelled training
//     out of the file, and for a fixture that is the dangerous answer: the coach already
//     has it in their calendar, and a file that merely omits it leaves it sitting there
//     looking like a game that is still on. So a cancelled fixture goes out WITH
//     `STATUS:CANCELLED` under the same UID — that is what makes a calendar drop it.
//   • ITS IDENTITY OUTLIVES THE RECORD. `federationCode` is what survives a re-import, so
//     it is the UID. Using the local id would hand the coach a second copy of the season
//     the first time a fixture was re-created.
//
// WHAT IS DELIBERATELY NOT IN THE FILE, and it is the same list the parents' sheet keeps
// (`gameSheet.js`) for the same reason — a calendar file is forwardable:
//
//   • The driver's name and phone.
//   • The coach's game note and any score in it.
//   • The gathering time for away games. It is a DERIVED value that the club publishes
//     with a sentence next to it saying it is not the official transport notice, and an
//     event description read three weeks later carries no such sentence. The tip-off is a
//     fact; the bus is a message the club sends.
//   • Any player. A fixture record does not know children exist.
export const GAME_MINUTES = 90;

const arr = (list) => (Array.isArray(list) ? list : []);
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// Local "floating" stamp from a real Date — the same choice, and the same reason, as
// `icsDateTime` above: everyone reading this calendar stands where the gym stands.
function icsLocal(d) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `T${p(d.getHours())}${p(d.getMinutes())}00`
  );
}

// "13-10-2026" + "17:00" -> { start, end }. Date arithmetic rather than string maths, so a
// late fixture that runs past midnight lands on the next day instead of producing "T2430".
export function gameWindow(game, minutes = GAME_MINUTES) {
  const day = parseDateDMY(game?.date);
  const t = /^(\d{1,2}):(\d{2})$/.exec(String(game?.time || "").trim());
  if (!day || isNaN(day.getTime()) || !t) return null;
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(t[1]), Number(t[2]));
  const end = new Date(start.getTime() + minutes * 60000);
  return { start, end };
}

// Where the game is played, in OUR words. Home fixtures resolve to the club's own name for
// the hall — never the federation's older name for the same building — through the rename
// table, exactly as the parents' sheet does. An away fixture carries the address the
// transport sheet uses, so the two cannot drift apart.
export function gameLocation(game, data) {
  const raw = game?.addressOverride || game?.venue || "";
  if (!game?.isHome) return withHallAliases(raw);
  const halls = arr(data?.halls);
  const id = game.hallId || matchHall(raw, halls);
  return halls.find((h) => h && h.id === id)?.name || withHallAliases(raw);
}

export function gameEvent(game, data, { dtstamp, sequence = 0, minutes = GAME_MINUTES } = {}) {
  const window = gameWindow(game, minutes);
  // No usable date or time is the one case with nothing honest to write. It is dropped
  // rather than guessed — an event at the wrong hour is worse than an event that is absent
  // from a file the coach still has the screen for.
  if (!window) return null;

  const team = nameOf(data?.teams, game.teamId);
  const opponent = String(game.opponent || "").trim();
  const side = game.isHome ? "בית" : "חוץ";
  const off = Boolean(game.cancelled);

  // The month view on a phone shows the first few words and nothing else, so the squad
  // comes first: a coach with three teams is reading the list to find their own.
  const summary =
    (off ? "מבוטל — " : "") +
    [team || "משחק", side, opponent && `נגד ${opponent}`].filter(Boolean).join(" · ");

  const where = gameLocation(game, data);
  const description = [game.league && `ליגה: ${game.league}`].filter(Boolean).join("\n");

  return [
    "BEGIN:VEVENT",
    `UID:game-${game.federationCode || game.id}@kiryat-ono-basketball`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${icsLocal(window.start)}`,
    `DTEND:${icsLocal(window.end)}`,
    `SUMMARY:${escapeText(summary)}`,
    where ? `LOCATION:${escapeText(where)}` : null,
    description ? `DESCRIPTION:${escapeText(description)}` : null,
    off ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    `SEQUENCE:${sequence}`,
    "END:VEVENT",
  ].filter(Boolean);
}

// Which fixtures belong in one person's file.
//
// `teamIds = null` means the whole club and an EMPTY ARRAY means nothing — the same
// distinction the birthday list turns on, and for the same reason: a bug that falls back
// to "show everything" is a bug that hands one coach the other twenty-seven squads.
export function gamesForCalendar(data, { teamIds = null, now = new Date(), includePast = false } = {}) {
  const scope = teamIds === null ? null : new Set(arr(teamIds));
  const today = startOfDay(now);
  return arr(data?.games)
    .filter((g) => g && (!scope || scope.has(g.teamId)))
    .filter((g) => {
      if (includePast) return true;
      const d = parseDateDMY(g.date);
      // A fixture whose date cannot be read is kept here and dropped later by `gameEvent`.
      // Deciding it twice would mean two places that can disagree about what a season is.
      return !d || startOfDay(d) >= today;
    })
    .sort((a, b) => {
      const x = gameWindow(a)?.start.getTime() ?? Number.MAX_SAFE_INTEGER;
      const y = gameWindow(b)?.start.getTime() ?? Number.MAX_SAFE_INTEGER;
      return x - y;
    });
}

export function buildGamesIcs(games, data, { now = new Date(), calendarName = "משחקים" } = {}) {
  const dtstamp = icsStamp(now);
  const sequence = icsSequence(now);
  const events = arr(games)
    .filter(Boolean)
    .map((g) => gameEvent(g, data, { dtstamp, sequence }))
    .filter(Boolean)
    .flat();
  return wrapCalendar(events, calendarName);
}

export function icsFileName(label, suffix) {
  const safe = String(label || "אימונים").replace(/[\\/:*?"<>|]/g, "").trim() || "אימונים";
  // The suffix is optional. A week of trainings is named by its week; a season of fixtures
  // has no week to be named by, and "משחקים-undefined.ics" is what happens when a call
  // site is trusted to always have one.
  return `${safe}${suffix ? `-${suffix}` : ""}.ics`;
}
