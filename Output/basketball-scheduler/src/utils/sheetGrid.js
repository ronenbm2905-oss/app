// A spreadsheet the manager keeps for himself — the hall-slot sheet ("ברזלים") and anything
// else of that shape — stored as data rather than as a file.
//
// THE APP HOLDS NO FILES. There is no Cloud Storage bucket, no `storage.rules`, no line of
// code that keeps bytes. Excel has only ever entered here as rows to read and then discard:
// the player import, the federation fixture file, the cup pages. This keeps that
// arrangement — the workbook is opened in the browser, the grid is what gets saved, and the
// file itself is thrown away. Nothing new is switched on to make it work.
//
// FIRESTORE CANNOT PUT AN ARRAY INSIDE AN ARRAY, so a grid — the obvious array of rows —
// has no direct representation. Each row travels wrapped in a map. `toDoc` and `fromDoc`
// are the only two functions that know that; everything else works on a plain array of
// arrays, which is what a grid is.

// Guard rails, not preferences. The club document is already metered against the 1 MiB
// ceiling, and while a sheet lives in its own document it has the same ceiling. A sheet
// that cannot be saved must be refused at import with a number the manager can act on,
// not fail on write with a Firestore error nobody can read.
export const MAX_ROWS = 2000;
export const MAX_COLS = 60;
export const MAX_BYTES = 700 * 1024;

const str = (v) => (v === null || v === undefined ? "" : String(v));

// Excel hands back numbers, dates and formula results, not only text. Everything becomes a
// string on the way in: this grid is read, searched and printed, never calculated with, and
// a column of mixed types is a column that sorts and filters by surprise.
export function cellText(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const p = (n) => String(n).padStart(2, "0");
    return `${p(value.getDate())}/${p(value.getMonth() + 1)}/${value.getFullYear()}`;
  }
  return String(value).trim();
}

const rowIsEmpty = (row) => !(row || []).some((c) => cellText(c) !== "");

// A real worksheet is mostly empty. Excel reports the used range generously — a sheet with
// four columns of content routinely comes back 26 wide and a thousand deep, because someone
// once clicked a cell down there. Saving that is saving nothing, expensively.
export function trimGrid(rows) {
  const grid = (Array.isArray(rows) ? rows : []).map((r) => (Array.isArray(r) ? r.map(cellText) : []));
  let last = -1;
  grid.forEach((r, i) => { if (!rowIsEmpty(r)) last = i; });
  const kept = grid.slice(0, last + 1);
  let width = 0;
  for (const r of kept) {
    for (let c = r.length - 1; c >= 0; c--) {
      if (r[c] !== "") { width = Math.max(width, c + 1); break; }
    }
  }
  // Ragged rows are normal — Excel stops a row at its last filled cell. Padding them here
  // means every consumer can index a column without checking it exists.
  return kept.map((r) => Array.from({ length: width }, (_, c) => r[c] || ""));
}

// The first row is a header far more often than not, so that is the default — but it is
// offered as a choice at import, because a sheet that starts straight into data would
// otherwise lose its first line to the header and there would be no way to tell.
export function gridFrom(rawRows, { header = true } = {}) {
  const grid = trimGrid(rawRows);
  if (grid.length === 0) return { columns: [], rows: [] };
  if (!header) {
    // Column letters, as Excel shows them, so the table still has something to head it.
    const width = grid[0].length;
    return { columns: Array.from({ length: width }, (_, i) => columnLetter(i)), rows: grid };
  }
  return { columns: grid[0], rows: grid.slice(1) };
}

