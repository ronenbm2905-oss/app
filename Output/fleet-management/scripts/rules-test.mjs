// ============================================================================
// rules-test.mjs — הרצה **אמיתית** של firestore.rules ו-storage.rules מול
// אמולטור Firebase.  G2 בשער של עדי (2026-08-13): קובץ הכללים הזה כבר היה
// שגוי פעם אחת (חסרו match ל-vehiclesPrivate/finesPrivate/incidentsPrivate/
// fineScans, ב-12.8), ונתפס ביד. קובץ שכבר טעה אינו זכאי לחזקת תקינות
// בקריאה שנייה בעיניים.
//
//   הרצה:
//     1) התקנת firebase-tools (פעם אחת):  npm i -g firebase-tools
//     2) **Java 11+ מותקן** — האמולטור הוא תהליך JVM. בלי Java הוא לא יעלה.
//     3) בטרמינל אחד:   npx firebase-tools emulators:start --only firestore,storage --project fleet-rules-test
//        (ב-PowerShell npx.ps1 חסום — להריץ:  cmd /c "npx firebase-tools emulators:start --only firestore,storage --project fleet-rules-test")
//     4) בטרמינל שני:   npm run rules:test
//
//   לחלופין, בשורה אחת:
//     cmd /c "npx firebase-tools emulators:exec --only firestore,storage --project fleet-rules-test \"npm run rules:test\""
//
// ארבע הבדיקות שעדי דרשה (סעיף 3 בשער) — כל אחת מסומנת להלן:
//   (א) משתמש לא-מחובר נדחה מכל נתיב.
//   (ב) אדמין של ארגון א' נדחה מכל נתיב תחת orgs/B.
//   (ג) כתיבה ל-vehiclesPrivate **מצליחה** לאדמין — הבאג של 12.8 היה נופל כאן.
//   (ד) העלאה ל-Storage מחוץ לארבעת התחומים **נדחית** — הבדיקה של G3.
//
// ⚠️ נכון ל-13.8.2026 הבדיקות האלה **טרם הורצו**: Java אינה מותקנת על מכונת
// הפיתוח ולכן האמולטור לא עולה. הקוד כתוב, מחווט ומוכן-להרצה; ברגע ש-Java
// מותקנת זו פקודה אחת. אין לפרש "נכתבו" כ"עברו".
// ============================================================================

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ID = "fleet-rules-test";
const FIRESTORE_PORT = 8080;
const STORAGE_PORT = 9199;
const HOST = "127.0.0.1";

// ---------------------------------------------------------------------------
// preflight — האמולטור חייב לרוץ. בלי ההודעה הזו הכישלון נראה כמו באג בכללים.
// ---------------------------------------------------------------------------
function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: HOST, port });
    const done = (v) => {
      socket.destroy();
      resolve(v);
    };
    socket.setTimeout(1200);
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false));
    socket.on("error", () => done(false));
  });
}

const up = { firestore: await portOpen(FIRESTORE_PORT), storage: await portOpen(STORAGE_PORT) };
if (!up.firestore || !up.storage) {
  console.error("\n⛔ האמולטור אינו רץ.");
  console.error(`   Firestore ${HOST}:${FIRESTORE_PORT} — ${up.firestore ? "פתוח" : "סגור"}`);
  console.error(`   Storage   ${HOST}:${STORAGE_PORT} — ${up.storage ? "פתוח" : "סגור"}`);
  console.error("\n   הפעלה:");
  console.error(
    `   cmd /c "npx firebase-tools emulators:start --only firestore,storage --project ${PROJECT_ID}"`
  );
  console.error("\n   דרוש Java 11+ (האמולטור הוא תהליך JVM). בדיקה: java -version\n");
  process.exit(2);
}

const { initializeTestEnvironment, assertFails, assertSucceeds } = await import(
  "@firebase/rules-unit-testing"
);
const { doc, getDoc, setDoc, deleteDoc, collection, getDocs } = await import("firebase/firestore");
const { ref, uploadBytes, getBytes, deleteObject } = await import("firebase/storage");

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: {
    rules: readFileSync(join(ROOT, "firestore.rules"), "utf8"),
    host: HOST,
    port: FIRESTORE_PORT,
  },
  storage: {
    rules: readFileSync(join(ROOT, "storage.rules"), "utf8"),
    host: HOST,
    port: STORAGE_PORT,
  },
});

let pass = 0;
let failed = 0;
const failures = [];

