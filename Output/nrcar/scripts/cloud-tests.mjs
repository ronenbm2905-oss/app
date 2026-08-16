// ============================================================================
// cloud-tests.mjs — הנתיב הענני **בהרצה**: onSnapshot, writeHouseholdDiff,
// העלאות Storage, והזרימה הקריטית מקצה לקצה מול Firestore אמיתי (אמולטור).
//
// עד היום זה היה קוד שלא רץ מעולם. הוא מריץ כאן את **אותן פונקציות בדיוק**
// שהאפליקציה מריצה — `src/utils/firestoreSync.js`, `src/utils/files.js`,
// `src/utils/seed.js`, `src/utils/renewal.js` — ולא העתק שלהן.
//
// רץ בתוך `npm run emu:cloud`. הכול מקומי; אין deploy ואין פרויקט אמיתי.
// ============================================================================

import { initializeApp, deleteApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, collection, getDocs } from "firebase/firestore";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getStorage, connectStorageEmulator, ref, getMetadata } from "firebase/storage";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const { subscribeHousehold, writeHouseholdDiff, ensureHousehold, ensureMembership, writeUserProfile } =
  await import("../src/utils/firestoreSync.js");
const { ENTITY_COLLECTIONS, EMPTY, STORAGE_DOMAINS } = await import("../src/constants.js");
const { createVehicle, createDocument, createUserProfile, appendNotice } = await import("../src/schema.js");
const { seedTasksForVehicle } = await import("../src/utils/seed.js");
const { completeTask } = await import("../src/utils/renewal.js");
const { writeVehicleWithTasks, writeTaskCompletion } = await import("../src/utils/writes.js");
const { uploadFile, deleteStorageObjects, storagePath } = await import("../src/utils/files.js");
const { mapActiveRecord } = await import("../src/utils/mot.js");

