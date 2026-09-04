import * as XLSX from "xlsx";
import { DAYS } from "../constants.js";
import { parseDateDMY, weekStartOfDMY } from "./dates.js";

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

// Add minutes to an "HH:MM" time (wraps around midnight).
export function timePlus(hm, minutes) {
  return timeMinus(hm, -minutes);
}

// A game lasts 1.5h from tip-off — used for the return-pickup time.
export const GAME_DURATION_MIN = 90;

// Hebrew weekday name from a DD-MM-YYYY date string.
export function dayOf(dmy) {
  const d = parseDateDMY(dmy);
  return d ? DAYS[d.getDay()] : "";
}

// Column schema for the transport export — order matches the file the vendor already knows.
export const TRANSPORT_HEADERS = [
  "קבוצה",
  "יום",
  "תאריך",
  "שעה",
  "מארחת",
  "מיקום",
  "איש קשר",
  "טלפון",
  "שעת התייצבות",
  "נקודת איסוף",
  "איסוף חזרה",
  "סוג רכב",
];

// Build printable/exportable rows from away games.
// `departBefore` = minutes before tip-off for the gathering ("שעת התייצבות") time.
// `pickupPoint` = the club's fixed pickup address. `teams`/`coaches` resolve contact + vehicle.
export function buildTransportRows(awayGames, { teams, coaches, departBefore, pickupPoint }) {
  const teamById = (id) => (teams || []).find((t) => t.id === id);
  const coachById = (id) => (coaches || []).find((c) => c.id === id);
  return awayGames.map((g) => {
    const team = teamById(g.teamId);
    const coach = team && team.coachId ? coachById(team.coachId) : null;
    return {
      team: team?.name || g.teamId,
      day: dayOf(g.date),
      date: g.date || "",
      gameTime: g.time || "",
      opponent: g.opponent || "",
      address: g.addressOverride || g.venue || "", // manual override wins over the file's מיקום column
      coachName: coach?.name || "",
      coachPhone: coach?.phone || "",
      arriveTime: timeMinus(g.time, departBefore), // gather at pickup point
      pickupPoint: pickupPoint || "",
      returnTime: timePlus(g.time, GAME_DURATION_MIN), // end of game
      vehicle: team?.vehicleType || "",
    };
  });
}

// Driver contact for a game — quiet by default, and that default is the control.
//
// The number belongs to someone who never gave it to us; the bus company did. So a call
// site that has not thought about who is reading the screen gets the name and nothing else,
// and the two places allowed to show the number ask for it out loud.
export function driverLine(game, withPhone = false) {
  if (!game || game.isHome) return "";
  const name = String(game.driverName || "").trim();
  const phone = String(game.driverPhone || "").trim();
  if (!withPhone) return name;
  return [name, phone].filter(Boolean).join(" · ");
}

// A driver is assigned to one trip. Two weeks after it the number is dead weight on a
// record nobody opens — and because a re-import carries hand-entered fields forward, it
// would otherwise be copied onto the same finished game every time, for ever.
//
// Note what is NOT here: the driver's details never reach the transport sheet. That file
// is produced a week ahead to ORDER the coach, before any driver is assigned, and its
// recipient is the bus company — the very party the number came from. Printing it back to
// them adds nothing and puts a third party's phone in a file that leaves the system.
//
// `today` is injected rather than read from the clock so the rule can be tested.
export function clearStaleDrivers(games, today = new Date(), days = 14) {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);
  let cleared = 0;
  const next = (games || []).map((g) => {
    if (!g || (!g.driverName && !g.driverPhone)) return g;
    const d = parseDateDMY(g.date);
    if (!d || d >= cutoff) return g;
    cleared++;
    const { driverName, driverPhone, ...rest } = g;
    return rest;
  });
  return { games: next, cleared };
}

// Row object -> array of cells in TRANSPORT_HEADERS order (shared by xlsx + image).
export function transportRowToCells(r) {
  return [
    r.team, r.day, r.date, r.gameTime, r.opponent, r.address,
    r.coachName, r.coachPhone, r.arriveTime, r.pickupPoint, r.returnTime, r.vehicle,
  ];
}

// Generate + download an xlsx of the transport rows. `fileTag` is a filename-safe label.
export function exportTransportXlsx(rows, fileTag) {
  const aoa = [TRANSPORT_HEADERS, ...rows.map(transportRowToCells)];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 18 }, // קבוצה
    { wch: 6 }, // יום
    { wch: 12 }, // תאריך
    { wch: 7 }, // שעה
    { wch: 22 }, // מארחת
    { wch: 32 }, // מיקום
    { wch: 14 }, // איש קשר
    { wch: 13 }, // טלפון
    { wch: 11 }, // שעת התייצבות
    { wch: 28 }, // נקודת איסוף
    { wch: 10 }, // איסוף חזרה
    { wch: 8 }, // סוג רכב
  ];
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] }; // Excel opens the sheet right-to-left
  XLSX.utils.book_append_sheet(wb, ws, "משחקי חוץ");
  XLSX.writeFile(wb, `הסעות-משחקי-חוץ-${fileTag}.xlsx`);
}
