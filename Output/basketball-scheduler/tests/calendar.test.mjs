import assert from "node:assert/strict";
import {
  escapeText, foldLine, icsDateTime, icsFileName, icsStamp, icsSequence,
  buildIcs, gameWindow, gameLocation, gameEvent, gamesForCalendar, buildGamesIcs, GAME_MINUTES,
} from "../src/utils/calendar.js";

let count = 0;
const T = (name, fn) => { fn(); console.log("  ok  " + name); count++; };

const NOW = new Date("2026-10-05T09:00:00Z");

const data = {
  teams: [
    { id: "t1", name: "נערים א", coachId: "c1" },
    { id: "t2", name: "ילדים ב", coachId: "c1" },
    { id: "t3", name: "נוער", coachId: "c2" },
  ],
  coaches: [{ id: "c1", name: "יוסי כהן" }, { id: "c2", name: "דנה לוי" }],
  halls: [{ id: "h1", name: "אולם ברק" }],
  games: [
    // Out of order on purpose, to prove the list sorts.
    { federationCode: "3", teamId: "t1", date: "26-10-2026", time: "18:30", isHome: false,
      opponent: "בני יהודה", venue: "הרצל 10, רמת גן", league: "נערים א מרכז",
      driverName: "יוסי", driverPhone: "0521111111" },
    { federationCode: "1", teamId: "t1", date: "12-10-2026", time: "20:30", isHome: true,
      opponent: "מכבי רעננה", venue: "אולם עלומים, רח' הכפר 2, קריית אונו" },
    { federationCode: "2", teamId: "t2", date: "13-10-2026", time: "17:00", isHome: true,
      opponent: "אליצור", venue: "אולם ברק" },
    { federationCode: "4", teamId: "t3", date: "14-10-2026", time: "19:00", isHome: true,
      opponent: "קבוצה של מאמנת אחרת" },
    { federationCode: "5", teamId: "t1", date: "01-09-2026", time: "19:00", isHome: true,
      opponent: "משחק שכבר היה" },
  ],
};

// ---------- the parts the trainings file already relied on ----------
//
// `calendar.js` shipped in August with no test file at all. These cover the helpers that
// both builders now share, so a change made for fixtures cannot quietly break trainings.

T("escapeText escapes the four characters that truncate an event", () => {
  assert.equal(escapeText("א;ב,ג\\ד\nה"), "א\\;ב\\,ג\\\\ד\\nה");
});

T("foldLine counts BYTES, not characters — Hebrew is two per letter", () => {
  const line = "SUMMARY:" + "א".repeat(60); // 8 + 120 bytes
  const folded = foldLine(line);
  assert.equal(folded.includes("\r\n "), true);
  for (const part of folded.split("\r\n")) {
    assert.ok(new TextEncoder().encode(part).length <= 76, "a folded line is over the limit");
  }
});

T("foldLine never splits inside a character", () => {
  const folded = foldLine("X:" + "ש".repeat(80));
  assert.equal(folded.includes("�"), false);
});

T("icsDateTime walks the week from its Sunday", () => {
  assert.equal(icsDateTime("2026-10-11", "שלישי", "16:00"), "20261013T160000");
});

T("icsStamp is UTC — it is when the file was written, not when anything happens", () => {
  assert.equal(icsStamp(new Date("2026-10-05T09:07:03Z")), "20261005T090703Z");
});

T("a training that was cancelled is left out of the trainings file", () => {
  const ics = buildIcs(
    [{ id: "s1", weekOf: "2026-10-11", day: "שני", start: "16:00", end: "17:30", teamId: "t1" },
     { id: "s2", weekOf: "2026-10-11", day: "שני", start: "18:00", end: "19:30", teamId: "t2", cancelled: true }],
    data,
    { now: NOW }
  );
  assert.equal(ics.includes("UID:s1@"), true);
  assert.equal(ics.includes("UID:s2@"), false);
});

// ---------- fixtures ----------

T("gameWindow gives a 90-minute event from a tip-off that has no end", () => {
  const w = gameWindow({ date: "12-10-2026", time: "20:30" });
  assert.equal(w.start.getHours(), 20);
  assert.equal(w.start.getMinutes(), 30);
  assert.equal(w.end.getHours(), 22);
  assert.equal(w.end.getMinutes(), 0);
  assert.equal(GAME_MINUTES, 90);
});

