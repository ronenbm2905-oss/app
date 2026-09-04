import { DAYS, DEFAULT_SESSION_TYPE } from "../constants.js";
import { clubName } from "./club.js";

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
// PRODID identifies the SOFTWARE that produced the file, not the club whose week is in
// it — which is what RFC 5545 actually asks for, and what the single-club branch conflated
// because there the two were the same thing. A club's name belongs in X-WR-CALNAME and in
// the events; putting one customer's name in every other customer's calendar file is the
// leak this replaces.
const PRODID = "-//Basketball Scheduler//Weekly Schedule//HE";

// The UID's domain half is a namespace, and on a multi-club deployment it has to be the
// club's. `uid()` is eight base-36 characters, so two clubs CAN mint the same session id;
// a coach who works at two clubs and imports both weeks would then have one training
// silently replace the other, because a calendar treats a repeated UID as the same event.
const uidNamespace = (clubId) => String(clubId || "").trim() || "basketball-scheduler";

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

export function sessionEvent(session, data, { dtstamp, clubId }) {
  const start = icsDateTime(session.weekOf, session.day, session.start);
  const end = icsDateTime(session.weekOf, session.day, session.end);
  if (!start || !end) return null;

  const team = nameOf(data?.teams, session.teamId);
  const coach = nameOf(data?.coaches, session.coachId);
  const hall = nameOf(data?.halls, session.hallId);
  const type = session.type && session.type !== DEFAULT_SESSION_TYPE ? session.type : "";

  const summary = [team || DEFAULT_SESSION_TYPE, type].filter(Boolean).join(" — ");
  const description = [coach && `מאמן: ${coach}`, session.notes].filter(Boolean).join("\n");

  return [
    "BEGIN:VEVENT",
    // Stable per session, so importing the same week twice updates the events instead of
    // creating a second copy of every training.
    `UID:${session.id}@${uidNamespace(clubId)}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeText(summary)}`,
    hall ? `LOCATION:${escapeText(hall)}` : null,
    description ? `DESCRIPTION:${escapeText(description)}` : null,
    "END:VEVENT",
  ].filter(Boolean);
}

// `now` is injected so the output is reproducible in a test.
export function buildIcs(sessions, data, { now = new Date(), calendarName, clubId } = {}) {
  // The club names its own calendar. Falls back to the generic word rather than to any
  // club's name — `DEFAULT_SETTINGS` is empty here by design and must stay that way.
  const title = String(calendarName || clubName(data) || "אימונים").trim() || "אימונים";
  const p = (n) => String(n).padStart(2, "0");
  const dtstamp =
    `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}` +
    `T${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}Z`;

  const events = (Array.isArray(sessions) ? sessions : [])
    .filter(Boolean)
    // A cancelled fixture is left out rather than exported: a phone calendar has no way to
    // show it as struck through, so it would just look like a game that is still on.
    .filter((s) => !s.cancelled)
    .map((s) => sessionEvent(s, data, { dtstamp, clubId }))
    .filter(Boolean)
    .flat();

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(title)}`,
    ...events,
    "END:VCALENDAR",
  ];

  // CRLF between lines is required by the spec, and some calendars reject the file
  // outright without it.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function icsFileName(label, weekStart) {
  const safe = String(label || "אימונים").replace(/[\/:*?"<>|]/g, "").trim() || "אימונים";
  return `${safe}-${weekStart}.ics`;
}
