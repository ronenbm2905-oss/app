import assert from "node:assert/strict";
import { matchHall, withHallAliases, HALL_RENAMES } from "../src/utils/halls.js";

// The club's real halls, as they are named in the club document.
const HALLS = [
  { id: "h-barak", name: "ברק" },
  { id: "h-barak1", name: "ברק מקורה 1" },
  { id: "h-barak2", name: "ברק מקורה 2" },
  { id: "h-sharet", name: "שרת" },
  { id: "h-rimonim", name: "רימונים מקורה" },
];

// Exactly what the federation publishes for the club's home cup fixture on 4.11.2026.
const FED_VENUE = "אולם עלומים, רח' הכפר 2, קריית אונו";

let n = 0;
const T = (name, fn) => { fn(); n++; console.log("  ok  " + name); };

T("the rename is recorded, old name to new", () => {
  assert.equal(HALL_RENAMES.some((r) => r.was === "עלומים" && r.now === "ברק"), true);
});

T("THE CASE THIS EXISTS FOR: the federation's venue finds the club's hall", () => {
  assert.equal(matchHall(FED_VENUE, HALLS), "h-barak");
});

T("and without the rename it would have found nothing", () => {
  const noAlias = HALLS.find((h) => FED_VENUE.includes(h.name) || h.name.includes(FED_VENUE));
  assert.equal(noAlias, undefined);
});

T("the alias applies anywhere in the text, not only at the start", () => {
  assert.equal(withHallAliases("רח' הכפר 2, אולם עלומים"), "רח' הכפר 2, אולם ברק");
  assert.equal(withHallAliases("עלומים"), "ברק");
  assert.equal(withHallAliases(""), "");
  assert.equal(withHallAliases(null), "");
});

T("a specific court wins over the building it is in", () => {
  assert.equal(matchHall("אולם ברק מקורה 1, קריית אונו", HALLS), "h-barak1");
  assert.equal(matchHall("עלומים מקורה 2", HALLS), "h-barak2");
});

T("a hall that is named plainly still matches", () => {
  assert.equal(matchHall("אולם שרת, קריית אונו", HALLS), "h-sharet");
});

T("a venue belonging to nobody matches nothing", () => {
  assert.equal(matchHall("היכל מנורה, תל אביב", HALLS), "");
  assert.equal(matchHall("", HALLS), "");
  assert.equal(matchHall(FED_VENUE, []), "");
  assert.equal(matchHall(FED_VENUE, null), "");
});

T("a malformed hall record cannot break the match", () => {
  assert.equal(matchHall(FED_VENUE, [null, { id: "x" }, { name: "" }, ...HALLS]), "h-barak");
});

console.log("\n" + n + " tests passed");

// ── what the board ROW says about where the game is played ────────────────────────────
{
  const { syncGamesToSessions } = await import("../src/utils/games.js");
  const a = (await import("node:assert/strict")).default;
  const ok = (n, f) => { f(); console.log("  ok  " + n); };

  const data = {
    teams: [{ id: "t1", name: "נערים א", coachId: "c1" }],
    halls: [{ id: "h-barak", name: "ברק" }],
    coaches: [{ id: "c1", name: "מאמן" }],
    sessions: [],
  };
  const homeGame = {
    federationCode: "779711", teamId: "t1", date: "04-11-2026", time: "20:30", isHome: true,
    opponent: "מכבי רמת גן ליאור", venue: "אולם עלומים, רח' הכפר 2, קריית אונו", hallId: "h-barak",
  };

  ok("THE BUG: the row was in the right hall and named the wrong one", () => {
    const [row] = syncGamesToSessions([homeGame], { ...data, games: [homeGame] });
    a.equal(row.hallId, "h-barak");
    a.equal(row.notes.includes("עלומים"), false);
    a.equal(row.notes.includes("ברק"), true);
  });

  ok("a home fixture with no hall still falls back to the aliased text", () => {
    const g = { ...homeGame, hallId: "" };
    const [row] = syncGamesToSessions([g], { ...data, games: [g] });
    a.equal(row.notes.includes("עלומים"), false);
  });

  ok("an away address is left exactly as it is", () => {
    const away = { ...homeGame, isHome: false, hallId: "", venue: "רח' אחד במאי 38, חולון" };
    const [row] = syncGamesToSessions([away], { ...data, games: [away] });
    a.equal(row.notes.includes("רח' אחד במאי 38, חולון"), true);
  });

  console.log("\n3 board-row tests passed");
}