T("a late fixture rolls into the next day instead of producing T2430", () => {
  const w = gameWindow({ date: "12-10-2026", time: "23:00" });
  assert.equal(w.end.getDate(), 13);
  assert.equal(w.end.getHours(), 0);
  assert.equal(w.end.getMinutes(), 30);
});

T("no date, no time, or nonsense — no window and no event", () => {
  assert.equal(gameWindow({ date: "", time: "18:00" }), null);
  assert.equal(gameWindow({ date: "12-10-2026", time: "" }), null);
  assert.equal(gameWindow({ date: "לא תאריך", time: "18:00" }), null);
  assert.equal(gameEvent({ date: "", time: "" }, data, { dtstamp: "X" }), null);
});

T("a home fixture is located by OUR name for the hall, not the federation's", () => {
  // The federation writes "אולם עלומים, רח' הכפר 2" for the building the club calls ברק.
  assert.equal(gameLocation(data.games[1], data), "אולם ברק");
});

T("an away fixture carries the address, with the club's hall aliases applied", () => {
  assert.equal(gameLocation(data.games[0], data), "הרצל 10, רמת גן");
});

T("addressOverride wins — it is the address the transport sheet uses", () => {
  const g = { isHome: false, venue: "הרצל 10", addressOverride: "הרצל 10, רמת גן (כניסה מאחור)" };
  assert.equal(gameLocation(g, data), "הרצל 10, רמת גן (כניסה מאחור)");
});

const ev = gameEvent(data.games[0], data, { dtstamp: "20261005T090000Z" }).join("\r\n");

T("the squad comes first in the summary — a phone shows the first few words", () => {
  assert.match(ev, /SUMMARY:נערים א · חוץ · נגד בני יהודה/);
});

T("the UID is the federation code, so a re-import updates instead of duplicating", () => {
  assert.match(ev, /UID:game-3@kiryat-ono-basketball/);
});

T("the driver's name and phone are NOT in the file", () => {
  assert.equal(ev.includes("יוסי"), false);
  assert.equal(ev.includes("0521111111"), false);
});

T("nothing outside the seven fields reaches the event, whatever the record carries", () => {
  // Locks the DOCTRINE and not one example of it. The previous test protected one item out
  // of four, so a record that grew a field would have walked into the file unnoticed — and
  // this file is forwardable.
  const dirty = {
    ...data.games[0],
    note: "השחקן חזר מפציעה",
    score: "62-58",
    assembly: "17:00",
    players: [{ name: "ילד כלשהו", phone: "0500000000" }],
    driverName: "משה", driverPhone: "0529999999",
    addressOverride: "",
  };
  const line = gameEvent(dirty, data, { dtstamp: "X" }).join("\r\n");
  for (const leak of ["פציעה", "62-58", "17:00", "ילד כלשהו", "0500000000", "משה", "0529999999"]) {
    assert.equal(line.includes(leak), false, `"${leak}" reached the calendar file`);
  }
});

T("a cancelled fixture goes out as CANCELLED rather than being dropped", () => {
  // The whole point: the coach already has it. A file that merely omits it leaves it in
  // their calendar looking like a game that is still on.
  const off = gameEvent({ ...data.games[1], cancelled: true }, data, { dtstamp: "X" }).join("\r\n");
  assert.match(off, /STATUS:CANCELLED/);
  assert.match(off, /SUMMARY:מבוטל — /);
  assert.match(off, /UID:game-1@/); // same UID as the live one, or nothing is replaced
});

T("a live fixture is CONFIRMED", () => {
  assert.match(ev, /STATUS:CONFIRMED/);
});

// ---------- the revision number ----------

T("SEQUENCE rises with time and is the same for every event in one file", () => {
  const file = buildGamesIcs(gamesForCalendar(data, { teamIds: ["t1", "t2"], now: NOW }), data, { now: NOW });
  const seqs = [...file.matchAll(/SEQUENCE:(\d+)/g)].map((m) => m[1]);
  assert.equal(new Set(seqs).size, 1, "one file, one revision");
  assert.equal(Number(seqs[0]) > 0, true);
  assert.ok(icsSequence(new Date("2026-10-05T10:00:00Z")) > icsSequence(NOW));
});

