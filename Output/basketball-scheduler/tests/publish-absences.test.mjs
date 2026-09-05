// The parent-facing document must never carry an absence.
//
// An absence is the one record in the club document written by a MANAGER about a COACH.
// The coach did not write it, and may not know it exists — `note` is where "מילואים" or
// "ניתוח" gets typed. `availability.js` hides that note by default inside the app; this
// suite is the outer boundary: nothing about an absence may reach a parent at all.
//
// Written when `absences` was ported from the single-club branch. Nothing published it
// then — `buildPublicWeek` is an allowlist, so a new club-document field is excluded by
// construction. That is exactly why the test exists: it locks the current, correct
// behaviour in place before a future field addition upstream has a chance to change it.

import assert from "node:assert/strict";
import {
  buildPublicWeek,
  buildSharedWeek,
  buildTeamWeek,
  findLeakedKeys,
  FORBIDDEN_KEYS,
} from "../src/utils/publish.js";

const WEEK = "2026-09-06"; // a Sunday

const NOTE = "מילואים";

const COACH_EMAIL = "dana.coach@gmail.com";

const club = {
  settings: { name: "מכבי בדיקה", legal: { operator: "מכבי בדיקה", email: "office@club.org" } },
  teams: [{ id: "t1", name: "נוער א", coachId: "c1" }],
  coaches: [{ id: "c1", name: "דנה", phone: "050-1111111", email: COACH_EMAIL }],
  halls: [{ id: "h1", name: "אולם מרכזי" }],
  sessions: [
    {
      id: "s1", teamId: "t1", coachId: "c1", hallId: "h1",
      day: "ראשון", start: "17:00", end: "18:30", weekOf: WEEK, type: "אימון",
    },
  ],
  holidays: [],
  absences: [
    { id: "a1", coachId: "c1", date: "2026-09-06", start: "", end: "", note: NOTE },
    { id: "a2", hallId: "h1", date: "2026-09-07", start: "18:00", end: "22:00", note: "עירייה" },
  ],
};

const asText = (doc) => JSON.stringify(doc);

// ---- 1. Nothing about an absence survives publication ----
for (const [label, doc] of [
  ["buildPublicWeek", buildPublicWeek(club, WEEK, 0)],
  ["buildSharedWeek", buildSharedWeek(club, WEEK, 0)],
  ["buildTeamWeek", buildTeamWeek(club, WEEK, "t1", 0)],
]) {
  const text = asText(doc);
  assert.ok(!text.includes(NOTE), `${label}: the manager's note reached the parent document`);
  assert.ok(!text.includes("עירייה"), `${label}: a hall-closure note reached the parent document`);
  assert.ok(!text.includes("absences"), `${label}: the absences key reached the parent document`);
  assert.ok(!text.includes('"a1"') && !text.includes('"a2"'), `${label}: an absence id reached the parent document`);
  assert.deepEqual(findLeakedKeys(doc), [], `${label}: findLeakedKeys reported a leak`);
}

// The week that IS published still works — a test that only proves emptiness proves nothing.
assert.equal(buildTeamWeek(club, WEEK, "t1", 0).sessions.length, 1, "the session itself stopped being published");

// ---- 1b. A coach's own address never reaches a parent ----
//
// `coaches[].email` is how the app tells which coach is signed in, and the publish
// allowlist copies a coach's NAME only. Note what cannot be used to enforce this:
// "email" must NOT go on FORBIDDEN_KEYS, because the club's own contact address is
// published on purpose — `legal.email` is what lets a parent exercise access or erasure.
// A blanket key ban would block every publish, so the guard is this assertion.
for (const [label, doc] of [
  ["buildPublicWeek", buildPublicWeek(club, WEEK, 0)],
  ["buildSharedWeek", buildSharedWeek(club, WEEK, 0)],
  ["buildTeamWeek", buildTeamWeek(club, WEEK, "t1", 0)],
]) {
  const text = asText(doc);
  assert.ok(!text.includes(COACH_EMAIL), `${label}: a coach's sign-in address reached the parent document`);
  assert.ok(!text.includes("050-1111111"), `${label}: a coach's phone reached the parent document`);
}
// The coach's NAME is published on purpose, so the parent knows who takes the training.
// Asserted on the two documents that carry a team's week — the shared document deliberately
// carries team names and nothing else, and asserting a name there would be asserting a bug.
for (const [label, doc] of [
  ["buildPublicWeek", buildPublicWeek(club, WEEK, 0)],
  ["buildTeamWeek", buildTeamWeek(club, WEEK, "t1", 0)],
]) {
  assert.ok(asText(doc).includes("דנה"), `${label}: the coach's name stopped being published`);
}
assert.ok(!asText(buildSharedWeek(club, WEEK, 0)).includes("דנה"),
  "the shared document should carry team names only, not who coaches them");
