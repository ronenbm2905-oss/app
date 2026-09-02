// The monthly hours report. This is the number the club settles wages against, so the
// rules it follows are asserted here rather than read off the screen.
import assert from "node:assert/strict";
import {
  HOURS_PER_UNIT, EXCLUDED_TYPES, excludedLabel, countsToward, monthOfSession,
  hoursRows, hoursTotals, fmtHours, HOURS_HEADERS, hoursRowToCells, hoursSheetAoa,
} from "../src/utils/hoursReport.js";

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("  ok  " + name); };

const coaches = [
  { id: "c1", name: "שון קמינר" },
  { id: "c2", name: "טל ברוך" },
  { id: "c3", name: "מוקט" },
  { id: "c4", name: "לא אימן החודש" },
];
// Week of Sunday 2026-08-30 — it straddles the month end: ראשון is 30/08, רביעי is 02/09.
const W1 = "2026-08-30";
const W2 = "2026-09-06";
const W3 = "2026-09-13";
const s = (id, coachId, weekOf, day, type = "אימון") =>
  ({ id, coachId, hallId: "h1", teamId: "t1", weekOf, day, start: "16:00", end: "17:30", type });

console.log("- what counts -");
t("a plain training counts", () => assert.equal(countsToward(s("x", "c1", W2, "שני")), true));
t("the three excluded types do not", () =>
  EXCLUDED_TYPES.forEach((type) => assert.equal(countsToward(s("x", "c1", W2, "שני", type)), false)));
t("games DO count — they are hours the coach worked", () => {
  assert.equal(countsToward(s("x", "c1", W2, "שני", "משחק בית")), true);
  assert.equal(countsToward(s("x", "c1", W2, "שני", "משחק חוץ")), true);
});
t("the on-screen note is built from the list, so it cannot drift", () =>
  EXCLUDED_TYPES.forEach((type) => assert.ok(excludedLabel.includes(type))));

console.log("- THE RULE RONEN ASKED ABOUT: an excluded session credits nobody -");
t("a ספורטתרפיה session recorded against the team's own coach is not counted for him", () => {
  // This is the real shape in production: 3 ספורטתרפיה sessions sit on a regular coach's
  // id, and 8 more חד"כ/יורם sessions on eight others. None may reach their hours.
  const data = { coaches, sessions: [
    s("a", "c1", W2, "שני"),
    s("b", "c1", W2, "שלישי", "ספורטתרפיה"),
    s("c", "c1", W2, "רביעי", 'חד"כ'),
    s("d", "c1", W2, "חמישי", "יורם"),
  ] };
  const [row] = hoursRows(data, "2026-09");
  assert.equal(row.units, 1, "only the real training counted");
  assert.equal(row.hours, 1.5);
  assert.equal(row.days, 1);
});
t("and it is not silently moved to somebody else either", () => {
  const data = { coaches, sessions: [s("b", "c1", W2, "שלישי", "ספורטתרפיה")] };
  assert.deepEqual(hoursRows(data, "2026-09"), [], "an excluded session creates no row at all");
});
t("a coach whose own sessions are all excluded drops out of the report", () => {
  const data = { coaches, sessions: [s("a", "c3", W2, "שני", 'חד"כ'), s("b", "c3", W2, "שלישי", 'חד"כ')] };
  assert.equal(hoursRows(data, "2026-09").length, 0);
});
t("but a plain training for מוקט DOES count for מוקט — that was Ronen's call", () => {
  const data = { coaches, sessions: [s("a", "c3", W2, "שני"), s("b", "c3", W2, "שלישי", 'חד"כ')] };
  const rows = hoursRows(data, "2026-09");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "מוקט");
  assert.equal(rows[0].units, 1);
});

console.log("- ימי אימון: distinct DATES, not sessions -");
t("three groups on one afternoon are one day and three units", () => {
  const data = { coaches, sessions: [
    { ...s("a", "c1", W2, "שני"), start: "15:00", end: "16:30" },
    { ...s("b", "c1", W2, "שני"), start: "16:30", end: "18:00" },
    { ...s("c", "c1", W2, "שני"), start: "18:00", end: "19:30" },
  ] };
  const [row] = hoursRows(data, "2026-09");
  assert.equal(row.days, 1, "one afternoon is one day");
  assert.equal(row.units, 3);
  assert.equal(row.hours, 4.5);
});
t("the same weekday in two different weeks is two days", () => {
  // Both Mondays have to be in the SAME month for this to be about weeks — W1's Monday is
  // 31 August, which is a different month and would make this test pass for the wrong
  // reason. W2 and W3 are the 7th and the 14th of September.
  const data = { coaches, sessions: [s("a", "c1", W2, "שני"), s("b", "c1", W3, "שני")] };
  assert.equal(hoursRows(data, "2026-09")[0].days, 2);
});
t("days never exceed units", () => {
  const data = { coaches, sessions: [s("a", "c1", W2, "שני"), s("b", "c1", W2, "שני"), s("c", "c1", W2, "רביעי")] };
  const [row] = hoursRows(data, "2026-09");
  assert.ok(row.days <= row.units);
  assert.equal(row.days, 2);
});
t("an excluded session does not add a day either", () => {
  const data = { coaches, sessions: [s("a", "c1", W2, "שני"), s("b", "c1", W2, "רביעי", 'חד"כ')] };
  assert.equal(hoursRows(data, "2026-09")[0].days, 1);
});

