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
import { doc, getDoc, setDoc, deleteDoc, getDocs, collection, query, where } from "firebase/firestore";

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

  await setDoc(doc(db, "clubs", CLUB, "gameNotes", "G-1"), {
    text: "שיחקנו טוב", authorEmail: "coach@club.org", author: "מאמן", updatedAt: "2026-09-01",
  });
  await setDoc(doc(db, "clubs", CLUB, "trainingPlans", "S-1"), {
    rows: [], units: {}, summary: "", authorEmail: "coach@club.org", author: "מאמן", updatedAt: "2026-09-01",
  });
  await setDoc(doc(db, "clubs", CLUB, "trainingPlans", "S-2"), {
    rows: [], units: {}, summary: "", authorEmail: "other@club.org", author: "אחר", updatedAt: "2026-09-01",
  });
  await setDoc(doc(db, "clubs", CLUB, "videos", "V-1"), {
    title: "תרגיל מסירות", url: "https://youtu.be/abc", provider: "youtube",
    authorEmail: "coach@club.org", author: "מאמן", createdAt: "2026-09-01",
  });
  await setDoc(doc(db, "clubs", CLUB, "videos", "V-2"), {
    title: "של אחר", url: "https://youtu.be/def", provider: "youtube",
    authorEmail: "other@club.org", author: "אחר", createdAt: "2026-09-01",
  });
  await setDoc(doc(db, "clubs", CLUB, "gameNotes", "G-2"), {
    text: "של מישהו אחר", authorEmail: "other@club.org", author: "אחר", updatedAt: "2026-09-01",
  });

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
const asOther = testEnv.authenticatedContext("other", { email: "other@club.org" }).firestore();

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

console.log("\nA coach's own writing:");
const note = (db, id) => doc(db, "clubs", CLUB, "gameNotes", id);
const mine = { text: "עודכן", authorEmail: "coach@club.org", author: "מאמן", updatedAt: "2026-09-02" };

await check("a coach reads their own note", assertSucceeds(getDoc(note(asCoach, "G-1"))));
await check("a coach CANNOT read another coach's note", assertFails(getDoc(note(asCoach, "G-2"))));
await check("a coach updates their own note", assertSucceeds(setDoc(note(asCoach, "G-1"), mine)));
await check("a coach CANNOT overwrite another coach's note",
  assertFails(setDoc(note(asCoach, "G-2"), mine)));
// The give-it-away case: writing someone else's address onto a new record would let a
// coach plant a note in a colleague's name, and would put it out of their own reach.
await check("a coach CANNOT create a note owned by someone else",
  assertFails(setDoc(note(asCoach, "G-9"), { ...mine, authorEmail: "other@club.org" })));
await check("a coach CANNOT hand their own note to someone else",
  assertFails(setDoc(note(asCoach, "G-1"), { ...mine, authorEmail: "other@club.org" })));
await check("a note with no authorEmail at all is refused",
  assertFails(setDoc(note(asCoach, "G-8"), { text: "אנונימי" })));
await check("a coach creates a new note of their own",
  assertSucceeds(setDoc(note(asCoach, "G-7"), mine)));

await check("the manager reads every note", assertSucceeds(getDoc(note(asAdmin, "G-2"))));
// Marking a note read is the manager's job, and they do not own the record.
await check("the manager marks someone else's note read",
  assertSucceeds(setDoc(note(asAdmin, "G-2"),
    { text: "של מישהו אחר", authorEmail: "other@club.org", author: "אחר", updatedAt: "2026-09-01", readAt: "2026-09-03" })));
await check("the manager deletes a note they do not own", assertSucceeds(deleteDoc(note(asAdmin, "G-7"))));

await check("an outsider cannot read a note", assertFails(getDoc(note(asStranger, "G-1"))));
await check("a portal parent cannot read a note", assertFails(getDoc(note(asParentA, "G-1"))));

console.log("\nListening to the collection:");
const notes = (db) => collection(db, "clubs", CLUB, "gameNotes");
// Rules do not FILTER a listen — they refuse it unless the query is provably inside the
// rule. This is the pair of assertions the client's scoped/unscoped split depends on.
await check("a coach CANNOT list the whole collection", assertFails(getDocs(notes(asCoach))));
await check("a coach CAN list their own, scoped by authorEmail",
  assertSucceeds(getDocs(query(notes(asCoach), where("authorEmail", "==", "coach@club.org")))));
