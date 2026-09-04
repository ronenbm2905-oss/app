// The bus driver's name and phone number.
//
// The number belongs to someone who never gave it to us — the bus company did — and the
// club has one legitimate use for it: the coach travelling with the team rings the driver
// on the morning of the match. Everything here follows from that single sentence, and most
// of these assertions are about where the number must NOT appear.

import assert from "node:assert/strict";
import { driverLine, clearStaleDrivers, TRANSPORT_HEADERS, buildTransportRows, transportRowToCells } from "../src/utils/transport.js";
import { isPastGame } from "../src/utils/games.js";

const away = { federationCode: "1", teamId: "t1", isHome: false, date: "07-09-2026", time: "20:30", venue: "אולם רימונים", driverName: "משה", driverPhone: "050-1234567" };
const home = { ...away, federationCode: "2", isHome: true };

// ---- Quiet by default, and that default is the control ----
assert.equal(driverLine(away), "משה", "the default must not include the number");
assert.equal(driverLine(away, false), "משה");
assert.equal(driverLine(away, true), "משה · 050-1234567");
assert.equal(driverLine(home, true), "", "a home game has no bus and no driver");
assert.equal(driverLine(null, true), "");
assert.equal(driverLine({ isHome: false }, true), "", "nothing entered, nothing shown");
assert.equal(driverLine({ isHome: false, driverPhone: "050-1" }, true), "050-1", "a phone with no name still reaches the coach");
assert.equal(driverLine({ isHome: false, driverPhone: "050-1" }), "", "...but not without being asked for");
// The guard is the SECOND argument, so a call site that forgets it leaks nothing. This is
// the assertion that protects a call site nobody has written yet.
assert.equal(driverLine(away, undefined), "משה");

// ---- The number never reaches the transport sheet ----
//
// These are deliberately phrased as absences. An earlier version of this feature put the
// driver in two extra columns; the sheet goes to the BUS COMPANY, a week ahead, to order
// the coach — before any driver is assigned, and to the very party the number came from.
// A test that still confirmed the old behaviour would be worse than no test at all.
assert.equal(TRANSPORT_HEADERS.length, 12, "the sheet is twelve columns");
for (const h of TRANSPORT_HEADERS) {
  assert.ok(!h.includes("נהג"), `a driver column reappeared in the sheet: ${h}`);
}
{
  const rows = buildTransportRows([away], {
    teams: [{ id: "t1", name: "נוער א", coachId: "c1", vehicleType: "20" }],
    coaches: [{ id: "c1", name: "דנה", phone: "050-9999999" }],
    departBefore: 60,
    pickupPoint: "אולם הבית",
  });
  assert.equal(rows.length, 1, "the away game is on the sheet");
  const cells = transportRowToCells(rows[0]);
  assert.equal(cells.length, 12);
  const text = cells.join("|");
  assert.ok(!text.includes("050-1234567"), "the driver's phone reached the transport sheet");
  assert.ok(!text.includes("משה"), "the driver's name reached the transport sheet");
  // ...while the coach's own contact, which the sheet exists to carry, is still there.
  assert.ok(text.includes("050-9999999"), "the escorting coach's phone stopped reaching the sheet");
}

// ---- The number expires; the address does not ----
const day = (n) => `${String(n).padStart(2, "0")}-09-2026`;
const TODAY = new Date(2026, 8, 30); // 30 Sep 2026

assert.equal(isPastGame({ date: day(1) }, TODAY), true, "a month old");
assert.equal(isPastGame({ date: day(20) }, TODAY), false, "inside the fortnight's grace");
assert.equal(isPastGame({ date: "" }, TODAY), false, "an unreadable date is unknown, not past");
assert.equal(isPastGame(null, TODAY), false);

{
  const games = [
    { ...away, federationCode: "old", date: day(1) },
    { ...away, federationCode: "recent", date: day(25) },
    { federationCode: "none", date: day(1), addressOverride: "רחוב כלשהו 3" },
  ];
  const { games: next, cleared } = clearStaleDrivers(games, TODAY);
  assert.equal(cleared, 1);
  assert.equal(next[0].driverPhone, undefined, "a finished trip kept the driver's number");
  assert.equal(next[0].driverName, undefined);
  assert.equal(next[0].federationCode, "old", "the game itself must survive the clearing");
  assert.equal(next[1].driverPhone, "050-1234567", "an upcoming trip still needs its driver");
  // The address has no expiry — it is about a building, not about a person.
  assert.equal(next[2].addressOverride, "רחוב כלשהו 3");
  assert.equal(clearStaleDrivers([], TODAY).cleared, 0);
  assert.equal(clearStaleDrivers(null, TODAY).games.length, 0);
}

console.log("driver: 30 assertions passed");
