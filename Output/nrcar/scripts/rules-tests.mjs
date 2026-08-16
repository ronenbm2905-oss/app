// ============================================================================
// rules-tests.mjs — אכיפת ה-rules **בהרצה**, מול אמולטור אמיתי.
//
// עד עכשיו ה-rules אומתו בקריאה ובסריקה סטטית. זה החוב הפתוח השלישי ברציפות
// (property → fleet → כאן), והיום גם הוכח שוב שסטטי לא מחליף הרצה: 602
// אסרשנים לא תפסו באג שהרצה אחת בדפדפן תפסה.
//
// רץ בתוך `npm run emu:rules`. הכול מקומי — project-id פיקטיבי, בלי deploy.
// ============================================================================

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getMetadata, getDownloadURL, deleteObject } from "firebase/storage";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { ENTITY_COLLECTIONS } = await import("../src/constants.js");

let pass = 0;
let failed = 0;
const failures = [];
async function must(name, promise, shouldSucceed) {
  try {
    await (shouldSucceed ? assertSucceeds(promise) : assertFails(promise));
    pass++;
  } catch (err) {
    failed++;
    failures.push(name);
    console.error("  FAIL:", name, "\n    ", String(err.message).split("\n")[0]);
  }
}
const allow = (name, p) => must(name, p, true);
const deny = (name, p) => must(name, p, false);
function ok(name, cond, detail) {
  if (cond) pass++;
  else {
    failed++;
    failures.push(name);
    console.error("  FAIL:", name, detail === undefined ? "" : `\n    got: ${JSON.stringify(detail)}`);
  }
}
const section = (t) => console.log(`\n— ${t}`);

// -- זהויות -----------------------------------------------------------------
const HID_A = "hh_a";
const HID_B = "hh_b";
const OWNER_A = "uid_owner_a";
const OWNER_B = "uid_owner_b";
const DRIVER = "uid_driver";
const OTHER_DRIVER = "uid_driver2";

const testEnv = await initializeTestEnvironment({
  projectId: "nrcar-emulator",
  firestore: {
    rules: readFileSync(join(ROOT, "firestore.rules"), "utf8"),
    host: "127.0.0.1",
    port: 8080,
  },
  storage: {
    rules: readFileSync(join(ROOT, "storage.rules"), "utf8"),
    host: "127.0.0.1",
    port: 9199,
  },
});

await testEnv.clearFirestore();

const ownerA = testEnv.authenticatedContext(OWNER_A);
const ownerB = testEnv.authenticatedContext(OWNER_B);
const driver = testEnv.authenticatedContext(DRIVER);
const other = testEnv.authenticatedContext(OTHER_DRIVER);
const anon = testEnv.unauthenticatedContext();

const dbA = ownerA.firestore();
const dbB = ownerB.firestore();
const dbD = driver.firestore();
const dbO = other.firestore();
const dbAnon = anon.firestore();

// ============================================================================
// זריעה — עוקפת rules בכוונה, כדי שהבדיקות יבדקו **קריאה/כתיבה**, לא הקמה.
// ============================================================================
const householdDoc = (hid, members) => ({
  household: { id: hid, name: "", createdAt: new Date().toISOString(), members },
  settings: { onboarded: true, policyVersion: "0.1-draft" },
  schemaVersion: 1,
});

