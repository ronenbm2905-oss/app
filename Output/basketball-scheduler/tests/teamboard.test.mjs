import assert from "node:assert/strict";
import {
  buildBoard, boardWeeks, tokenFrom, tokenFromPath, boardPath,
  tokenForTeam, withBoardToken, withoutBoardToken, TOKEN_LENGTH,
} from "../src/utils/teamBoard.js";

const W = "2026-09-13";
const data = {
  teams: [{ id: "t1", name: "נערים א ארצית" }, { id: "t2", name: "קטסל ב" }],
  halls: [{ id: "h1", name: "אולם ברק" }, { id: "h2", name: "אולם עלומים" }],
  games: [
    { federationCode: "111", opponent: "הפועל רמת גן", isHome: false, venue: "ז'בוטינסקי 45", time: "16:30" },
    { federationCode: "222", opponent: "מכבי חיפה", isHome: true, time: "18:00" },
  ],
  departBeforeMin: 90,
  sessions: [
    { id: "a", teamId: "t1", hallId: "h1", day: "ראשון", start: "17:00", end: "18:30", weekOf: W, notes: "אלון לא מגיע" },
    { id: "b", teamId: "t1", hallId: "h2", day: "רביעי", start: "19:15", end: "20:45", weekOf: W, type: "ספורטתרפיה" },
    { id: "c", teamId: "t1", hallId: "h1", day: "שבת", start: "16:30", end: "18:00", weekOf: W, fromGame: true, federationCode: "111" },
    { id: "d", teamId: "t2", hallId: "h1", day: "שני", start: "16:00", end: "17:00", weekOf: W },
    { id: "e", teamId: "t1", hallId: "h1", day: "שני", start: "17:00", end: "18:00", weekOf: "2026-09-20" },
  ],
};
const at = (iso) => new Date(iso + "T10:00:00");
const t = (name, fn) => { fn(); console.log("  ok  " + name); };
let count = 0;
const T = (n, f) => { t(n, f); count++; };

T("builds this week and next, and nothing else", () => {
  const b = buildBoard(data, "t1", { now: at("2026-09-16") });
  assert.deepEqual(Object.keys(b.weeks).sort(), ["2026-09-13", "2026-09-20"]);
});

T("only this team — another team's training never appears", () => {
  const b = buildBoard(data, "t1", { now: at("2026-09-16") });
  const all = Object.values(b.weeks).flat();
  assert.equal(all.some((r) => r.where === "אולם ברק" && r.day === "שני" && r.start === "16:00"), false);
});

T("a session NOTE is never published — free text can name a child", () => {
  const b = buildBoard(data, "t1", { now: at("2026-09-16") });
  const s = JSON.stringify(b);
  assert.equal(s.includes("אלון"), false);
  assert.equal(s.includes("notes"), false);
});

T("no player, phone or birth date can reach the board", () => {
  const withPlayers = { ...data, players: [{ id: "p", teamId: "t1", name: "דני כהן", phone: "0501234567", birthDate: "2010-01-01" }] };
  const s = JSON.stringify(buildBoard(withPlayers, "t1", { now: at("2026-09-16") }));
  assert.equal(s.includes("דני"), false);
  assert.equal(s.includes("0501234567"), false);
  assert.equal(s.includes("2010-01-01"), false);
});

T("rows come out sorted by day and then by hour", () => {
  const rows = buildBoard(data, "t1", { now: at("2026-09-16") }).weeks[W];
  assert.deepEqual(rows.map((r) => r.day), ["ראשון", "רביעי", "שבת"]);
});

T("an away game carries the address and the assembly time", () => {
  const rows = buildBoard(data, "t1", { now: at("2026-09-16") }).weeks[W];
  const game = rows.find((r) => r.kind === "game");
  assert.equal(game.opponent, "הפועל רמת גן");
  assert.equal(game.home, false);
  assert.equal(game.where, "ז'בוטינסקי 45");
  assert.equal(game.assembly, "15:00"); // 16:30 minus 90
});

T("a HOME game shows the hall and no assembly time", () => {
  const d = { ...data, sessions: [{ id: "g", teamId: "t1", hallId: "h1", day: "שישי", start: "18:00", end: "19:30", weekOf: W, fromGame: true, federationCode: "222" }] };
  const row = buildBoard(d, "t1", { now: at("2026-09-16") }).weeks[W][0];
  assert.equal(row.home, true);
  assert.equal(row.where, "אולם ברק");
  assert.equal(row.assembly, "");
});

