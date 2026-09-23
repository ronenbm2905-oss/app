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

// ---------- the families of halls, and the bug they caused ----------
//
// This club names its halls in families: ברק · ברק מקורה 1 · ברק מקורה 2 · ברק חד"כ, and
// רימונים · רימונים מקורה. Before 23.9.2026 `matchHall` sorted by name LENGTH and accepted
// a match in either direction, so the venue "ברק" found the longest hall whose name
// contains it — "ברק מקורה 1" — and the hall actually called ברק never won.
//
// It surfaced one screen away from its cause: a manual fixture stores its hall as TEXT, and
// the board resolves that text back to an id. Pick ברק, save, look at the board: ברק מקורה 1.
{
  const a = assert;
  let n = 0;
  const ok = (name, fn) => { fn(); console.log("  ok  " + name); n++; };

  const halls = [
    { id: "h-barak", name: "ברק" },
    { id: "h-barak-1", name: "ברק מקורה 1" },
    { id: "h-barak-2", name: "ברק מקורה 2" },
    { id: "h-barak-hd", name: 'ברק חד"כ' },
    { id: "h-rimonim", name: "רימונים" },
    { id: "h-rimonim-m", name: "רימונים מקורה" },
  ];

  ok("the exact name wins over a longer hall that contains it", () => {
    a.equal(matchHall("ברק", halls), "h-barak");
    a.equal(matchHall("רימונים", halls), "h-rimonim");
  });

  ok("and the specific courts still resolve to themselves", () => {
    a.equal(matchHall("ברק מקורה 1", halls), "h-barak-1");
    a.equal(matchHall("ברק מקורה 2", halls), "h-barak-2");
    a.equal(matchHall('ברק חד"כ', halls), "h-barak-hd");
    a.equal(matchHall("רימונים מקורה", halls), "h-rimonim-m");
  });

  ok("a venue text naming both still gives the court, not the building", () => {
    // The reason "longest first" exists, and it has to keep working.
    a.equal(matchHall("אולם ברק מקורה 1, רח' הכפר 2, קריית אונו", halls), "h-barak-1");
  });

  ok("'אולם ברק' is the building — there is no hall by that exact name", () => {
    a.equal(matchHall("אולם ברק", halls), "h-barak");
  });

  ok("the rename still applies before any of it", () => {
    a.equal(matchHall("עלומים", halls), "h-barak");
    a.equal(matchHall("אולם עלומים, רח' הכפר 2, קריית אונו", halls), "h-barak");
  });

  ok("surrounding spaces do not change the answer", () => {
    a.equal(matchHall("  ברק  ", halls), "h-barak");
  });

  console.log(`\n${n} hall-family tests passed`);
}
