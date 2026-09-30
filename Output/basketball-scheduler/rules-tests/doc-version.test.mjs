// Two devices, one club document — against a real Firestore.
//
//   npx firebase emulators:exec --only firestore --project demo-basketball "node rules-tests/doc-version.test.mjs"
//
// WHY THIS IS AN EMULATOR TEST AND NOT A UNIT TEST. The unit tests in tests/docversion.test.mjs
// prove the arithmetic: which rev beats which. They cannot prove the thing that actually
// failed on 30.9.2026, which is a RACE — two clients reading the same document and both
// writing. That needs a server with real transaction semantics, and it needs the app's own
// `commitWithVersion`, not a re-implementation of it in a test file.
//
// What happened that morning, in one line: the phone saved a copy of the document it had
// taken two hours earlier, and Firestore accepted it, and six trainings and eleven
// secretariat rows stopped existing.

import { initializeTestEnvironment, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, runTransaction } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { commitWithVersion, isConflict, revOf } from "../src/utils/docVersion.js";

const MANAGER = "manager@example.com";
const OTHER = "manager2@example.com";

const env = await initializeTestEnvironment({
  projectId: "demo-basketball",
  firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
});

const club = (sessions, rev) => ({
  admins: [MANAGER, OTHER],
  members: [],
  sessions,
  teams: [],
  ...(rev === undefined ? {} : { rev }),
});

const session = (id) => ({ id, day: "ראשון", start: "18:00", end: "19:30", weekOf: "2026-10-04", teamId: "t1" });

const as = (email) => env.authenticatedContext(email.split("@")[0], { email }).firestore();
const refFor = (db) => doc(db, "clubs/main");

const seed = async (data) => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "clubs/main"), data);
  });
};

const save = (db, next, expectedRev) =>
  commitWithVersion({ runTransaction, db, ref: refFor(db), next, expectedRev });

let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log("  ok  " + name); };

console.log("— a document that predates this guard —");

await t("a club document with no `rev` accepts its first save and gains rev 1", async () => {
  // Every club in production today. If this failed, the deploy would freeze the app.
  await seed(club([session("a")]));
  const db = as(MANAGER);
  const rev = await save(db, club([session("a"), session("b")]), 0);
  assert(rev === 1, `expected rev 1, got ${rev}`);
  const after = await getDoc(refFor(db));
  assert(revOf(after.data()) === 1, "the rev must be stored");
  assert(after.data().sessions.length === 2, "and the save must have landed");
});

console.log("— the morning of 30.9.2026, reproduced —");

await t("THE OVERWRITE: a save built on a two-hour-old copy is REFUSED", async () => {
  await seed(club([session("a")], 4));

  // The computer works through the morning and moves the document on.
  const computer = as(MANAGER);
  let rev = 4;
  for (const id of ["b", "c", "d"]) {
    rev = await save(computer, club([session("a"), session(id)], undefined), rev);
  }
  assert(rev === 7, `expected the server to be on 7, got ${rev}`);

  // The phone saves the copy it took before any of that. Its whole document would land.
  const phone = as(OTHER);
  let refused = false;
  try {
    await save(phone, club([session("a")], undefined), 4);
  } catch (err) {
    refused = isConflict(err);
    if (!refused) throw err;
  }
  assert(refused, "the stale write was accepted — this is the bug");

  // And the morning's work is still there.
  const after = await getDoc(refFor(computer));
  assert(revOf(after.data()) === 7, "the refused save must not have moved the rev");
  assert(after.data().sessions.some((s) => s.id === "d"), "the last edit must have survived");
});

await t("after reloading, the same device saves normally", async () => {
  // The instruction in the error message has to actually work, or people learn to ignore it.
  const phone = as(OTHER);
  const current = revOf((await getDoc(refFor(phone))).data());
  const rev = await save(phone, club([session("a"), session("z")], undefined), current);
  assert(rev === current + 1, "a refreshed client must be able to save");
});

console.log("— the app must not fight itself —");

await t("two saves in a row from ONE device both succeed", async () => {
  // The snapshot listener lags behind a write. A guard that only trusted the snapshot would
  // make every rapid second edit fail, which is worse than the bug it replaces.
  await seed(club([session("a")], 0));
  const db = as(MANAGER);
  const first = await save(db, club([session("a"), session("b")], undefined), 0);
  const second = await save(db, club([session("a"), session("b"), session("c")], undefined), first);
  assert(second === first + 1, `expected ${first + 1}, got ${second}`);
  const after = await getDoc(refFor(db));
  assert(after.data().sessions.length === 3);
});

await t("TWO DEVICES RACING: one wins, the other is told — neither is silently lost", async () => {
  await seed(club([session("a")], 10));
  const a = as(MANAGER);
  const b = as(OTHER);

  // Both read 10 and both try to save. This is the real race, not a simulated one.
  const results = await Promise.allSettled([
    save(a, club([session("a"), session("winner")], undefined), 10),
    save(b, club([session("a"), session("loser")], undefined), 10),
  ]);
  const ok = results.filter((r) => r.status === "fulfilled");
  const failed = results.filter((r) => r.status === "rejected");

  assert(ok.length >= 1, "at least one save must succeed");
  // Whoever lost must have lost LOUDLY.
  for (const f of failed) assert(isConflict(f.reason), `a loser failed for the wrong reason: ${f.reason?.message}`);

  const after = await getDoc(refFor(a));
  assert(revOf(after.data()) === 11, `the rev must have advanced exactly once, got ${revOf(after.data())}`);
});

console.log("— and the rules still apply —");

await t("CONTRAST: a non-admin cannot save at all, guard or no guard", async () => {
  // Without this the suite could be green because the emulator refuses everything.
  await seed(club([session("a")], 1));
  const outsider = env.authenticatedContext("nobody", { email: "nobody@example.com" }).firestore();
  let denied = false;
  try {
    await save(outsider, club([session("a")], undefined), 1);
  } catch {
    denied = true;
  }
  assert(denied, "an outsider must not be able to write the club");
  await assertSucceeds(getDoc(refFor(as(MANAGER))));
});

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

console.log(`\n${pass} document-version rules tests passed`);
await env.cleanup();