export function columnLetter(index) {
  let n = Number(index);
  if (!Number.isFinite(n) || n < 0) return "";
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

// What the document will weigh. Measured in UTF-8 bytes rather than characters, because
// this sheet is in Hebrew and every letter of it costs two.
export function gridBytes(grid) {
  const json = JSON.stringify({ columns: grid?.columns || [], rows: grid?.rows || [] });
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(json).length;
  return Buffer.byteLength(json, "utf8");
}

export function buildSheet({ id, name, grid, now, by }) {
  const columns = (grid?.columns || []).map(cellText);
  const rows = (grid?.rows || []).map((r) => (Array.isArray(r) ? r.map(cellText) : []));
  const title = cellText(name);
  if (!title) return { ok: false, reason: "לגיליון חייב להיות שם." };
  if (rows.length === 0) return { ok: false, reason: "הגיליון ריק — לא נמצאו שורות עם תוכן." };
  if (rows.length > MAX_ROWS) return { ok: false, reason: `הגיליון גדול מדי: ${rows.length} שורות, המקסימום הוא ${MAX_ROWS}.` };
  if (columns.length > MAX_COLS) return { ok: false, reason: `הגיליון רחב מדי: ${columns.length} עמודות, המקסימום הוא ${MAX_COLS}.` };
  const sheet = {
    id: str(id),
    name: title,
    columns,
    rows,
    updatedAt: now || new Date().toISOString(),
    updatedBy: cellText(by),
  };
  const bytes = gridBytes(sheet);
  if (bytes > MAX_BYTES) {
    return { ok: false, reason: `הגיליון כבד מדי: ${Math.round(bytes / 1024)} KB, המקסימום הוא ${Math.round(MAX_BYTES / 1024)} KB.` };
  }
  return { ok: true, sheet, bytes };
}

// ---------- the stored shape ----------
//
// Nothing outside these two functions may assume it. See the note at the top: an array of
// arrays is not a thing Firestore can hold.
export function toDoc(sheet) {
  return {
    id: str(sheet?.id),
    name: str(sheet?.name),
    columns: (sheet?.columns || []).map(str),
    rows: (sheet?.rows || []).map((cells) => ({ cells: (cells || []).map(str) })),
    updatedAt: str(sheet?.updatedAt),
    updatedBy: str(sheet?.updatedBy),
  };
}

export function fromDoc(doc) {
  return {
    id: str(doc?.id),
    name: str(doc?.name),
    columns: (doc?.columns || []).map(str),
    rows: (doc?.rows || []).map((r) => (Array.isArray(r?.cells) ? r.cells.map(str) : [])),
    updatedAt: str(doc?.updatedAt),
    updatedBy: str(doc?.updatedBy),
  };
}

// ---------- reading it on a phone ----------

// Free-text search across the whole row. The manager's question at the gym door is "what do
// we have at רימונים on Monday" — three words from three different columns — so this
// matches every word somewhere in the row rather than the phrase in one cell.
export function filterRows(sheet, query) {
  const terms = cellText(query).toLowerCase().split(/\s+/).filter(Boolean);
  const rows = sheet?.rows || [];
  if (terms.length === 0) return rows.map((cells, i) => ({ cells, index: i }));
  return rows
    .map((cells, i) => ({ cells, index: i }))
    .filter(({ cells }) => {
      const hay = cells.join(" ").toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
}

// Immutable, and it keeps the grid rectangular — editing a cell past the end of a short row
// would otherwise leave a row narrower than its header and the table would shear.
export function setCell(sheet, rowIndex, colIndex, value) {
  const rows = sheet?.rows || [];
  if (rowIndex < 0 || rowIndex >= rows.length) return sheet;
  const width = Math.max((sheet?.columns || []).length, ...rows.map((r) => r.length), colIndex + 1);
  const next = rows.map((cells, i) => {
    const padded = Array.from({ length: width }, (_, c) => cells[c] || "");
    return i === rowIndex ? padded.map((cell, c) => (c === colIndex ? cellText(value) : cell)) : padded;
  });
  return { ...sheet, rows: next };
}

export function sheetFileName(name) {
  const clean = cellText(name).replace(/[\\/:*?"<>|]/g, "-").trim() || "גיליון";
  return `${clean}.xlsx`;
}

// Header row first, so a sheet exported out of here re-imports as the same sheet. The app
// is not a place data goes to get stuck.
export function sheetToRows(sheet) {
  return [(sheet?.columns || []).map(str), ...(sheet?.rows || []).map((r) => (r || []).map(str))];
}