async function expectDenied(name, promise) {
  try {
    await assertFails(promise);
    pass++;
  } catch {
    failed++;
    failures.push(`נדחה? לא — ${name}`);
    console.error("  FAIL (היה אמור להיחסם):", name);
  }
}
async function expectAllowed(name, promise) {
  try {
    await assertSucceeds(promise);
    pass++;
  } catch (err) {
    failed++;
    failures.push(`הותר? לא — ${name}`);
    console.error("  FAIL (היה אמור לעבור):", name, "·", err?.code || err?.message || err);
  }
}
const section = (title) => console.log(`\n— ${title}`);

// ---------------------------------------------------------------------------
// זריעה: שני ארגונים, כל אחד עם אדמין משלו. נכתב עם כללים מנוטרלים — זו
// הדרך היחידה להגיע למצב פתיחה בלי להסתמך על הכללים שאותם בודקים.
// ---------------------------------------------------------------------------
await testEnv.clearFirestore();
await testEnv.clearStorage();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "orgs/orgA"), {
    org: { id: "orgA", name: "ארגון א", members: { adminA: "admin" } },
    settings: { onboarded: true },
  });
  await setDoc(doc(db, "orgs/orgB"), {
    org: { id: "orgB", name: "ארגון ב", members: { adminB: "admin" } },
    settings: { onboarded: true },
  });
  await setDoc(doc(db, "orgs/orgB/vehicles/vB1"), { plate: "111", orgId: "orgB" });
  await setDoc(doc(db, "orgs/orgB/vehiclesPrivate/vB1"), { monthlyCost: 3200, orgId: "orgB" });
  await setDoc(doc(db, "memberships/adminA"), { orgId: "orgA", role: "admin", driverId: null });
});

const anon = testEnv.unauthenticatedContext();
const adminA = testEnv.authenticatedContext("adminA");
const adminB = testEnv.authenticatedContext("adminB");
const stranger = testEnv.authenticatedContext("nobody"); // מחובר, לא חבר באף ארגון

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const png = (storage, path) =>
  uploadBytes(ref(storage, path), PNG, { contentType: "image/png" });

// ============================================================================
section("(א) משתמש לא-מחובר — נדחה מכל נתיב");
// ============================================================================
{
  const db = anon.firestore();
  const st = anon.storage();
  await expectDenied("קריאת מסמך הארגון", getDoc(doc(db, "orgs/orgA")));
  await expectDenied("כתיבת מסמך הארגון", setDoc(doc(db, "orgs/orgA"), { hacked: true }));
  await expectDenied("קריאת רכבים", getDocs(collection(db, "orgs/orgA/vehicles")));
  await expectDenied("כתיבת רכב", setDoc(doc(db, "orgs/orgA/vehicles/v1"), { plate: "1" }));
  await expectDenied("קריאת נהגים", getDocs(collection(db, "orgs/orgA/drivers")));
  await expectDenied("קריאת החזקות", getDocs(collection(db, "orgs/orgA/assignments")));
  await expectDenied("קריאת קנסות", getDocs(collection(db, "orgs/orgA/fines")));
  await expectDenied("קריאת מסמכים פרטיים (D1)", getDoc(doc(db, "orgs/orgA/vehiclesPrivate/v1")));
  await expectDenied("קריאת סריקות קנס (D2)", getDocs(collection(db, "orgs/orgA/fineScans")));
  await expectDenied("קריאת שיוך משתמש-ארגון", getDoc(doc(db, "memberships/adminA")));
  await expectDenied("כתיבת שיוך משתמש-ארגון", setDoc(doc(db, "memberships/x"), { orgId: "orgA", role: "admin" }));
  await expectDenied("נתיב שרירותי כלשהו", getDoc(doc(db, "whatever/x")));
  await expectDenied("Storage — העלאת סריקת קנס", png(st, "orgs/orgA/fines/f1/a.png"));
  await expectDenied("Storage — העלאת צילום מד", png(st, "orgs/orgA/drivers/d1/odometer/a.png"));
  await expectDenied("Storage — קריאת קובץ", getBytes(ref(st, "orgs/orgA/fines/f1/a.png")));
}

