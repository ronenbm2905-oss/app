// Security rules tests, run against the Firestore emulator.
//
// These exist because the portal's access boundary now lives in the rules rather than in
// the portal's rendering. Reading a rules file and believing it is not the same as
// asking the engine — three of the bugs in this project's history were rules that
// compiled cleanly and did the wrong thing at runtime.
//
//   npm run test:rules
//
// Needs Java (the emulator) and no network. Nothing here touches a real project.

import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const CLUB = "demo";
const WEEK = "2026-08-16";
const TEAM_A = "tA";
const TEAM_B = "tB";
const CODE_A = "AAA-111";
const CODE_B = "BBB-222";

let failed = 0;
let passed = 0;
const check = async (name, promise) => {
  try {
    await promise;
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${String(e.message || e).split("\n")[0]}`);
    failed++;
  }
};

const testEnv = await initializeTestEnvironment({
  projectId: "rules-test",
  firestore: {
    rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"),
    host: "127.0.0.1",
    port: 8080,
  },
});

// ---- Seed, bypassing rules ----
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "clubs", CLUB), {
    admins: ["admin@club.org"],
    members: ["coach@club.org"],
    settings: { name: "מועדון" },
  });
  await setDoc(doc(db, "clubs", CLUB, "joinCodes", CODE_A), { teamId: TEAM_A, teamName: "נוער א" });
  await setDoc(doc(db, "clubs", CLUB, "joinCodes", CODE_B), { teamId: TEAM_B, teamName: "נוער ב" });
  await setDoc(doc(db, "clubs", CLUB, "published", WEEK), { weekOf: WEEK, clubName: "מועדון" });
  await setDoc(doc(db, "clubs", CLUB, "published", WEEK, "teams", TEAM_A), { teamId: TEAM_A, sessions: [] });
  await setDoc(doc(db, "clubs", CLUB, "published", WEEK, "teams", TEAM_B), { teamId: TEAM_B, sessions: [] });

  // A parent of team A only.
  await setDoc(doc(db, "portalUsers", "parentA"), {
    clubId: CLUB, teams: { [TEAM_A]: CODE_A }, joinCode: CODE_A, email: "a@p.com",
  });
  // A parent whose stored code no longer exists — the rotated-code case.
  await setDoc(doc(db, "portalUsers", "stale"), {
    clubId: CLUB, teams: { [TEAM_A]: "OLD-999" }, joinCode: "OLD-999", email: "s@p.com",
  });
  // A document still in the pre-split shape.
  await setDoc(doc(db, "portalUsers", "legacy"), {
    clubId: CLUB, teamIds: [TEAM_A], joinCode: CODE_A, email: "l@p.com",
  });
});

const asParentA = testEnv.authenticatedContext("parentA", { email: "a@p.com" }).firestore();
const asStale = testEnv.authenticatedContext("stale", { email: "s@p.com" }).firestore();
const asLegacy = testEnv.authenticatedContext("legacy", { email: "l@p.com" }).firestore();
const asStranger = testEnv.authenticatedContext("nobody", { email: "x@x.com" }).firestore();
const asCoach = testEnv.authenticatedContext("coach", { email: "coach@club.org" }).firestore();
const asAdmin = testEnv.authenticatedContext("admin", { email: "admin@club.org" }).firestore();

const teamDoc = (db, team) => doc(db, "clubs", CLUB, "published", WEEK, "teams", team);
const weekDoc = (db) => doc(db, "clubs", CLUB, "published", WEEK);

console.log("\nM3 — a parent reads their own team and no other:");
await check("parent of A reads team A", assertSucceeds(getDoc(teamDoc(asParentA, TEAM_A))));
await check("parent of A CANNOT read team B", assertFails(getDoc(teamDoc(asParentA, TEAM_B))));
await check("parent of A reads the club-level week", assertSucceeds(getDoc(weekDoc(asParentA))));

console.log("\nM2 — rotating a code actually revokes:");
await check("a parent whose code was replaced loses the team", assertFails(getDoc(teamDoc(asStale, TEAM_A))));
await check("...and a pre-split document grants nothing either", assertFails(getDoc(teamDoc(asLegacy, TEAM_A))));

console.log("\nOutsiders:");
await check("a signed-in stranger cannot read a team week", assertFails(getDoc(teamDoc(asStranger, TEAM_A))));
await check("a signed-in stranger cannot read the club week", assertFails(getDoc(weekDoc(asStranger))));
await check("nobody can read the club document itself", assertFails(getDoc(doc(asParentA, "clubs", CLUB))));

console.log("\nClub staff still see everything they should:");
await check("a coach reads team A", assertSucceeds(getDoc(teamDoc(asCoach, TEAM_A))));
await check("a coach reads team B", assertSucceeds(getDoc(teamDoc(asCoach, TEAM_B))));

console.log("\nWriting the account↔team link:");
await check("a parent cannot claim a team without a code",
  assertFails(setDoc(doc(asStranger, "portalUsers", "nobody"),
    { clubId: CLUB, teams: { [TEAM_B]: "MADE-UP" }, joinCode: "MADE-UP" })));
await check("a parent cannot record a code that unlocks a DIFFERENT team",
  assertFails(setDoc(doc(asStranger, "portalUsers", "nobody"),
    { clubId: CLUB, teams: { [TEAM_B]: CODE_A }, joinCode: CODE_A })));
await check("a valid code creates the link",
  assertSucceeds(setDoc(doc(asStranger, "portalUsers", "nobody"),
    { clubId: CLUB, teams: { [TEAM_A]: CODE_A }, joinCode: CODE_A })));
await check("a parent cannot write someone else's link",
  assertFails(setDoc(doc(asStranger, "portalUsers", "parentA"),
    { clubId: CLUB, teams: { [TEAM_A]: CODE_A }, joinCode: CODE_A })));

console.log("\nA club cannot lock itself out:");
const clubDoc = (db) => doc(db, "clubs", CLUB);
const CLUB_BODY = { members: ["coach@club.org"], settings: { name: "מועדון" } };
await check("an admin edits the club normally",
  assertSucceeds(setDoc(clubDoc(asAdmin), { ...CLUB_BODY, admins: ["admin@club.org"] })));
await check("an admin hands over to another admin",
  assertSucceeds(setDoc(clubDoc(asAdmin), { ...CLUB_BODY, admins: ["admin@club.org", "two@club.org"] })));
// The screen refuses this too, but the screen is not the boundary. Without the rule a
// club could write an empty allowlist and become unreachable by anyone, including the
// service operator — this block grants a super-admin nothing.
await check("an admin CANNOT write an empty admins list",
  assertFails(setDoc(clubDoc(asAdmin), { ...CLUB_BODY, admins: [] })));
await check("...nor drop the admins field altogether",
  assertFails(setDoc(clubDoc(asAdmin), CLUB_BODY)));
await check("...nor replace it with something that is not a list",
  assertFails(setDoc(clubDoc(asAdmin), { ...CLUB_BODY, admins: "admin@club.org" })));
await check("a coach still cannot edit the club at all",
  assertFails(setDoc(clubDoc(asCoach), { ...CLUB_BODY, admins: ["coach@club.org"] })));

await testEnv.cleanup();
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