await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "households", HID_A), householdDoc(HID_A, { [OWNER_A]: "owner", [DRIVER]: "driver" }));
  await setDoc(doc(db, "households", HID_B), householdDoc(HID_B, { [OWNER_B]: "owner" }));
  // ★ N4 — משק בית שה-id שלו **זהה ל-uid** של מישהו שאינו הבעלים שלו.
  await setDoc(doc(db, "households", OWNER_B), householdDoc(OWNER_B, { [OWNER_A]: "owner" }));

  const base = (extra = {}) => ({ householdId: HID_A, schemaVersion: 1, ...extra });
  await setDoc(doc(db, "households", HID_A, "vehicles", "v1"), base({ id: "v1", plate: "1234567" }));
  await setDoc(doc(db, "households", HID_A, "vehicles", "v2"), base({ id: "v2", plate: "7654321" }));
  await setDoc(doc(db, "households", HID_A, "vehiclesPrivate", "v1"), base({ id: "v1", vehicleId: "v1", purchasePrice: 90000 }));
  await setDoc(
    doc(db, "households", HID_A, "drivers", "d1"),
    base({ id: "d1", userUid: DRIVER, isMinor: false, guardianConsent: [], inviteStatus: "invited", fullName: "דנה" })
  );
  await setDoc(
    doc(db, "households", HID_A, "drivers", "dMinor"),
    base({ id: "dMinor", userUid: OTHER_DRIVER, isMinor: true, guardianConsent: [], inviteStatus: "invited", fullName: "יונתן" })
  );
  await setDoc(doc(db, "households", HID_A, "vehicleAccess", `${DRIVER}__v1`), base({ id: `${DRIVER}__v1`, driverUid: DRIVER, driverId: "d1", vehicleId: "v1" }));
  await setDoc(doc(db, "households", HID_A, "tasks", "t1"), base({ id: "t1", vehicleId: "v1", type: "test" }));
  await setDoc(doc(db, "households", HID_A, "documents", "docShared"), base({ id: "docShared", vehicleId: "v1", type: "vehicleLicence", visibility: "shared", storageDomain: "shared" }));
  await setDoc(doc(db, "households", HID_A, "documents", "docOwner"), base({ id: "docOwner", vehicleId: "v1", type: "receipt", visibility: "owner", storageDomain: "owner" }));
  await setDoc(doc(db, "households", HID_A, "personalDocs", "pdDriver"), base({ id: "pdDriver", driverId: "d1", driverUid: DRIVER, type: "drivingLicence", sensitivity: "id" }));
  await setDoc(doc(db, "households", HID_A, "personalDocs", "pdOwner"), base({ id: "pdOwner", driverId: "dOwner", driverUid: OWNER_A, type: "drivingLicence", sensitivity: "id" }));
  await setDoc(doc(db, "households", HID_A, "serviceRecords", "s1"), base({ id: "s1", vehicleId: "v1" }));
  await setDoc(doc(db, "households", HID_A, "odometerReadings", "o1"), base({ id: "o1", vehicleId: "v1", km: 100000 }));
  // שתי רשומות יומן — אחת לכל נמען. זה מה שמאפשר לבדוק את הכלל החדש.
  await setDoc(doc(db, "households", HID_A, "reminderLog", "rOwner"), base({ id: "rOwner", taskId: "t1", channel: "push", recipientUid: OWNER_A }));
  await setDoc(doc(db, "households", HID_A, "reminderLog", "rDriver"), base({ id: "rDriver", taskId: "t1", channel: "push", recipientUid: DRIVER }));
  await setDoc(doc(db, "households", HID_A, "tasks", "t1", "private", "state"), {
    taskId: "t1", householdId: HID_A,
    recipients: { [OWNER_A]: { lastFiredAt: "2026-08-13T08:00:00Z", channelsTried: ["push"], acknowledgedAt: null } },
  });
  await setDoc(doc(db, "households", HID_A, "accessLog", "aOwner"), {
    actorUid: OWNER_A, docId: "docShared", docType: "documents", at: "2026-08-13T08:00:00Z", granted: true, householdId: HID_A,
  });
  await setDoc(doc(db, "households", HID_B, "vehicles", "vb1"), { householdId: HID_B, id: "vb1", plate: "9999999" });

  await setDoc(doc(db, "users", OWNER_A), { uid: OWNER_A, notices: [{ policyVersion: "0.1-draft", acknowledgedAt: "x", method: "inApp" }] });
  await setDoc(doc(db, "memberships", OWNER_A), { uid: OWNER_A, householdId: HID_A, role: "owner" });
});

// ============================================================================
section("1. בידוד בין משקי בית — מחלקת הבאג הקטלנית");
// ============================================================================
await deny("בעלים ב' לא קורא את מסמך משק הבית של א'", getDoc(doc(dbB, "households", HID_A)));
await deny("ולא רכב שלו", getDoc(doc(dbB, "households", HID_A, "vehicles", "v1")));
await deny("ולא משימה", getDoc(doc(dbB, "households", HID_A, "tasks", "t1")));
await deny("ולא מסמך", getDoc(doc(dbB, "households", HID_A, "documents", "docShared")));
await deny("ולא רשימת הרכבים", getDocs(collection(dbB, "households", HID_A, "vehicles")));
await deny("ולא כותב לרכב של א'", setDoc(doc(dbB, "households", HID_A, "vehicles", "v1"), { hacked: true }));
await deny("ולא מוחק אותו", deleteDoc(doc(dbB, "households", HID_A, "vehicles", "v1")));
await allow("אבל כן קורא את הרכב שלו עצמו", getDoc(doc(dbB, "households", HID_B, "vehicles", "vb1")));
await deny("אנונימי לא קורא כלום", getDoc(doc(dbAnon, "households", HID_A, "vehicles", "v1")));
await deny("ואנונימי לא קורא את מסמך משק הבית", getDoc(doc(dbAnon, "households", HID_A)));

