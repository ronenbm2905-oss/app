import * as XLSX from "xlsx";
import { DAYS } from "../constants";
import { formatDateFromExcel, parseDateDMY, HEB_DAY_MAP, weekStartOfDMY } from "./dates";

// Parse xlsx using SheetJS. In Vite we import the library directly (not window.XLSX).
export function parseXlsxToRows(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
  return rows;
}

// Detect file format: old (Home Team Code) or new (מספר קבוצה)
export function detectFileFormat(rows) {
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i].map((c) => String(c || "").trim());
    if (row.includes("Home Team Code")) return { format: "old", headerIdx: i };
    if (row.includes("מספר קבוצה") || row.includes("מארחת"))
      return { format: "new", headerIdx: i };
  }
  return { format: "new", headerIdx: 1 }; // default assume new
}

export function rowsToObjects(rows, headerIdx) {
  const headers = rows[headerIdx].map((c) => String(c || "").trim());
  return rows
    .slice(headerIdx + 1)
    .filter((r) => r.some((c) => c !== "" && c !== null && c !== undefined))
    .map((r) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = r[i] ?? "";
      });
      return obj;
    });
}

// Full import + sync computation. Pure: takes raw rows + current data, returns the
// next games list, next sessions list, and counters. Caller persists via save().
export function importGamesFile(rawRows, data) {
  const games = data.games || [];
  const mapping = data.gameMapping || [];

  const { format, headerIdx } = detectFileFormat(rawRows);
  const rows = rowsToObjects(rawRows, headerIdx);

  // Collect all codes we track
  const allCodes = new Set();
  const codeToTeamId = {};
  mapping.forEach((m) => {
    m.federationCodes.forEach((c) => {
      allCodes.add(String(c).trim());
      codeToTeamId[String(c).trim()] = m.teamId;
    });
  });

  if (allCodes.size === 0) {
    return { error: "no-mapping" };
  }

  const existingByCode = {};
  games.forEach((g) => {
    existingByCode[String(g.federationCode)] = g;
  });

  let added = 0,
    updated = 0,
    skipped = 0;
  const nextGames = [...games];

  rows.forEach((row) => {
    let game = null;

    if (format === "old") {
      const code = String(row["Code"] || "").trim();
      if (!code) return;
      const homeCode = String(row["Home Team Code"] || "").trim();
      const awayCode = String(row["Away Team Code"] || "").trim();
      const isHome = allCodes.has(homeCode);
      const isAway = allCodes.has(awayCode);
      if (!isHome && !isAway) {
        skipped++;
        return;
      }
      const ourTeamId = isHome ? codeToTeamId[homeCode] : codeToTeamId[awayCode];
      const opponent = isHome
        ? String(row["Away Team"] || "").trim()
        : String(row["Home Team"] || "").trim();
      const homeScore = row["Home Score"] !== "" ? row["Home Score"] : null;
      const awayScore = row["Away Score"] !== "" ? row["Away Score"] : null;
      game = {
        federationCode: code,
        teamId: ourTeamId,
        league: row["ליגה"] || "",
        date: String(row["תאריך"] || "").trim(),
        time: String(row["Time"] || "").trim(),
        weekDay: row["Week Day"] || "",
        round: row["מחזור"] ?? "",
        isHome,
        opponent,
        venue: String(row["Venue"] || "").trim(),
        ourScore:
          homeScore !== null && homeScore !== ""
            ? Number(isHome ? homeScore : awayScore)
            : null,
        theirScore:
          awayScore !== null && awayScore !== ""
            ? Number(isHome ? awayScore : homeScore)
            : null,
      };
    } else {
      // New format: מספר קבוצה, קבוצה, מחוז/ליגה, יום, תאריך, מחזור, שעה, מארחת, אורחת, מיקום
      const teamCode = String(row["מספר קבוצה"] || "").trim();
      if (!teamCode || !allCodes.has(teamCode)) {
        skipped++;
        return;
      }
      const ourTeamId = codeToTeamId[teamCode];
      const home = String(row["מארחת"] || "").trim();
      const away = String(row["אורחת"] || "").trim();
      const OUR_KEYWORDS = ["קרית אונו", "ק. אונו", "ק.אונו", "קריית אונו"];
      const homeIsOurs = OUR_KEYWORDS.some((k) => home.includes(k));
      const isHome = homeIsOurs;
      const opponent = isHome ? away : home;
      const dateRaw = row["תאריך"];
      const dateStr = formatDateFromExcel(dateRaw);
      const dayHeb = String(row["יום"] || "").trim();
      const weekDay = HEB_DAY_MAP[dayHeb] || dayHeb;
      const timeVal = String(row["שעה"] || "")
        .trim()
        .replace(/:00$/, "")
        .replace(/^(\d+:\d+):\d+$/, "$1");
      // Unique key: teamCode + date + time (no single game code in this format)
      const federationCode = `${teamCode}-${dateStr}-${timeVal}`;
      game = {
        federationCode,
        teamId: ourTeamId,
        league: String(row["מחוז/ליגה"] || row["ליגה"] || "").trim(),
        date: dateStr,
        time: timeVal,
        weekDay,
        round: String(row["מחזור"] || "").trim(),
        isHome,
        opponent,
        venue: String(row["מיקום"] || "").trim(),
        ourScore: null,
        theirScore: null,
      };
    }

    if (!game) return;
    const key = String(game.federationCode);
    if (existingByCode[key]) {
      const idx = nextGames.findIndex(
        (g) => String(g.federationCode) === key
      );
      if (idx >= 0) {
        nextGames[idx] = game;
        updated++;
      }
    } else {
      nextGames.push(game);
      existingByCode[key] = game;
      added++;
    }
  });

  // Sort by date then time
  nextGames.sort((a, b) => {
    const da = parseDateDMY(a.date),
      db = parseDateDMY(b.date);
    if (da && db && da - db !== 0) return da - db;
    return (a.time || "").localeCompare(b.time || "");
  });

  const nextSessions = syncGamesToSessions(nextGames, data);

  return { nextGames, nextSessions, added, updated, skipped };
}

