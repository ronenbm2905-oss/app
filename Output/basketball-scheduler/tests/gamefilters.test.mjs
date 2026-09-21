import assert from "node:assert/strict";
import {
  MY_TEAMS, teamIdsForCoach, defaultTeamFilter, teamFilterOptions, filterGames,
} from "../src/utils/gameFilters.js";

let count = 0;
const T = (name, fn) => { fn(); console.log("  ok  " + name); count++; };

// Modelled on the real club: a coach with two squads, a coach with one, and a squad with
// no coach linked at all — all three exist there.
const data = {
  teams: [
    { id: "t1", name: "נערים ב לאומית", coachId: "c1" },
    { id: "t2", name: "ילדים ב", coachId: "c1" },
    { id: "t3", name: "נוער מחוזית", coachId: "c2" },
    { id: "t4", name: "קטסל א", coachId: "" },
  ],
  coaches: [{ id: "c1", name: "עומר" }, { id: "c2", name: "רונן" }],
};
const games = [
  { federationCode: "1", teamId: "t1", isHome: true },
  { federationCode: "2", teamId: "t1", isHome: false },
  { federationCode: "3", teamId: "t2", isHome: false },
  { federationCode: "4", teamId: "t3", isHome: true },
  { federationCode: "5", teamId: "t4", isHome: true },
  { federationCode: "6", teamId: "", isHome: false },
];
const codes = (list) => list.map((g) => g.federationCode);

T("a coach's squads are the teams that name them as coach", () => {
  assert.deepEqual(teamIdsForCoach(data, "c1"), ["t1", "t2"]);
  assert.deepEqual(teamIdsForCoach(data, "c2"), ["t3"]);
});

T("a manager has none, and asking with no id is not an error", () => {
  assert.deepEqual(teamIdsForCoach(data, ""), []);
  assert.deepEqual(teamIdsForCoach(data, null), []);
  assert.deepEqual(teamIdsForCoach(null, "c1"), []);
});

T("a coach opens on their own squads", () => {
  assert.equal(defaultTeamFilter(["t1", "t2"]), MY_TEAMS);
});

T("a manager opens on the whole club, exactly as before", () => {
  assert.equal(defaultTeamFilter([]), "");
  assert.equal(defaultTeamFilter(undefined), "");
});

// THE CASE THE FEATURE WAS DESIGNED AROUND. Eight coaches here hold more than one squad;
// preselecting a single team would have hidden the rest — and hidden them in the way that
// reads as "the fixtures never imported".
T("BOTH of a two-squad coach's teams are shown, not just the first", () => {
  assert.deepEqual(codes(filterGames(games, { team: MY_TEAMS, myTeamIds: ["t1", "t2"] })), ["1", "2", "3"]);
});

T("and nobody else's fixtures come with them", () => {
  const out = filterGames(games, { team: MY_TEAMS, myTeamIds: ["t1", "t2"] });
  assert.equal(out.some((g) => g.teamId === "t3"), false);
  assert.equal(out.some((g) => !g.teamId), false);
});

T("the coach can still ask for the whole club — the filter is not a wall", () => {
  // It never was one: the rules decide what a coach may read, and this only decides what
  // the screen opens on.
  assert.equal(filterGames(games, { team: "", myTeamIds: ["t1", "t2"] }).length, games.length);
});

T("picking one specific team still works, including one that is not theirs", () => {
  assert.deepEqual(codes(filterGames(games, { team: "t3", myTeamIds: ["t1", "t2"] })), ["4"]);
});

T("home / away still narrows, and combines with my-teams", () => {
  assert.deepEqual(codes(filterGames(games, { team: MY_TEAMS, myTeamIds: ["t1", "t2"], type: "home" })), ["1"]);
  assert.deepEqual(codes(filterGames(games, { team: MY_TEAMS, myTeamIds: ["t1", "t2"], type: "away" })), ["2", "3"]);
});

T("a coach with squads but no fixtures yet gets an empty list, not everyone's", () => {
  // Most squads had no fixtures at all the day this shipped. Falling back to "show
  // everything" would have looked like the filter was broken.
  assert.deepEqual(filterGames(games, { team: MY_TEAMS, myTeamIds: ["t4"] }).map((g) => g.teamId), ["t4"]);
  assert.deepEqual(filterGames(games, { team: MY_TEAMS, myTeamIds: ["tX"] }), []);
});

