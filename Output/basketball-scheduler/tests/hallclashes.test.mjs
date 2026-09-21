import assert from "node:assert/strict";
import { seasonHallClashes, clashesByDate, sessionDate } from "../src/utils/hallClashes.js";
import { findHallClashes, hallClashPairs } from "../src/utils/conflicts.js";

let count = 0;
const T = (name, fn) => { fn(); console.log("  ok  " + name); count++; };

// The real 15.10.2026 evening, as the app actually holds it: three HOME fixtures in
// רימונים, whose warm-up windows overlap. The federation published all three.
const W = "2026-10-11"; // Sunday
const data = {
  halls: [{ id: "h1", name: "רימונים" }, { id: "h2", name: "ברק" }],
  teams: [
    { id: "t1", name: "ילדים א מחוזית" },
    { id: "t2", name: "ילדים ב" },
    { id: "t3", name: "נערים א" },
  ],
  sessions: [
    { id: "a", teamId: "t2", hallId: "h1", day: "חמישי", start: "16:30", end: "18:30", weekOf: W, fromGame: true, type: "משחק בית" },
    { id: "b", teamId: "t1", hallId: "h1", day: "חמישי", start: "18:00", end: "20:00", weekOf: W, fromGame: true, type: "משחק בית" },
    { id: "c", teamId: "t1", hallId: "h1", day: "חמישי", start: "18:30", end: "20:30", weekOf: W, fromGame: true, type: "משחק בית" },
    // Same evening, DIFFERENT hall — not a clash.
    { id: "d", teamId: "t2", hallId: "h2", day: "חמישי", start: "18:30", end: "20:30", weekOf: W, fromGame: true, type: "משחק בית" },
    // Away fixtures carry no hall. Two of them are two buses, not a double booking.
    { id: "e", teamId: "t1", hallId: "", day: "חמישי", start: "18:30", end: "20:30", weekOf: W, fromGame: true, type: "משחק חוץ" },
    { id: "f", teamId: "t3", hallId: "", day: "חמישי", start: "18:30", end: "20:30", weekOf: W, fromGame: true, type: "משחק חוץ" },
  ],
};
const BEFORE = new Date("2026-10-01T09:00:00");

T("the date comes out of week + day, so a season can be grouped by it", () => {
  assert.equal(sessionDate({ weekOf: W, day: "חמישי" }), "2026-10-15");
  assert.equal(sessionDate({ weekOf: W, day: "ראשון" }), "2026-10-11");
  assert.equal(sessionDate({ day: "חמישי" }), "");
  assert.equal(sessionDate({ weekOf: W, day: "לא יום" }), "");
});

// THE CASE HE REPORTED.
T("15.10 in רימונים is reported — the overlapping pairs, and only those", () => {
  // Three fixtures, TWO pairs: 16:30-18:30 and 18:30-20:30 merely touch, and a hall that
  // empties at the moment the next team walks in is not double booked.
  const out = seasonHallClashes(data, { from: BEFORE });
  assert.equal(out.length, 2);
  assert.equal(out.every((c) => c.date === "2026-10-15" && c.hall === "רימונים"), true);
});

T("a different hall on the same evening is NOT a clash", () => {
  const out = seasonHallClashes(data, { from: BEFORE });
  assert.equal(out.some((c) => c.hall === "ברק"), false);
});

T("two AWAY fixtures at the same hour are not a double booking", () => {
  // They carry no hall. This is the thing that made a naive report useless: grouping
  // fixtures by an empty hallId puts the whole season in one bucket.
  const out = seasonHallClashes(data, { from: BEFORE });
  assert.equal(out.some((c) => c.rows.some((r) => r.label === "משחק חוץ")), false);
});

T("each pair names the hall, the teams and the two times, earliest first", () => {
  const out = seasonHallClashes(data, { from: BEFORE });
  const pair = out.find((c) => c.rows[0].start === "16:30");
  assert.equal(pair.hall, "רימונים");
  assert.equal(pair.day, "חמישי");
  assert.deepEqual(pair.rows.map((r) => r.team), ["ילדים ב", "ילדים א מחוזית"]);
  assert.deepEqual(pair.rows.map((r) => r.start), ["16:30", "18:00"]);
});