// Rebuild game-derived sessions (fromGame) from the games list, keeping manual sessions.
export function syncGamesToSessions(nextGames, data) {
  const gameSessionKey = (g) => `game-${g.federationCode}`;

  const coachForTeam = (teamId) => {
    const team = data.teams.find((t) => t.id === teamId);
    return team?.coachId || "";
  };

  const hallByName = (venueName) => {
    if (!venueName) return "";
    const match = data.halls.find(
      (h) => venueName.includes(h.name) || h.name.includes(venueName)
    );
    return match?.id || "";
  };

  const nextSessions = (data.sessions || []).filter((s) => !s.fromGame); // drop old game-sessions
  nextGames.forEach((g) => {
    if (!g.teamId) return;
    // Always compute day from date to avoid stale weekDay values
    let day = g.weekDay || "";
    if (g.date) {
      const d = parseDateDMY(g.date);
      if (d) {
        day = DAYS[d.getDay()]; // 0=Sun=ראשון ... 6=Sat=שבת
      }
    }
    if (!day || !DAYS.includes(day)) return;
    const sessionType = g.isHome ? "משחק בית" : "משחק חוץ";
    const hallId = g.isHome ? hallByName(g.venue) : "";
    const coachId = coachForTeam(g.teamId);
    const start = g.time || "18:00";
    const [sh, sm] = start.split(":").map(Number);
    const endMinutes = (sh * 60 + (sm || 0) + 120) % (24 * 60);
    const end = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(
      endMinutes % 60
    ).padStart(2, "0")}`;

    nextSessions.push({
      id: gameSessionKey(g),
      teamId: g.teamId,
      coachId,
      hallId,
      day,
      start,
      end,
      type: sessionType,
      notes: `נגד: ${g.opponent}${g.venue ? ` | ${g.venue}` : ""}`,
      weekOf: weekStartOfDMY(g.date),
      fromGame: true,
      gameKey: gameSessionKey(g),
      federationCode: g.federationCode,
    });
  });
  return nextSessions;
}
