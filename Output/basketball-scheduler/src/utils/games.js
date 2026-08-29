// Import paths in this file and in ./dates.js carry an explicit .js extension: the nightly
// scripts load these modules in plain Node, which — unlike Vite — does not guess the
// extension. Vite resolves an explicit extension perfectly well, so both sides are happy.
import * as XLSX from "xlsx";
import { DAYS } from "../constants.js";
import { formatDateFromExcel, parseDateDMY, HEB_DAY_MAP, weekStartOfDMY } from "./dates.js";

// Parse xlsx using SheetJS. In Vite we import the library directly (not window.XLSX).
export function parseXlsxToRows(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
  return rows;
}

// The federation's export escapes its text as if it were going into a web page, so a name
// like מכבי ת"א arrives as `מכבי ת&quot;א` — 65 cells across 22 opponents in the 2025 file.
// Left alone it reaches the coach's screen exactly like that.
//
// `&amp;` is decoded last on purpose: doing it first would turn `&amp;quot;` into `&quot;`
// and then into a quote mark, inventing punctuation that was never in the name.
const ENTITIES = [
  [/&quot;/g, '"'],
  [/&apos;/g, "'"],
  [/&#0*39;/g, "'"],
  [/&#0*34;/g, '"'],
  [/&lt;/g, "<"],
  [/&gt;/g, ">"],
  [/&nbsp;/g, " "],
  [/&amp;/g, "&"],
];

export function decodeEntities(value) {
  let s = String(value ?? "");
  if (!s.includes("&")) return s;
  for (const [re, ch] of ENTITIES) s = s.replace(re, ch);
  return s;
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
    // A row usually describes one game for one of our teams. When two of our own teams
    // play each other it describes a game for *both*, which is why this is a list.
    const produced = [];

    if (format === "old") {
      const code = String(row["Code"] || "").trim();
      if (!code) return;
      const homeCode = String(row["Home Team Code"] || "").trim();
      const awayCode = String(row["Away Team Code"] || "").trim();
      const weHost = allCodes.has(homeCode);
      const weVisit = allCodes.has(awayCode);
      if (!weHost && !weVisit) {
        skipped++;
        return;
      }
      const homeScore = row["Home Score"] !== "" ? row["Home Score"] : null;
      const awayScore = row["Away Score"] !== "" ? row["Away Score"] : null;

      // Two of our own teams in the same fixture. Only then is one record not enough.
      const derby = weHost && weVisit && awayCode !== homeCode;

      // One record per team of ours in this fixture, seen from that team's side.
      //
      // The key stays the federation's own game code in every case that used to produce a
      // record — home games and ordinary away games alike — so re-importing over a season
      // already in the app updates those games instead of duplicating every one of them.
      // Only the visiting half of a derby is new, and it needs a key of its own; deriving
      // it from that team's code keeps it identical on every future import.
      const sideOf = (isHome) => {
        const ourCode = isHome ? homeCode : awayCode;
        return {
          federationCode: isHome || !derby ? code : `${code}-${ourCode}`,
          teamId: codeToTeamId[ourCode],
          league: decodeEntities(row["ליגה"] || ""),
          date: String(row["תאריך"] || "").trim(),
          time: String(row["Time"] || "").trim(),
          weekDay: row["Week Day"] || "",
          round: row["מחזור"] ?? "",
          isHome,
          opponent: decodeEntities(row[isHome ? "Away Team" : "Home Team"] || "").trim(),
          venue: decodeEntities(row["Venue"] || "").trim(),
          ourScore:
            homeScore !== null && homeScore !== ""
              ? Number(isHome ? homeScore : awayScore)
              : null,
          theirScore:
            awayScore !== null && awayScore !== ""
              ? Number(isHome ? awayScore : homeScore)
              : null,
        };
      };
      if (weHost) produced.push(sideOf(true));
      // Guarded on the two codes differing: a file that lists the same code on both sides
      // is a data error, and it must not hand one team the same game twice.
      if (weVisit && awayCode !== homeCode) produced.push(sideOf(false));
    } else {
      // New format: מספר קבוצה, קבוצה, מחוז/ליגה, יום, תאריך, מחזור, שעה, מארחת, אורחת, מיקום
      const teamCode = String(row["מספר קבוצה"] || "").trim();
      if (!teamCode || !allCodes.has(teamCode)) {
        skipped++;
        return;
      }
      const ourTeamId = codeToTeamId[teamCode];
      const home = decodeEntities(row["מארחת"] || "").trim();
      const away = decodeEntities(row["אורחת"] || "").trim();
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
      // This format already lists one row per team, so an internal derby arrives as two
      // separate rows and needs no special handling here.
      produced.push({
        federationCode,
        teamId: ourTeamId,
        league: decodeEntities(row["מחוז/ליגה"] || row["ליגה"] || "").trim(),
        date: dateStr,
        time: timeVal,
        weekDay,
        round: String(row["מחזור"] || "").trim(),
        isHome,
        opponent,
        venue: decodeEntities(row["מיקום"] || "").trim(),
        ourScore: null,
        theirScore: null,
      });
    }

    produced.forEach((game) => {
      const key = String(game.federationCode);
      if (existingByCode[key]) {
        const idx = nextGames.findIndex((g) => String(g.federationCode) === key);
        if (idx >= 0) {
          // Everything the file owns is refreshed; everything the manager set by hand is
          // carried over. Losing either of these on a routine re-import would quietly undo
          // work that has no other record.
          // The driver belongs on this list for the same reason the address does: the bus
          // company tells us who is driving, the federation file knows nothing about it,
          // and a routine re-import would erase it the same night it was entered.
          const { addressOverride, timeOverride, driverName, driverPhone } = nextGames[idx];
          nextGames[idx] = {
            ...game,
            ...(addressOverride ? { addressOverride } : {}),
            ...(timeOverride ? { timeOverride } : {}),
            ...(driverName ? { driverName } : {}),
            ...(driverPhone ? { driverPhone } : {}),
          };
          updated++;
        }
      } else {
        nextGames.push(game);
        existingByCode[key] = game;
        added++;
      }
    });
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

// A game the club already has that is no longer in the federation's file has been called
// off. Working that out is the one operation here that can destroy a season, so it is
// deliberately narrow.
//
// The danger is a file that is smaller than the club: one league exported by mistake, a
// download that stopped halfway, a season filter left on. Compared naively, every game the
// file does not mention looks cancelled. Three limits keep that from happening:
//
//   1. only teams the file actually covers are examined — a team absent from the file is
//      not a team whose games were called off, it is a team the file says nothing about;
//   2. only dates inside the range the file spans, so a file covering one month cannot
//      cancel the rest of the season;
//   3. anything above a sixth of the games in scope is reported as suspicious, because a
//      real round of cancellations is a handful and a broken file is most of them.
//
// The caller decides what to do with `suspicious` — nothing here acts on it. Games that
// reappear in a later file are listed in `restored`, since the federation reinstates
// fixtures as readily as it drops them.
export const CANCEL_SUSPICIOUS_RATIO = 0.15;

export function findCancelledGames(existingGames, rawRows, data) {
  const existing = Array.isArray(existingGames) ? existingGames : [];
  // Asking the importer what this file produces, rather than reading codes off the sheet,
  // is what keeps the two key spaces identical — including the derby suffix.
  const fresh = importGamesFile(rawRows, { ...data, games: [] });
  if (fresh.error) return { error: fresh.error, cancelled: [], restored: [], suspicious: false };

  const codesInFile = new Set(fresh.nextGames.map((g) => String(g.federationCode)));
  const teamsInFile = new Set(fresh.nextGames.map((g) => g.teamId).filter(Boolean));
  const dates = fresh.nextGames.map((g) => parseDateDMY(g.date)).filter(Boolean);
  const from = dates.length ? Math.min(...dates) : null;
  const to = dates.length ? Math.max(...dates) : null;

  const inScope = (g) => {
    if (!teamsInFile.has(g.teamId)) return false;
    const d = parseDateDMY(g.date);
    return Boolean(d) && from !== null && d >= from && d <= to;
  };

  const scoped = existing.filter(inScope);
  const cancelled = scoped.filter((g) => !g.cancelled && !codesInFile.has(String(g.federationCode)));
  const restored = existing.filter((g) => g.cancelled && codesInFile.has(String(g.federationCode)));

  return {
    cancelled: cancelled.map((g) => String(g.federationCode)),
    restored: restored.map((g) => String(g.federationCode)),
    scope: { teams: teamsInFile.size, from, to, games: scoped.length },
    ratio: scoped.length ? cancelled.length / scoped.length : 0,
    suspicious: scoped.length > 0 && cancelled.length / scoped.length > CANCEL_SUSPICIOUS_RATIO,
  };
}

// Stamp the verdict onto the games list. Cancelling keeps the record — a coach who already
// saw the fixture needs to be told it is off, not have it disappear from under them.
export function applyCancellations(games, { cancelled = [], restored = [], now }) {
  const off = new Set(cancelled.map(String));
  const on = new Set(restored.map(String));
  return (games || []).map((g) => {
    const code = String(g.federationCode);
    if (off.has(code)) return { ...g, cancelled: true, cancelledAt: now };
    if (on.has(code)) {
      const { cancelled: _was, cancelledAt: _when, ...rest } = g;
      return rest;
    }
    return g;
  });
}

// The hall slot a game gets when nobody has touched it: half an hour of warm-up before
// the tip-off, an hour and a half after. Exported so the board can offer "back to default"
// without knowing the rule.
export function defaultGameTimes(game) {
  const [h, m] = String(game?.time || "18:00").split(":").map(Number);
  const mins = (Number.isFinite(h) ? h : 18) * 60 + (Number.isFinite(m) ? m : 0);
  const hm = (v) => {
    const x = ((v % (24 * 60)) + 24 * 60) % (24 * 60);
    return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
  };
  return { start: hm(mins - 30), end: hm(mins + 90) };
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
    const defaultStart = toHM(gameMinutes - 30); // חצי שעה חימום לפני
    const defaultEnd = toHM(gameMinutes + 90); // שעה וחצי משחק

    // A manager who nudged this block on the board keeps that nudge. The federation owns
    // the tip-off time; how long the hall is held around it is the club's business, so a
    // re-import refreshes everything else and leaves these two alone — the same bargain
    // `addressOverride` already makes for the address.
    const start = g.timeOverride?.start || defaultStart;
    const end = g.timeOverride?.end || defaultEnd;

    nextSessions.push({
      id: gameSessionKey(g),
      teamId: g.teamId,
      coachId,
      hallId,
      day,
      start,
      end,
      type: sessionType,
      // Carried onto the row so the board can strike it through without looking the game
      // up again, and so the transport and calendar exports can drop it.
      ...(g.cancelled ? { cancelled: true } : {}),
      notes: `נגד: ${g.opponent}${venue ? ` | ${venue}` : ""} | חימום ${start} · משחק ${gameTime}`,
      weekOf: weekStartOfDMY(g.date),
      fromGame: true,
      gameKey: gameSessionKey(g),
      federationCode: g.federationCode,
    });
  });
  return nextSessions;
}