T("a training colliding with a fixture counts, and is named as a training", () => {
  // The same caretaker, the same gym, the same problem — and excluding it would report
  // half the clashes while looking complete.
  const withTraining = {
    ...data,
    sessions: [
      { id: "x", teamId: "t3", hallId: "h1", day: "שני", start: "17:00", end: "18:30", weekOf: W },
      { id: "y", teamId: "t1", hallId: "h1", day: "שני", start: "18:00", end: "20:00", weekOf: W, fromGame: true, type: "משחק בית" },
    ],
  };
  const out = seasonHallClashes(withTraining, { from: BEFORE });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].rows.map((r) => r.kind), ["training", "game"]);
  assert.equal(out[0].rows[0].label, "אימון");
});

// Found the moment this ran against the real season: 8 of the 41 "clashes" were one squad
// against ITSELF at identical hours — the same row twice, not a booking to move.
T("one squad against itself at the same hours is marked a duplicate, not a clash", () => {
  const dup = {
    ...data,
    sessions: [
      { id: "m", teamId: "t1", hallId: "h1", day: "שני", start: "17:45", end: "19:15", weekOf: W },
      { id: "n", teamId: "t1", hallId: "h1", day: "שני", start: "17:45", end: "19:15", weekOf: W },
    ],
  };
  const out = seasonHallClashes(dup, { from: BEFORE });
  assert.equal(out.length, 1);
  assert.equal(out[0].duplicate, true);
  assert.equal(out[0].sameTeam, true);
});

T("two DIFFERENT squads in one gym is a real clash, and says so", () => {
  const out = seasonHallClashes(data, { from: BEFORE });
  const real = out.find((c) => c.rows[0].team !== c.rows[1].team);
  assert.equal(real.sameTeam, false);
  assert.equal(real.duplicate, false);
});

T("the same squad at DIFFERENT hours is not called a duplicate", () => {
  // 18:00-20:00 and 18:30-20:30 for one squad is a real overlap worth looking at, but it
  // is not the same row twice — and treating it as one would hide it.
  const out = seasonHallClashes(data, { from: BEFORE });
  const overlap = out.find((c) => c.rows[0].start === "18:00");
  assert.equal(overlap.sameTeam, true);
  assert.equal(overlap.duplicate, false);
});

T("a CANCELLED row frees the hall", () => {
  const off = { ...data, sessions: data.sessions.map((s) => (s.id === "b" ? { ...s, cancelled: true } : s)) };
  const out = seasonHallClashes(off, { from: BEFORE });
  // 16:30-18:30 and 18:30-20:30 no longer overlap once the middle one is gone.
  assert.equal(out.length, 0);
});

T("past dates drop off — a manager can only move what has not happened", () => {
  assert.equal(seasonHallClashes(data, { from: new Date("2026-10-16T09:00:00") }).length, 0);
  assert.equal(seasonHallClashes(data, { from: new Date("2026-10-15T23:00:00") }).length, 2, "the day itself is still shown");
});

T("sorted by date, so the nearest problem is first", () => {
  const later = {
    ...data,
    sessions: [
      ...data.sessions,
      { id: "p", teamId: "t1", hallId: "h2", day: "שני", start: "17:00", end: "19:00", weekOf: "2026-11-08" },
      { id: "q", teamId: "t3", hallId: "h2", day: "שני", start: "18:00", end: "20:00", weekOf: "2026-11-08" },
    ],
  };
  const out = seasonHallClashes(later, { from: BEFORE });
  assert.equal(out[0].date, "2026-10-15");
  assert.equal(out[out.length - 1].date, "2026-11-09");
});

T("grouped by day, because that is how one evening gets dealt with", () => {
  const grouped = clashesByDate(seasonHallClashes(data, { from: BEFORE }));
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].date, "2026-10-15");
  assert.equal(grouped[0].items.length, 2);
});

// The board and the report must never disagree about a date.
T("the board's red rows and this report come from ONE rule", () => {
  const ids = findHallClashes(data.sessions);
  const fromPairs = new Set(hallClashPairs(data.sessions).flatMap(([a, b]) => [a.id, b.id]));
  assert.deepEqual([...ids].sort(), [...fromPairs].sort());
  assert.deepEqual([...ids].sort(), ["a", "b", "c"]);
});

T("nothing to report, and rubbish, both come back empty", () => {
  assert.deepEqual(seasonHallClashes({ halls: [], teams: [], sessions: [] }), []);
  assert.deepEqual(seasonHallClashes(null), []);
  assert.deepEqual(clashesByDate(null), []);
});

console.log(`\n${count} hall-clash tests passed`);
