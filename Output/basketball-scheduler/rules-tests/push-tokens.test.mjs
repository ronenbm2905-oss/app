// Can one coach reach another coach's phone?
//
// `pushTokens` is not a list of documents — it is a map of WHICH PERSON HOLDS WHICH DEVICE,
// stored next to their email address. The collection is more sensitive than any single row
// in it, which is why the read rule here is ownership-based rather than club-wide the way
// `videos` is.
//
// And the rule has to allow one more thing that is easy to miss: a coach must be able to
// DELETE their own row, because that is the only way to turn notifications off. A rule that
// reviews cleanly but blocks that leaves a person unable to withdraw — the promise in
// privacy policy §2ז would be one the system does not keep.
//
//   npx firebase emulators:exec --only firestore --project demo-basketball "node rules-tests/push-tokens.test.mjs"

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { readFileSync } from "node:fs";

const COACH = "coach@example.com";
const OTHER_COACH = "other@example.com";
const MANAGER = "manager@example.com";
const OUTSIDER = "nobody@example.com";

const env = await initializeTestEnvironment({
  projectId: "demo-basketball",
  firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
});

// NOTE the shape of this club, because it is the shape of the real one: the manager is in
// `admins` and NOT in `members`. On 16.9 the live club was measured and all three admins
// were outside `members[]`. A rule written as `isClubMember(...)` alone therefore locks out
// every manager — which is exactly the bug this collection shipped with.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "clubs/main"), {
    admins: [MANAGER],
    members: [COACH, OTHER_COACH],
  });
  await setDoc(doc(db, "clubs/main/pushTokens/tok-other"), {
    token: "tok-other", coachId: "c2", authorEmail: OTHER_COACH,
    updatedAt: "2026-09-16T10:00:00.000Z",
  });
});

const as = (email) => env.authenticatedContext(email.split("@")[0], { email }).firestore();
const row = (authorEmail, token) => ({
  token, coachId: "c1", authorEmail, updatedAt: "2026-09-16T12:00:00.000Z",
});

let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log("  ok  " + name); };

console.log("— THE QUESTION: can a coach reach another coach's device? —");

await t("a coach CANNOT read another coach's device row", async () => {
  await assertFails(getDoc(doc(as(COACH), "clubs/main/pushTokens/tok-other")));
});
await t("a coach CANNOT list the collection — that is the map, not a row", async () => {
  await assertFails(getDocs(collection(as(COACH), "clubs/main/pushTokens")));
});
await t("a coach CANNOT delete another coach's device row", async () => {
  await assertFails(deleteDoc(doc(as(COACH), "clubs/main/pushTokens/tok-other")));
});

console.log("— registering, and being able to stop —");

await t("a coach can register their OWN device", async () => {
  await assertSucceeds(
    setDoc(doc(as(COACH), "clubs/main/pushTokens/tok-mine"), row(COACH, "tok-mine"))
  );
});
await t("a coach CANNOT register a row signed with someone else's address", async () => {
  await assertFails(
    setDoc(doc(as(COACH), "clubs/main/pushTokens/tok-forged"), row(OTHER_COACH, "tok-forged"))
  );
});
await t("a coach can read back their own row", async () => {
  const snap = await assertSucceeds(getDoc(doc(as(COACH), "clubs/main/pushTokens/tok-mine")));
  if (!snap.exists()) throw new Error("the coach's own row is invisible to them");
});
await t("a coach CAN delete their own row — this is how notifications are switched off", async () => {
  await assertSucceeds(deleteDoc(doc(as(COACH), "clubs/main/pushTokens/tok-mine")));
});

console.log("— the manager, who is an admin and NOT a member —");

await t("a manager can read a coach's row, though not in members[]", async () => {
  await assertSucceeds(getDoc(doc(as(MANAGER), "clubs/main/pushTokens/tok-other")));
});
await t("a manager can list the collection — needed to clear a leaver's devices", async () => {
  await assertSucceeds(getDocs(collection(as(MANAGER), "clubs/main/pushTokens")));
});
await t("a manager can register their OWN device (the bug that shipped on 16.9)", async () => {
  await assertSucceeds(
    setDoc(doc(as(MANAGER), "clubs/main/pushTokens/tok-mgr"), row(MANAGER, "tok-mgr"))
  );
});
await t("a manager can delete a leaver's row — M2 depends on this", async () => {
  await assertSucceeds(deleteDoc(doc(as(MANAGER), "clubs/main/pushTokens/tok-other")));
});

console.log("— outside the club —");

await t("someone not in the club reads nothing", async () => {
  await assertFails(getDoc(doc(as(OUTSIDER), "clubs/main/pushTokens/tok-mgr")));
});
await t("someone not in the club cannot register a device", async () => {
  await assertFails(
    setDoc(doc(as(OUTSIDER), "clubs/main/pushTokens/tok-out"), row(OUTSIDER, "tok-out"))
  );
});

await env.cleanup();
console.log("\n" + pass + " rules tests passed");
