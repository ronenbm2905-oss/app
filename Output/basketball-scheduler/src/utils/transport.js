import * as XLSX from "xlsx";
import { DAYS } from "../constants.js";
import { parseDateDMY, weekStartOfDMY, timeMinus, timePlus } from "./dates.js";

// `timeMinus`/`timePlus` lived here until the scorer's-table duty needed the same clock
// arithmetic. They moved to dates.js rather than being imported across from here, because
// "the secretary module depends on the bus module" is a sentence nobody should have to
// explain. Re-exported so an import still pointing at this file keeps working.
export { timeMinus, timePlus };

// Away games (isHome=false) that fall in a given week (Sunday-ISO), sorted by date then time.
// Away games carry the opponent's address in `venue` (the "מיקום" column from the federation file),
// which is exactly what a transport vendor needs.
export function awayGamesForWeek(games, weekStart) {
  if (!weekStart) return [];
  return (games || [])
    // A called-off game needs no bus. Ordering one would be a real cost, so this filter
    // matters more than the visual ones.
    .filter((g) => !g.isHome && !g.cancelled && weekStartOfDMY(g.date) === weekStart)
    .sort((a, b) => {
      const da = parseDateDMY(a.date),
        db = parseDateDMY(b.date);
      if (da && db && da - db !== 0) return da - db;
      return (a.time || "").localeCompare(b.time || "");
    });
}

// A game lasts 1.5h from tip-off — used for the return-pickup time.
export const GAME_DURATION_MIN = 90;

// Minutes before tip-off that the squad gathers at the pickup point — "שעת התייצבות".
//
// It lives on the club document rather than in the export screen's state, and that is the
// whole point of it being here. The manager sets the number once, on the transport panel,
// and the coach's own board reads the SAME number. While it was component state the two
// agreed only by coincidence — both defaulted to 90 — and would have parted company the
// first time anyone changed it: the bus in the vendor's file and the time on the coach's
// screen an hour apart, with nothing on either screen saying so.
export const DEFAULT_DEPART_BEFORE = 90;

export function departBeforeOf(data) {
  // The type check before the Number() is not defensive noise. `Number("")` is 0, and 0
  // here does not read as "missing" — it reads as "gather at the whistle". A field cleared
  // and left empty would have put the squad at the pickup point as the game started, and
  // the screen would have looked entirely normal.
  const raw = data?.departBeforeMin;
  const ok = typeof raw === "number" || (typeof raw === "string" && raw.trim() !== "");
  const n = ok ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DEPART_BEFORE;
}

// The gathering time for one game, or "" when there is nothing to gather for.
//
// Measured from the GAME's tip-off (`g.time`) and never from the session's `start`:
// syncGamesToSessions writes the session half an hour early for the warm-up, so a bus
// derived from it would be announced thirty minutes before the real one.
//
// A home game returns "" — the club orders no bus to its own hall — and so does a game
// that was called off, which is the same rule `awayGamesForWeek` applies to the vendor's
// sheet. Two screens, one answer.
export function assemblyTime(game, departBefore = DEFAULT_DEPART_BEFORE) {
  if (!game || game.isHome || game.cancelled) return "";
  return timeMinus(game.time, departBefore);
}

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

// The driver is deliberately NOT a column here. This sheet is produced a week ahead to
// ORDER the bus, and at that point no driver has been assigned; by the time one has, the
// sheet has already been sent. Its recipient is the bus company — which is where the
// driver's number came from in the first place, so printing it back to them adds nothing
// and puts a third party's phone into a file that leaves the building. The person who
// actually needs it is the coach standing at the pickup point, and they read it on the
// games screen. (Adi, gate #7.)

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
      arriveTime: assemblyTime(g, departBefore), // gather at pickup point
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
// and the two places allowed to show the number ask for it out loud. The first version of
// this feature printed it in the games list with no guard at all, where every coach in the
// club could read the driver's phone for every away game of every team.
export function driverLine(game, withPhone = false) {
  if (!game || game.isHome) return "";
  const name = String(game.driverName || "").trim();
  const phone = String(game.driverPhone || "").trim();
  if (!withPhone) return name;
  return [name, phone].filter(Boolean).join(" · ");
}

// A driver is assigned to one trip. Two weeks after it the number is dead weight on a
// record nobody opens — and because the nightly federation sync carries hand-entered fields
// forward, it would otherwise be copied onto the same game every night, for ever.
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