// ============================================================================
section("2. 🔴 N4 — התפקיד נקרא מ-members, לא מהשוואת מזהים");
// ============================================================================
// משק הבית `households/{OWNER_B}` — ה-id שלו **זהה ל-uid** של OWNER_B,
// אבל במפת ה-members רשום OWNER_A. אם איפשהו הסתננה השוואת hid ל-uid,
// הבדיקה הזאת תעבור בטעות.
await deny("★ hid ששווה ל-uid **לא** מקנה גישה", getDoc(doc(dbB, "households", OWNER_B)));
await deny("★ ולא הרשאת כתיבה", setDoc(doc(dbB, "households", OWNER_B, "vehicles", "x"), { a: 1 }));
await allow("★ ומי שרשום ב-members כן נכנס", getDoc(doc(dbA, "households", OWNER_B)));

// ============================================================================
section("3. 🔴 vehiclesPrivate — בעלים בלבד, לתמיד");
// ============================================================================
await allow("הבעלים קורא", getDoc(doc(dbA, "households", HID_A, "vehiclesPrivate", "v1")));
await deny("★ הנהג לא קורא — גם על רכב שהוקצה לו", getDoc(doc(dbD, "households", HID_A, "vehiclesPrivate", "v1")));
await deny("ולא דרך שאילתה על האוסף", getDocs(collection(dbD, "households", HID_A, "vehiclesPrivate")));
await deny("ולא כותב", setDoc(doc(dbD, "households", HID_A, "vehiclesPrivate", "v1"), { purchasePrice: 1 }));

// ============================================================================
section("4. 🔴 personalDocs — read לנושא בלבד, delete לבעלים");
// ============================================================================
await allow("הנהג קורא את המסמך שלו", getDoc(doc(dbD, "households", HID_A, "personalDocs", "pdDriver")));
await deny("★ הבעלים **לא** קורא את המסמך של הנהג", getDoc(doc(dbA, "households", HID_A, "personalDocs", "pdDriver")));
await deny("★ ונהג אחר לא קורא של הנהג הראשון", getDoc(doc(dbO, "households", HID_A, "personalDocs", "pdDriver")));
await deny("והנהג לא קורא של הבעלים", getDoc(doc(dbD, "households", HID_A, "personalDocs", "pdOwner")));
await deny("שאילתה על האוסף חסומה לבעלים", getDocs(collection(dbA, "households", HID_A, "personalDocs")));
await deny("הנהג לא יוצר מסמך בשם אחר", setDoc(doc(dbD, "households", HID_A, "personalDocs", "fake"), { driverUid: OWNER_A, householdId: HID_A }));
await allow("הנהג יוצר מסמך בשם עצמו", setDoc(doc(dbD, "households", HID_A, "personalDocs", "pdNew"), { driverUid: DRIVER, householdId: HID_A }));
// ★★ הנקודה החדה ביותר: מחיקה בלי קריאה.
await allow("★★ הבעלים **כן** מוחק (cascade) — בלי הרשאת קריאה", deleteDoc(doc(dbA, "households", HID_A, "personalDocs", "pdNew")));

// ============================================================================
section("5. מסמכי רכב — shared מול owner");
// ============================================================================
await allow("הבעלים קורא shared", getDoc(doc(dbA, "households", HID_A, "documents", "docShared")));
await allow("הבעלים קורא owner", getDoc(doc(dbA, "households", HID_A, "documents", "docOwner")));
// פרוסה 1 = בעלים בלבד על שניהם. ההבחנה shared/נהג נכנסת בפרוסה 2
// (ההערה `|| (visibility=='shared' && hasVehicle(...))` כבר בקוד).
await deny("הנהג לא קורא owner", getDoc(doc(dbD, "households", HID_A, "documents", "docOwner")));
await deny("ובפרוסה 1 גם לא shared", getDoc(doc(dbD, "households", HID_A, "documents", "docShared")));

