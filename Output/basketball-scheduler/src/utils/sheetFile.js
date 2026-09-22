import * as XLSX from "xlsx";
import { sheetToRows, sheetFileName } from "./sheetGrid";

// The thin layer that touches Excel. Everything that decides anything lives in
// `sheetGrid.js`, which is pure and runs under Node in the tests; this file only turns a
// File into rows and rows back into a file, and has nothing to assert about.

// `raw: false` asks SheetJS for the formatted text rather than the underlying value, so a
// date reads as the date the manager typed and a time as "17:00" instead of 0.708333. The
// grid is displayed, never calculated with — the format IS the data here.
// `defval: ""` keeps blank cells in place, so a row does not silently shift left where a
// column happens to be empty.
const SHEET_OPTS = { header: 1, raw: false, defval: "" };

export async function readWorkbook(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const names = wb.SheetNames || [];
  const rows = {};
  for (const name of names) {
    rows[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], SHEET_OPTS);
  }
  return { names, rows };
}

// Out again, in a form that re-imports as the same sheet. A tool that can only swallow is
// a tool the club cannot leave, and that is not what this is.
export function downloadSheet(sheet) {
  const ws = XLSX.utils.aoa_to_sheet(sheetToRows(sheet));
  const wb = XLSX.utils.book_new();
  // Excel refuses a tab name over 31 characters or containing any of : \ / ? * [ ].
  const tab = String(sheet?.name || "גיליון").replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "גיליון";
  XLSX.utils.book_append_sheet(wb, ws, tab);
  XLSX.writeFile(wb, sheetFileName(sheet?.name));
}
