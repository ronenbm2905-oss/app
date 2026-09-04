import assert from "node:assert/strict";
import {
  isFixedTeam, fixedTeams, templateWeekFor, templateSessions,
  pendingFixedTeams, buildFixedSessions, countPending, skipWeek,
} from "../src/utils/fixedTeams.js";

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("  ok  " + name); };
let n = 0;
const makeId = () => `new${++n}`;

const teams = [
  { id: "school-barak", name: "בית ספר לכדורסל ברק", weekly: true },
  { id: "school-sharet", name: "בית ספר לכדורסל שרת", weekly: true },
  { id: "noar", name: "נוער על" },                       // ordinary team
];
const S = (id, teamId, weekOf, day, extra = {}) => ({
  id, teamId, weekOf, day, start: "16:30", end: "18:00",
  coachId: "c1", hallId: "h1", type: "אימון", notes: "", ...extra,
});

console.log("- the flag -");
t("weekly marks a fixed team", () => assert.equal(isFixedTeam(teams[0]), true));
t("an ordinary team is not fixed", () => assert.equal(isFixedTeam(teams[2]), false));
t("fixedTeams picks exactly the marked ones", () =>
  assert.deepEqual(fixedTeams(teams).map((x) => x.id), ["school-barak", "school-sharet"]));

console.log("- finding the template week -");
const base = [
  S("a1", "school-barak", "2026-08-23", "ראשון"),
  S("a2", "school-barak", "2026-08-23", "שני"),
  S("b1", "school-sharet", "2026-08-23", "שני"),
  S("n1", "noar", "2026-08-30", "שני"),
];
t("the last week the team ran, walking back", () =>
  assert.equal(templateWeekFor(base, "school-barak", "2026-09-06"), "2026-08-23"));
t("a nearer week wins over an older one", () => {
  const s = [...base, S("a3", "school-barak", "2026-08-30", "ראשון")];
  assert.equal(templateWeekFor(s, "school-barak", "2026-09-06"), "2026-08-30");
});
t("never looks forward", () =>
  assert.equal(templateWeekFor([S("f", "school-barak", "2026-09-20", "ראשון")], "school-barak", "2026-09-06"), ""));
t("gives up after maxBack weeks — a dormant team is not resurrected", () =>
  assert.equal(templateWeekFor(base, "school-barak", "2026-12-06", 8), ""));
t("imported games are not a template", () =>
  assert.equal(templateWeekFor([S("g", "school-barak", "2026-08-30", "ראשון", { fromGame: true })], "school-barak", "2026-09-06"), ""));

console.log("- what is pending -");
const data = { teams, sessions: base };
t("both fixed teams are offered for an empty week", () => {
  const p = pendingFixedTeams(data, "2026-09-06");
  assert.deepEqual(p.map((e) => e.team.id), ["school-barak", "school-sharet"]);
  assert.equal(countPending(p), 3); // 2 barak + 1 sharet
});
t("the ordinary team is never offered", () => {
  const p = pendingFixedTeams(data, "2026-09-06");
  assert.ok(!p.some((e) => e.team.id === "noar"));
});
t("a team already entered that week is left alone — even partly", () => {
  const d = { teams, sessions: [...base, S("x", "school-barak", "2026-09-06", "ראשון")] };
  const p = pendingFixedTeams(d, "2026-09-06");
  assert.deepEqual(p.map((e) => e.team.id), ["school-sharet"]);
});
t("the template week itself has nothing pending", () =>
  assert.deepEqual(pendingFixedTeams(data, "2026-08-23"), []));
t("a skipped week asks nothing", () => {
  const d = { ...data, fixedWeekSkips: ["2026-09-06"] };
  assert.deepEqual(pendingFixedTeams(d, "2026-09-06"), []);
});
t("no fixed teams = no work", () =>
  assert.deepEqual(pendingFixedTeams({ teams: [teams[2]], sessions: base }, "2026-09-06"), []));

console.log("- what gets built -");
t("one new session per template session, stamped with the target week", () => {
  n = 0;
  const p = pendingFixedTeams(data, "2026-09-06");
  const built = buildFixedSessions(p, "2026-09-06", makeId);
  assert.equal(built.length, 3);
  built.forEach((s) => assert.equal(s.weekOf, "2026-09-06"));
});
t("ids are fresh — never the template's", () => {
  n = 0;
  const built = buildFixedSessions(pendingFixedTeams(data, "2026-09-06"), "2026-09-06", makeId);
  assert.deepEqual(built.map((s) => s.id), ["new1", "new2", "new3"]);
  assert.ok(!built.some((s) => ["a1", "a2", "b1"].includes(s.id)));
});
t("day, hour, coach and hall carry over", () => {
  n = 0;
  const built = buildFixedSessions(pendingFixedTeams(data, "2026-09-06"), "2026-09-06", makeId);
  const first = built[0];
  assert.equal(first.day, "ראשון");
  assert.equal(first.start, "16:30");
  assert.equal(first.coachId, "c1");
  assert.equal(first.hallId, "h1");
  assert.equal(first.teamId, "school-barak");
});
t("a one-off time nudge does NOT carry over", () => {
  n = 0;
  const d = { teams, sessions: [S("z", "school-barak", "2026-08-30", "ראשון", { timeOverride: { start: "17:00", end: "18:30" } })] };
  const built = buildFixedSessions(pendingFixedTeams(d, "2026-09-06"), "2026-09-06", makeId);
  assert.equal(built[0].timeOverride, undefined);
});
t("a cancellation does NOT carry over — cancelled once is not cancelled forever", () => {
  n = 0;
  const d = { teams, sessions: [S("z", "school-barak", "2026-08-30", "ראשון", { cancelled: true, cancelledAt: "x" })] };
  const built = buildFixedSessions(pendingFixedTeams(d, "2026-09-06"), "2026-09-06", makeId);
  assert.equal(built[0].cancelled, undefined);
  assert.equal(built[0].cancelledAt, undefined);
});
t("an edit made last week is what next week inherits", () => {
  n = 0;
  const d = { teams, sessions: [...base, S("edited", "school-barak", "2026-08-30", "שלישי", { start: "17:15", end: "18:45" })] };
  const built = buildFixedSessions(pendingFixedTeams(d, "2026-09-06"), "2026-09-06", makeId);
  const barak = built.filter((s) => s.teamId === "school-barak");
  assert.equal(barak.length, 1);                 // 2026-08-30 is the nearer week: one row
  assert.equal(barak[0].day, "שלישי");
  assert.equal(barak[0].start, "17:15");
});
t("filling twice in a row adds nothing the second time", () => {
  n = 0;
  let d = { teams, sessions: base };
  const built = buildFixedSessions(pendingFixedTeams(d, "2026-09-06"), "2026-09-06", makeId);
  d = { ...d, sessions: [...d.sessions, ...built] };
  assert.deepEqual(pendingFixedTeams(d, "2026-09-06"), []);
});

console.log("- skipping -");
t("skipWeek records the week", () =>
  assert.deepEqual(skipWeek({ fixedWeekSkips: [] }, "2026-09-06"), ["2026-09-06"]));
t("skipping twice does not duplicate", () =>
  assert.deepEqual(skipWeek({ fixedWeekSkips: ["2026-09-06"] }, "2026-09-06"), ["2026-09-06"]));
t("skipping one week leaves the others asking", () => {
  const d = { ...data, fixedWeekSkips: ["2026-09-06"] };
  assert.equal(pendingFixedTeams(d, "2026-09-13").length > 0, true);
});

console.log("\n" + pass + " tests passed");