// ============================================================================
section("6. גישת נהג — vehicleAccess ו-drivers");
// ============================================================================
await allow("הנהג קורא את רשומת ההרשאה שלו", getDoc(doc(dbD, "households", HID_A, "vehicleAccess", `${DRIVER}__v1`)));
await deny("ולא כותב אותה", setDoc(doc(dbD, "households", HID_A, "vehicleAccess", `${DRIVER}__v2`), { driverUid: DRIVER, vehicleId: "v2", householdId: HID_A }));
await allow("הנהג קורא את רשומת הנהג שלו", getDoc(doc(dbD, "households", HID_A, "drivers", "d1")));
await deny("ולא של נהג אחר", getDoc(doc(dbD, "households", HID_A, "drivers", "dMinor")));
await deny("★ ובפרוסה 1 הנהג לא קורא את הרכב עצמו", getDoc(doc(dbD, "households", HID_A, "vehicles", "v1")));
await deny("ולא משימות", getDoc(doc(dbD, "households", HID_A, "tasks", "t1")));

// ============================================================================
section("7. 🔴 N7 — guardianConsent ו-isMinor: בעלים בלבד, append-only");
// ============================================================================
const consent = { byUid: OWNER_A, byName: "רונן", at: new Date().toISOString(), method: "inApp", policyVersion: "0.1-draft" };
await deny(
  "★ הנהג לא כותב guardianConsent על עצמו",
  updateDoc(doc(dbD, "households", HID_A, "drivers", "d1"), { guardianConsent: [consent] })
);
await deny(
  "★ ולא משנה isMinor",
  updateDoc(doc(dbD, "households", HID_A, "drivers", "d1"), { isMinor: true })
);
await deny(
  "★ הזמנת קטין לא עוברת ל-accepted בלי הסכמה",
  updateDoc(doc(dbA, "households", HID_A, "drivers", "dMinor"), { inviteStatus: "accepted" })
);
await allow(
  "★ הבעלים כותב את ההסכמה",
  updateDoc(doc(dbA, "households", HID_A, "drivers", "dMinor"), { guardianConsent: [consent] })
);
await allow(
  "★ ורק אז ההזמנה ניתנת לקבלה",
  updateDoc(doc(dbA, "households", HID_A, "drivers", "dMinor"), { inviteStatus: "accepted" })
);
await deny(
  "★ ההסכמה append-only — אי אפשר לרוקן",
  updateDoc(doc(dbA, "households", HID_A, "drivers", "dMinor"), { guardianConsent: [] })
);
await allow(
  "אבל אפשר להוסיף",
  updateDoc(doc(dbA, "households", HID_A, "drivers", "dMinor"), { guardianConsent: [consent, { ...consent, at: "later" }] })
);

// ============================================================================
section("8. 🔴 N5 — users/{uid}: הנושא בלבד, notices append-only");
// ============================================================================
await allow("המשתמש קורא את עצמו", getDoc(doc(dbA, "users", OWNER_A)));
await deny("★ ומשתמש אחר לא קורא אותו", getDoc(doc(dbB, "users", OWNER_A)));
await deny("★ ולא כותב לו", setDoc(doc(dbB, "users", OWNER_A), { hacked: true }));
await allow(
  "★ הוספת יידוע (append)",
  updateDoc(doc(dbA, "users", OWNER_A), {
    notices: [
      { policyVersion: "0.1-draft", acknowledgedAt: "x", method: "inApp" },
      { policyVersion: "0.2", acknowledgedAt: "y", method: "inApp" },
    ],
  })
);
await deny("★ אבל לא צמצום ההיסטוריה", updateDoc(doc(dbA, "users", OWNER_A), { notices: [] }));

// ============================================================================
section("9. memberships + יצירת משק בית");
// ============================================================================
await allow("המשתמש קורא את השיוך שלו", getDoc(doc(dbA, "memberships", OWNER_A)));
await deny("ולא של אחר", getDoc(doc(dbB, "memberships", OWNER_A)));
await deny(
  "★ אי אפשר לזייף שיוך למשק בית שאינך בעליו",
  setDoc(doc(dbB, "memberships", OWNER_B), { uid: OWNER_B, householdId: HID_A, role: "owner" })
);
await deny("ואי אפשר למחוק שיוך", deleteDoc(doc(dbA, "memberships", OWNER_A)));
await allow(
  "יצירת משק בית שבו היוצר הוא הבעלים היחיד",
  setDoc(doc(dbB, "households", "hh_new"), householdDoc("hh_new", { [OWNER_B]: "owner" }))
);
await deny(
  "★ אבל לא משק בית שרושם מישהו אחר",
  setDoc(doc(dbB, "households", "hh_evil"), householdDoc("hh_evil", { [OWNER_A]: "owner", [OWNER_B]: "owner" }))
);

