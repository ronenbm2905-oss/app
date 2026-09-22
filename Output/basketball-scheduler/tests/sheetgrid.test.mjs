import assert from "node:assert/strict";
import {
  cellText, columnLetter, trimGrid, gridFrom, gridBytes, buildSheet,
  toDoc, fromDoc, filterRows, setCell, sheetFileName, sheetToRows,
  MAX_ROWS, MAX_COLS, MAX_BYTES,
} from "../src/utils/sheetGrid.js";

let count = 0;
const T = (name, fn) => { fn(); console.log("  ok  " + name); count++; };

// Shaped like the sheet this was built for: the club's fixed hall slots, one row per slot.
const raw = [
  ["קבוצה", "יום", "שעה", "אולם"],
  ["נוער מחוזית", "ראשון", "20:30", "רימונים"],
  ["ילדים ב", "שני", "17:00", "ברק"],
];

T("a header row becomes the columns, and the rest are the rows", () => {
  const g = gridFrom(raw);
  assert.deepEqual(g.columns, ["קבוצה", "יום", "שעה", "אולם"]);
  assert.equal(g.rows.length, 2);
  assert.deepEqual(g.rows[0], ["נוער מחוזית", "ראשון", "20:30", "רימונים"]);
});

T("a sheet that starts straight into data keeps its first line", () => {
  // Losing row one to a header it never had is a silent loss — there is nothing on screen
  // afterwards to say a row went missing.
  const g = gridFrom(raw, { header: false });
  assert.equal(g.rows.length, 3);
  assert.deepEqual(g.columns, ["A", "B", "C", "D"]);
});

