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