// ============================================================================
section("10. deny גורף — אוסף בלי match, ו-reminderLog");
// ============================================================================
// ★ הכשל שכבר קרה ב-fleet: אוסף חדש שנוסף לקוד בלי כלל ב-rules.
await deny("★ אוסף שלא נמנה במפורש — חסום גם לבעלים", getDoc(doc(dbA, "households", HID_A, "somethingNew", "x")));
await deny("ולא ניתן לכתיבה", setDoc(doc(dbA, "households", HID_A, "somethingNew", "x"), { a: 1 }));
await deny("נתיב שורש לא מוכר חסום", getDoc(doc(dbA, "randomCollection", "x")));

// ★ כל אוסף ב-ENTITY_COLLECTIONS חייב כלל — אחרת הוא נופל ל-deny הגורף
// והאפליקציה תישבר בשקט בענן.
for (const c of ENTITY_COLLECTIONS) {
  // personalDocs הוא היחיד שהבעלים **לא** קורא — במכוון.
  if (c === "personalDocs") continue;
  await allow(`★ לאוסף ${c} יש כלל שמאפשר לבעלים לקרוא`, getDocs(collection(dbA, "households", HID_A, c)));
}
await allow("★ ולבעלים יש read על personalDocs? לא — אבל delete כן", deleteDoc(doc(dbA, "households", HID_A, "personalDocs", "pdOwner")));

// ============================================================================
// reminderLog — **הנמען בלבד קורא. גם לא הבעלים.**
// לוג מסירה של בן משפחה חושף מתי הודעה נמסרה למכשירו ומתי הוא אישר אותה —
// כלומר נוכחות והתנהגות. זה המעקב שנפסל ב-fleet, בגרסה רגישה יותר: הורה
// שמנטר בן 17. מה שהבעלים צריך פתור ב-`schedule.escalateToOwner`.
// ============================================================================
await allow("הנמען קורא את הרשומה שלו", getDoc(doc(dbA, "households", HID_A, "reminderLog", "rOwner")));
await allow("והנהג את שלו", getDoc(doc(dbD, "households", HID_A, "reminderLog", "rDriver")));
await deny("★★ הבעלים **לא** קורא את לוג המסירה של הנהג", getDoc(doc(dbA, "households", HID_A, "reminderLog", "rDriver")));
await deny("★ והנהג לא את של הבעלים", getDoc(doc(dbD, "households", HID_A, "reminderLog", "rOwner")));
await deny("★ ושאילתה על האוסף חסומה לכולם", getDocs(collection(dbA, "households", HID_A, "reminderLog")));
await deny("★ הקליינט לא כותב ליומן", setDoc(doc(dbA, "households", HID_A, "reminderLog", "rNew"), { recipientUid: OWNER_A }));
await deny("ולא מוחק ממנו — גם לא את שלו", deleteDoc(doc(dbA, "households", HID_A, "reminderLog", "rOwner")));
await deny("ובעלים אחר לא קורא כלום", getDoc(doc(dbB, "households", HID_A, "reminderLog", "rOwner")));

// ============================================================================
// 🔴 T3 — המצב הפר-נמען של המשימה: **שרת בלבד, גם לבעלים.**
// כאן יושבים acknowledgedAt / lastFiredAt / channelsTried — כל מה שהוא
// תכונה של אדם ולא של המשימה. הם ירדו ממסמך המשימה בדיוק כי הבעלים קורא
// אותו במלואו, ו-rules לא מסתירים שדה (D1, פעם שלישית).
// ============================================================================
await deny("★★ הבעלים לא קורא את מצב המסירה הפר-נמען", getDoc(doc(dbA, "households", HID_A, "tasks", "t1", "private", "state")));
await deny("★★ ולא כותב אליו", setDoc(doc(dbA, "households", HID_A, "tasks", "t1", "private", "state"), { a: 1 }));
await deny("★ והנהג בוודאי לא", getDoc(doc(dbD, "households", HID_A, "tasks", "t1", "private", "state")));
await allow("★ אבל את המשימה עצמה הבעלים כן קורא", getDoc(doc(dbA, "households", HID_A, "tasks", "t1")));

// -- O18: לוג הגישה — הפועל בלבד, וכתיבה מהשרת בלבד ----------------------
await allow("★ הפועל קורא את רשומת הגישה שלו", getDoc(doc(dbA, "households", HID_A, "accessLog", "aOwner")));
await deny("★★ ואדם אחר לא קורא אותה", getDoc(doc(dbD, "households", HID_A, "accessLog", "aOwner")));
await deny("★ והקליינט לא כותב ללוג הגישה", setDoc(doc(dbA, "households", HID_A, "accessLog", "aNew"), { actorUid: OWNER_A }));

