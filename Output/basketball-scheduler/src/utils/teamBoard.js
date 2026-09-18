import { DAYS } from "../constants.js";
import { shiftWeek, weekStartOf, timeToMinutes } from "./dates.js";
import { assemblyTime, departBeforeOf } from "./transport.js";
import { escapeText, foldLine, icsDateTime } from "./calendar.js";
import { payFor } from "./payLink.js";

// The board one team's parents see — and the ONLY document they are allowed to read.
//
// THIS IS THE WHOLE REASON THE FEATURE HAS A SEPARATE DOCUMENT AT ALL.
//
// Firestore has no field-level permissions. The club document carries `players[]` — name,
// phone, birth date and sizes for every child in the club, including the ones under 15 who
// are nowhere near this feature. A parent who could read it to find Wednesday's training
// would read all of that too. There is no rule that says "only the sessions".
//
// So nothing is granted on the club document. A minimal copy is BUILT here and published,
// and it is minimal by construction rather than by filtering at display time — the
// distinction this project has already been caught on more than once.
//
// What is deliberately NOT copied:
//   • Anything about any player. The board does not know children exist.
//   • `notes` on a session. Free text written for internal use — "אלון לא מגיע השבוע" is
//     exactly the kind of sentence that ends up there, and publishing it would put a
//     child's name on a page anyone with the link can open.
//   • The driver's name and phone on away games. They are on the transport sheet, which
//     stays inside the club.
//   • Every other team.

const arr = (list) => (Array.isArray(list) ? list : []);

// Look-alike characters removed (l/1/0/o), and 32 exactly so that a random byte maps onto
// it without bias. Twelve of these is far more than a training schedule needs.
const ALPHABET = "abcdefghijkmnopqrstuvwxyz2345678";
export const TOKEN_LENGTH = 12;

export function tokenFrom(bytes) {
  return arr(bytes)
    .slice(0, TOKEN_LENGTH)
    .map((b) => ALPHABET[Math.abs(Number(b) || 0) % ALPHABET.length])
    .join("");
}

export function newToken() {
  const a = new Uint8Array(TOKEN_LENGTH);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(a);
  else for (let i = 0; i < TOKEN_LENGTH; i++) a[i] = Math.floor(Math.random() * 256);
  return tokenFrom([...a]);
}

// The link a coach pastes into the team's WhatsApp group.
export function boardPath(token) {
  return "/t/" + String(token || "");
}
export function tokenFromPath(pathname) {
  const m = /^\/t\/([a-z0-9]{6,32})\/?$/.exec(String(pathname || ""));
  return m ? m[1] : "";
}

// This week and next, and nothing else. A parent needs to know about tomorrow and about
// Saturday; a board that carries the whole season is a board nobody scrolls. Past weeks
// drop off on every publish, which also keeps the document small on its own.
export function boardWeeks(today = new Date()) {
  const here = weekStartOf(today);
  return [here, shiftWeek(here, 1)];
}

// One row of the board. `timeOverride` is applied here rather than shown raw: a game moved
// to 17:00 is at 17:00, and the original time is an internal detail.
function rowFor(session, { hallName, gameOf, departBefore }) {
  const start = session.timeOverride?.start || session.start || "";
  const end = session.timeOverride?.end || session.end || "";
  const game = session.fromGame ? gameOf(session) : null;

  if (game) {
    return {
      kind: "game",
      day: session.day,
      start,
      end,
      opponent: game.opponent || "",
      home: Boolean(game.isHome),
      // Home: the hall. Away: the address the transport sheet uses, so the two cannot drift.
      where: game.isHome ? hallName(session.hallId) : game.addressOverride || game.venue || "",
      // The same call the coach's own screen makes, with the manager's number. A second
      // definition here would put the squad and the parents at the pickup point at
      // different times, and both screens would look right.
      assembly: assemblyTime(game, departBefore),
      cancelled: Boolean(session.cancelled),
    };
  }

  // A fixture the manager typed straight onto the board rather than entering on the games
  // screen — ten of them existed on 17.9.2026. It is a game to everyone who reads it, so it
  // reads as one here. The opponent comes from its own field and NOT from `notes`, which is
  // free text and the one place a child's name turns up.
  if (/^משחק/.test(session.type || "")) {
    return {
      kind: "game",
      day: session.day,
      start,
      end,
      opponent: String(session.opponent || "").trim(),
      home: session.type === "משחק בית",
      where: hallName(session.hallId),
      // No fixture record means no tip-off time, so nothing to count back from. An
      // invented gathering time would be worse than none.
      assembly: "",
      cancelled: Boolean(session.cancelled),
    };
  }

  return {
    kind: "training",
    day: session.day,
    start,
    end,
    where: hallName(session.hallId),
    // "אימון" is what a row without a type already means; repeating it is noise.
    type: session.type && session.type !== "אימון" ? session.type : "",
    cancelled: Boolean(session.cancelled),
  };
}

