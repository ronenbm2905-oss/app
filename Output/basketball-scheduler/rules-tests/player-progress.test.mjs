// Is a progress note really private to its author and the manager?
//
// This is the one claim the feature makes to coaches, and the legal documents repeat it.
// Reading the rules is not running them. This runs them, against the real firestore.rules
// file, in the emulator.
//
//   npx firebase emulators:exec --only firestore --project demo-basketball "node rules-tests/player-progress.test.mjs"

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from "firebase/firestore";
import { readFileSync } from "node:fs";

const COACH = "coach@example.com";
const OTHER_COACH = "other@example.com";
const MANAGER = "manager@example.com";
const OUTSIDER = "nobody@example.com";

const PERIOD = "2026-27-A";
const MINE = `p1__${PERIOD}`;
const THEIRS = `p2__${PERIOD}`;

const env = await initializeTestEnvironment({
  projectId: "demo-basketball",
  firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
});

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "clubs/main"), {
    admins: [MANAGER],
    members: [COACH, OTHER_COACH, MANAGER],
  });
  const entry = (authorEmail, playerId) => ({
    playerId, teamId: "t1", period: PERIOD,
    text: "התקדם במסירה ובקריאת משחק", author: "מאמן", authorEmail,
    createdAt: "2026-12-01T00:00:00.000Z", updatedAt: "2026-12-01T00:00:00.000Z", readAt: null,
  });
  await setDoc(doc(db, `clubs/main/playerProgress/${MINE}`), entry(COACH, "p1"));
  await setDoc(doc(db, `clubs/main/playerProgress/${THEIRS}`), entry(OTHER_COACH, "p2"));
});

const as = (email) => env.authenticatedContext(email.split("@")[0], { email }).firestore();
const col = (db) => collection(db, "clubs/main/playerProgress");
const fresh = (authorEmail) => ({
  playerId: "p9", teamId: "t1", period: PERIOD, text: "חדש", author: "מאמן",
  authorEmail, createdAt: "2026-12-30T00:00:00.000Z", updatedAt: "2026-12-30T00:00:00.000Z", readAt: null,
});

let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log("  ok  " + name); };

console.log("— THE PROMISE: one coach cannot read another coach's note —");

await t("a coach CANNOT read a note another coach wrote", async () => {
  // If this ever starts passing, the feature's only privacy claim is gone.
  await assertFails(getDoc(doc(as(COACH), `clubs/main/playerProgress/${THEIRS}`)));
});
await t("and cannot reach it by listening to the collection either", async () => {
  await assertFails(getDocs(col(as(COACH))));
});
await t("a coach CAN read their own note", async () => {
  const snap = await assertSucceeds(getDoc(doc(as(COACH), `clubs/main/playerProgress/${MINE}`)));
  if (!snap.exists()) throw new Error("a coach cannot read back what they wrote");
});
await t("a coach's filtered listen — the one the hook actually uses — works", async () => {
  const q = query(col(as(COACH)), where("authorEmail", "==", COACH));
  const snap = await assertSucceeds(getDocs(q));
  if (snap.size !== 1) throw new Error(`expected 1 own document, got ${snap.size}`);
});
await t("a coach cannot widen that filter to someone else", async () => {
  await assertFails(getDocs(query(col(as(COACH)), where("authorEmail", "==", OTHER_COACH))));
});

console.log("— the manager —");

await t("the manager reads the whole collection", async () => {
  const snap = await assertSucceeds(getDocs(col(as(MANAGER))));
  if (snap.size !== 2) throw new Error(`manager should see both, got ${snap.size}`);
});
await t("the manager reads a note they did not write", async () => {
  await assertSucceeds(getDoc(doc(as(MANAGER), `clubs/main/playerProgress/${THEIRS}`)));
});
await t("the manager marks it read without owning it", async () => {
  await assertSucceeds(updateDoc(doc(as(MANAGER), `clubs/main/playerProgress/${MINE}`), {
    readAt: "2026-12-31T00:00:00.000Z",
  }));
});
await t("...and by the path the app actually takes — a whole-document setDoc", async () => {
  // `usePlayerProgress.saveProgress` writes the entire document, not a field patch. Testing
  // only `updateDoc` would leave the code path the app runs unexercised: `canChange` sees a
  // full incoming document, and a manager passes on `isClubAdmin` before ownership is even
  // consulted. Worth asserting rather than assuming.
  const snap = await getDoc(doc(as(MANAGER), `clubs/main/playerProgress/${MINE}`));
  await assertSucceeds(setDoc(doc(as(MANAGER), `clubs/main/playerProgress/${MINE}`), {
    ...snap.data(), readAt: "2026-12-31T12:00:00.000Z",
  }));
  const after = await getDoc(doc(as(MANAGER), `clubs/main/playerProgress/${MINE}`));
  if (after.data().authorEmail !== COACH) throw new Error("markRead must not re-stamp ownership");
});

console.log("— writing —");

await t("a coach writes their own note", async () => {
  await assertSucceeds(setDoc(doc(as(COACH), `clubs/main/playerProgress/p9__${PERIOD}`), fresh(COACH)));
});
await t("a coach CANNOT file a note signed with someone else's address", async () => {
  await assertFails(setDoc(doc(as(COACH), `clubs/main/playerProgress/p8__${PERIOD}`), fresh(OTHER_COACH)));
});
await t("a coach cannot edit another coach's note", async () => {
  await assertFails(updateDoc(doc(as(COACH), `clubs/main/playerProgress/${THEIRS}`), { text: "שונה" }));
});
await t("a coach cannot re-stamp their own note to another author", async () => {
  await assertFails(updateDoc(doc(as(COACH), `clubs/main/playerProgress/${MINE}`), { authorEmail: OTHER_COACH }));
});
await t("a coach deletes their own; not another's", async () => {
  await assertSucceeds(deleteDoc(doc(as(COACH), `clubs/main/playerProgress/p9__${PERIOD}`)));
  await assertFails(deleteDoc(doc(as(COACH), `clubs/main/playerProgress/${THEIRS}`)));
});

console.log("— outside the club —");

await t("someone not in the club reads nothing", async () => {
  await assertFails(getDoc(doc(as(OUTSIDER), `clubs/main/playerProgress/${MINE}`)));
  await assertFails(getDocs(col(as(OUTSIDER))));
});
await t("nor writes anything", async () => {
  await assertFails(setDoc(doc(as(OUTSIDER), `clubs/main/playerProgress/p7__${PERIOD}`), fresh(OUTSIDER)));
});
await t("signed out reads nothing", async () => {
  const anon = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon, `clubs/main/playerProgress/${MINE}`)));
});

console.log("— the neighbours are unchanged —");

await t("the shared video library is still shared (no regression from this block)", async () => {
  await assertSucceeds(getDocs(collection(as(COACH), "clubs/main/videos")));
});

await env.cleanup();
console.log("\n" + pass + " rules tests passed");