T("'my teams' is offered only to someone who has some", () => {
  assert.deepEqual(teamFilterOptions(data.teams, ["t1"])[0], { id: MY_TEAMS, name: "הקבוצות שלי" });
  assert.equal(teamFilterOptions(data.teams, ["t1"]).length, data.teams.length + 1);
  assert.deepEqual(teamFilterOptions(data.teams, []), data.teams);
});

T("the sentinel cannot collide with a real team id", () => {
  // Ids come from uid(): eight lower-case alphanumerics. This is neither.
  assert.equal(/^[a-z0-9]{8}$/.test(MY_TEAMS), false);
  assert.equal(data.teams.some((t) => t.id === MY_TEAMS), false);
});

T("rubbish in the list never throws", () => {
  assert.deepEqual(filterGames(null, { team: MY_TEAMS, myTeamIds: ["t1"] }), []);
  assert.deepEqual(filterGames([null, undefined], {}), []);
  assert.equal(filterGames(games).length, games.length);
});

console.log(`\n${count} game-filter tests passed`);

// ── order ────────────────────────────────────────────────────────────────────────────
{
  const { sortGames, GAME_SORTS } = await import("../src/utils/gameFilters.js");
  const a = (await import("node:assert/strict")).default;
  const ok = (n, f) => { f(); console.log("  ok  " + n); };

  const teams = [
    { id: "t1", name: "בוגרים" },
    { id: "t2", name: "אלופים" },
  ];
  // As the federation's file lists them: no order a person can use.
  const list = [
    { federationCode: "1", teamId: "t1", date: "19-10-2026", time: "20:30" },
    { federationCode: "2", teamId: "t2", date: "12-10-2026", time: "20:30" },
    { federationCode: "3", teamId: "t1", date: "12-10-2026", time: "18:00" },
    { federationCode: "4", teamId: "t2", date: "05-11-2026", time: "19:00" },
    { federationCode: "5", teamId: "t1", date: "", time: "" },
  ];
  const codes = (out) => out.map((g) => g.federationCode);

  ok("by date, across months and years, not by the text of the date", () => {
    // "05-11" must come after "19-10": a plain string sort puts it first.
    assert.deepEqual(codes(sortGames(list, "date", { teams })), ["3", "2", "1", "4", "5"]);
  });

  ok("same day is settled by the hour", () => {
    const out = sortGames(list, "date", { teams });
    assert.deepEqual(codes(out).slice(0, 2), ["3", "2"]); // 18:00 before 20:30
  });

  ok("an unreadable date sorts LAST, never first", () => {
    // At the top it reads as the whole screen being broken.
    assert.equal(codes(sortGames(list, "date", { teams })).at(-1), "5");
  });

  ok("by team groups the squad together, and by date inside it", () => {
    const out = codes(sortGames(list, "team", { teams }));
    assert.deepEqual(out, ["2", "4", "3", "1", "5"]); // אלופים before בוגרים
  });

  ok("the file's own order is available, untouched", () => {
    assert.deepEqual(codes(sortGames(list, "source", { teams })), ["1", "2", "3", "4", "5"]);
  });

  ok("SORTING NEVER MUTATES THE CLUB'S OWN ARRAY", () => {
    // This list is `data.games`. Sorting it in place would reorder stored data as a side
    // effect of looking at a screen.
    const before = codes(list);
    sortGames(list, "date", { teams });
    sortGames(list, "team", { teams });
    assert.deepEqual(codes(list), before);
  });

  ok("rubbish never throws, and every offered sort is handled", () => {
    assert.deepEqual(sortGames(null, "date"), []);
    assert.deepEqual(sortGames([null, undefined], "date"), []);
    for (const s of GAME_SORTS) assert.equal(Array.isArray(sortGames(list, s.id, { teams })), true);
    assert.equal(sortGames(list, "nonsense", { teams }).length, list.length);
  });

  console.log("\n7 order tests passed");
}