T("Excel's empty tail is dropped, in both directions", () => {
  // A four-column sheet routinely comes back 26 wide and a thousand deep because somebody
  // once clicked a cell down there.
  const padded = [
    ["קבוצה", "יום", "", "", ""],
    ["נוער", "ראשון", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
  ];
  const g = trimGrid(padded);
  assert.equal(g.length, 2, "trailing empty rows");
  assert.equal(g[0].length, 2, "trailing empty columns");
});

T("an empty cell INSIDE the sheet is kept — it is data", () => {
  const g = trimGrid([["א", "", "ג"], ["1", "2", "3"]]);
  assert.deepEqual(g[0], ["א", "", "ג"]);
});

T("ragged rows are squared off, so a column can be indexed", () => {
  // Excel ends a row at its last filled cell, so row 2 here is shorter than its header.
  const g = trimGrid([["א", "ב", "ג"], ["1"]]);
  assert.deepEqual(g[1], ["1", "", ""]);
  assert.equal(g[0].length, g[1].length);
});

T("numbers and dates arrive as text, because the grid is read and never calculated", () => {
  assert.equal(cellText(20.5), "20.5");
  assert.equal(cellText(new Date(2026, 8, 22)), "22/09/2026");
  assert.equal(cellText(null), "");
  assert.equal(cellText(undefined), "");
  assert.equal(cellText("  רימונים  "), "רימונים");
});

T("column letters run past Z the way Excel does", () => {
  assert.equal(columnLetter(0), "A");
  assert.equal(columnLetter(25), "Z");
  assert.equal(columnLetter(26), "AA");
  assert.equal(columnLetter(27), "AB");
  assert.equal(columnLetter(-1), "");
});

// ---------- building ----------

T("a built sheet carries who saved it and when", () => {
  const built = buildSheet({ id: "s1", name: "ברזלים", grid: gridFrom(raw), now: "2026-09-22T10:00:00.000Z", by: "רונן" });
  assert.equal(built.ok, true);
  assert.equal(built.sheet.name, "ברזלים");
  assert.equal(built.sheet.updatedBy, "רונן");
  assert.equal(built.sheet.rows.length, 2);
});

T("a nameless or empty sheet is refused, with a reason a person can act on", () => {
  assert.equal(buildSheet({ id: "s1", name: "", grid: gridFrom(raw) }).ok, false);
  const empty = buildSheet({ id: "s1", name: "ברזלים", grid: { columns: ["א"], rows: [] } });
  assert.equal(empty.ok, false);
  assert.match(empty.reason, /ריק/);
});

// THE FAILURE THIS GUARD EXISTS TO PREVENT. Firestore refuses a document over 1 MiB with an
// error no manager can read, AFTER the upload appears to have worked.
T("a sheet too big to store is refused at import, not at write", () => {
  const wide = { columns: Array.from({ length: MAX_COLS + 1 }, (_, i) => "c" + i), rows: [["1"]] };
  assert.match(buildSheet({ id: "s", name: "x", grid: wide }).reason, /רחב/);

  const tall = { columns: ["א"], rows: Array.from({ length: MAX_ROWS + 1 }, () => ["1"]) };
  assert.match(buildSheet({ id: "s", name: "x", grid: tall }).reason, /גדול/);

  // Under both counts and still over the byte ceiling — the case a row/column limit alone
  // would let through.
  const fat = { columns: ["א"], rows: Array.from({ length: 500 }, () => ["ר".repeat(2000)]) };
  const out = buildSheet({ id: "s", name: "x", grid: fat });
  assert.equal(out.ok, false);
  assert.match(out.reason, /כבד/);
});

T("the weight is counted in BYTES, not characters", () => {
  // The sheet is in Hebrew and every letter of it costs two. Counting characters would
  // report half the real size and let a sheet through that Firestore then rejects.
  const heb = gridBytes({ columns: [], rows: [["שלום"]] });
  const eng = gridBytes({ columns: [], rows: [["abcd"]] });
  assert.equal(heb > eng, true);
});

// ---------- the stored shape ----------

// THE CONSTRAINT THE WHOLE MODULE IS SHAPED AROUND.
T("no array is ever nested directly inside an array on the way out", () => {
  const doc = toDoc({ id: "s1", name: "ברזלים", ...gridFrom(raw), updatedAt: "x", updatedBy: "y" });
  assert.equal(Array.isArray(doc.rows), true);
  for (const row of doc.rows) {
    assert.equal(Array.isArray(row), false, "a row must be a map, not an array");
    assert.equal(Array.isArray(row.cells), true);
  }
});

T("a round trip through the stored shape changes nothing", () => {
  const sheet = { id: "s1", name: "ברזלים", ...gridFrom(raw), updatedAt: "2026-09-22", updatedBy: "רונן" };
  assert.deepEqual(fromDoc(toDoc(sheet)), sheet);
});

T("a document written by an older version still reads", () => {
  assert.deepEqual(fromDoc({}), { id: "", name: "", columns: [], rows: [], updatedAt: "", updatedBy: "" });
  assert.deepEqual(fromDoc({ rows: [{ cells: null }, {}] }).rows, [[], []]);
  assert.deepEqual(fromDoc(null).rows, []);
});

// ---------- reading it ----------

T("search matches every word ANYWHERE in the row, not a phrase in one cell", () => {
  // "רימונים ראשון" is two words from two different columns — which is how the question is
  // actually asked at the gym door.
  const sheet = { ...gridFrom(raw) };
  assert.deepEqual(filterRows(sheet, "רימונים ראשון").map((r) => r.index), [0]);
  assert.deepEqual(filterRows(sheet, "ברק").map((r) => r.index), [1]);
  assert.deepEqual(filterRows(sheet, "אין כזה"), []);
});

T("an empty search returns everything, with its original row numbers", () => {
  const sheet = { ...gridFrom(raw) };
  assert.deepEqual(filterRows(sheet, "").map((r) => r.index), [0, 1]);
  assert.deepEqual(filterRows(sheet, "   ").map((r) => r.index), [0, 1]);
});

// The row index has to survive the filter or editing a filtered row writes to the wrong one.
T("a filtered row remembers where it really is", () => {
  const sheet = { ...gridFrom(raw) };
  const hit = filterRows(sheet, "ילדים")[0];
  assert.equal(hit.index, 1);
  assert.deepEqual(setCell(sheet, hit.index, 3, "רימונים").rows[1][3], "רימונים");
  assert.deepEqual(setCell(sheet, hit.index, 3, "רימונים").rows[0], sheet.rows[0], "the other row is untouched");
});

T("editing a cell does not mutate the sheet it was given", () => {
  const sheet = { ...gridFrom(raw) };
  const before = JSON.stringify(sheet.rows);
  setCell(sheet, 0, 0, "אחר");
  assert.equal(JSON.stringify(sheet.rows), before);
});

T("editing past the end of a short row squares the grid instead of shearing it", () => {
  const sheet = { columns: ["א", "ב", "ג"], rows: [["1"], ["2"]] };
  const next = setCell(sheet, 0, 2, "x");
  assert.deepEqual(next.rows[0], ["1", "", "x"]);
  assert.deepEqual(next.rows[1], ["2", "", ""]);
});

T("editing a row that does not exist is a no-op, not a crash", () => {
  const sheet = { ...gridFrom(raw) };
  assert.equal(setCell(sheet, 99, 0, "x"), sheet);
  assert.equal(setCell(sheet, -1, 0, "x"), sheet);
});

// ---------- back out again ----------

T("what goes out re-imports as what came in", () => {
  // The app is not a place a sheet goes to get stuck.
  const sheet = gridFrom(raw);
  assert.deepEqual(gridFrom(sheetToRows(sheet)), sheet);
});

T("a file name cannot carry a path or a character Windows refuses", () => {
  assert.equal(sheetFileName("ברזלים"), "ברזלים.xlsx");
  assert.equal(sheetFileName("א/ב:ג"), "א-ב-ג.xlsx");
  assert.equal(sheetFileName(""), "גיליון.xlsx");
});

T("rubbish never throws", () => {
  assert.deepEqual(trimGrid(null), []);
  assert.deepEqual(trimGrid([null, undefined]), []);
  assert.deepEqual(gridFrom([]), { columns: [], rows: [] });
  assert.deepEqual(gridFrom(null), { columns: [], rows: [] });
  assert.deepEqual(filterRows(null, "x"), []);
  assert.equal(buildSheet({}).ok, false);
  assert.equal(typeof gridBytes(null), "number");
});

console.log(`\n${count} sheet-grid tests passed`);
assert.equal(MAX_BYTES < 1024 * 1024, true, "the ceiling must stay under Firestore's 1 MiB");