console.log("- the month a session belongs to is its real DATE, not its week -");
t("a week that straddles the month end splits between the two months", () => {
  // W1 is Sunday 30 August. ראשון falls in August; רביעי falls on 2 September. Reading the
  // month off `weekOf` would file the whole week under August and quietly overpay it.
  assert.equal(monthOfSession(s("a", "c1", W1, "ראשון")), "2026-08");
  assert.equal(monthOfSession(s("b", "c1", W1, "רביעי")), "2026-09");
  const data = { coaches, sessions: [s("a", "c1", W1, "ראשון"), s("b", "c1", W1, "רביעי")] };
  assert.equal(hoursRows(data, "2026-08")[0].units, 1);
  assert.equal(hoursRows(data, "2026-09")[0].units, 1);
});
t("a session with no week, or an unknown day, belongs to no month", () => {
  assert.equal(monthOfSession({ coachId: "c1", day: "שני" }), "");
  assert.equal(monthOfSession({ coachId: "c1", weekOf: W2, day: "יום כיף" }), "");
  assert.equal(monthOfSession(null), "");
});
t("a monthless session is counted nowhere rather than somewhere", () => {
  const data = { coaches, sessions: [{ id: "a", coachId: "c1", day: "שני", type: "אימון" }] };
  assert.deepEqual(hoursRows(data, "2026-09"), []);
});

console.log("- rows and order -");
t("only coaches who worked appear, busiest first", () => {
  const data = { coaches, sessions: [
    s("a", "c2", W2, "שני"), s("b", "c1", W2, "שני"), s("c", "c1", W2, "שלישי"),
  ] };
  assert.deepEqual(hoursRows(data, "2026-09").map((r) => r.name), ["שון קמינר", "טל ברוך"]);
});
t("a tie is broken by name in Hebrew, so the order is stable between runs", () => {
  const data = { coaches, sessions: [s("a", "c2", W2, "שני"), s("b", "c1", W2, "שני")] };
  assert.deepEqual(hoursRows(data, "2026-09").map((r) => r.name), ["טל ברוך", "שון קמינר"]);
});
t("no month, no data, no crash", () => {
  assert.deepEqual(hoursRows({ coaches, sessions: [] }, "2026-09"), []);
  assert.deepEqual(hoursRows(null, "2026-09"), []);
  assert.deepEqual(hoursRows({ coaches, sessions: [] }, ""), []);
});

console.log("- totals, and the two different day-counts -");
const twoCoaches = { coaches, sessions: [
  s("a", "c1", W2, "שני"), s("b", "c1", W2, "רביעי"),
  s("c", "c2", W2, "שני"), s("d", "c2", W2, "חמישי"),
] };
t("units and hours add up", () => {
  const rows = hoursRows(twoCoaches, "2026-09");
  const tot = hoursTotals(rows, twoCoaches, "2026-09");
  assert.equal(tot.units, 4);
  assert.equal(tot.hours, 6);
  assert.equal(tot.hours, tot.units * HOURS_PER_UNIT);
});
t("THE TWO DAY NUMBERS ARE DIFFERENT, and both are right", () => {
  // Both coaches worked Monday. That is 2 coach-days and 1 club day, and a report that
  // conflated them would claim the club trained on more days than it did.
  const rows = hoursRows(twoCoaches, "2026-09");
  const tot = hoursTotals(rows, twoCoaches, "2026-09");
  assert.equal(tot.days, 4, "sum of the coaches' own days");
  assert.equal(tot.clubDays, 3, "Monday, Wednesday, Thursday — Monday counted once");
});
t("clubDays ignores excluded sessions too", () => {
  const data = { coaches, sessions: [s("a", "c1", W2, "שני"), s("b", "c2", W2, "שישי", 'חד"כ')] };
  assert.equal(hoursTotals(hoursRows(data, "2026-09"), data, "2026-09").clubDays, 1);
});

console.log("- formatting and the sheet -");
t("whole hours stay whole, halves keep their half", () => {
  assert.equal(fmtHours(12), "12");
  assert.equal(fmtHours(12.5), "12.5");
  assert.equal(fmtHours(0), "0");
  assert.equal(fmtHours(undefined), "0");
});
t("the sheet's columns are the screen's columns, in the same order", () => {
  assert.deepEqual(HOURS_HEADERS, ["מאמן", "ימי אימון", "יחידות אימון", 'סה"כ שעות']);
  assert.deepEqual(hoursRowToCells({ name: "טל", days: 3, units: 5, hours: 7.5 }), ["טל", 3, 5, 7.5]);
});
t("the workbook carries a totals row and says which month it is", () => {
  const rows = hoursRows(twoCoaches, "2026-09");
  const tot = hoursTotals(rows, twoCoaches, "2026-09");
  const aoa = hoursSheetAoa(rows, tot, "ספטמבר 2026");
  assert.deepEqual(aoa[0], HOURS_HEADERS);
  assert.equal(aoa.length, rows.length + 6, "header + rows + total + blank + three notes");
  const totalRow = aoa[rows.length + 1];
  assert.equal(totalRow[0], 'סה"כ');
  assert.equal(totalRow[3], 6);
  assert.ok(aoa.flat().join(" ").includes("ספטמבר 2026"), "the sheet must name its month");
  assert.ok(aoa.flat().join(" ").includes("נספר יום אחד"), "and explain what a day means");
});
t("numbers reach Excel as numbers, not as strings", () => {
  // A column of text right-aligns and will not sum. For a payroll sheet that is the
  // difference between a file you can total and a file you have to retype.
  const cells = hoursRowToCells({ name: "טל", days: 3, units: 5, hours: 7.5 });
  cells.slice(1).forEach((c) => assert.equal(typeof c, "number"));
});

console.log("\n" + pass + " tests passed");