// ============================================================================
section("(ב) אדמין של ארגון א' — נדחה מכל נתיב תחת ארגון ב'");
// ============================================================================
{
  const db = adminA.firestore();
  const st = adminA.storage();
  await expectDenied("קריאת מסמך הארגון האחר", getDoc(doc(db, "orgs/orgB")));
  await expectDenied("עדכון מסמך הארגון האחר", setDoc(doc(db, "orgs/orgB"), { org: { members: { adminA: "admin" } } }));
  await expectDenied("קריאת רכב של הארגון האחר", getDoc(doc(db, "orgs/orgB/vehicles/vB1")));
  await expectDenied("קריאת רשימת הרכבים של הארגון האחר", getDocs(collection(db, "orgs/orgB/vehicles")));
  await expectDenied("כתיבת רכב לארגון האחר", setDoc(doc(db, "orgs/orgB/vehicles/vB2"), { plate: "2" }));
  await expectDenied("קריאת המסמך הפרטי של הארגון האחר (D1)", getDoc(doc(db, "orgs/orgB/vehiclesPrivate/vB1")));
  await expectDenied("קריאת נהגי הארגון האחר", getDocs(collection(db, "orgs/orgB/drivers")));
  await expectDenied("מחיקת רכב בארגון האחר", deleteDoc(doc(db, "orgs/orgB/vehicles/vB1")));
  await expectDenied("קריאת שיוך של משתמש אחר", getDoc(doc(db, "memberships/adminB")));
  await expectDenied("Storage — קריאה מהארגון האחר", getBytes(ref(st, "orgs/orgB/fines/f1/a.png")));
  await expectDenied("Storage — העלאה לארגון האחר", png(st, "orgs/orgB/fines/f1/a.png"));
  await expectDenied("Storage — העלאה למסמכי רכב של הארגון האחר", png(st, "orgs/orgB/vehicles/vB1/docs/a.png"));

  // ומהצד השני, לשם סימטריה
  const dbB = adminB.firestore();
  await expectDenied("אדמין ב' נדחה ממסמך הארגון של א'", getDoc(doc(dbB, "orgs/orgA")));
  await expectDenied("אדמין ב' נדחה מהמסמכים הפרטיים של א'", getDoc(doc(dbB, "orgs/orgA/vehiclesPrivate/v1")));

  // משתמש מחובר שאינו חבר באף ארגון
  const dbS = stranger.firestore();
  await expectDenied("משתמש מחובר שאינו חבר — נדחה", getDoc(doc(dbS, "orgs/orgA")));
  await expectDenied("משתמש מחובר שאינו חבר — לא כותב", setDoc(doc(dbS, "orgs/orgA/vehicles/v9"), { plate: "9" }));
  await expectDenied(
    "משתמש מחובר לא רושם את עצמו כאדמין בארגון קיים",
    setDoc(doc(dbS, "memberships/nobody"), { orgId: "orgA", role: "admin" })
  );
}

// ============================================================================
section("(ג) אדמין בארגון שלו — הכתיבות שחייבות לעבוד (הבאג של 12.8)");
// ============================================================================
{
  const db = adminA.firestore();
  await expectAllowed("קריאת מסמך הארגון", getDoc(doc(db, "orgs/orgA")));
  await expectAllowed("כתיבת רכב", setDoc(doc(db, "orgs/orgA/vehicles/v1"), { plate: "1", orgId: "orgA" }));
  // ⬇ זו הבדיקה שהבאג של 12.8 היה נופל בה: חסר match ל-vehiclesPrivate.
  await expectAllowed(
    "כתיבה ל-vehiclesPrivate (D1)",
    setDoc(doc(db, "orgs/orgA/vehiclesPrivate/v1"), { vehicleId: "v1", monthlyCost: 2900, orgId: "orgA" })
  );
  await expectAllowed("קריאה מ-vehiclesPrivate", getDoc(doc(db, "orgs/orgA/vehiclesPrivate/v1")));
  await expectAllowed(
    "כתיבה ל-finesPrivate (D1)",
    setDoc(doc(db, "orgs/orgA/finesPrivate/f1"), { fineId: "f1", adminNotes: "…", orgId: "orgA" })
  );
  await expectAllowed(
    "כתיבה ל-incidentsPrivate (D1)",
    setDoc(doc(db, "orgs/orgA/incidentsPrivate/i1"), { incidentId: "i1", adminAssessment: "…", orgId: "orgA" })
  );
  await expectAllowed(
    "כתיבה ל-fineScans (D2)",
    setDoc(doc(db, "orgs/orgA/fineScans/s1"), { fineId: "f1", driverUid: null, orgId: "orgA" })
  );
  await expectAllowed("כתיבת נהג", setDoc(doc(db, "orgs/orgA/drivers/d1"), { fullName: "בדיקה", orgId: "orgA" }));
  await expectAllowed("כתיבת החזקה", setDoc(doc(db, "orgs/orgA/assignments/a1"), { vehicleId: "v1", driverId: "d1" }));
  await expectAllowed("כתיבת קנס", setDoc(doc(db, "orgs/orgA/fines/f1"), { vehicleId: "v1", amount: 250 }));
  await expectAllowed("כתיבת קריאת מד", setDoc(doc(db, "orgs/orgA/odometerReadings/o1"), { vehicleId: "v1", km: 100 }));
  await expectAllowed("כתיבת טיפול", setDoc(doc(db, "orgs/orgA/serviceRecords/sr1"), { vehicleId: "v1" }));
  await expectAllowed("כתיבת מסמך רכב", setDoc(doc(db, "orgs/orgA/documents/doc1"), { vehicleId: "v1" }));
  await expectAllowed("כתיבת חברת ליסינג", setDoc(doc(db, "orgs/orgA/leaseCompanies/lc1"), { name: "ליס" }));
  await expectAllowed("כתיבת תקלה", setDoc(doc(db, "orgs/orgA/incidents/i1"), { vehicleId: "v1" }));
  await expectAllowed("קריאת השיוך של עצמו", getDoc(doc(db, "memberships/adminA")));
  // תת-אוסף שלא נמנה במפורש — חסום גם לאדמין (רשת הביטחון של firestore.rules)
  await expectDenied("אוסף לא מוכר תחת הארגון נחסם", setDoc(doc(db, "orgs/orgA/somethingElse/x"), { a: 1 }));
  await expectDenied("נתיב מחוץ ל-orgs נחסם", setDoc(doc(db, "randomTop/x"), { a: 1 }));
}