T("a fixture cancelled and then REINSTATED outranks the cancellation", () => {
  // The federation reinstates fixtures as readily as it drops them (`restored` in
  // games.js). With SEQUENCE written as a flag — 1 for cancelled, 0 for live — the
  // reinstated game went out BELOW the copy already in the coach's calendar, and a
  // calendar is entitled to ignore that. The coach would have been left with "מבוטל" on
  // a game that is back on.
  const monday = new Date("2026-10-05T09:00:00Z");
  const tuesday = new Date("2026-10-06T09:00:00Z");
  const game = data.games[1];
  const cancelled = buildGamesIcs([{ ...game, cancelled: true }], data, { now: monday });
  const restored = buildGamesIcs([game], data, { now: tuesday });
  const seq = (s) => Number(/SEQUENCE:(\d+)/.exec(s)[1]);
  assert.ok(seq(restored) > seq(cancelled), "the reinstatement must outrank the cancellation");
  assert.match(restored, /STATUS:CONFIRMED/);
});

T("the trainings file carries a revision number too — it had none at all", () => {
  const ics = buildIcs(
    [{ id: "s1", weekOf: "2026-10-11", day: "שני", start: "16:00", end: "17:30", teamId: "t1" }],
    data,
    { now: NOW }
  );
  assert.match(ics, /SEQUENCE:\d+/);
});

// ---------- whose fixtures ----------

T("a coach's teams only — never another coach's squad", () => {
  const mine = gamesForCalendar(data, { teamIds: ["t1", "t2"], now: NOW });
  assert.deepEqual(mine.map((g) => g.federationCode), ["1", "2", "3"]);
});

T("sorted by date and time, whatever order the record holds", () => {
  const all = gamesForCalendar(data, { now: NOW });
  assert.deepEqual(all.map((g) => g.federationCode), ["1", "2", "4", "3"]);
});

T("fixtures that have already been played are left out", () => {
  const mine = gamesForCalendar(data, { teamIds: ["t1"], now: NOW });
  assert.equal(mine.some((g) => g.federationCode === "5"), false);
});

T("includePast brings the whole season back", () => {
  const all = gamesForCalendar(data, { teamIds: ["t1"], now: NOW, includePast: true });
  assert.equal(all.some((g) => g.federationCode === "5"), true);
});

T("an EMPTY array means nothing — it must never fall back to the whole club", () => {
  // The distinction the birthday list turns on. A bug here hands one coach 28 squads.
  assert.deepEqual(gamesForCalendar(data, { teamIds: [], now: NOW }), []);
});

T("null means the whole club — the manager's own list", () => {
  assert.equal(gamesForCalendar(data, { teamIds: null, now: NOW }).length, 4);
});

// ---------- the file ----------

const ics = buildGamesIcs(gamesForCalendar(data, { teamIds: ["t1", "t2"], now: NOW }), data, {
  now: NOW,
  calendarName: "משחקים — יוסי כהן",
});

T("a whole, well-formed calendar", () => {
  assert.equal(ics.startsWith("BEGIN:VCALENDAR\r\n"), true);
  assert.equal(ics.endsWith("END:VCALENDAR\r\n"), true);
  assert.equal(ics.split("BEGIN:VEVENT").length - 1, 3);
  assert.equal(ics.split("END:VEVENT").length - 1, 3);
});

T("every line ends CRLF — some calendars reject the file outright without it", () => {
  assert.equal(/[^\r]\n/.test(ics), false);
});

T("the calendar carries the coach's name as its source", () => {
  assert.match(ics, /X-WR-CALNAME:משחקים — יוסי כהן/);
});

T("no other coach's squad reached the file", () => {
  assert.equal(ics.includes("נוער"), false);
});

T("icsFileName: a season has no week, and no '-undefined' either", () => {
  assert.equal(icsFileName("משחקים יוסי כהן"), "משחקים יוסי כהן.ics");
  assert.equal(icsFileName("משחקים יוסי", ""), "משחקים יוסי.ics");
  assert.equal(icsFileName("אימונים", "2026-10-11"), "אימונים-2026-10-11.ics");
});

T("icsFileName strips what Windows refuses — the backslash included", () => {
  // The backslash was missing from the class, so a label carrying one produced a name the
  // save dialog read as a folder that does not exist.
  assert.equal(icsFileName("מש/חקים\\א:ב?"), "משחקיםאב.ics");
});

console.log(`\n${count} tests passed`);