T("the driver never reaches the board", () => {
  const d = { ...data, games: [{ ...data.games[0], driverName: "יוסי", driverPhone: "0521111111" }] };
  const s = JSON.stringify(buildBoard(d, "t1", { now: at("2026-09-16") }));
  assert.equal(s.includes("יוסי"), false);
  assert.equal(s.includes("0521111111"), false);
});

T("a moved time is shown as the real time", () => {
  const d = { ...data, sessions: [{ ...data.sessions[0], timeOverride: { start: "18:00", end: "19:30" } }] };
  const row = buildBoard(d, "t1", { now: at("2026-09-16") }).weeks[W][0];
  assert.equal(row.start, "18:00");
  assert.equal(row.end, "19:30");
});

T("a cancelled training is published AS cancelled, not hidden", () => {
  const d = { ...data, sessions: [{ ...data.sessions[0], cancelled: true }] };
  assert.equal(buildBoard(d, "t1", { now: at("2026-09-16") }).weeks[W][0].cancelled, true);
});

T("'אימון' is not repeated as a type; a real type is kept", () => {
  const rows = buildBoard(data, "t1", { now: at("2026-09-16") }).weeks[W];
  assert.equal(rows[0].type, "");
  assert.equal(rows[1].type, "ספורטתרפיה");
});

T("an empty week is left out rather than published empty", () => {
  const b = buildBoard({ ...data, sessions: [data.sessions[0]] }, "t1", { now: at("2026-09-16") });
  assert.deepEqual(Object.keys(b.weeks), [W]);
});

T("a team that does not exist produces nothing", () => {
  assert.equal(buildBoard(data, "nope", { now: at("2026-09-16") }), null);
});

T("boardWeeks returns the Sunday of this week and the next", () => {
  assert.deepEqual(boardWeeks(at("2026-09-16")), ["2026-09-13", "2026-09-20"]);
  assert.deepEqual(boardWeeks(at("2026-09-13")), ["2026-09-13", "2026-09-20"]);
});