// ============================================================================
section("11. Storage — ארבעת הדומיינים");
// ============================================================================
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const meta = { contentType: "image/jpeg" };
const stA = ownerA.storage();
const stD = driver.storage();
const stB = ownerB.storage();

const P = {
  shared: `households/${HID_A}/vehicles/v1/shared/doc1_lic.jpg`,
  owner: `households/${HID_A}/vehicles/v1/owner/doc2_policy.jpg`,
  photo: `households/${HID_A}/vehicles/v1/photo/ph_car.jpg`,
  personal: `households/${HID_A}/people/d1/docs/pd_lic.jpg`,
};

await allow("הבעלים מעלה לדומיין shared", uploadBytes(ref(stA, P.shared), JPEG, meta));
await allow("הבעלים מעלה לדומיין owner", uploadBytes(ref(stA, P.owner), JPEG, meta));
await allow("הבעלים מעלה תמונת רכב", uploadBytes(ref(stA, P.photo), JPEG, meta));
await deny("★ הנהג לא מעלה לדומיין shared (פרוסה 1)", uploadBytes(ref(stD, P.shared), JPEG, meta));
await deny("★ ובעלים אחר לא מעלה בכלל", uploadBytes(ref(stB, P.shared), JPEG, meta));
await allow("הבעלים קורא מטא-דאטה של shared", getMetadata(ref(stA, P.shared)));
await deny("★ הנהג לא קורא את הדומיין owner", getMetadata(ref(stD, P.owner)));
await deny("★ ובעלים אחר לא קורא כלום", getMetadata(ref(stB, P.shared)));

// -- O6: סוג קובץ וגודל --
await deny(
  "★ O6 — קובץ שאינו תמונה/PDF נחסם",
  uploadBytes(ref(stA, `households/${HID_A}/vehicles/v1/shared/evil.txt`), new Uint8Array([1, 2, 3]), { contentType: "text/plain" })
);
await allow(
  "PDF מותר",
  uploadBytes(ref(stA, `households/${HID_A}/vehicles/v1/shared/doc3.pdf`), new Uint8Array([0x25, 0x50, 0x44, 0x46]), { contentType: "application/pdf" })
);
await deny(
  "★ O6 — קובץ מעל 10MB נחסם",
  uploadBytes(ref(stA, `households/${HID_A}/vehicles/v1/shared/big.jpg`), new Uint8Array(11 * 1024 * 1024), meta)
);

// ============================================================================
section("12. 🔴🔴 Storage — מסמך אישי: delete בלי read");
// ============================================================================
// זו הנקודה החדה ביותר בכל הסקירה. עדי תכננה במפורש שלבעלים יהיה `delete`
// **בלי** `read`. אם Storage לא מתיר את הפיצול — ה-cascade נכשל בשקט,
// ונשארות סריקות רישיון נהיגה יתומות עם טוקן קריאה פעיל.
await allow("★ הנהג מעלה את רישיון הנהיגה שלו", uploadBytes(ref(stD, P.personal), JPEG, meta));
await deny("★ הבעלים לא מעלה לנתיב האישי של הנהג", uploadBytes(ref(stA, P.personal), JPEG, meta));
await allow("★ הנהג קורא את המסמך שלו", getMetadata(ref(stD, P.personal)));
await allow("★ והנהג מקבל כתובת הורדה", getDownloadURL(ref(stD, P.personal)));
await deny("★★ הבעלים **לא** קורא את המסמך האישי", getMetadata(ref(stA, P.personal)));
await deny("★★ ולא מקבל כתובת הורדה", getDownloadURL(ref(stA, P.personal)));
await deny("★ ונהג אחר לא קורא אותו", getMetadata(ref(other.storage(), P.personal)));
// ★★★ ההכרעה: האם מחיקה בלי קריאה בכלל אפשרית ב-Storage?
await allow("★★★ הבעלים **כן** מוחק את האובייקט — cascade עובד", deleteObject(ref(stA, P.personal)));

await testEnv.cleanup();

console.log("\n" + "=".repeat(60));
if (failed) {
  console.error(`נכשלו ${failed} בדיקות מתוך ${pass + failed}`);
  for (const f of failures) console.error("  ✗", f);
  process.exit(1);
}
console.log(`✓ כל ${pass} בדיקות ה-rules עברו מול אמולטור אמיתי`);
