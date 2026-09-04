import * as XLSX from "xlsx";
import { DAYS } from "../constants.js";
import { formatDateFromExcel, parseDateDMY, HEB_DAY_MAP, weekStartOfDMY } from "./dates.js";
import { clubHomeKeywords } from "./club.js";
import { clearStaleDrivers } from "./transport.js";

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
// A game is "past" only well after it happened. The grace period matters: a driver entered
// on the morning of the match must survive that day's re-import, and a fixture rescheduled
// by a week must not be treated as history.
export function isPastGame(game, now = new Date(), graceDays = 14) {
  const d = parseDateDMY(game && game.date);
  if (!d) return false; // a game with no readable date is not "past", it is unknown
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - graceDays);
  return d < cutoff;
}

export function importGamesFile(rawRows, data) {
  const games = data.games || [];
  const mapping = data.gameMapping || [];
  // Which host names mean "us". Per club — a wrong list makes every game an away
  // game, which then breaks hall matching and the transport export as well.
  const ourKeywords = clubHomeKeywords(data);

  // Checked before any parsing: with no names to match, every single game would be
  // filed as away and the club would have to undo an entire season's import by hand.
  // A club that has not filled this in yet is one settings field away from a correct
  // import, so stop and say so.
  if (ourKeywords.length === 0) {
    return { error: "no-home-keywords" };
  }

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
      const homeIsOurs = ourKeywords.some((k) => home.includes(k));
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
        // Hand-entered fields survive a re-import; everything else refreshes from the file.
        // The driver belongs on this list for the same reason the address does — the bus
        // company tells us who is driving and the federation file knows nothing about it,
        // so a routine re-import would erase it the same day it was entered.
        //
        // But only while the trip is still ahead. An address has no expiry; a driver's
        // phone number does — it is for one journey. Carried unconditionally, every
        // re-import would copy a stranger's number onto a finished game, for ever, on a
        // record nobody opens again.
        const { addressOverride, driverName, driverPhone } = nextGames[idx];
        const keepDriver = !isPastGame(game);
        nextGames[idx] = {
          ...game,
          ...(addressOverride ? { addressOverride } : {}),
          ...(keepDriver && driverName ? { driverName } : {}),
          ...(keepDriver && driverPhone ? { driverPhone } : {}),
        };
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

  // Sweep drivers off finished trips, across the WHOLE list rather than only the rows the
  // file happened to match. The carry-over rule above already drops a stale driver from a
  // game the file still contains; this catches the fixture that has since left the file —
  // cancelled, rescheduled, moved to another league — and would otherwise hold a stranger's
  // phone number for ever on a record nobody opens.
  //
  // Worth saying: the single-club branch defines this function and never calls it. Its
  // privacy policy nonetheless promises the deletion. That is the same shape of gap the
  // port keeps finding, so the function is wired here rather than carried over dormant.
  const swept = clearStaleDrivers(nextGames);

  const nextSessions = syncGamesToSessions(swept.games, data);

  return { nextGames: swept.games, nextSessions, added, updated, skipped, driversCleared: swept.cleared };
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
    const venue = g.addressOverride || g.venue || ""; // manual address override wins over the file
    const hallId = g.isHome ? hallByName(venue) : "";
    const coachId = coachForTeam(g.teamId);
    // הקובץ מהאיגוד נותן רק את שעת המשחק. השורה בלוח נחסמת מ-30 דקות חימום
    // לפני שריקת הפתיחה ועד שעה וחצי אחריה. דוגמה: משחק 18:30 → 18:00–20:00.
    const gameTime = g.time || "18:00";
    const [gh, gm] = gameTime.split(":").map(Number);
    const gameMinutes = gh * 60 + (gm || 0);
    const toHM = (mins) => {
      const m = ((mins % (24 * 60)) + 24 * 60) % (24 * 60); // עוטף סביב חצות
      return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    };
    const start = toHM(gameMinutes - 30); // חצי שעה חימום לפני
    const end = toHM(gameMinutes + 90); // שעה וחצי משחק

    nextSessions.push({
      id: gameSessionKey(g),
      teamId: g.teamId,
      coachId,
      hallId,
      day,
      start,
      end,
      type: sessionType,
      notes: `נגד: ${g.opponent}${venue ? ` | ${venue}` : ""} | חימום ${start} · משחק ${gameTime}`,
      weekOf: weekStartOfDMY(g.date),
      fromGame: true,
      gameKey: gameSessionKey(g),
      federationCode: g.federationCode,
    });
  });
  return nextSessions;
}
