import assert from "node:assert/strict";
import { teamGameRows, teamNameOf, sheetFileName } from "../src/utils/gameSheet.js";

let count = 0;
const T = (name, fn) => { fn(); console.log("  ok  " + name); count++; };

const data = {
  teams: [{ id: "t1", name: "נוער מחוזית" }, { id: "t2", name: "ילדים ב" }],
  halls: [{ id: "h1", name: "אולם ברק" }],
  departBeforeMin: 90,
  games: [
    // Deliberately out of order, to prove the sheet sorts.
    { federationCode: "3", teamId: "t1", date: "26-10-2026", time: "18:30", isHome: false, opponent: "בני יהודה", venue: "הרצל 10" },
    { federationCode: "1", teamId: "t1", date: "12-10-2026", time: "20:30", isHome: false, opponent: "הפועל הוד השרון", venue: "אולם עלומים",
      driverName: "יוסי", driverPhone: "0521111111" },
    { federationCode: "2", teamId: "t1", date: "19-10-2026", time: "20:30", isHome: true, opponent: "מכבי רעננה", venue: "אולם עלומים" },
    { federationCode: "9", teamId: "t2", date: "13-10-2026", time: "17:00", isHome: true, opponent: "אליצור" },
    { federationCode: "8", teamId: "t1", date: "01-09-2026", time: "19:00", isHome: true, opponent: "משחק שהיה" },
  ],
};
const NOW = new Date("2026-10-05T09:00:00");
const rows = teamGameRows(data, "t1", { now: NOW });

T("only this team's fixtures — a sheet cannot mix two squads", () => {
  assert.equal(rows.some((r) => r.opponent === "אליצור"), false);
});

T("sorted by date, whatever order they sit in the record", () => {
  assert.deepEqual(rows.map((r) => r.date), ["12.10", "19.10", "26.10"]);
});

T("past fixtures are left out — the sheet answers 'what is coming'", () => {
  assert.equal(rows.some((r) => r.opponent === "משחק שהיה"), false);
  assert.equal(teamGameRows(data, "t1", { now: NOW, includePast: true }).length, 4);
});

T("the weekday is computed from the date, not trusted from the file", () => {
  assert.equal(rows[0].day, "שני");   // 12.10.2026
  assert.equal(rows[1].day, "שני");   // 19.10.2026
});

// The rename that put the old hall name on the board for weeks.
T("a HOME fixture names our hall, never the federation's older name for it", () => {
  const home = rows.find((r) => r.home);
  assert.equal(home.where, "אולם ברק");
  assert.equal(home.where.includes("עלומים"), false);
});

T("an AWAY fixture at the same text still goes through the rename table", () => {
  assert.equal(rows[0].where, "אולם ברק");
});

T("an away address is carried as written", () => {
  assert.equal(rows[2].where, "הרצל 10");
});

T("the gathering time is on away fixtures, and computed the same way as everywhere else", () => {
  assert.equal(rows[0].assembly, "19:00"); // 20:30 minus 90
  assert.equal(rows.find((r) => r.home).assembly, "", "a home fixture has nowhere to gather for");
});

// THE POINT OF THE MODULE. This file leaves the club.
T("THE DRIVER NEVER REACHES THE SHEET", () => {
  const s = JSON.stringify(rows);
  assert.equal(s.includes("יוסי"), false);
  assert.equal(s.includes("0521111111"), false);
});

T("nothing a coach wrote reaches it either", () => {
  const withNote = {
    ...data,
    games: data.games.map((g) => (g.federationCode === "1" ? { ...g, notes: "אלון לא מגיע", ourScore: 71 } : g)),
  };
  const s = JSON.stringify(teamGameRows(withNote, "t1", { now: NOW }));
  assert.equal(s.includes("אלון"), false);
  assert.equal(s.includes("71"), false);
});

T("a cancelled fixture is carried AS cancelled, not hidden", () => {
  // A sheet can strike a line through; hiding it would be the parent's only notice
  // silently disappearing.
  const off = { ...data, games: data.games.map((g) => (g.federationCode === "2" ? { ...g, cancelled: true } : g)) };
  const out = teamGameRows(off, "t1", { now: NOW });
  assert.equal(out.length, 3);
  assert.equal(out.find((r) => r.opponent === "מכבי רעננה").cancelled, true);
});

T("an unreadable date is KEPT, and sorts last", () => {
  // A row that vanishes is the one error nobody notices.
  const odd = { ...data, games: [...data.games, { federationCode: "7", teamId: "t1", date: "", opponent: "ללא תאריך" }] };
  const out = teamGameRows(odd, "t1", { now: NOW });
  assert.equal(out[out.length - 1].opponent, "ללא תאריך");
});

T("no team, no rows — and rubbish never throws", () => {
  assert.deepEqual(teamGameRows(data, ""), []);
  assert.deepEqual(teamGameRows(null, "t1"), []);
  assert.deepEqual(teamGameRows({}, "t1"), []);
});

T("the team name, and a file name a phone will accept", () => {
  assert.equal(teamNameOf(data, "t1"), "נוער מחוזית");
  assert.equal(teamNameOf(data, "nope"), "");
  assert.equal(sheetFileName("נוער מחוזית", NOW), "משחקים-נוער מחוזית-5.10.pdf");
  assert.equal(sheetFileName('קט/סל:א*', NOW), "משחקים-קטסלא-5.10.pdf");
  assert.equal(sheetFileName("", NOW), "משחקים-קבוצה-5.10.pdf");
});

console.log(`\n${count} game-sheet tests passed`);