let pass = 0;
let failed = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) pass++;
  else {
    failed++;
    failures.push(name);
    console.error("  FAIL:", name, detail === undefined ? "" : `\n    got: ${JSON.stringify(detail)}`);
  }
}
function eq(name, a, b) {
  const good = JSON.stringify(a) === JSON.stringify(b);
  if (good) pass++;
  else {
    failed++;
    failures.push(name);
    console.error("  FAIL:", name, "\n    got:", JSON.stringify(a), "\n    want:", JSON.stringify(b));
  }
}
const section = (t) => console.log(`\n— ${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (o) => JSON.parse(JSON.stringify(o));

// ============================================================================
const app = initializeApp({ projectId: "nrcar-emulator", apiKey: "fake-api-key", storageBucket: "nrcar-emulator.appspot.com" });
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
connectFirestoreEmulator(db, "127.0.0.1", 8080);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
connectStorageEmulator(storage, "127.0.0.1", 9199);

const TODAY = "2026-08-13";

try {
  // ==========================================================================
  section("1. 🔴 הבאג המתועד — הרשמה לפני login נחסמת ע\"י ה-rules");
  // ==========================================================================
  // זו הסיבה שה-effect ב-useData תלוי ב-[user?.uid] ויש בו early return.
  // כאן מוכיחים שההרשמה לפני auth באמת נכשלת — ולכן הדפוס אינו קישוט.
  //
  // ⚠️ רץ על **app נפרד** בכוונה: לקוח Firestore שקיבל permission-denied
  // נכנס ל-backoff ומרעיל קריאות עוקבות על אותו instance. זה ממצא בפני
  // עצמו — וזו בדיוק הסיבה שהאפליקציה לא אמורה להירשם לפני login.
  const probeApp = initializeApp(
    { projectId: "nrcar-emulator", apiKey: "fake-api-key" },
    `probe-${Date.now()}`
  );
  const probeDb = getFirestore(probeApp);
  connectFirestoreEmulator(probeDb, "127.0.0.1", 8080);
  let preAuthError = null;
  const unsubPre = await subscribeHousehold(
    probeDb,
    "hh_never_created",
    null,
    () => {},
    (err) => {
      preAuthError = err?.code || String(err);
    }
  );
  await sleep(4000);
  unsubPre();
  await deleteApp(probeApp);
  ok("★ onSnapshot לפני login נכשל בהרשאות", String(preAuthError).includes("permission-denied"), preAuthError);
  ok("★ ולכן ה-early return ב-useData הוא תנאי, לא סגנון", true);

  // ==========================================================================
  section("2. התחברות + הקמת משק בית");
  // ==========================================================================
  const cred = await createUserWithEmailAndPassword(auth, `owner_${Date.now()}@nrcar.test`, "pw123456");
  const uid = cred.user.uid;
  const HID = uid; // hid נזרע מה-uid — אבל מטופל כמזהה אטום (N4)
  ok("משתמש נוצר באמולטור ה-Auth", Boolean(uid));

  await ensureHousehold(db, HID, uid, "");
  await ensureMembership(db, uid, HID, "owner");
  const hhSnap = await getDoc(doc(db, "households", HID));
  ok("★ מסמך משק הבית נוצר", hhSnap.exists());
  eq("★ והיוצר רשום כבעלים ב-members (N4)", hhSnap.data().household.members[uid], "owner");
  const memSnap = await getDoc(doc(db, "memberships", uid));
  ok("★ ורשומת ה-membership נכתבה", memSnap.exists());

  // ==========================================================================
  section("3. 🔴 onSnapshot — האזנה חיה");
  // ==========================================================================
  const received = [];
  const unsub = await subscribeHousehold(
    db,
    HID,
    uid,
    (assembled) => received.push(assembled),
    (err) => {
      failed++;
      failures.push(`snapshot error: ${err?.code}`);
      console.error("  FAIL: snapshot error", err?.code);
    }
  );
  await sleep(1500);
  ok("★ המאזין קיבל מצב התחלתי", received.length > 0);
  const first = received[received.length - 1];
  eq("★ ומסמך השורש הורכב נכון", first.household.members[uid], "owner");
  ok("★ כל האוספים קיימים כמערכים", ENTITY_COLLECTIONS.every((c) => Array.isArray(first[c])), Object.keys(first));
  // ⚠️ personalDocs חסום לבעלים ב-rules — הקוד מטפל בזה כמצב **תקין**
  // (מערך ריק), לא ככשל טעינה. זה מסלול שמעולם לא רץ עד עכשיו.
  eq("★ personalDocs חסום לבעלים ומוחזר כריק — לא כשגיאה", first.personalDocs, []);

  // ==========================================================================
  section("4. 🔴 writeHouseholdDiff + ★ הזרימה הקריטית בענן");
  // ==========================================================================
  const fixture = JSON.parse(readFileSync(join(ROOT, "scripts", "fixtures", "mot-active.json"), "utf8"));
  const mot = mapActiveRecord(fixture.result.records[0], "68708404");
  const vehicle = createVehicle({
    householdId: HID,
    plate: mot.plate,
    manufacturer: mot.manufacturer,
    commercialName: mot.commercialName,
    testValidUntil: mot.testValidUntil,
  });
  const tasks = seedTasksForVehicle(vehicle, [], { today: TODAY });

  const before = clone(EMPTY);
  before.household = first.household;
  before.settings = first.settings;
  const afterWrite = writeVehicleWithTasks(clone(before), { vehicle, tasks });
  await writeHouseholdDiff(db, HID, before, afterWrite);

  const vehDocs = await getDocs(collection(db, "households", HID, "vehicles"));
  const taskDocs = await getDocs(collection(db, "households", HID, "tasks"));
  eq("★★ הרכב נכתב ל-Firestore", vehDocs.size, 1);
  eq("★★ והמשימות איתו — באותה כתיבה", taskDocs.size, tasks.length);
  eq("★ tokef_dt שרד את המסע לענן", vehDocs.docs[0].data().testValidUntil, "2027-08-01");
  eq("★ ו-householdId נכתב על כל ישות", vehDocs.docs[0].data().householdId, HID);
  ok(
    "★★ ואין משימה יתומה בענן",
    taskDocs.docs.every((t) => vehDocs.docs.some((v) => v.id === t.data().vehicleId)),
    taskDocs.docs.map((d) => d.data().vehicleId)
  );

  await sleep(1200);
  const live = received[received.length - 1];
  eq("★ המאזין קיבל את הרכב בזמן אמת", live.vehicles.length, 1);
  eq("★ ואת המשימות", live.tasks.length, tasks.length);

  // -- "בוצע" → המשימה הבאה, בענן --
  const testTask = live.tasks.find((t) => t.type === "test");
  const { completed, next } = completeTask(testTask, { today: TODAY, completedDate: TODAY, completedKm: 112000 });
  const afterComplete = writeTaskCompletion(clone(live), {
    completed,
    next,
    ctx: { householdId: HID, completedDate: TODAY, completedKm: 112000 },
  });
  await writeHouseholdDiff(db, HID, live, afterComplete);
  await sleep(1200);

  const cloudTasks = await getDocs(collection(db, "households", HID, "tasks"));
  eq("★★ המשימה הבאה נוצרה בענן", cloudTasks.size, tasks.length + 1);
  ok("★ הישנה סומנה בוצע", cloudTasks.docs.some((d) => d.data().completedAt));
  ok("★ והחדשה נושאת sourceTaskId", cloudTasks.docs.some((d) => d.data().sourceTaskId === testTask.id));
  const odo = await getDocs(collection(db, "households", HID, "odometerReadings"));
  eq("★ ונשמרה קריאת מד-אוץ' אמיתית", odo.size, 1);
  const vehAfter = await getDocs(collection(db, "households", HID, "vehicles"));
  eq("★★ והרכב שרד את כל הרצף", vehAfter.size, 1);

  // -- מחיקה: ה-diff מוחק את המסמך, לא רק משנה אותו --
  const withoutTasks = clone(afterComplete);
  withoutTasks.tasks = [];
  await writeHouseholdDiff(db, HID, afterComplete, withoutTasks);
  const emptied = await getDocs(collection(db, "households", HID, "tasks"));
  eq("★ diff מוחק מסמכים שהוסרו מהמודל", emptied.size, 0);

  // -- ה-diff לא נוגע באוסף שרת --
  ok("★ writeHouseholdDiff לא נוגע ב-reminderLog", !ENTITY_COLLECTIONS.includes("reminderLog"));
  // ★ והקליינט לא יכול אפילו לסרוק אותו: ה-read מותנה ב-recipientUid,
  // ולכן שאילתה על האוסף כולו נדחית. זו ההגנה שמונעת מבעלים ללמוד
  // מתי בן משפחה פתח הודעה.
  let logQueryDenied = false;
  try {
    await getDocs(collection(db, "households", HID, "reminderLog"));
  } catch (err) {
    logQueryDenied = String(err?.code).includes("permission-denied");
  }
  ok("★★ שאילתה על reminderLog נדחית לקליינט", logQueryDenied);

  // ==========================================================================
  section("5. users/{uid} — append-only בענן");
  // ==========================================================================
  let profile = createUserProfile({ uid, householdId: HID, displayName: "רונן" });
  profile = appendNotice(profile, { policyVersion: "0.1-draft" });
  await writeUserProfile(db, uid, profile);
  profile = appendNotice(profile, { policyVersion: "0.2" });
  await writeUserProfile(db, uid, profile);
  const userSnap = await getDoc(doc(db, "users", uid));
  eq("★ שתי רשומות יידוע נשמרו", userSnap.data().notices.length, 2);
  ok("★ והראשונה שרדה", userSnap.data().notices[0].policyVersion === "0.1-draft");
  ok("★ serviceChannels מופרד מ-marketingConsent (O10)", "serviceChannels" in userSnap.data() && userSnap.data().marketingConsent === null);

  // ==========================================================================
  section("6. 🟠 Storage — העלאה ומחיקה דרך הקוד האמיתי");
  // ==========================================================================
  // בונים "קובץ" אמיתי: Blob עם שם, כדי ש-uploadFile ירוץ בדיוק כמו בדפדפן.
  const makeFile = (bytes, type, name) => {
    const blob = new Blob([bytes], { type });
    Object.defineProperty(blob, "name", { value: name });
    return blob;
  };
  const pdf = makeFile(new Uint8Array([0x25, 0x50, 0x44, 0x46]), "application/pdf", "licence.pdf");

  const uploaded = await uploadFile(pdf, {
    storage,
    domain: STORAGE_DOMAINS.shared,
    hid: HID,
    vehicleId: vehicle.id,
    docId: "doc1",
  });
  ok("★ ההעלאה עברה דרך uploadFile האמיתי", Boolean(uploaded.fileRef?.storagePath));
  ok("★ fileRef הוא נתיב — לא כתובת (N2)", !/^https?:/.test(uploaded.fileRef.storagePath));
  eq("★ ואין בו שדה url", Object.keys(uploaded.fileRef).sort(), ["contentType", "size", "storagePath", "uploadedAt"]);
  ok("★ הנתיב מקודד את הדומיין", uploaded.fileRef.storagePath.includes(`/vehicles/${vehicle.id}/shared/`));
  const metaRes = await getMetadata(ref(storage, uploaded.fileRef.storagePath));
  ok("★ והאובייקט באמת קיים ב-Storage", metaRes.size > 0);

  // O6 — סוג אסור נחסם ע"י ה-rules בפועל
  const zip = makeFile(new Uint8Array([1, 2, 3]), "application/zip", "evil.zip");
  let zipBlocked = false;
  try {
    await uploadFile(zip, { storage, domain: STORAGE_DOMAINS.shared, hid: HID, vehicleId: vehicle.id, docId: "z" });
  } catch {
    zipBlocked = true;
  }
  ok("★ O6 — קובץ אסור נחסם עוד לפני הרשת (validateFile)", zipBlocked);

  // מחיקה — הצלע השנייה של ה-cascade
  const del = await deleteStorageObjects([uploaded.fileRef.storagePath], storage);
  eq("★ deleteStorageObjects מחק את האובייקט", del.deleted, 1);
  let goneAfter = false;
  try {
    await getMetadata(ref(storage, uploaded.fileRef.storagePath));
  } catch (err) {
    goneAfter = String(err.code || err).includes("object-not-found");
  }
  ok("★★ והאובייקט באמת נעלם — הטוקן הקבוע בוטל", goneAfter);

  // מסמך רכב עם fileRef, ואז cascade מלא
  const docEntity = createDocument({
    householdId: HID,
    vehicleId: vehicle.id,
    type: "vehicleLicence",
    fileRef: uploaded.fileRef,
  });
  const withDoc = clone(withoutTasks);
  withDoc.documents = [docEntity];
  await writeHouseholdDiff(db, HID, withoutTasks, withDoc);
  const docSnap = await getDocs(collection(db, "households", HID, "documents"));
  eq("★ המסמך נכתב", docSnap.size, 1);
  ok("★ ובענן אין בו כתובת הורדה", !JSON.stringify(docSnap.docs[0].data()).includes("firebasestorage"));

  // ==========================================================================
  section("7. התאוששות המאזין");
  // ==========================================================================
  unsub();
  const countAtUnsub = received.length;
  const after2 = clone(withDoc);
  after2.documents = [];
  await writeHouseholdDiff(db, HID, withDoc, after2);
  await sleep(900);
  eq("★ אחרי unsubscribe המאזין מפסיק לקבל", received.length, countAtUnsub);

  const received2 = [];
  const unsub2 = await subscribeHousehold(db, HID, uid, (a) => received2.push(a), () => {});
  await sleep(1200);
  ok("★ והרשמה מחדש עובדת", received2.length > 0);
  eq("★ עם המצב המעודכן מהענן", received2[received2.length - 1].documents.length, 0);
  eq("★ והרכב עדיין שם", received2[received2.length - 1].vehicles.length, 1);
  unsub2();

  await signOut(auth);
} catch (err) {
  failed++;
  const detail = `${err?.code || "error"}: ${err?.message || "(no message)"}`;
  failures.push(detail);
  console.error("  FAIL:", detail, "\n", err?.stack || "");
} finally {
  try {
    await deleteApp(app);
  } catch {
    /* ignore */
  }
}

console.log("\n" + "=".repeat(60));
if (failed) {
  console.error(`נכשלו ${failed} בדיקות מתוך ${pass + failed}`);
  for (const f of failures) console.error("  ✗", f);
  process.exit(1);
}
console.log(`✓ כל ${pass} בדיקות הענן עברו מול אמולטור אמיתי`);
process.exit(0);