await check("a coach CANNOT list under someone else's address",
  assertFails(getDocs(query(notes(asCoach), where("authorEmail", "==", "other@club.org")))));
await check("the manager lists the whole collection", assertSucceeds(getDocs(notes(asAdmin))));

console.log("\nThe shared video library — read wide, write narrow:");
const vid = (db, id) => doc(db, "clubs", CLUB, "videos", id);
const videos = (db) => collection(db, "clubs", CLUB, "videos");
const myVideo = { title: "עודכן", url: "https://youtu.be/abc", provider: "youtube", authorEmail: "coach@club.org", author: "מאמן", createdAt: "2026-09-01" };

// The pair that makes it a LIBRARY. If read were owner-scoped like the notes, every coach
// would see only what they added — the feature would be broken, not secured.
await check("a coach reads a link ANOTHER coach added", assertSucceeds(getDoc(vid(asCoach, "V-2"))));
await check("a coach lists the WHOLE library unscoped", assertSucceeds(getDocs(videos(asCoach))));

await check("a coach edits their own link", assertSucceeds(setDoc(vid(asCoach, "V-1"), myVideo)));
await check("a coach CANNOT edit another coach's link", assertFails(setDoc(vid(asCoach, "V-2"), myVideo)));
await check("a coach CANNOT delete another coach's link", assertFails(deleteDoc(vid(asCoach, "V-2"))));
await check("a coach CANNOT add a link in someone else's name",
  assertFails(setDoc(vid(asCoach, "V-9"), { ...myVideo, authorEmail: "other@club.org" })));
// Releasing an entry to the club: the manager blanks the owner and the link stays. This
// is the mechanism behind the privacy policy's promise that a departing coach's details
// come off the links they contributed — a club has no Firebase console to do it by hand.
await check("the manager releases another coach's entry to the club",
  assertSucceeds(setDoc(vid(asAdmin, "V-2"),
    { title: "של אחר", url: "https://youtu.be/def", provider: "youtube", authorEmail: "", author: "", createdAt: "2026-09-01" })));
await check("...and after that the coach can no longer edit it",
  assertFails(setDoc(vid(asOther, "V-2"),
    { title: "בחזרה", url: "https://youtu.be/def", provider: "youtube", authorEmail: "other@club.org", author: "אחר", createdAt: "2026-09-01" })));
await check("...but every coach still READS it — the link stayed in the library",
  assertSucceeds(getDoc(vid(asCoach, "V-2"))));
await check("a coach CANNOT release someone else's entry",
  assertFails(setDoc(vid(asCoach, "V-1"), { ...myVideo, authorEmail: "", author: "" })));

await check("the manager removes anything", assertSucceeds(deleteDoc(vid(asAdmin, "V-2"))));

await check("an outsider cannot read the library", assertFails(getDoc(vid(asStranger, "V-1"))));
await check("a portal parent cannot read the library", assertFails(getDoc(vid(asParentA, "V-1"))));

console.log("\nTraining plans — a coach's own working document:");
const planDoc = (db, id) => doc(db, "clubs", CLUB, "trainingPlans", id);
const myPlan = { rows: [], units: {}, summary: "עודכן", authorEmail: "coach@club.org", author: "מאמן", updatedAt: "2026-09-02" };
await check("a coach reads their own plan", assertSucceeds(getDoc(planDoc(asCoach, "S-1"))));
await check("a coach CANNOT read another coach's plan", assertFails(getDoc(planDoc(asCoach, "S-2"))));
await check("a coach writes their own plan", assertSucceeds(setDoc(planDoc(asCoach, "S-1"), myPlan)));
await check("a coach CANNOT write another coach's plan", assertFails(setDoc(planDoc(asCoach, "S-2"), myPlan)));
await check("the manager reads every plan", assertSucceeds(getDoc(planDoc(asAdmin, "S-2"))));
// Same listen rule as the notes: unscoped is refused outright, scoped is allowed.
await check("a coach CANNOT list every plan", assertFails(getDocs(collection(asCoach, "clubs", CLUB, "trainingPlans"))));
await check("a coach CAN list their own, scoped",
  assertSucceeds(getDocs(query(collection(asCoach, "clubs", CLUB, "trainingPlans"), where("authorEmail", "==", "coach@club.org")))));
await check("a portal parent cannot read a plan", assertFails(getDoc(planDoc(asParentA, "S-1"))));

await testEnv.cleanup();
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
