// Does a COACH — not a manager — actually get to use the video library?
//
// Reading the rules is not the same as running them. This runs them, against the real
// firestore.rules file, in the emulator.
//
//   npx firebase emulators:exec --only firestore --project demo-basketball "node rules-videos.test.mjs"

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

// The club document decides who is a member and who is an admin.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "clubs/main"), {
    admins: [MANAGER],
    members: [COACH, OTHER_COACH, MANAGER],
  });
  // One video already in the library, added by OTHER_COACH.
  await setDoc(doc(db, "clubs/main/videos/existing"), {
    title: "הגנת אזור", url: "https://youtu.be/abc", provider: "youtube",
    category: "הגנה", note: "", author: "מאמן אחר", authorEmail: OTHER_COACH,
    createdAt: "2026-08-01T00:00:00.000Z",
  });
});

const as = (email) => env.authenticatedContext(email.split("@")[0], { email }).firestore();
const video = (authorEmail, id) => ({
  title: "מסירת חזה", url: "https://youtu.be/xyz", provider: "youtube",
  category: "מסירות וכדרור", note: "", author: "מאמן", authorEmail,
  createdAt: "2026-08-30T00:00:00.000Z", id,
});

let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log("  ok  " + name); };

console.log("— THE QUESTION: is the library open to coaches? —");

await t("a coach can READ the whole library, not just their own", async () => {
  await assertSucceeds(getDocs(collection(as(COACH), "clubs/main/videos")));
});
await t("a coach SEES a video another coach added — this is what makes it shared", async () => {
  const snap = await assertSucceeds(getDoc(doc(as(COACH), "clubs/main/videos/existing")));
  if (!snap.exists()) throw new Error("the other coach's video is invisible — the library is not shared");
});
await t("a coach can ADD a video", async () => {
  await assertSucceeds(setDoc(doc(as(COACH), "clubs/main/videos/v-coach"), video(COACH, "v-coach")));
});
await t("a coach can EDIT their own video", async () => {
  await assertSucceeds(
    setDoc(doc(as(COACH), "clubs/main/videos/v-coach"), { ...video(COACH, "v-coach"), title: "שם חדש" })
  );
});
await t("a coach can DELETE their own video", async () => {
  await assertSucceeds(deleteDoc(doc(as(COACH), "clubs/main/videos/v-coach")));
});

console.log("— and the limits, so 'open' does not mean 'open to everything' —");

await t("a coach may NOT edit a video someone else added", async () => {
  await assertFails(
    setDoc(doc(as(COACH), "clubs/main/videos/existing"), { ...video(OTHER_COACH, "existing"), title: "חטפתי" })
  );
});
await t("a coach may NOT delete someone else's video", async () => {
  await assertFails(deleteDoc(doc(as(COACH), "clubs/main/videos/existing")));
});
await t("a coach may NOT add a video stamped with someone else's name", async () => {
  await assertFails(setDoc(doc(as(COACH), "clubs/main/videos/v-forged"), video(OTHER_COACH, "v-forged")));
});
await t("someone outside the club sees nothing", async () => {
  await assertFails(getDoc(doc(as(OUTSIDER), "clubs/main/videos/existing")));
  await assertFails(getDocs(collection(as(OUTSIDER), "clubs/main/videos")));
});
await t("a signed-out visitor sees nothing", async () => {
  const anon = env.unauthenticatedContext().firestore();
  await assertFails(getDocs(collection(anon, "clubs/main/videos")));
});

console.log("— the manager —");
await t("a manager can remove anything, including a coach's video", async () => {
  await assertSucceeds(deleteDoc(doc(as(MANAGER), "clubs/main/videos/existing")));
});

console.log("— the contrast that proves the read rule is the right one —");
await t("training plans stay PRIVATE: a coach cannot read another coach's plan", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "clubs/main/trainingPlans/s1"), {
      rows: [], authorEmail: OTHER_COACH, author: "מאמן אחר",
    });
  });
  // Same club, same coach — but plans use `canRead`, which requires ownership. If this
  // ever starts succeeding, the videos rule was copied over the plans rule by mistake.
  await assertFails(getDoc(doc(as(COACH), "clubs/main/trainingPlans/s1")));
});

await env.cleanup();
console.log("\n" + pass + " rules tests passed");
