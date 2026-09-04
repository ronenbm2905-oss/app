// The week as a calendar file (RFC 5545).
//
// Two things this suite is really about. First, byte-level correctness: Hebrew is two
// bytes a letter, and the spec folds lines at 75 OCTETS — count characters instead and
// you produce a file that looks legal and is not, or split mid-character and corrupt it.
// Second, and specific to a multi-club deployment: no club's identity may appear in
// another club's file, and the event UIDs must be namespaced per club.

import assert from "node:assert/strict";
import {
  escapeText, foldLine, icsDateTime, sessionEvent, buildIcs, icsFileName,
} from "../src/utils/calendar.js";

const WEEK = "2026-09-06"; // a Sunday
const NOW = new Date(Date.UTC(2026, 8, 1, 10, 30, 0));

const club = {
  settings: { name: "מכבי בדיקה" },
  teams: [{ id: "t1", name: "נוער א" }],
  coaches: [{ id: "c1", name: "דנה" }],
  halls: [{ id: "h1", name: "אולם מרכזי" }],
};
const session = {
  id: "s1", teamId: "t1", coachId: "c1", hallId: "h1",
  day: "ראשון", start: "17:00", end: "18:30", weekOf: WEEK, type: "אימון",
};

// ---- Escaping. Miss one and the event truncates at that character in some calendars ----
assert.equal(escapeText("a,b"), "a\\,b");
assert.equal(escapeText("a;b"), "a\\;b");
assert.equal(escapeText("a\\b"), "a\\\\b");
assert.equal(escapeText("a\nb"), "a\\nb");
assert.equal(escapeText("a\r\nb"), "a\\nb");
assert.equal(escapeText(null), "");
// The backslash must be escaped FIRST, or the escapes escape each other.
assert.equal(escapeText("a\\,b"), "a\\\\\\,b");

// ---- Folding at 75 bytes, never mid-character ----
{
  const short = "SUMMARY:אימון";
  assert.equal(foldLine(short), short, "a short line is left alone");

  const long = "SUMMARY:" + "א".repeat(80); // 160 bytes of Hebrew
  const folded = foldLine(long);
  const parts = folded.split("\r\n");
  assert.ok(parts.length > 1, "a long line was not folded");
  for (const part of parts) {
    assert.ok(new TextEncoder().encode(part).length <= 75, `a folded line exceeded 75 bytes: ${part.length}`);
  }
  for (const cont of parts.slice(1)) {
    assert.ok(cont.startsWith(" "), "a continuation line must start with a space");
  }
  // Unfolding puts it back exactly — which is the proof nothing was split mid-character.
  // Unfolding means dropping the ONE leading space each continuation line carries, not
  // stripping every space: a summary can legitimately contain them.
  const unfolded = parts[0] + parts.slice(1).map((p) => p.slice(1)).join("");
  assert.equal(unfolded, long, "folding was not reversible");
  assert.ok(!folded.includes("�"), "a character was split across the fold");
}

// ---- Dates ----
assert.equal(icsDateTime(WEEK, "ראשון", "17:00"), "20260906T170000");
assert.equal(icsDateTime(WEEK, "שני", "9:05"), "20260907T090500", "a single-digit hour is padded");
assert.equal(icsDateTime(WEEK, "שבת", "20:00"), "20260912T200000", "the last day of the week");
assert.equal(icsDateTime(WEEK, "לא-יום", "17:00"), null);
assert.equal(icsDateTime("nonsense", "ראשון", "17:00"), null);
assert.equal(icsDateTime(WEEK, "ראשון", "17"), null, "an incomplete time is refused, not guessed");