T("a token is fixed length and drawn from the safe alphabet", () => {
  const tok = tokenFrom([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  assert.equal(tok.length, TOKEN_LENGTH);
  assert.equal(/^[a-z0-9]+$/.test(tok), true);
  assert.equal(/[l1o0]/.test(tok), false);
});

T("the link round-trips, and anything else is refused", () => {
  assert.equal(tokenFromPath(boardPath("abcdefghijkm")), "abcdefghijkm");
  assert.equal(tokenFromPath("/"), "");
  assert.equal(tokenFromPath("/t/"), "");
  assert.equal(tokenFromPath("/t/ab"), "");
  assert.equal(tokenFromPath("/t/abc!def"), "");
  assert.equal(tokenFromPath("/team/abcdefghijkm"), "");
});

T("the token index adds and removes without touching the rest", () => {
  const withOne = withBoardToken({ teams: [] }, "t1", "abc123def456");
  assert.equal(tokenForTeam(withOne, "t1"), "abc123def456");
  assert.equal(tokenForTeam(withoutBoardToken(withOne, "t1"), "t1"), "");
  assert.equal(tokenForTeam({}, "t1"), "");
});

console.log("\n" + count + " tests passed");

// ── a fixture typed straight onto the board, with no game record behind it ────────────
{
  const { buildBoard: build } = await import("../src/utils/teamBoard.js");
  const a = (await import("node:assert/strict")).default;
  const ok = (n, f) => { f(); console.log("  ok  " + n); };
  const W2 = "2026-09-13";
  const base = {
    teams: [{ id: "t1", name: "נוער מחוזית" }],
    halls: [{ id: "h1", name: "רימונים" }],
    games: [],
    sessions: [{
      id: "x", teamId: "t1", hallId: "h1", day: "שלישי", start: "20:00", end: "22:00",
      weekOf: W2, type: "משחק בית", opponent: "גבעתיים", notes: "אלון לא מגיע",
    }],
  };
  const at = (iso) => new Date(iso + "T10:00:00");

  ok("it reads as a GAME, not a training", () => {
    const row = build(base, "t1", { now: at("2026-09-16") }).weeks[W2][0];
    a.equal(row.kind, "game");
    a.equal(row.home, true);
  });

  ok("the opponent comes from its own field", () => {
    const row = build(base, "t1", { now: at("2026-09-16") }).weeks[W2][0];
    a.equal(row.opponent, "גבעתיים");
  });

  ok("and the free-text note is STILL not published", () => {
    const s = JSON.stringify(build(base, "t1", { now: at("2026-09-16") }));
    a.equal(s.includes("אלון"), false);
  });

  ok("an away fixture typed this way is marked away", () => {
    const away = { ...base, sessions: [{ ...base.sessions[0], type: "משחק חוץ" }] };
    a.equal(build(away, "t1", { now: at("2026-09-16") }).weeks[W2][0].home, false);
  });

  ok("no fixture record means no invented gathering time", () => {
    a.equal(build(base, "t1", { now: at("2026-09-16") }).weeks[W2][0].assembly, "");
  });

  ok("a plain training is untouched by any of this", () => {
    const tr = { ...base, sessions: [{ ...base.sessions[0], type: "אימון", opponent: "" }] };
    a.equal(build(tr, "t1", { now: at("2026-09-16") }).weeks[W2][0].kind, "training");
  });

  console.log("\n6 typed-fixture tests passed");
}

// ── the board as calendar events ──────────────────────────────────────────────────────
{
  const { buildBoardIcs } = await import("../src/utils/teamBoard.js");
  const a = (await import("node:assert/strict")).default;
  const ok = (n, f) => { f(); console.log("  ok  " + n); };

  const board = {
    teamId: "t1",
    teamName: "נוער מחוזית",
    weeks: {
      "2026-09-13": [
        { kind: "training", day: "שני", start: "16:15", end: "17:30", where: "רימונים", type: "" },
        { kind: "game", day: "שבת", start: "16:30", end: "18:00", where: "ז'בוטינסקי 45", opponent: "הפועל רמת גן", home: false, assembly: "15:00" },
        { kind: "training", day: "רביעי", start: "18:00", end: "19:30", where: "שז\"ר", type: "", cancelled: true },
      ],
    },
  };
  const ics = buildBoardIcs(board, { now: new Date("2026-09-17T10:00:00Z") });
  // ICS folds any line past 75 OCTETS onto the next one with a leading space, and Hebrew is
  // two octets a character — so a summary in Hebrew is split in the middle of a word. That
  // is the format behaving correctly; these assertions read the unfolded text.
  const fold = String.fromCharCode(13, 10) + " ";
  const flat = (s) => s.split(fold).join("");
  const un = flat(ics);

  ok("it is a calendar, named after the team", () => {
    a.equal(ics.startsWith("BEGIN:VCALENDAR"), true);
    a.equal(un.includes("X-WR-CALNAME:נוער מחוזית"), true);
  });

  ok("every line ends CRLF, as the format requires", () => {
    a.equal(ics.includes("\r\n"), true);
    a.equal(/[^\r]\n/.test(ics), false);
  });

  ok("a training becomes an event with its hall", () => {
    a.equal(un.includes("SUMMARY:נוער מחוזית — אימון"), true);
    a.equal(un.includes("LOCATION:רימונים"), true);
  });

  ok("an away game names the opponent and carries the gathering time", () => {
    a.equal(un.includes("משחק חוץ נגד הפועל רמת גן"), true);
    a.equal(un.includes("DESCRIPTION:התייצבות 15:00"), true);
  });

  ok("a CANCELLED fixture is not exported — a calendar cannot strike it through", () => {
    a.equal(un.includes("שז"), false);
    a.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  });

  ok("ids are stable, so importing twice updates instead of doubling", () => {
    const again = buildBoardIcs(board, { now: new Date("2026-09-18T10:00:00Z") });
    const uids = (s) => (s.match(/^UID:.*$/gm) || []).map((x) => x.trim());
    a.deepEqual(uids(ics), uids(again));
  });

  ok("an empty board is still a valid, empty calendar", () => {
    const out = buildBoardIcs({ teamName: "x", weeks: {} });
    a.equal(out.includes("BEGIN:VEVENT"), false);
    a.equal(out.trim().endsWith("END:VCALENDAR"), true);
  });

  console.log("\n7 calendar tests passed");
}