// ============================================================================
section("(ד) Storage — ארבעת התחומים בלבד (G3)");
// ============================================================================
{
  const st = adminA.storage();
  // מותר — ארבעת התחומים של D2, בדיוק כפי ש-files.js:storagePath מייצר.
  await expectAllowed("סריקת קנס", png(st, "orgs/orgA/fines/f1/scn1_scan.png"));
  await expectAllowed("צילום מד-אוץ'", png(st, "orgs/orgA/drivers/d1/odometer/odo1_photo.png"));
  await expectAllowed("צילום תקלה", png(st, "orgs/orgA/drivers/d1/incidents/inc1_photo.png"));
  await expectAllowed("מסמך רכב", png(st, "orgs/orgA/vehicles/v1/docs/doc1_insurance.png"));
  await expectAllowed("קריאה חזרה של קובץ מהתחום", getBytes(ref(st, "orgs/orgA/fines/f1/scn1_scan.png")));
  await expectAllowed("מחיקת קובץ מהתחום", deleteObject(ref(st, "orgs/orgA/fines/f1/scn1_scan.png")));

  // ⛔ G3 — כל נתיב אחר תחת הארגון נדחה, גם לאדמין.
  await expectDenied("נתיב שטוח תחת הארגון", png(st, "orgs/orgA/loose.png"));
  await expectDenied("תיקייה שאינה תחום מוכר", png(st, "orgs/orgA/misc/x.png"));
  await expectDenied("תת-תיקייה מתחת לנהג שאינה odometer/incidents", png(st, "orgs/orgA/drivers/d1/other/x.png"));
  await expectDenied("קובץ ישירות מתחת לנהג", png(st, "orgs/orgA/drivers/d1/x.png"));
  await expectDenied("קובץ ישירות מתחת לרכב (בלי docs)", png(st, "orgs/orgA/vehicles/v1/x.png"));
  await expectDenied("תת-תיקייה מתחת לרכב שאינה docs", png(st, "orgs/orgA/vehicles/v1/private/x.png"));
  await expectDenied("עומק נוסף מתחת לסריקות קנס", png(st, "orgs/orgA/fines/f1/sub/deep.png"));
  await expectDenied("נתיב מחוץ ל-orgs לגמרי", png(st, "uploads/x.png"));
  await expectDenied("שורש הבאקט", png(st, "x.png"));

  // מגבלות סוג הקובץ — גם בתוך תחום מותר.
  await expectDenied(
    "סוג קובץ לא מורשה בתוך תחום מותר",
    uploadBytes(ref(st, "orgs/orgA/fines/f1/note.txt"), new Uint8Array([1, 2, 3]), {
      contentType: "text/plain",
    })
  );
}

await testEnv.cleanup();

console.log("\n" + "=".repeat(60));
if (failed) {
  console.error(`נכשלו ${failed} בדיקות כללים מתוך ${pass + failed}`);
  for (const f of failures) console.error("  ✗", f);
  process.exit(1);
}
console.log(`✓ כל ${pass} בדיקות הכללים עברו (firestore.rules + storage.rules)`);
