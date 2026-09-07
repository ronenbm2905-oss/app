import assert from "node:assert/strict";
import {
  TRANSPORT_HEADERS, buildTransportRows, transportRowToCells, awayGamesForWeek,
  assemblyTime, departBeforeOf, DEFAULT_DEPART_BEFORE, MAX_DEPART_BEFORE,
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

console.log("- the gathering time, shared by the vendor's sheet and the coach's board -");
t("counts back from tip-off, not from the warm-up", () =>
  // The SESSION starts at 19:30 (tip-off minus 30 for the warm-up). Measuring from that
  // would announce 18:00 for a bus that leaves at 18:30.
  assert.equal(assemblyTime({ isHome: false, time: "20:00" }, 90), "18:30"));
t("a home game has no bus", () =>
  assert.equal(assemblyTime({ isHome: true, time: "20:00" }, 90), ""));
t("a called-off game has no trip", () =>
  assert.equal(assemblyTime({ isHome: false, cancelled: true, time: "20:00" }, 90), ""));
t("a session with no game behind it says nothing", () =>
  assert.equal(assemblyTime(null, 90), ""));
t("a game with no time says nothing rather than guessing one", () =>
  assert.equal(assemblyTime({ isHome: false, time: "" }, 90), ""));
t("an early game wraps back over midnight instead of going negative", () =>
  assert.equal(assemblyTime({ isHome: false, time: "00:30" }, 90), "23:00"));
t("zero minutes means tip-off itself", () =>
  assert.equal(assemblyTime({ isHome: false, time: "20:00" }, 0), "20:00"));

t("the club's number is what both screens read", () =>
  assert.equal(departBeforeOf({ departBeforeMin: 60 }), 60));
t("0 is a real answer and not a missing one", () =>
  assert.equal(departBeforeOf({ departBeforeMin: 0 }), 0));
t("a document saved before the field existed falls back to the default", () => {
  assert.equal(departBeforeOf({}), DEFAULT_DEPART_BEFORE);
  assert.equal(departBeforeOf(undefined), DEFAULT_DEPART_BEFORE);
});
t("junk in the field does not become NaN on the coach's screen", () => {
  assert.equal(departBeforeOf({ departBeforeMin: "" }), DEFAULT_DEPART_BEFORE);
  assert.equal(departBeforeOf({ departBeforeMin: "abc" }), DEFAULT_DEPART_BEFORE);
  assert.equal(departBeforeOf({ departBeforeMin: -15 }), DEFAULT_DEPART_BEFORE);
});
t("a stored string number still works", () =>
  assert.equal(departBeforeOf({ departBeforeMin: "45" }), 45));
t("900 instead of 90 is capped, not shown as yesterday's time", () => {
  // timeMinus wraps backwards past midnight (the test above locks that on purpose), so an
  // uncapped 900 would print a time on the PREVIOUS day as a clean HH:MM with no date.
  assert.equal(departBeforeOf({ departBeforeMin: 900 }), MAX_DEPART_BEFORE);
  assert.equal(assemblyTime({ isHome: false, time: "20:00" }, departBeforeOf({ departBeforeMin: 900 })), "16:00");
});
t("the ceiling is applied to the stored value, not only to the input box", () =>
  // A second manager, an older client or a hand edit all write this field too.
  assert.equal(departBeforeOf({ departBeforeMin: "1440" }), MAX_DEPART_BEFORE));
t("the vendor's sheet and the coach's board agree by construction", () => {
  const g = { ...game, time: "20:00" };
  const [row] = buildTransportRows([g], { ...opts, departBefore: 75 });
  assert.equal(row.arriveTime, assemblyTime(g, 75));
  assert.equal(row.arriveTime, "18:45");
});

console.log("\n" + pass + " tests passed (incl. gate #7)");
