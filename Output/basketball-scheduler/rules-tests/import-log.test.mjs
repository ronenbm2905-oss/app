// Is the import log actually append-only, and actually closed to a coach?
//
// The screen has no edit button and no delete button, and the component says so in a
// comment. Neither of those is a boundary — a browser console is one line away from both.
// THIS is the boundary, and reading the rule is not the same as running it.
//
//   npx firebase emulators:exec --only firestore --project demo-basketball "node rules-tests/import-log.test.mjs"
//
// The property under test is the one the whole record rests on: an entry says that a named
// person approved a change a background job proposed. If that entry can be edited or removed
// afterwards, it is a note, not a record.

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs } from "firebase/firestore";
import { readFileSync } from "node:fs";

const COACH = "coach@example.com";
const MANAGER = "manager@example.com";
const OTHER_MANAGER = "manager2@example.com";
const OUTSIDER = "nobody@example.com";

const env = await initializeTestEnvironment({
  projectId: "demo-basketball",
  firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
});

const entry = (by = MANAGER) => ({
  at: "2026-09-23T17:43:05.000Z",
  by,
  proposalId: "2026-09-23",
  sourceFile: "latest.xlsx",
  partial: false,
  total: 1,
  added: [{ code: "800509", label: "קטסל א · 13-10-2026 · נגד אליצור", teamId: "t1" }],
  updated: [],
  cancelled: [],
  restored: [],
});

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "clubs/main"), {
    admins: [MANAGER, OTHER_MANAGER],
    // A full member of the club — which is the point. Membership opens the weekly board,
    // the roster and the video library. It must not open this.
    members: [COACH],
  });
  await setDoc(doc(db, "clubs/main/importLog/seed"), entry());
});

const as = (email) => env.authenticatedContext(email.split("@")[0], { email }).firestore();

let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log("  ok  " + name); };

console.log("— the manager, whose decisions these are —");

await t("a manager can list the log", async () => {
  await assertSucceeds(getDocs(collection(as(MANAGER), "clubs/main/importLog")));
});
await t("a manager can read one entry", async () => {
  await assertSucceeds(getDoc(doc(as(MANAGER), "clubs/main/importLog/seed")));
});
await t("a manager can append a new entry", async () => {
  await assertSucceeds(addDoc(collection(as(MANAGER), "clubs/main/importLog"), entry()));
});

console.log("— THE OTHER PROPERTY: `by` is the signer, not a field the client chooses —");

await t("a manager may NOT attribute an approval to the other manager", async () => {
  // Refusing an EDIT of `by` is not the same as refusing a false one written at the start,
  // and in a club with two managers that is the difference between a record and a claim.
  await assertFails(addDoc(collection(as(MANAGER), "clubs/main/importLog"), entry(OTHER_MANAGER)));
});
await t("nor to a name that belongs to nobody", async () => {
  await assertFails(addDoc(collection(as(MANAGER), "clubs/main/importLog"), entry("someone@invented.test")));
  await assertFails(addDoc(collection(as(MANAGER), "clubs/main/importLog"), entry("")));
});
await t("a capitalised address is refused — which is why the client lower-cases", async () => {
  // `myEmail()` lower-cases. A client that sends the address as Google returns it would be
  // refused on every approval, with only an amber line and no reason. `importLogEntry`
  // lower-cases for exactly this.
  await assertFails(addDoc(collection(as(MANAGER), "clubs/main/importLog"), entry(MANAGER.toUpperCase())));
});

console.log("— THE PROPERTY: written once, never touched again —");

await t("a manager may NOT edit an entry they wrote", async () => {
  await assertFails(updateDoc(doc(as(MANAGER), "clubs/main/importLog/seed"), { by: "somebody else" }));
});
await t("a manager may NOT delete an entry", async () => {
  await assertFails(deleteDoc(doc(as(MANAGER), "clubs/main/importLog/seed")));
});
await t("a manager may NOT overwrite an entry with setDoc either", async () => {
  // `setDoc` on an existing path is an update as far as the rules are concerned, and a
  // rule that blocked `update` while leaving this open would protect nothing.
  await assertFails(setDoc(doc(as(MANAGER), "clubs/main/importLog/seed"), entry("someone else")));
});
await t("a SECOND manager may not edit or delete it either", async () => {
  await assertFails(updateDoc(doc(as(OTHER_MANAGER), "clubs/main/importLog/seed"), { total: 99 }));
  await assertFails(deleteDoc(doc(as(OTHER_MANAGER), "clubs/main/importLog/seed")));
});

console.log("— does a club MEMBER get in? —");

await t("a coach may NOT read an entry, although they are in the club", async () => {
  await assertFails(getDoc(doc(as(COACH), "clubs/main/importLog/seed")));
});
// `allow read` covers get AND list, and a collection listen is a list.
await t("a coach may NOT LIST the log either", async () => {
  await assertFails(getDocs(collection(as(COACH), "clubs/main/importLog")));
});
await t("a coach may NOT write an entry", async () => {
  await assertFails(addDoc(collection(as(COACH), "clubs/main/importLog"), entry(COACH)));
});

console.log("— and somebody who is not in the club at all —");

await t("an outsider is refused on every operation", async () => {
  await assertFails(getDoc(doc(as(OUTSIDER), "clubs/main/importLog/seed")));
  await assertFails(getDocs(collection(as(OUTSIDER), "clubs/main/importLog")));
  await assertFails(addDoc(collection(as(OUTSIDER), "clubs/main/importLog"), entry(OUTSIDER)));
});

// The contrast test. Without it every assertion above could be passing because the whole
// emulator refuses everything, and the suite would look green while proving nothing.
await t("CONTRAST: the same coach CAN read the club document", async () => {
  await assertSucceeds(getDoc(doc(as(COACH), "clubs/main")));
});

console.log(`\n${pass} import-log rules tests passed`);
await env.cleanup();
