import assert from "node:assert/strict";
import {
  TRANSPORT_HEADERS, buildTransportRows, transportRowToCells, awayGamesForWeek,
} from "../src/utils/transport.js";

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("  ok  " + name); };

const teams = [{ id: "t1", name: "נוער על", coachId: "c1", vehicleType: "20" }];
const coaches = [{ id: "c1", name: "מאמן א", phone: "050-1111111" }];
const game = {
  federationCode: "1", teamId: "t1", isHome: false, date: "09-09-2026", time: "20:00",
  opponent: "אליצור יבנה", venue: "היכל הספורט, יבנה",
};
const opts = { teams, coaches, departBefore: 90, pickupPoint: "הכפר 2, קרית אונו" };

console.log("- the schema stays in step -");
t("headers and cells are the same length", () => {
  const [row] = buildTransportRows([game], opts);
  assert.equal(transportRowToCells(row).length, TRANSPORT_HEADERS.length);
});
t("the sheet is back to its original 12 columns", () => {
  // The driver was briefly a column here. It came out again after gate #7: the sheet is
  // sent to the bus company, a week ahead, to ORDER the bus — before a driver exists — and
  // its recipient is the very party the number came from.
  assert.deepEqual(TRANSPORT_HEADERS, ["קבוצה", "יום", "תאריך", "שעה", "מארחת", "מיקום",
    "איש קשר", "טלפון", "שעת התייצבות", "נקודת איסוף", "איסוף חזרה", "סוג רכב"]);
});
t("no driver header sneaks back in", () =>
  assert.ok(!TRANSPORT_HEADERS.some((h) => h.includes("נהג"))));

console.log("- the driver never reaches the sheet -");
t("a driver on the game does NOT appear in any cell", () => {
  const g = { ...game, driverName: "משה", driverPhone: "052-2222222" };
  const cells = transportRowToCells(buildTransportRows([g], opts)[0]);
  assert.equal(cells.length, 12);
  assert.ok(!cells.some((c) => String(c).includes("052-2222222")), "the phone must not leave the building");
  assert.ok(!cells.some((c) => String(c).includes("משה")));
});
t("the row object itself carries no driver either", () => {
  const g = { ...game, driverName: "משה", driverPhone: "052-2222222" };
  const row = buildTransportRows([g], opts)[0];
  assert.equal(row.driverPhone, undefined);
  assert.equal(row.driverName, undefined);
});
t("the coach's phone is untouched by the change", () => {
  const cells = transportRowToCells(buildTransportRows([{ ...game, driverPhone: "052-2222222" }], opts)[0]);
  assert.equal(cells[6], "מאמן א");
  assert.equal(cells[7], "050-1111111");   // still the COACH, not the driver
});

console.log("- unchanged behaviour -");
t("gathering time is still tip-off minus departBefore", () => {
  const cells = transportRowToCells(buildTransportRows([game], opts)[0]);
  assert.equal(cells[8], "18:30");
});
t("home games are still excluded from the week", () =>
  assert.deepEqual(awayGamesForWeek([{ ...game, isHome: true }], "2026-09-06"), []));
t("cancelled games are still excluded", () =>
  assert.deepEqual(awayGamesForWeek([{ ...game, cancelled: true }], "2026-09-06"), []));
t("the away game of that week is picked up", () =>
  assert.equal(awayGamesForWeek([game], "2026-09-06").length, 1));

console.log("\n" + pass + " tests passed");

// ---- appended after Adi's gate #7 ----
const { driverLine, clearStaleDrivers } = await import(
  "../src/utils/transport.js"
);
const { isPastGame } = await import(
  "../src/utils/games.js"
);

console.log("- B2: the phone is silent by default -");
const drv = { ...game, driverName: "משה", driverPhone: "052-2222222" };
t("no second argument = NAME ONLY, never the number", () => {
  const line = driverLine(drv);
  assert.equal(line, "משה");
  assert.ok(!line.includes("052"), "a call site that forgot to think must not leak the phone");
});
t("asked explicitly = name and number", () =>
  assert.equal(driverLine(drv, true), "משה · 052-2222222"));
t("a home game has no driver line at all", () =>
  assert.equal(driverLine({ ...drv, isHome: true }, true), ""));
t("a game with no driver yields nothing to render", () =>
  assert.equal(driverLine(game, true), ""));
t("phone without a name still needs asking", () => {
  const g = { ...game, driverPhone: "052-2222222" };
  assert.equal(driverLine(g), "");
  assert.equal(driverLine(g, true), "052-2222222");
});
t("an array index as the flag cannot leak — index 0 is silent", () => {
  const mapped = [drv, drv].map((g, i) => driverLine(g, i));
  assert.ok(!mapped[0].includes("052"));
});

console.log("- M2: the number does not outlive the trip -");
const NOW = new Date("2026-10-01T00:00:00");
t("a game 20 days ago is past", () =>
  assert.equal(isPastGame({ date: "11-09-2026" }, NOW), true));
t("a game 3 days ago is inside the grace window", () =>
  assert.equal(isPastGame({ date: "28-09-2026" }, NOW), false));
t("a future game is never past", () =>
  assert.equal(isPastGame({ date: "20-10-2026" }, NOW), false));
t("an unreadable date is unknown, not past — never delete on a guess", () =>
  assert.equal(isPastGame({ date: "" }, NOW), false));
t("clearStaleDrivers strips only the finished trips", () => {
  const games = [
    { federationCode: "a", date: "11-09-2026", driverName: "משה", driverPhone: "052-1" },
    { federationCode: "b", date: "28-09-2026", driverName: "יוסי", driverPhone: "052-2" },
    { federationCode: "c", date: "20-10-2026", driverName: "דן", driverPhone: "052-3" },
  ];
  const { games: out, cleared } = clearStaleDrivers(games, NOW);
  assert.equal(cleared, 1);
  assert.equal(out[0].driverPhone, undefined);
  assert.equal(out[1].driverPhone, "052-2");
  assert.equal(out[2].driverPhone, "052-3");
});
t("clearStaleDrivers leaves games without a driver untouched", () => {
  const games = [{ federationCode: "a", date: "11-09-2026" }];
  const { cleared } = clearStaleDrivers(games, NOW);
  assert.equal(cleared, 0);
});

console.log("\n" + pass + " tests passed (incl. gate #7)");
