import assert from "node:assert/strict";
import {
  COACH_HEADERS, birthDateText, coachRows, coachRowToCells, coachSheetAoa,
} from "../src/utils/coachExport.js";

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("  ok  " + name); };

const coaches = [
  { id: "c2", name: "רונן בן מאיר", email: "Ronen@Club.IL", phone: "050-1111111", birthDate: "1979-04-07" },
  { id: "c1", name: "אסף יוגב", email: "asaf@club.il", phone: "052-2222222", birthDate: "1990-12-25" },
  { id: "c3", name: "עידו ברגמן" }, // everything optional is missing
];

console.log("- the columns stay closed -");
t("four columns, and the cells line up with them", () => {
  const [row] = coachRows(coaches);
  assert.equal(coachRowToCells(row).length, COACH_HEADERS.length);
  assert.deepEqual(COACH_HEADERS, ["שם", 'דוא"ל', "טלפון", "תאריך לידה"]);
});
t("a field added to the coach record does not leak into the file", () => {
  // The reason coachRows builds an object instead of spreading one: parallel groups today,
  // something else next season, into a file the manager stopped reading closely.
  const [row] = coachRows([{ name: "א", email: "a@b.c", phone: "1", birthDate: "2000-01-01", salary: 9999, parallelGroups: 3 }]);
  assert.deepEqual(Object.keys(row), ["name", "email", "phone", "birthDate"]);
  assert.equal(coachRowToCells(row).includes(9999), false);
});

console.log("- the date -");
t("stored YYYY-MM-DD comes out as DD/MM/YYYY", () =>
  assert.equal(birthDateText("1990-12-25"), "25/12/1990"));
t("a missing or malformed date is empty, never 'undefined' or NaN", () => {
  assert.equal(birthDateText(""), "");
  assert.equal(birthDateText(undefined), "");
  assert.equal(birthDateText("1990"), "");
  assert.equal(birthDateText("25/12/1990"), "");
});

console.log("- the rows -");
t("sorted by name, not by entry order", () => {
  const names = coachRows(coaches).map((r) => r.name);
  assert.deepEqual(names, ["אסף יוגב", "עידו ברגמן", "רונן בן מאיר"]);
});
t("a coach with nothing filled in still gets a row, with empty cells", () => {
  const row = coachRows(coaches).find((r) => r.name === "עידו ברגמן");
  assert.deepEqual(coachRowToCells(row), ["עידו ברגמן", "", "", ""]);
});
t("the address is written as it was stored — this file is read by a person, not matched", () =>
  // coachIdentity lower-cases for MATCHING. Here, rewriting what the manager typed would
  // make the file disagree with the screen it came from.
  assert.equal(coachRows(coaches).find((r) => r.name === "רונן בן מאיר").email, "Ronen@Club.IL"));
t("no coaches, no throw", () => {
  assert.deepEqual(coachRows([]), []);
  assert.deepEqual(coachRows(null), []);
});

console.log("- the sheet says what it is -");
t("a title row, a warning row, headers, the rows, and a total", () => {
  const rows = coachRows(coaches);
  const aoa = coachSheetAoa(rows, "07/09/2026");
  assert.equal(aoa.length, rows.length + 6);
  assert.ok(aoa[0][0].includes("07/09/2026"));
  // Not decoration: a sheet of personal details with no header explaining itself is the
  // one that gets forwarded once and lives in a downloads folder for a year.
  assert.ok(aoa[1][0].includes("פרטים אישיים"));
  assert.ok(aoa[1][0].includes("הנהלת המועדון בלבד"));
  assert.deepEqual(aoa[3], COACH_HEADERS);
  assert.deepEqual(aoa[4], ["אסף יוגב", "asaf@club.il", "052-2222222", "25/12/1990"]);
  assert.ok(aoa[aoa.length - 1][0].includes("3 מאמנים"));
});

console.log("\n" + pass + " tests passed");
