import * as XLSX from "xlsx";
import { sortByName } from "./names.js";

// The player list as a file — and deliberately as TWO files, because they go to two places.
//
// The club's own list carries what the roster screen carries: phone and date of birth
// included. The order list carries a name, a shirt number and three sizes, and nothing
// else. Both are "the players", and one of them is the one that gets sent to a supplier —
// so it is built as its own thing rather than left to whoever is in a hurry to delete four
// columns first. These are minors: a phone number is not a detail a uniform vendor needs,
// and the safest field is the one that was never in the file.
export const PLAYER_HEADERS = [
  "קבוצה", "מספר", "שם", "טלפון", "תאריך לידה", "חולצה", "מכנס", "פוטר",
];
export const SIZES_HEADERS = ["קבוצה", "מספר", "שם", "חולצה", "מכנס", "פוטר"];

const str = (v) => String(v ?? "").trim();

// Stored as DD-MM-YYYY (the Excel import's format); written as DD/MM/YYYY. Text, not a
// date: this column is read, never summed, and Excel would reformat it per locale.
export function birthText(stored) {
  const p = str(stored).split("-");
  return p.length === 3 && p[0] && p[1] && p[2] ? `${p[0]}/${p[1]}/${p[2]}` : "";
}

// The three garments, in the order the club orders them.
export function sizesOf(player) {
  return [str(player?.shirtSize), str(player?.pantsSize), str(player?.sweaterSize)];
}

// A player nobody has measured yet. The whole point of the export is that it happens AFTER
// the sizes are collected, so "who is still missing" is the question the file has to answer
// — not something to be discovered by the supplier.
export function missingSizes(player) {
  return sizesOf(player).some((s) => s === "");
}

// Ordered by team as the manager arranged them, then by shirt number, then by name.
// `teams` comes in already in the club's own order; a team not in the list sorts last
// rather than vanishing, because a player attached to a deleted team is exactly the row
// somebody needs to see.
export function playerRows(players, teams) {
  const order = new Map((teams || []).map((t, i) => [t.id, i]));
  const nameOf = new Map((teams || []).map((t) => [t.id, t.name]));
  return sortByName(players || [])
    .map((p) => ({
      team: nameOf.get(p?.teamId) || "— ללא קבוצה —",
      teamIdx: order.has(p?.teamId) ? order.get(p.teamId) : 9999,
      jersey: str(p?.jerseyNumber),
      name: str(p?.name),
      phone: str(p?.phone),
      birthDate: birthText(p?.birthDate),
      sizes: sizesOf(p),
      missing: missingSizes(p),
    }))
    .sort(
      (a, b) =>
        a.teamIdx - b.teamIdx ||
        (Number(a.jersey) || 999) - (Number(b.jersey) || 999) ||
        a.name.localeCompare(b.name, "he")
    );
}

export function playerRowToCells(row) {
  return [row.team, row.jersey, row.name, row.phone, row.birthDate, ...row.sizes];
}
export function sizesRowToCells(row) {
  return [row.team, row.jersey, row.name, ...row.sizes];
}

export function playerSheetAoa(rows, dateText) {
  const missing = rows.filter((r) => r.missing).length;
  return [
    [`רשימת שחקנים — קרית אונו – דור העתיד · ${dateText}`],
    ["הקובץ מכיל פרטים אישיים של קטינים. לשימוש הנהלת המועדון בלבד — אין להעביר לצד שלישי."],
    [],
    PLAYER_HEADERS,
    ...rows.map(playerRowToCells),
    [],
    [`סה"כ ${rows.length} שחקנים`],
    ...(missing > 0 ? [[`${missing} מהם ללא מידות מלאות`]] : []),
  ];
}

export function sizesSheetAoa(rows, dateText) {
  const missing = rows.filter((r) => r.missing).length;
  return [
    [`הזמנת מדים — קרית אונו – דור העתיד · ${dateText}`],
    [],
    SIZES_HEADERS,
    ...rows.map(sizesRowToCells),
    [],
    [`סה"כ ${rows.length} שחקנים`],
    // Printed even when it is zero, because "no line" and "nobody checked" look the same.
    [missing > 0 ? `שים לב: ${missing} שחקנים ללא מידות מלאות` : "לכל השחקנים יש מידות מלאות"],
  ];
}

function todayParts(today) {
  const iso = today.toISOString().slice(0, 10);
  const [y, m, d] = iso.split("-");
  return { iso, text: `${d}/${m}/${y}` };
}

function write(aoa, cols, sheet, file) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = cols;
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] }; // Excel opens the sheet right-to-left
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, file);
}

export function exportPlayersXlsx(players, teams, today = new Date()) {
  const rows = playerRows(players, teams);
  const { iso, text } = todayParts(today);
  write(
    playerSheetAoa(rows, text),
    [{ wch: 18 }, { wch: 7 }, { wch: 22 }, { wch: 15 }, { wch: 13 }, { wch: 9 }, { wch: 9 }, { wch: 9 }],
    "שחקנים",
    `רשימת-שחקנים-${iso}.xlsx`
  );
  return rows.length;
}

export function exportSizesXlsx(players, teams, today = new Date()) {
  const rows = playerRows(players, teams);
  const { iso, text } = todayParts(today);
  write(
    sizesSheetAoa(rows, text),
    [{ wch: 18 }, { wch: 7 }, { wch: 22 }, { wch: 9 }, { wch: 9 }, { wch: 9 }],
    "מידות",
    `הזמנת-מדים-${iso}.xlsx`
  );
  return rows.length;
}