const byDayThenTime = (a, b) =>
  DAYS.indexOf(a.day) - DAYS.indexOf(b.day) ||
  timeToMinutes(a.start || "00:00") - timeToMinutes(b.start || "00:00");

export function buildBoard(data, teamId, { now = new Date(), weeks } = {}) {
  const team = arr(data?.teams).find((t) => t && t.id === teamId);
  if (!team) return null;

  const hallName = (id) => arr(data?.halls).find((h) => h && h.id === id)?.name || "";
  const gameOf = (s) =>
    arr(data?.games).find((g) => g && String(g.federationCode) === String(s.federationCode)) || null;
  const departBefore = departBeforeOf(data);

  const out = {};
  (weeks || boardWeeks(now)).forEach((week) => {
    const rows = arr(data?.sessions)
      .filter((s) => s && s.teamId === teamId && (s.weekOf || "") === week)
      .map((s) => rowFor(s, { hallName, gameOf, departBefore }))
      .sort(byDayThenTime);
    // A week with nothing in it is left out rather than published empty: "no training this
    // week" and "this week is not published yet" are different sentences, and the reader
    // shows a different line for each.
    if (rows.length > 0) out[week] = rows;
  });

  return {
    teamId,
    teamName: team.name || "",
    weeks: out,
    // A link and nothing more — see `payLink.js`. `null` is written on purpose when there
    // is none, because the board is saved with `merge: true`.
    pay: payFor(data, teamId),
    updatedAt: now.toISOString(),
  };
}

// Where the token for each team is remembered. Small on purpose — this lives in the club
// document, which is already the thing with a size ceiling.
export function boardsIndex(data) {
  const raw = data?.boards;
  return raw && typeof raw === "object" ? raw : {};
}
export function tokenForTeam(data, teamId) {
  return boardsIndex(data)[teamId]?.token || "";
}
export function withBoardToken(data, teamId, token) {
  return { ...data, boards: { ...boardsIndex(data), [teamId]: { token, since: new Date().toISOString() } } };
}
export function withoutBoardToken(data, teamId) {
  const next = { ...boardsIndex(data) };
  delete next[teamId];
  return { ...data, boards: next };
}

// The board as calendar events, for a parent to put in their own phone.
//
// Built from the PUBLISHED board and not from the club's sessions, and that distinction is
// the whole point: `sessionEvent` in calendar.js writes `notes` into the event description,
// and the note is the field that carries "אלון לא מגיע השבוע". A parent's calendar is the
// last place that should end up. Everything here has already passed the filter that keeps a
// board minimal.
//
// One file rather than a Google Calendar link per event: a link adds one fixture at a time,
// and six taps is how a good idea stops being used. A .ics opens Apple Calendar directly and
// imports into Google Calendar just the same.
export function buildBoardIcs(board, { now = new Date() } = {}) {
  const pad = (n) => String(n).padStart(2, "0");
  const dtstamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const team = String(board?.teamName || "").trim();
  const events = [];

  Object.entries(board?.weeks || {}).forEach(([week, rows]) => {
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      // A cancelled fixture is left out rather than exported: a phone calendar cannot show
      // it struck through, so it would read as a game that is still on.
      if (!r || r.cancelled) return;
      const start = icsDateTime(week, r.day, r.start);
      const end = icsDateTime(week, r.day, r.end);
      if (!start || !end) return;

      const what =
        r.kind === "game"
          ? [r.home ? "משחק בית" : "משחק חוץ", r.opponent ? `נגד ${r.opponent}` : ""]
              .filter(Boolean)
              .join(" ")
          : r.type || "אימון";

      events.push(
        [
          "BEGIN:VEVENT",
          // Stable, so importing the file twice updates the events instead of doubling them.
          `UID:${board?.teamId || "team"}-${week}-${r.day}-${r.start}@kiryat-ono-basketball`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART:${start}`,
          `DTEND:${end}`,
          `SUMMARY:${escapeText([team, what].filter(Boolean).join(" — "))}`,
          r.where ? `LOCATION:${escapeText(r.where)}` : null,
          // The one line a parent has to act on, and the only description there is.
          r.assembly ? `DESCRIPTION:${escapeText(`התייצבות ${r.assembly}`)}` : null,
          "END:VEVENT",
        ].filter(Boolean)
      );
    });
  });

  const CRLF = "\r\n";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//kiryat-ono-basketball//team-board//HE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(team)}`,
    ...events.flat(),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}
