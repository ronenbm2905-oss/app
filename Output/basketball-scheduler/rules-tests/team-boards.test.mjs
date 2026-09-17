// The board a parent opens with a link — the one document here the whole internet can read.
//
// The question these tests exist to answer is not "does the link work". It is: does opening
// that document get anyone one step closer to the club document, which holds 550 children's
// names, phone numbers and birth dates? And: can a coach quietly rewrite a schedule that
// parents will act on?
//
//   npx firebase emulators:exec --only firestore --project demo-basketball "node rules-tests/team-boards.test.mjs"

import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";

const COACH = "coach@example.com";
const MANAGER = "manager@example.com";
const OUTSIDER = "nobody@example.com";

const env = await initializeTestEnvironment({
  projectId: "demo-basketball",
  firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
});

const board = {
  teamId: "t1", teamName: "נערים א ארצית",
  weeks: { "2026-09-13": [{ kind: "training", day: "ראשון", start: "17:00", end: "18:30", where: "אולם ברק" }] },
  message: { text: "", author: "", updatedAt: "" },
  updatedAt: "2026-09-17T09:00:00.000Z",
};

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "clubs/main"), {
    admins: [MANAGER],
    members: [COACH],
    players: [{ id: "p1", name: "דני כהן", phone: "0501234567", birthDate: "2010-04-02" }],
  });
  await setDoc(doc(db, "clubs/main/boards/abcdefghijkm"), board);
});

const as = (email) => env.authenticatedContext(email.split("@")[0], { email }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log("  ok  " + name); };

console.log("— the link, with nobody signed in —");

await t("a parent with the link reads the board without signing in", async () => {
  const snap = await assertSucceeds(getDoc(doc(anon(), "clubs/main/boards/abcdefghijkm")));
  if (!snap.exists()) throw new Error("the board is unreadable to the people it is for");
});
await t("THE POINT: the same visitor still cannot read the club document", async () => {
  await assertFails(getDoc(doc(anon(), "clubs/main")));
});
await t("nor any player record, progress note or training plan", async () => {
  await assertFails(getDoc(doc(anon(), "clubs/main/playerProgress/p1__2026-27-A")));
  await assertFails(getDoc(doc(anon(), "clubs/main/trainingPlans/s1")));
  await assertFails(getDoc(doc(anon(), "clubs/main/pushTokens/tok")));
});
await t("a visitor cannot write to the board they can read", async () => {
  await assertFails(updateDoc(doc(anon(), "clubs/main/boards/abcdefghijkm"), { message: { text: "x" } }));
  await assertFails(deleteDoc(doc(anon(), "clubs/main/boards/abcdefghijkm")));
});
await t("and cannot create a board of their own", async () => {
  await assertFails(setDoc(doc(anon(), "clubs/main/boards/zzzzzzzzzzzz"), board));
});

console.log("— the coach —");

await t("a coach posts the message on the board", async () => {
  await assertSucceeds(
    updateDoc(doc(as(COACH), "clubs/main/boards/abcdefghijkm"), {
      message: { text: "מחר מביאים בקבוק", author: "מאמן", updatedAt: "2026-09-17T10:00:00.000Z" },
      updatedAt: "2026-09-17T10:00:00.000Z",
    })
  );
});
await t("a coach CANNOT rewrite the schedule itself — this is the whole restriction", async () => {
  await assertFails(
    updateDoc(doc(as(COACH), "clubs/main/boards/abcdefghijkm"), { weeks: { "2026-09-13": [] } })
  );
});
await t("not even alongside a legitimate message", async () => {
  await assertFails(
    updateDoc(doc(as(COACH), "clubs/main/boards/abcdefghijkm"), {
      message: { text: "שלום", author: "מאמן", updatedAt: "x" },
      teamName: "קבוצה אחרת",
    })
  );
});
await t("a coach cannot publish a new board or delete one", async () => {
  await assertFails(setDoc(doc(as(COACH), "clubs/main/boards/qqqqqqqqqqqq"), board));
  await assertFails(deleteDoc(doc(as(COACH), "clubs/main/boards/abcdefghijkm")));
});

console.log("— the manager, who is an admin and NOT a member —");

await t("a manager publishes a board", async () => {
  await assertSucceeds(setDoc(doc(as(MANAGER), "clubs/main/boards/mmmmmmmmmmmm"), board));
});
await t("a manager refreshes a published board", async () => {
  await assertSucceeds(
    updateDoc(doc(as(MANAGER), "clubs/main/boards/mmmmmmmmmmmm"), { weeks: {}, updatedAt: "z" })
  );
});
await t("a manager unpublishes — the link stops opening", async () => {
  await assertSucceeds(deleteDoc(doc(as(MANAGER), "clubs/main/boards/mmmmmmmmmmmm")));
});
await t("someone outside the club cannot publish anything", async () => {
  await assertFails(setDoc(doc(as(OUTSIDER), "clubs/main/boards/xxxxxxxxxxxx"), board));
});

await env.cleanup();
console.log("\n" + pass + " rules tests passed");
