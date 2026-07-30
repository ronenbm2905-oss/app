import * as XLSX from "xlsx";
import { uid, formatDateFromExcel } from "./dates";

// Fixed column schema for the players roster. Order = order in the Excel template.
export const PLAYER_FIELDS = [
  { key: "name", header: "שם" },
  { key: "phone", header: "טלפון" },
  { key: "birthDate", header: "תאריך לידה" },
  { key: "shirtSize", header: "מידת חולצה" },
  { key: "pantsSize", header: "מידת מכנס" },
  { key: "sweaterSize", header: "מידת פוטר" },
  { key: "jerseyNumber", header: "מספר גופייה" },
];

export const PLAYER_HEADERS = PLAYER_FIELDS.map((f) => f.header);

// Israeli phone numbers stored as numbers in Excel lose their leading 0.
// Re-pad a bare 9-digit number back to 10 digits; otherwise keep as-is (text, dashes...).
function normPhone(v) {
  if (v == null || v === "") return "";
  let s = String(v).trim();
  if (/^\d{9}$/.test(s)) s = "0" + s;
  return s;
}

const str = (v) => (v == null ? "" : String(v).trim());

// Parse the first sheet of a players xlsx into raw field objects (no id/teamId yet).
// Header row is located by the "שם" cell, so column order in the file doesn't matter.
export function parsePlayersRows(rawRows) {
  let headerIdx = -1;
  for (let i = 0; i < Math.min(6, rawRows.length); i++) {
    const row = (rawRows[i] || []).map((c) => str(c));
    if (row.includes("שם")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const headers = rawRows[headerIdx].map((c) => str(c));
  const colOf = {};
  PLAYER_FIELDS.forEach((f) => {
    colOf[f.key] = headers.indexOf(f.header);
  });

  const out = [];
  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const r = rawRows[i] || [];
    if (!r.some((c) => c !== "" && c != null)) continue;
    const cell = (key) => (colOf[key] >= 0 ? r[colOf[key]] : "");
    const name = str(cell("name"));
    if (!name) continue; // a player must have a name
    out.push({
      name,
      phone: normPhone(cell("phone")),
      birthDate: cell("birthDate") ? formatDateFromExcel(cell("birthDate")) : "",
      shirtSize: str(cell("shirtSize")),
      pantsSize: str(cell("pantsSize")),
      sweaterSize: str(cell("sweaterSize")),
      jerseyNumber: str(cell("jerseyNumber")),
    });
  }
  return out;
}

// Merge parsed rows into a team's roster. Appends (never wipes existing players).
// Skips rows that duplicate an existing person (same name+phone) or whose jersey
// number collides with one already used in the team (jersey numbers are unique per team).
export function importPlayersForTeam(parsedRows, teamId, allPlayers) {
  const teamPlayers = allPlayers.filter((p) => p.teamId === teamId);
  const usedJerseys = new Set(teamPlayers.map((p) => p.jerseyNumber).filter(Boolean));
  const seenPeople = new Set(teamPlayers.map((p) => `${p.name}|${p.phone}`));

  const toAdd = [];
  let skipped = 0;
  parsedRows.forEach((row) => {
    const personKey = `${row.name}|${row.phone}`;
    if (seenPeople.has(personKey)) {
      skipped++;
      return;
    }
    if (row.jerseyNumber && usedJerseys.has(row.jerseyNumber)) {
      skipped++;
      return;
    }
    if (row.jerseyNumber) usedJerseys.add(row.jerseyNumber);
    seenPeople.add(personKey);
    toAdd.push({ id: uid(), teamId, ...row });
  });

  return { nextPlayers: [...allPlayers, ...toAdd], added: toAdd.length, skipped };
}

// Read an uploaded xlsx file into raw rows (array-of-arrays).
export async function readPlayersFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
}

// Generate and download a blank xlsx template (header row + one example row).
export function downloadPlayersTemplate(teamName) {
  const ws = XLSX.utils.aoa_to_sheet([
    PLAYER_HEADERS,
    ["ישראל ישראלי", "0501234567", "12/07/2012", "10", "10", "M", "7"],
  ]);
  ws["!cols"] = PLAYER_HEADERS.map(() => ({ wch: 14 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "שחקנים");
  const safeTeam = teamName ? "-" + teamName.replace(/[\\/:*?"<>|]/g, "") : "";
  XLSX.writeFile(wb, `תבנית-שחקנים${safeTeam}.xlsx`);
}
