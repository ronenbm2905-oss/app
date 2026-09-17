// Can a child claim to be a different child?
//
// This is the first place in the project where someone who is neither a manager nor a coach
// signs in. The browser knows which player it thinks it is; the browser must not be believed.
// A one-time code per player is the proof, and these tests exist to show that the PROOF is
// what is checked — not the claim next to it.
//
//   npx firebase emulators:exec --only firestore --project demo-basketball "node rules-tests/player-accounts.test.mjs"

import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { readFileSync } from "node:fs";

const MANAGER = "manager@example.com";
const COACH = "coach@example.com";

const env = await initializeTestEnvironment({
  projectId: "demo-basketball",
  firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
});

const CODE_DANI = "abcd2345";
const CODE_YUVAL = "efgh6782";

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "clubs/main"), {
    admins: [MANAGER],
    members: [COACH],
    players: [{ id: "p-dani", name: "דני כהן", phone: "0501234567", birthDate: "2010-03-04" }],
  });
  await setDoc(doc(db, "clubs/main/claimCodes/" + CODE_DANI), { playerId: "p-dani", teamId: "t1" });
  await setDoc(doc(db, "clubs/main/claimCodes/" + CODE_YUVAL), { playerId: "p-yuval", teamId: "t1" });
});

const uid = (id, email) => env.authenticatedContext(id, { email }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const account = (u, playerId, code) => ({
  uid: u, playerId, teamId: "t1", code, playerName: "x",
  authorEmail: u + "@example.com", signedInAs: "x", linkedAt: "2026-09-17T00:00:00.000Z",
});

let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log("  ok  " + name); };

console.log("— the code is a key, and the collection is not a keyring —");

await t("someone holding a code can read that ONE document", async () => {
  await assertSucceeds(getDoc(doc(anon(), "clubs/main/claimCodes/" + CODE_DANI)));
});
await t("THE PROTECTION: nobody can list the codes and collect them all", async () => {
  await assertFails(getDocs(collection(anon(), "clubs/main/claimCodes")));
  await assertFails(getDocs(collection(uid("dani", "dani@example.com"), "clubs/main/claimCodes")));
});
await t("and nobody but a manager can create or change one", async () => {
  await assertFails(setDoc(doc(uid("dani", "dani@example.com"), "clubs/main/claimCodes/zzzzzzzz"), { playerId: "p-dani" }));
  await assertSucceeds(setDoc(doc(uid("manager", MANAGER), "clubs/main/claimCodes/wwwwwwww"), { playerId: "p-x" }));
});

console.log("— linking an account —");

await t("a child with their own code links to their own player", async () => {
  await assertSucceeds(
    setDoc(doc(uid("dani", "dani@example.com"), "clubs/main/playerAccounts/dani"), account("dani", "p-dani", CODE_DANI))
  );
});
await t("THE ONE THAT MATTERS: a real code cannot be used to claim a DIFFERENT player", async () => {
  await assertFails(
    setDoc(doc(uid("thief", "thief@example.com"), "clubs/main/playerAccounts/thief"), account("thief", "p-dani", CODE_YUVAL))
  );
});
await t("an invented code is refused", async () => {
  await assertFails(
    setDoc(doc(uid("thief", "thief@example.com"), "clubs/main/playerAccounts/thief"), account("thief", "p-dani", "nosuchcd"))
  );
});
await t("nobody writes an account under someone else's id", async () => {
  await assertFails(
    setDoc(doc(uid("thief", "thief@example.com"), "clubs/main/playerAccounts/dani"), account("dani", "p-dani", CODE_DANI))
  );
});
await t("and not while signed out at all", async () => {
  await assertFails(
    setDoc(doc(anon(), "clubs/main/playerAccounts/ghost"), account("ghost", "p-dani", CODE_DANI))
  );
});

console.log("— what an account can and cannot reach —");

await t("a child reads their own row", async () => {
  const snap = await assertSucceeds(getDoc(doc(uid("dani", "dani@example.com"), "clubs/main/playerAccounts/dani")));
  if (!snap.exists()) throw new Error("the child cannot see their own link");
});
await t("a child CANNOT read another child's row", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "clubs/main/playerAccounts/yuval"), account("yuval", "p-yuval", CODE_YUVAL));
  });
  await assertFails(getDoc(doc(uid("dani", "dani@example.com"), "clubs/main/playerAccounts/yuval")));
});
await t("nor list who else has an account", async () => {
  await assertFails(getDocs(collection(uid("dani", "dani@example.com"), "clubs/main/playerAccounts")));
});
await t("THE POINT OF ALL OF IT: a linked child still cannot read the club document", async () => {
  await assertFails(getDoc(doc(uid("dani", "dani@example.com"), "clubs/main")));
});
await t("nor a progress note, a training plan or a device token", async () => {
  const d = uid("dani", "dani@example.com");
  await assertFails(getDoc(doc(d, "clubs/main/playerProgress/p-dani__2026-27-A")));
  await assertFails(getDoc(doc(d, "clubs/main/trainingPlans/s1")));
  await assertFails(getDoc(doc(d, "clubs/main/pushTokens/tok")));
});

console.log("— unlinking —");

await t("an account is never edited in place", async () => {
  await assertFails(
    setDoc(doc(uid("dani", "dani@example.com"), "clubs/main/playerAccounts/dani"), account("dani", "p-yuval", CODE_YUVAL))
  );
});
await t("a child can remove their own link", async () => {
  await assertSucceeds(deleteDoc(doc(uid("dani", "dani@example.com"), "clubs/main/playerAccounts/dani")));
});
await t("and a manager can remove anyone's", async () => {
  await assertSucceeds(deleteDoc(doc(uid("manager", MANAGER), "clubs/main/playerAccounts/yuval")));
});

await env.cleanup();
console.log("\n" + pass + " rules tests passed");
