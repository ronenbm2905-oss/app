import { SESSION_TYPES } from "../constants";
import { uid } from "./dates";

// ---------- CSV helpers ----------
export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

export function buildCsvTemplate() {
  return [
    "type,name,team,coach,hall,day,start,end,session_type,notes",
    "team,נוער א',,,,,,,,",
    "team,נוער ב',,,,,,,,",
    "coach,דני כהן,,,,,,,,",
    "coach,מיכל לוי,,,,,,,,",
    "hall,אולם מרכזי,,,,,,,,",
    "hall,אולם נוער,,,,,,,,",
    "session,,נוער א',דני כהן,אולם מרכזי,שני,16:00,17:30,אימון,",
    "session,,נוער ב',מיכל לוי,אולם נוער,שני,16:00,17:00,משחק בית,נגד הפועל",
  ].join("\n");
}

export function importCsvToData(rows, base) {
  const data = {
    teams: [...base.teams],
    coaches: [...base.coaches],
    halls: [...base.halls],
    sessions: [...base.sessions],
    constraints: [...(base.constraints || [])],
  };
  const findOrCreate = (list, name) => {
    if (!name) return null;
    let item = list.find((x) => x.name === name);
    if (!item) {
      item = { id: uid(), name };
      list.push(item);
    }
    return item;
  };

  rows.forEach((row) => {
    const type = (row.type || "").toLowerCase();
    if (type === "team" && row.name) findOrCreate(data.teams, row.name);
    else if (type === "coach" && row.name) findOrCreate(data.coaches, row.name);
    else if (type === "hall" && row.name) findOrCreate(data.halls, row.name);
    else if (type === "session") {
      const team = findOrCreate(data.teams, row.team);
      const coach = findOrCreate(data.coaches, row.coach);
      const hall = findOrCreate(data.halls, row.hall);
      if (team && coach && hall && row.day && row.start && row.end) {
        const sessionType = SESSION_TYPES.some((t) => t.id === row.session_type)
          ? row.session_type
          : "אימון";
        data.sessions.push({
          id: uid(),
          teamId: team.id,
          coachId: coach.id,
          hallId: hall.id,
          day: row.day.trim(),
          start: row.start.trim(),
          end: row.end.trim(),
          type: sessionType,
          notes: (row.notes || "").trim(),
        });
      }
    }
  });
  return data;
}