// ...while the club's own contact address must still get through, or the footer's privacy
// policy has no one to write to.
assert.ok(asText(buildSharedWeek(club, WEEK, 0)).includes("office@club.org"),
  "the club's contact address stopped reaching the portal");

// ---- 2. The detector actually detects ----
// Without this, every assertion above would keep passing if `findLeakedKeys` were broken
// or `absences` were quietly dropped from the list. This project has shipped a dead
// privacy test before — a regex with no slashes that matched nothing.
assert.ok(FORBIDDEN_KEYS.includes("absences"), "`absences` is not on the forbidden list");
const injected = { ...buildTeamWeek(club, WEEK, "t1", 0), absences: club.absences };
assert.deepEqual(findLeakedKeys(injected), ["$.absences"], "an injected absences block was not caught");

// Nested, too — a leak one level down is the realistic shape (a session carrying its own).
const nested = buildTeamWeek(club, WEEK, "t1", 0);
nested.sessions[0].absences = [club.absences[0]];
assert.deepEqual(findLeakedKeys(nested), ["$.sessions[0].absences"], "a nested absences block was not caught");

// ---- 3. The driver, who is not a user and never agreed to anything ----
//
// A bus driver's name and phone reach the club from the transport company, not from him.
// He has no account, no way to look, and no reason to expect to be in a schedule a parent
// can open. Only five game fields are copied to the portal, so this cannot leak today —
// which is exactly when a guard is worth writing, rather than after it can.
const withDriver = {
  ...club,
  games: [{
    id: "g1", teamId: "t1", date: "10/09/2026", time: "19:00", opponent: "הפועל",
    isHome: false, venue: "אולם היריבה", driverName: "משה הנהג", driverPhone: "052-9999999",
  }],
};
for (const [label, doc] of [
  ["buildPublicWeek", buildPublicWeek(withDriver, WEEK, 0)],
  ["buildTeamWeek", buildTeamWeek(withDriver, WEEK, "t1", 0)],
]) {
  const text = asText(doc);
  assert.ok(!text.includes("משה הנהג"), `${label}: the driver's name reached the parent document`);
  assert.ok(!text.includes("052-9999999"), `${label}: the driver's phone reached the parent document`);
  assert.deepEqual(findLeakedKeys(doc), [], `${label}: findLeakedKeys reported a leak`);
}
assert.ok(FORBIDDEN_KEYS.includes("driverName") && FORBIDDEN_KEYS.includes("driverPhone"),
  "the driver's fields are not on the forbidden list");
assert.ok(FORBIDDEN_KEYS.includes("authorEmail"),
  "the field the record subcollections are owned by is not on the forbidden list");
// The detector catches them where they would realistically appear: on a published game.
{
  const doc = buildTeamWeek(withDriver, WEEK, "t1", 0);
  doc.games[0].driverPhone = "052-9999999";
  assert.deepEqual(findLeakedKeys(doc), ["$.games[0].driverPhone"], "a driver phone on a game was not caught");
}
// ...while the game itself is still published, opponent, venue and all. A guard that
// silently emptied the fixture list would "pass" this file and break the portal.
{
  const games = buildTeamWeek(withDriver, WEEK, "t1", 0).games;
  assert.equal(games.length, 1, "the game stopped being published");
  assert.equal(games[0].opponent, "הפועל");
  assert.equal(games[0].venue, "אולם היריבה");
}

console.log("publish boundary: 38 assertions passed");
