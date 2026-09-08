import assert from "node:assert/strict";
import {
  PLAYER_HEADERS, SIZES_HEADERS, birthText, sizesOf, missingSizes,
  playerRows, playerRowToCells, sizesRowToCells, playerSheetAoa, sizesSheetAoa,
} from "../src/utils/playerExport.js";

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("  ok  " + name); };

// Teams in the club's own hand-picked order, which the export has to keep.
const teams = [
  { id: "t1", name: "נערים א" },
  { id: "t2", name: "נערים ב" },
];
const players = [
  { id: "p1", teamId: "t2", name: "יונתן לוי", jerseyNumber: "9", phone: "050-1", birthDate: "07-04-2011", shirtSize: "M", pantsSize: "M", sweaterSize: "L" },
  { id: "p2", teamId: "t1", name: "דניאל כהן", jerseyNumber: "4", phone: "050-2", birthDate: "25-12-2010", shirtSize: "S", pantsSize: "S", sweaterSize: "S" },
  { id: "p3", teamId: "t1", name: "אורי מזרחי", jerseyNumber: "10", phone: "", birthDate: "", shirtSize: "M", pantsSize: "", sweaterSize: "" },
];

console.log("- the two files carry different things, and that is the point -");
t("the club's file has phone and date of birth; the order file does not", () => {
  const [row] = playerRows(players, teams);
  assert.equal(playerRowToCells(row).length, PLAYER_HEADERS.length);
  assert.equal(sizesRowToCells(row).length, SIZES_HEADERS.length);
  assert.ok(playerRowToCells(row).includes("050-2"));
  // A uniform vendor has no use for a child's phone number, and the safest field is the
  // one that was never in the file.
  assert.equal(sizesRowToCells(row).includes("050-2"), false);
  assert.equal(sizesRowToCells(row).some((c) => String(c).includes("2010")), false);
  assert.equal(SIZES_HEADERS.includes("טלפון"), false);
  assert.equal(SIZES_HEADERS.includes("תאריך לידה"), false);
});
t("a field added to the player record does not leak into either file", () => {
  const [row] = playerRows([{ teamId: "t1", name: "א", medicalNote: "סודי", parentEmail: "x@y.z" }], teams);
  assert.equal(playerRowToCells(row).includes("סודי"), false);
  assert.equal(playerRowToCells(row).includes("x@y.z"), false);
});

console.log("- order -");
t("by the club's team order, then shirt number, then name", () => {
  const rows = playerRows(players, teams);
  assert.deepEqual(rows.map((r) => r.name), ["דניאל כהן", "אורי מזרחי", "יונתן לוי"]);
  assert.deepEqual(rows.map((r) => r.team), ["נערים א", "נערים א", "נערים ב"]);
});
t("4 sorts before 10 — numerically, not as text", () => {
  const rows = playerRows(players, teams).filter((r) => r.team === "נערים א");
  assert.deepEqual(rows.map((r) => r.jersey), ["4", "10"]);
});
t("a player whose team was deleted sorts last and is still in the file", () => {
  const rows = playerRows([...players, { id: "p9", teamId: "gone", name: "נעלם" }], teams);
  assert.equal(rows[rows.length - 1].name, "נעלם");
  assert.equal(rows[rows.length - 1].team, "— ללא קבוצה —");
});

console.log("- the date -");
t("stored DD-MM-YYYY comes out as DD/MM/YYYY", () =>
  assert.equal(birthText("07-04-2011"), "07/04/2011"));
t("a missing or malformed date is empty, never 'undefined'", () => {
  assert.equal(birthText(""), "");
  assert.equal(birthText(undefined), "");
  assert.equal(birthText("2011"), "");
});

console.log("- who is still unmeasured -");
t("all three garments are needed before a player counts as measured", () => {
  assert.equal(missingSizes(players[0]), false);
  assert.equal(missingSizes(players[2]), true); // shirt only
  assert.equal(missingSizes({}), true);
  assert.deepEqual(sizesOf(players[2]), ["M", "", ""]);
});
t("the club's sheet counts them, and says nothing when there are none", () => {
  const withMissing = playerSheetAoa(playerRows(players, teams), "08/09/2026");
  assert.ok(withMissing[withMissing.length - 1][0].includes("1 מהם ללא מידות"));
  const complete = playerSheetAoa(playerRows([players[0], players[1]], teams), "08/09/2026");
  assert.equal(complete[complete.length - 1][0].includes("ללא מידות"), false);
});
t("the order sheet says it either way — a missing line reads the same as an unchecked one", () => {
  const a = sizesSheetAoa(playerRows(players, teams), "08/09/2026");
  assert.ok(a[a.length - 1][0].includes("1 שחקנים ללא מידות"));
  const b = sizesSheetAoa(playerRows([players[0], players[1]], teams), "08/09/2026");
  assert.ok(b[b.length - 1][0].includes("לכל השחקנים יש מידות מלאות"));
});

console.log("- the club's sheet says what it holds -");
t("title, warning, headers, rows, total", () => {
  const rows = playerRows(players, teams);
  const aoa = playerSheetAoa(rows, "08/09/2026");
  assert.ok(aoa[0][0].includes("08/09/2026"));
  assert.ok(aoa[1][0].includes("קטינים"));
  assert.ok(aoa[1][0].includes("אין להעביר לצד שלישי"));
  assert.deepEqual(aoa[3], PLAYER_HEADERS);
  assert.deepEqual(aoa[4], ["נערים א", "4", "דניאל כהן", "050-2", "25/12/2010", "S", "S", "S"]);
});
t("no players, no throw", () => {
  assert.deepEqual(playerRows([], teams), []);
  assert.deepEqual(playerRows(null, null), []);
});

console.log("\n" + pass + " tests passed");
