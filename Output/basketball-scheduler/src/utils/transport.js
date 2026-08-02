import * as XLSX from "xlsx";
import { DAYS } from "../constants";
import { parseDateDMY, weekStartOfDMY } from "./dates";

// Away games (isHome=false) that fall in a given week (Sunday-ISO), sorted by date then time.
// Away games carry the opponent's address in `venue` (the "מיקום" column from the federation file),
// which is exactly what a transport vendor needs.
export function awayGamesForWeek(games, weekStart) {
  if (!weekStart) return [];
  return (games || [])
    .filter((g) => !g.isHome && weekStartOfDMY(g.date) === weekStart)
    .sort((a, b) => {
      const da = parseDateDMY(a.date),
        db = parseDateDMY(b.date);
      if (da && db && da - db !== 0) return da - db;
      return (a.time || "").localeCompare(b.time || "");
    });
}

// Subtract minutes from an "HH:MM" time, wrapping around midnight. Returns "HH:MM" (or "").
export function timeMinus(hm, minutes) {
  if (!hm) return "";
  const [h, m] = hm.split(":").map(Number);
  const total = (((h * 60 + (m || 0) - minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Hebrew weekday name from a DD-MM-YYYY date string.
export function dayOf(dmy) {
  const d = parseDateDMY(dmy);
  return d ? DAYS[d.getDay()] : "";
}

// Column schema for the transport export (order = column order in the Excel/image).
export const TRANSPORT_HEADERS = [
  "תאריך",
  "יום",
  "שעת משחק",
  "שעת יציאה",
  "קבוצה",
  "יריב",
  "כתובת",
];

// Build printable/exportable rows from away games.
// `departBefore` = minutes before tip-off for the recommended departure time.
export function buildTransportRows(awayGames, { teamName, departBefore }) {
  return awayGames.map((g) => ({
    date: g.date || "",
    day: dayOf(g.date),
    gameTime: g.time || "",
    departTime: timeMinus(g.time, departBefore),
    team: teamName(g.teamId),
    opponent: g.opponent || "",
    address: g.venue || "",
  }));
}

// Generate + download an xlsx of the transport rows. `fileTag` is a filename-safe label.
export function exportTransportXlsx(rows, fileTag) {
  const aoa = [
    TRANSPORT_HEADERS,
    ...rows.map((r) => [r.date, r.day, r.gameTime, r.departTime, r.team, r.opponent, r.address]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 12 }, // תאריך
    { wch: 8 }, // יום
    { wch: 9 }, // שעת משחק
    { wch: 9 }, // שעת יציאה
    { wch: 16 }, // קבוצה
    { wch: 20 }, // יריב
    { wch: 34 }, // כתובת
  ];
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] }; // Excel opens the sheet right-to-left
  XLSX.utils.book_append_sheet(wb, ws, "משחקי חוץ");
  XLSX.writeFile(wb, `הסעות-משחקי-חוץ-${fileTag}.xlsx`);
}
