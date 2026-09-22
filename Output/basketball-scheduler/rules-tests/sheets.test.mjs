// Is the manager's own spreadsheet actually closed to everyone else?
//
// The screen says so in as many words — "רק מנהלי המועדון רואים את המסך הזה" — and the tab
// is hidden from a coach. Neither of those is a boundary. THIS is the boundary, and reading
// the rule is not the same as running it. This runs it, against the real firestore.rules,
// in the emulator.
//
//   npx firebase emulators:exec --only firestore --project demo-basketball "node rules-tests/sheets.test.mjs"

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { readFileSync } from "node:fs";

const COACH = "coach@example.com";
const MANAGER = "manager@example.com";
const OUTSIDER = "nobody@example.com";

const env = await initializeTestEnvironment({
  projectId: "demo-basketball",
  firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
});

const sheet = (name) => ({
  id: "barzelim",
  name,
  columns: ["קבוצה", "יום", "שעה", "אולם"],
  // Note the shape: a row is a MAP holding a `cells` array, because Firestore cannot nest
  // an array inside an array. See utils/sheetGrid.js.
  rows: [{ cells: ["נוער מחוזית", "ראשון", "20:30", "רימונים"] }],
  updatedAt: "2026-09-22T00:00:00.000Z",
  updatedBy: "מנהל",
});

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "clubs/main"), {
    admins: [MANAGER],
    // The coach is a full member of the club — which is the point. Membership is what opens
    // the video library, the roster screen and the weekly board. It must not open this.
    members: [COACH, MANAGER],
  });
  await setDoc(doc(db, "clubs/main/sheets/barzelim"), sheet("ברזלים"));
});

const as = (email) => env.authenticatedContext(email.split("@")[0], { email }).firestore();

let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log("  ok  " + name); };

console.log("— the manager, whose sheet it is —");

await t("a manager can list the collection", async () => {
  await assertSucceeds(getDocs(collection(as(MANAGER), "clubs/main/sheets")));
});
await t("a manager can read, write and delete a sheet", async () => {
  await assertSucceeds(getDoc(doc(as(MANAGER), "clubs/main/sheets/barzelim")));
  await assertSucceeds(setDoc(doc(as(MANAGER), "clubs/main/sheets/new"), sheet("אולמות")));
  await assertSucceeds(deleteDoc(doc(as(MANAGER), "clubs/main/sheets/new")));
});

console.log("— THE QUESTION: does a club MEMBER get in? —");

await t("a coach may NOT read the sheet, although they are in the club", async () => {
  await assertFails(getDoc(doc(as(COACH), "clubs/main/sheets/barzelim")));
});

// `allow read` covers get AND list, and a collection listen is a list. A rule that granted
// one without the other would let a coach enumerate every sheet the manager keeps.
await t("a coach may NOT LIST the collection either", async () => {
  await assertFails(getDocs(collection(as(COACH), "clubs/main/sheets")));
});
await t("a coach may NOT write a sheet, or overwrite the manager's", async () => {
  await assertFails(setDoc(doc(as(COACH), "clubs/main/sheets/mine"), sheet("שלי")));
  await assertFails(setDoc(doc(as(COACH), "clubs/main/sheets/barzelim"), sheet("החלפתי")));
});
await t("a coach may NOT delete one", async () => {
  await assertFails(deleteDoc(doc(as(COACH), "clubs/main/sheets/barzelim")));
});

console.log("— and everyone further out —");

await t("someone outside the club sees nothing", async () => {
  await assertFails(getDoc(doc(as(OUTSIDER), "clubs/main/sheets/barzelim")));
  await assertFails(getDocs(collection(as(OUTSIDER), "clubs/main/sheets")));
});
await t("a signed-out visitor sees nothing", async () => {
  const anon = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon, "clubs/main/sheets/barzelim")));
  await assertFails(getDocs(collection(anon, "clubs/main/sheets")));
});

console.log("— the contrast that proves this rule is not the shared one —");
await t("the same coach CAN read the video library, so 'member' is not the failing part", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "clubs/main/videos/v1"), {
      title: "הגנת אזור", url: "https://youtu.be/abc", authorEmail: MANAGER, author: "מנהל",
    });
  });
  // If this ever fails, the coach is not a member and every assertion above is passing for
  // the wrong reason.
  await assertSucceeds(getDocs(collection(as(COACH), "clubs/main/videos")));
});

await env.cleanup();
console.log("\n" + pass + " sheets rules tests passed");