// ---- No club's name in another club's file ----
{
  const ics = buildIcs([session], club, { now: NOW, clubId: "maccabi-test" });
  assert.ok(!/kiryat|Kiryat|קרית אונו/.test(ics), "a hard-coded club name reached the calendar file");
  // PRODID names the SOFTWARE, per the spec — not whichever club happens to be exporting.
  assert.ok(ics.includes("PRODID:-//Basketball Scheduler//Weekly Schedule//HE"));
  // The club names its own calendar, from settings.
  assert.ok(ics.includes("X-WR-CALNAME:מכבי בדיקה"), "the calendar was not named after the club");
  // The UID namespace is the club's: two clubs can mint the same session id, and a
  // repeated UID makes one calendar entry silently replace the other.
  assert.ok(ics.includes("UID:s1@maccabi-test"), "the UID was not namespaced to the club");
}
// Without a clubId it falls back to the product, never to a club name.
assert.ok(buildIcs([session], club, { now: NOW }).includes("UID:s1@basketball-scheduler"));
// A club that has not named itself gets the app's own placeholder — the same one the
// header shows — and NOT some other club's name. Consistency over friendliness here:
// `clubName` is the single answer to "what is this club called", and a second fallback
// living in the calendar module would be a second answer waiting to disagree.
assert.ok(buildIcs([session], { settings: {} }, { now: NOW }).includes("X-WR-CALNAME:מועדון ללא שם"));
assert.ok(!/קרית|Kiryat/.test(buildIcs([session], { settings: {} }, { now: NOW })));
// An explicit name still wins.
assert.ok(buildIcs([session], club, { now: NOW, calendarName: "אימונים — דנה" }).includes("X-WR-CALNAME:אימונים — דנה"));

// ---- The event itself ----
{
  const lines = sessionEvent(session, club, { dtstamp: "20260901T103000Z", clubId: "c" });
  const find = (k) => lines.find((l) => l.startsWith(k)) || "";
  assert.equal(find("DTSTART:"), "DTSTART:20260906T170000");
  assert.equal(find("DTEND:"), "DTEND:20260906T183000");
  assert.equal(find("LOCATION:"), "LOCATION:אולם מרכזי");
  assert.ok(find("DESCRIPTION:").includes("מאמן: דנה"));
  // The default type is not a label worth printing next to the team name.
  assert.equal(find("SUMMARY:"), "SUMMARY:נוער א");
}
{
  const lines = sessionEvent({ ...session, type: "משחק בית" }, club, { dtstamp: "x", clubId: "c" });
  assert.ok(lines.some((l) => l === "SUMMARY:נוער א — משחק בית"), "a non-default type should be named");
}
assert.equal(sessionEvent({ ...session, start: "" }, club, { dtstamp: "x" }), null, "an event with no time is dropped, not exported broken");

// ---- The file as a whole ----
{
  const ics = buildIcs([session, { ...session, id: "s2", cancelled: true }], club, { now: NOW, clubId: "c" });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"), "CRLF is required, and some calendars reject the file without it");
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1,
    "a cancelled fixture must not be exported — a calendar cannot show it struck through, so it would read as still on");
  assert.ok(ics.includes("DTSTAMP:20260901T103000Z"));
}
{
  const empty = buildIcs([], club, { now: NOW });
  assert.equal(empty.match(/BEGIN:VEVENT/g), null, "an empty week is an empty calendar, not an error");
  assert.ok(empty.includes("BEGIN:VCALENDAR") && empty.includes("END:VCALENDAR"), "...and still a valid file");
}
assert.ok(buildIcs(null, club, { now: NOW }).includes("END:VCALENDAR"));

// ---- File name ----
assert.equal(icsFileName("אימונים — דנה", WEEK), "אימונים — דנה-2026-09-06.ics");
assert.equal(icsFileName('a/b:c*d?e"f<g>h|i', WEEK), "abcdefghi-2026-09-06.ics", "characters a filesystem refuses");
assert.equal(icsFileName("", WEEK), "אימונים-2026-09-06.ics");
assert.equal(icsFileName("   ", WEEK), "אימונים-2026-09-06.ics");

console.log("calendar: 41 assertions passed");
