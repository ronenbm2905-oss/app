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
// (ה) נוסף ב-16.8 אחרי באג פרודקשן: **משתמש חדש שאין לו עדיין ארגון.**
//   כל (א)-(ד) זורעות את הארגון מראש עם withSecurityRulesDisabled, ולכן אף
//   אחת מהן לא ראתה את הרגע שבו הכללים תקינים אבל סדר הפעולות בקליינט לא.
//   המקטע מריץ את **קוד הקליינט האמיתי** (startOrgSync/writeOrgDiff) ולא
//   שכפול שלו, ונופל אם מחזירים את אחד משני הבאגים:
//     • הרשמה למאזינים לפני שהארגון קיים → 14 דחיות → באנר "טעינה נכשלה";
//     • מסמך ארגון בלי org.members[uid]='admin' → ההקמה בענן נדחית.
//
// (ו) נוסף ב-17.8 אחרי באג פרודקשן: **אדמין שני.** מנהלת הכספים קיבלה את
//   הקישור, התחברה, וראתה **מסך הקמה ראשונית** במקום את הצי — ואילו הייתה
//   משלימה אותו היה נוצר ארגון שני נפרד עם אפס רכבים. השורש היה בקליינט,
//   לא בכללים: `useData.js:63` קבע `orgId = user.uid`.
//   המקטע בודק את שני הצדדים של המודל החדש (allowlist של מיילים):
//     • הכללים — מייל ברשימה קורא/כותב הכול כולל vehiclesPrivate; מייל שאינו
//       ברשימה נדחה מכל נתיב; **מייל ברשימה שאינו מאומת נדחה**; הסרה שוללת
//       גישה מיד; האדמין האחרון אינו ניתן להסרה; ומסלול ה-legacy שמונע נעילה.
//     • קוד הגישה האמיתי (resolveOrgAccess/addAdminEmail/removeAdminEmail) —
//       'none' לפני ההוספה, 'member' אחריה, ו-orgId שהוא הארגון ולא ה-uid.
//
// (ח) נוסף ב-1.10.2026 עם מעבר **עוגן הזהות של הנהג ממייל לנייד**:
//   מסלול המייל היה תקין ועבר 328 בדיקות — ובכל זאת אף נהג לא נקשר, כי אין
//   לחברה חשבונות Google ארגוניים והעובדים לא נתנו גימייל פרטי. מקטע (ז)
//   הוסב במלואו לנייד, ומקטע (ח) הוא **בדיקת התאום** שעדי דרשה (§5.2):
//     • `canonPhone` ב-rules ו-`canonicalPhone` ב-JS הן שתי מימושות של אותו
//       כלל. כל סטייה ביניהן = "הרשאה שלא עובדת" או הרשאת יתר — בדיוק
//       המלכודת של canonEmail, שחוזרת כאן.
//     • ולכן **אותו מערך קלט בדיוק** (phone.js:PHONE_PARITY) מורץ בשני
//       הצדדים: ה-JS מחשב את הצורה הקנונית, והאמולטור מכריע אם הקישור עובר.
//     • כולל קו נייח (שאינו עוגן זהות), גרש מוביל מאקסל, ולוחית רישוי.
//
// ✅ 16.8.2026 — הורצו מול האמולטור: 66/66 עברו (JDK 21 הותקן).
// ✅ 17.8.2026 — 179/179 עברו, כולל מקטע (ו).
//    JAVA_HOME אינו מוגדר גלובלית — להריץ עם:
//    $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot"
//    $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
// ============================================================================

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// ============================================================================
// RULES_FILE — `firestore.rules` כברירת מחדל, ומשתנה סביבה כשהחבילה מורצת
// על **כללים ממוטטים** (scripts/rules-mutate.mjs).
//
// ⚠️ למה זה קיים: חבילת בדיקות ירוקה אומרת "לא תפסנו כלום", ולא "אין מה
// לתפוס. הדרך היחידה לדעת שהבדיקות **באמת** שומרות על הכללים היא לשבור
// את הכללים בכוונה ולראות אותן נופלות. בדיקה שלא ראו אותה נכשלת אינה בדיקה.
// ============================================================================
const RULES_FILE = process.env.FLEET_RULES_FILE || join(ROOT, "firestore.rules");
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
const { doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, collection, getDocs, query, where, FieldPath } =
  await import("firebase/firestore");
const { ref, uploadBytes, getBytes, deleteObject } = await import("firebase/storage");

// שכבת הנתונים **האמיתית** של הקליינט — נבדקת מול הכללים האמיתיים, ולא
// משוכפלת כאן. מקטע (ה) הוא הבדיקה שהייתה תופסת את באג הפרודקשן של 16.8.
const { probeOrg, subscribeOrg, startOrgSync, writeOrgDiff } = await import(
  "../src/utils/firestoreSync.js"
);
// מקטע (ו) — קוד הגישה האמיתי, לא שכפול. הבאג של 17.8 היה **בקליינט**
// (orgId = user.uid קשיח), ולכן בדיקה שרק מפעילה כללים לא הייתה תופסת אותו.
const { resolveOrgAccess, addAdminEmail, removeAdminEmail } = await import(
  "../src/utils/orgMembers.js"
);
// מקטע (ז) — הביטוי הבדיק של מודל הגישה, מול הכללים בפועל. אם השניים
// נפרדים, זו בדיוק הדליפה שאיש לא יראה.
const { canonicalEmail } = await import("../src/utils/admins.js");
// ⚠️ **הפונקציה שמקטע (ח) מודד מולה.** היא חייבת להגיע לאותה תשובה כמו
// `canonPhone` ב-firestore.rules על כל קלט — ולא "בדרך כלל".
const { canonicalPhone, phoneQueryForms } = await import("../src/utils/phone.js");
const { linkFields, unlinkFields, LINK_WRITABLE_KEYS } = await import(
  "../src/utils/driverLink.js"
);
const { buildDriverPortal } = await import("../src/utils/portal.js");
const {
  ownedByDriver,
  driverCanWriteReading,
  driverForUid: driverForUidRef,
  DRIVER_READABLE_COLLECTIONS,
} = await import("../src/utils/access.js");
const { EMPTY } = await import("../src/constants.js");
const emptyData = () => JSON.parse(JSON.stringify(EMPTY));

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: {
    rules: readFileSync(RULES_FILE, "utf8"),
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
function expectEq(name, actual, expected) {
  if (actual === expected) {
    pass++;
    return;
  }
  failed++;
  failures.push(`${name} — קיבלנו ${JSON.stringify(actual)} במקום ${JSON.stringify(expected)}`);
  console.error("  FAIL:", name, "· קיבלנו", JSON.stringify(actual), "· ציפינו", JSON.stringify(expected));
}
function expectTrue(name, cond) {
  expectEq(name, !!cond, true);
}
const section = (title) => console.log(`\n— ${title}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// waitFor — ממתין לתנאי עד deadline. מחזיר true/false, בלי לזרוק.
async function waitFor(fn, { timeoutMs = 5000, stepMs = 60 } = {}) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (fn()) return true;
    await sleep(stepMs);
  }
  return fn();
}

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

// `ctx.firestore()` מחיל settings על המופע, ולכן קריאה שנייה לאותו context
// זורקת "Firestore has already been started". מייצרים מופע אחד לכל זהות
// וממחזרים אותו בכל המקטעים.
const dbAnon = anon.firestore();
const dbAdminA = adminA.firestore();
const dbAdminB = adminB.firestore();
const dbStranger = stranger.firestore();
const stAnon = anon.storage();
const stAdminA = adminA.storage();

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const png = (storage, path) =>
  uploadBytes(ref(storage, path), PNG, { contentType: "image/png" });

// ============================================================================
section("(א) משתמש לא-מחובר — נדחה מכל נתיב");
// ============================================================================
{
  const db = dbAnon;
  const st = stAnon;
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
  const db = dbAdminA;
  const st = stAdminA;
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
  const dbB = dbAdminB;
  await expectDenied("אדמין ב' נדחה ממסמך הארגון של א'", getDoc(doc(dbB, "orgs/orgA")));
  await expectDenied("אדמין ב' נדחה מהמסמכים הפרטיים של א'", getDoc(doc(dbB, "orgs/orgA/vehiclesPrivate/v1")));

  // משתמש מחובר שאינו חבר באף ארגון
  const dbS = dbStranger;
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
  const db = dbAdminA;
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
  const st = stAdminA;
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

// ============================================================================
section("(ה) משתמש חדש בלי ארגון — זרימת ההקמה מקצה לקצה (באג פרודקשן 16.8)");
// ============================================================================
// למה המקטע הזה קיים: כל הבדיקות שמעליו זורעות את הארגון מראש דרך
// withSecurityRulesDisabled, ולכן אף אחת מהן לא ראתה את המצב שבו משתמש
// מחובר **קיים** אבל מסמך הארגון **עוד לא**. זה בדיוק המצב של כל משתמש
// חדש, והוא זה שהתפוצץ בפרודקשן:
//   • isOrgAdmin דורש exists(orgs/{orgId}) ⇒ כל 14 המאזינים נדחים,
//   • מאזין onSnapshot שנדחה מסתיים ואינו מנסה שוב ⇒ הבאנר האדום נשאר
//     גם אחרי שה-onboarding יצר את הארגון.
// המקטע רץ מול הכללים האמיתיים ומול קוד הקליינט האמיתי (firestoreSync).
{
  const NEW_UID = "freshAdmin";
  const dbNew = testEnv.authenticatedContext(NEW_UID).firestore();

  // מרכז אירועים — בדיוק מה שה-hook מקבל מ-startOrgSync.
  const sink = () => {
    const ev = { missing: 0, data: [], errors: [] };
    return {
      ev,
      handlers: {
        onMissing: () => ev.missing++,
        onData: (d) => ev.data.push(d),
        onError: (err, phase) => ev.errors.push({ code: err?.code || String(err), phase }),
      },
    };
  };

  // -- 1. לפני ההקמה: "אין ארגון" הוא מצב תקין, לא שגיאה ------------------
  const probeBefore = await probeOrg(dbNew, NEW_UID);
  expectEq("probeOrg לפני ההקמה מחזיר missing", probeBefore.state, "missing");
  expectEq("probeOrg לפני ההקמה לא מדווח שגיאה", probeBefore.error, null);

  // הרצף שהאפליקציה מריצה בפועל (startOrgSync — אותו קוד, לא שכפול):
  // משתמש חדש ⇒ onMissing, **אפס שגיאות**, ואף מאזין לא נפתח.
  const before = sink();
  const stopBefore = await startOrgSync(dbNew, NEW_UID, before.handlers);
  await sleep(1200); // שהות שבה מאזין שנפתח בטעות היה מספיק להידחות
  expectEq("משתמש חדש: onMissing נקרא פעם אחת", before.ev.missing, 1);
  expectEq("משתמש חדש: אפס שגיאות למשתמש (הבאג של 16.8)", before.ev.errors.length, 0);
  expectEq("משתמש חדש: אין נתונים ואין מאזינים", before.ev.data.length, 0);
  stopBefore();

  // -- 2. הרגרסיה עצמה: מאזין שנפתח מוקדם מדי נדחה — ולא מתאושש ----------
  let earlyError = null;
  let earlyData = null;
  const unsubEarly = await subscribeOrg(
    dbNew,
    NEW_UID,
    (d) => {
      earlyData = d;
    },
    (err) => {
      earlyError = err;
    }
  );
  await waitFor(() => earlyError !== null, { timeoutMs: 8000 });
  expectEq(
    "מאזין שנפתח לפני שהארגון קיים נדחה",
    earlyError?.code || null,
    "permission-denied"
  );

  // -- 3. ההקמה: יצירת הארגון + הישויות הראשונות, בדיוק כמו completeOnboarding
  const created = emptyData();
  created.org = { id: NEW_UID, name: "צי בדיקה", createdAt: "2026-08-16T00:00:00.000Z", members: {} };
  created.settings = { ...created.settings, onboarded: true };
  created.leaseCompanies = [{ id: "lc1", orgId: NEW_UID, name: "ליסינג בדיקה" }];
  created.vehicles = [{ id: "v1", orgId: NEW_UID, plate: "12-345-67", leaseCompanyId: "lc1" }];
  created.vehiclesPrivate = [{ id: "v1", orgId: NEW_UID, vehicleId: "v1", monthlyCost: 2500 }];

  // 3א. בלי selfUid אין members[uid]='admin' — וכלל ה-create דוחה. זה הבאג
  //     השני שנתפס ב-16.8: אף אחד לא כתב את מפת החברים, ולכן **הקמה בענן
  //     לא יכלה להצליח בכלל**.
  const OTHER_UID = "freshNoMembers";
  const dbOther = testEnv.authenticatedContext(OTHER_UID).firestore();
  const withoutMembers = emptyData();
  withoutMembers.org = { ...withoutMembers.org, id: OTHER_UID, name: "בלי חברים" };
  withoutMembers.settings = { ...withoutMembers.settings, onboarded: true };
  await expectDenied(
    "יצירת ארגון בלי members[uid]='admin' נדחית",
    writeOrgDiff(dbOther, OTHER_UID, emptyData(), withoutMembers, { ensureRoot: true })
  );

  // 3ב. עם selfUid — ההקמה עוברת, כולל תת-האוספים שנכתבים אחרי מסמך השורש.
  await expectAllowed(
    "יצירת הארגון + הישויות הראשונות (selfUid)",
    writeOrgDiff(dbNew, NEW_UID, emptyData(), created, { selfUid: NEW_UID, ensureRoot: true })
  );

  // -- 4. המאזין הישן **לא** מתאושש — ההצדקה ל-re-subscribe ---------------
  await sleep(1500);
  expectEq("מאזין שנדחה אינו מתאושש אחרי שהארגון נוצר", earlyData, null);
  unsubEarly();

  // -- 5. אחרי ההקמה: אותו רצף מחבר מאזינים ומחזיר נתונים מלאים -----------
  const probeAfter = await probeOrg(dbNew, NEW_UID);
  expectEq("probeOrg אחרי ההקמה מחזיר exists", probeAfter.state, "exists");

  const after = sink();
  const stopAfter = await startOrgSync(dbNew, NEW_UID, after.handlers);
  const gotFirst = await waitFor(() => after.ev.data.length > 0, { timeoutMs: 8000 });
  expectTrue("re-subscribe אחרי ההקמה מקבל נתונים", gotFirst);
  expectEq("אין שגיאות אחרי ההקמה", after.ev.errors.length, 0);
  expectEq("לא נקרא onMissing אחרי ההקמה", after.ev.missing, 0);

  const live = () => after.ev.data[after.ev.data.length - 1];
  expectEq("הצילום הראשון שלם — שם הארגון", live()?.org?.name || null, "צי בדיקה");
  expectEq("הצילום הראשון שלם — onboarded", live()?.settings?.onboarded, true);
  expectEq("הצילום הראשון שלם — רכב אחד", live()?.vehicles?.length, 1);
  expectEq("הצילום הראשון שלם — חברת ליסינג אחת", live()?.leaseCompanies?.length, 1);
  expectEq("הצילום הראשון שלם — מסמך פרטי (D1)", live()?.vehiclesPrivate?.length, 1);
  expectEq("עדכון אחד מלא ולא 14 עדכונים חלקיים", after.ev.data.length, 1);
  expectEq("מפת החברים נכתבה", live()?.org?.members?.[NEW_UID] || null, "admin");
  // רשומת השיוך נכתבת ע"י startOrgSync רק כשהארגון קיים (לא בכל login)
  const membership = await getDoc(doc(dbNew, "memberships", NEW_UID));
  expectTrue("רשומת השיוך נכתבה אחרי שהארגון קיים", membership.exists());
  expectEq("השיוך מצביע על הארגון הנכון", membership.data()?.orgId || null, NEW_UID);

  // -- 6. הנתונים חיים: כתיבה נוספת מגיעה למאזין בלי רענון ----------------
  const prevLive = live();
  if (!prevLive) {
    // בלי צילום ראשון אין מה לבדוק — נרשם ככישלון ולא כקריסה של הסוויטה.
    expectTrue("המאזין מקבל את הרכב השני בלי re-subscribe (לא הגיע צילום ראשון)", false);
  } else {
    const next = JSON.parse(JSON.stringify(prevLive));
    next.vehicles.push({ id: "v2", orgId: NEW_UID, plate: "76-543-21", leaseCompanyId: "lc1" });
    await expectAllowed(
      "כתיבת רכב שני אחרי ההקמה",
      writeOrgDiff(dbNew, NEW_UID, prevLive, next, { selfUid: NEW_UID })
    );
    const gotLive = await waitFor(() => (live()?.vehicles?.length || 0) === 2, { timeoutMs: 8000 });
    expectTrue("המאזין מקבל את הרכב השני בלי re-subscribe", gotLive);
  }
  stopAfter();
}
// ============================================================================
section("(ו) אדמין שני — allowlist של מיילים (באג פרודקשן 17.8)");
// ============================================================================
// למה המקטע הזה קיים: המשתמש שלח את הקישור למנהלת הכספים כדי שתהיה אדמין
// שנייה. היא התחברה וקיבלה **מסך הקמה ראשונית** — ואילו השלימה אותו, היה
// נוצר ארגון שני נפרד עם אפס רכבים. השורש לא היה בכללים אלא בקליינט:
//
//   useData.js:63   const orgId = isFirebaseConfigured ? user?.uid || null : "local";
//
// מזהה הארגון היה **ה-uid של המשתמש המחובר, קשיח**, ולכן גם הוספה ידנית שלה
// למסמך הארגון לא הייתה עוזרת — הקליינט בכלל לא ביקש את הארגון הנכון.
//
// המודל החדש (הדפוס מ-Output/basketball-scheduler, שחי בפרודקשן):
//   • מזהה הארגון קבוע בזמן build (VITE_FLEET_ORG_ID) ולא נגזר מהמשתמש;
//   • הגישה נקבעת ע"י `org.adminEmails` — allowlist של כתובות מייל **מלאות**;
//   • `email_verified == true` נדרש. זו ההגנה שנשארת.
//
// ⚠️ **אין הנחת דומיין.** מנהלת הכספים נכנסה מ-Gmail פרטי ולא מהמייל הארגוני,
//    ולכן אין כאן `endsWith('@company')` — הגבלת הדומיין שעדי המליצה עליה
//    (R-b) אינה ישימה, וזו סטייה מתועדת. הבדיקות למטה כוללות שני ספקים.
// ⚠️ **הגבול:** ה-allowlist הוא לאדמינים בלבד. בידוד נהגים בפרוסה 2 יישאר
//    לפי uid (F1), ו-vehiclesPrivate אינו נפתח לאף אחד שאינו ברשימה.
{
  const ORG = "orgP"; // מזהה הארגון — **אינו** ה-uid של אף אחד מהאדמינים
  const RONEN = "ronenUid";
  const RONEN_EMAIL = "ronen@promall.example";
  const HILDA = "hildaUid";
  const HILDA_EMAIL = "hildavazana@gmail.example"; // Gmail פרטי — המצב בפועל
  const OUTSIDER = "outsiderUid";
  const OUTSIDER_EMAIL = "outsider@elsewhere.example";
  const LEGACY = "legacyUid"; // גישה דרך org.members בלבד (גשר ההגירה)
  const SOLO = "soloAdminUid"; // orgId === uid, בלי דגל build

  // seedOrg — מצב פתיחה נקי לכל תרחיש, עם כללים מנוטרלים.
  // ⚠️ שני ארגונים במסד בכוונה: בפרודקשן ייתכן שנוצר ארגון שני (מנהלת הכספים
  // קיבלה מסך הקמה), ואסור שהקוד יניח שיש ארגון אחד בלבד.
  const seedOrg = (adminEmails, members = { [LEGACY]: "admin" }) =>
    testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const org = { id: ORG, name: "צי בדיקה P", createdAt: "2026-01-01T00:00:00.000Z", members };
      if (adminEmails !== undefined) org.adminEmails = adminEmails;
      await setDoc(doc(db, `orgs/${ORG}`), {
        org,
        settings: { onboarded: true, contractAlertDays: 90, policyVersion: "0.1-draft" },
        schemaVersion: 2,
      });
      await setDoc(doc(db, `orgs/${ORG}/vehicles/vP1`), { plate: "998", orgId: ORG });
      await setDoc(doc(db, `orgs/${ORG}/vehiclesPrivate/vP1`), { vehicleId: "vP1", monthlyCost: 4100, orgId: ORG });
      await setDoc(doc(db, `orgs/${ORG}/drivers/dP1`), { fullName: "בדיקה", orgId: ORG });
      await setDoc(doc(db, `orgs/${ORG}/fines/fP1`), { vehicleId: "vP1", amount: 250, orgId: ORG });
      // ניקוי מה שבדיקות קודמות במקטע כתבו — כדי שספירות יהיו דטרמיניסטיות
      // ולא יזלגו בין תרחישים.
      await deleteDoc(doc(db, `orgs/${ORG}/vehicles/vP2`)).catch(() => {});
      await deleteDoc(doc(db, `orgs/${ORG}/vehiclesPrivate/vP2`)).catch(() => {});
      // ארגון שני, של מישהו אחר — כדי שגזירת ה-orgId לא תתבלבל.
      await setDoc(doc(db, "orgs/orgOther"), {
        org: { id: "orgOther", name: "ארגון אחר", adminEmails: ["stranger@x.example"], members: {} },
        settings: { onboarded: true },
      });
      // ארגון שבו orgId === uid (התקנה בלי דגל build) — תאימות לאחור.
      await setDoc(doc(db, `orgs/${SOLO}`), {
        org: { id: SOLO, name: "יחיד", adminEmails: ["solo@x.example"], members: {} },
        settings: { onboarded: true },
      });
      await deleteDoc(doc(db, `memberships/${HILDA}`)).catch(() => {});
      await deleteDoc(doc(db, `memberships/${OUTSIDER}`)).catch(() => {});
    });

  // הזהויות. שימו לב לשלוש הווריאציות של **אותה כתובת**: מאומתת, לא מאומתת,
  // ובאותיות גדולות. ההבדל ביניהן הוא כל המנגנון.
  const dbRonen = testEnv.authenticatedContext(RONEN, { email: RONEN_EMAIL, email_verified: true }).firestore();
  const dbHilda = testEnv.authenticatedContext(HILDA, { email: HILDA_EMAIL, email_verified: true }).firestore();
  const dbHildaUnv = testEnv
    .authenticatedContext("hildaUnverifiedUid", { email: HILDA_EMAIL, email_verified: false })
    .firestore();
  const dbHildaUpper = testEnv
    .authenticatedContext("hildaUpperUid", { email: HILDA_EMAIL.toUpperCase(), email_verified: true })
    .firestore();
  const dbOutsider = testEnv
    .authenticatedContext(OUTSIDER, { email: OUTSIDER_EMAIL, email_verified: true })
    .firestore();
  const dbNoEmail = testEnv.authenticatedContext("noEmailUid").firestore();
  const dbLegacy = testEnv.authenticatedContext(LEGACY, { email: "legacy@x.example", email_verified: true }).firestore();
  const dbSolo = testEnv.authenticatedContext(SOLO, { email: "solo@x.example", email_verified: true }).firestore();
  const stRonen = testEnv.authenticatedContext(RONEN, { email: RONEN_EMAIL, email_verified: true }).storage();
  const stHilda = testEnv.authenticatedContext(HILDA, { email: HILDA_EMAIL, email_verified: true }).storage();
  const stHildaUnv = testEnv
    .authenticatedContext("hildaUnverifiedUid", { email: HILDA_EMAIL, email_verified: false })
    .storage();
  const stOutsider = testEnv
    .authenticatedContext(OUTSIDER, { email: OUTSIDER_EMAIL, email_verified: true })
    .storage();

  const setList = (db, list) => updateDoc(doc(db, "orgs", ORG), { "org.adminEmails": list });
  const readOrg = async (db) => (await getDoc(doc(db, "orgs", ORG))).data();

  // -- 1. מייל ב-allowlist — קורא וכותב הכול ------------------------------
  await seedOrg([RONEN_EMAIL, HILDA_EMAIL]);
  await expectAllowed("מייל ב-allowlist קורא את מסמך הארגון", getDoc(doc(dbHilda, "orgs", ORG)));
  await expectAllowed("קורא רכבים", getDocs(collection(dbHilda, `orgs/${ORG}/vehicles`)));
  await expectAllowed("קורא נהגים", getDocs(collection(dbHilda, `orgs/${ORG}/drivers`)));
  await expectAllowed("קורא קנסות", getDocs(collection(dbHilda, `orgs/${ORG}/fines`)));
  // ⬅ הבדיקה שנדרשה במפורש: אדמין מלא, כולל D1.
  await expectAllowed(
    "קורא vehiclesPrivate (D1) — אדמין מלא",
    getDoc(doc(dbHilda, `orgs/${ORG}/vehiclesPrivate/vP1`))
  );
  await expectAllowed(
    "כותב רכב",
    setDoc(doc(dbHilda, `orgs/${ORG}/vehicles/vP2`), { plate: "997", orgId: ORG })
  );
  await expectAllowed(
    "כותב vehiclesPrivate",
    setDoc(doc(dbHilda, `orgs/${ORG}/vehiclesPrivate/vP2`), { vehicleId: "vP2", monthlyCost: 3000, orgId: ORG })
  );
  await expectAllowed(
    "שומר הגדרות",
    setDoc(doc(dbHilda, "orgs", ORG), { settings: { contractAlertDays: 85 } }, { merge: true })
  );
  // ⬅ **אין הנחת דומיין**: Gmail פרטי ומייל ארגוני עובדים באותה מידה.
  await expectAllowed("והמייל הארגוני של האדמין המקורי עובד גם כן", getDoc(doc(dbRonen, "orgs", ORG)));
  await expectAllowed("Storage — אדמין ב-allowlist מעלה סריקה", png(stRonen, `orgs/${ORG}/fines/fP1/s.png`));

  // -- 2. מייל שאינו ב-allowlist — נדחה מכל נתיב --------------------------
  await expectDenied("מייל שאינו ברשימה — מסמך הארגון", getDoc(doc(dbOutsider, "orgs", ORG)));
  await expectDenied("מייל שאינו ברשימה — רכבים", getDocs(collection(dbOutsider, `orgs/${ORG}/vehicles`)));
  await expectDenied("מייל שאינו ברשימה — נהגים", getDocs(collection(dbOutsider, `orgs/${ORG}/drivers`)));
  await expectDenied("מייל שאינו ברשימה — קנסות", getDocs(collection(dbOutsider, `orgs/${ORG}/fines`)));
  await expectDenied(
    "מייל שאינו ברשימה — vehiclesPrivate (D1)",
    getDoc(doc(dbOutsider, `orgs/${ORG}/vehiclesPrivate/vP1`))
  );
  await expectDenied(
    "מייל שאינו ברשימה — כתיבת רכב",
    setDoc(doc(dbOutsider, `orgs/${ORG}/vehicles/vX`), { plate: "1" })
  );
  await expectDenied(
    "מייל שאינו ברשימה — כתיבת הגדרות",
    setDoc(doc(dbOutsider, "orgs", ORG), { settings: { contractAlertDays: 1 } }, { merge: true })
  );
  // ⬅ החור המובהק: מי שאינו ברשימה מוסיף את **עצמו** לרשימה.
  await expectDenied(
    "מייל שאינו ברשימה לא מוסיף את עצמו ל-allowlist",
    setList(dbOutsider, [RONEN_EMAIL, OUTSIDER_EMAIL])
  );
  await expectDenied(
    "וגם לא דורס את הרשימה כולה",
    setList(dbOutsider, [OUTSIDER_EMAIL])
  );
  await expectDenied("Storage — מי שאינו ברשימה לא מעלה", png(stOutsider, `orgs/${ORG}/fines/fP1/x.png`));
  await expectDenied("Storage — ולא קורא", getBytes(ref(stOutsider, `orgs/${ORG}/fines/fP1/s.png`)));
  // ⬅ storage.rules הוא קובץ **נפרד** עם מימוש נפרד של isOrgAdmin, ולכן הוא
  //   צריך את אותה בדיקה בזכות עצמו: מייל שברשימה אך אינו מאומת נדחה גם כאן.
  await expectDenied(
    "Storage — מייל ברשימה אך לא מאומת לא מעלה",
    png(stHildaUnv, `orgs/${ORG}/fines/fP1/u.png`)
  );
  await expectDenied(
    "Storage — ולא קורא",
    getBytes(ref(stHildaUnv, `orgs/${ORG}/fines/fP1/s.png`))
  );
  await expectAllowed(
    "Storage — מייל ברשימה ומאומת כן קורא",
    getBytes(ref(stHilda, `orgs/${ORG}/fines/fP1/s.png`))
  );

  // -- 3. מייל ברשימה אך **לא מאומת** — נדחה ------------------------------
  // הכתובת נכונה לחלוטין; רק הדגל כבוי. בלי התנאי הזה כל אחד היה נרשם
  // ב-Firebase Auth עם הכתובת של מנהלת הכספים ונכנס לצי.
  await expectDenied("מייל ברשימה אך לא מאומת — מסמך הארגון", getDoc(doc(dbHildaUnv, "orgs", ORG)));
  await expectDenied(
    "מייל ברשימה אך לא מאומת — vehiclesPrivate",
    getDoc(doc(dbHildaUnv, `orgs/${ORG}/vehiclesPrivate/vP1`))
  );
  await expectDenied(
    "מייל ברשימה אך לא מאומת — כתיבה",
    setDoc(doc(dbHildaUnv, `orgs/${ORG}/vehicles/vY`), { plate: "2" })
  );
  await expectDenied("משתמש בלי מייל בטוקן — נדחה", getDoc(doc(dbNoEmail, "orgs", ORG)));
  await expectDenied(
    "משתמש בלי מייל בטוקן לא כותב",
    setDoc(doc(dbNoEmail, `orgs/${ORG}/vehicles/vZ`), { plate: "3" })
  );

  // -- 4. נרמול lowercase --------------------------------------------------
  // הרשימה מוחזקת lowercase; הטוקן עשוי להגיע באותיות גדולות. בלי `.lower()`
  // בשני הצדדים, `Hildav@…` לא מתאים ל-`hildav@…` ואף אחד לא מבין למה.
  await expectAllowed("אותה כתובת באותיות גדולות בטוקן — עוברת", getDoc(doc(dbHildaUpper, "orgs", ORG)));
  await seedOrg([RONEN_EMAIL, HILDA_EMAIL.toUpperCase()]);
  await expectDenied(
    "כתובת שנשמרה ברשימה באותיות גדולות — לא מזוהה (ולכן הקליינט מנרמל בכתיבה)",
    getDoc(doc(dbHilda, "orgs", ORG))
  );

  // -- 5. הסרת מייל שוללת גישה **מיד** ------------------------------------
  await seedOrg([RONEN_EMAIL, HILDA_EMAIL]);
  await expectAllowed("לפני ההסרה — יש גישה", getDoc(doc(dbHilda, "orgs", ORG)));
  await expectAllowed("האדמין מסיר את המייל השני", setList(dbRonen, [RONEN_EMAIL]));
  await expectDenied("אחרי ההסרה — אין גישה למסמך הארגון", getDoc(doc(dbHilda, "orgs", ORG)));
  await expectDenied("ואין גישה לרכבים", getDocs(collection(dbHilda, `orgs/${ORG}/vehicles`)));
  await expectDenied(
    "ואין גישה ל-vehiclesPrivate",
    getDoc(doc(dbHilda, `orgs/${ORG}/vehiclesPrivate/vP1`))
  );
  await expectDenied("ומי שהוסר לא מחזיר את עצמו", setList(dbHilda, [RONEN_EMAIL, HILDA_EMAIL]));

  // -- 6. **האדמין האחרון אינו ניתן להסרה** -------------------------------
  // ארגון בלי אף אדמין אינו ניתן לשחזור מתוך האפליקציה — צריך גישת קונסולה
  // ל-Firestore. מערך (בשונה ממפה) כן ניתן לספירה ב-rules, ולכן זה נאכף כאן.
  await seedOrg([RONEN_EMAIL], {});
  await expectDenied("אדמין אחרון לא מרוקן את הרשימה", setList(dbRonen, []));
  await expectDenied(
    "וגם לא מוחק את השדה כולו",
    updateDoc(doc(dbRonen, "orgs", ORG), { "org.adminEmails": deleteField() })
  );
  await expectDenied(
    "ולא דרך setDoc(merge) עם מערך ריק",
    setDoc(doc(dbRonen, "orgs", ORG), { org: { adminEmails: [] } }, { merge: true })
  );
  await expectDenied("והרשימה חייבת להיות מערך", setList(dbRonen, "notalist"));
  await expectAllowed(
    "אבל להוסיף אדמין נוסף — מותר",
    setList(dbRonen, [RONEN_EMAIL, HILDA_EMAIL])
  );
  await expectAllowed(
    "ואז כן מותר להסיר את עצמו (נשאר אדמין אחד)",
    setList(dbRonen, [HILDA_EMAIL])
  );
  await expectDenied("ומי שהסיר את עצמו מאבד גישה מיד", getDoc(doc(dbRonen, "orgs", ORG)));
  {
    const org = await readOrg(dbHilda);
    expectEq("נשאר בדיוק אדמין אחד", (org?.org?.adminEmails || []).join(","), HILDA_EMAIL);
  }

  // -- 7. legacy: גשר ההגירה ----------------------------------------------
  // ⚠️ מסמך הארגון שכבר בענן (36 רכבים) **אינו מכיל adminEmails**. לו הכללים
  // דרשו מייל בלבד, ה-deploy היה נועל את המשתמש מחוץ לצי שלו — ואף אחד לא
  // היה יכול להוסיף את המייל הראשון, כי בשביל זה בדיוק צריך גישה.
  await seedOrg(undefined, { [LEGACY]: "admin" }); // בלי adminEmails בכלל
  await expectAllowed("legacy: org.members מעניק גישה כשאין adminEmails", getDoc(doc(dbLegacy, "orgs", ORG)));
  await expectAllowed(
    "legacy: וגם ל-vehiclesPrivate",
    getDoc(doc(dbLegacy, `orgs/${ORG}/vehiclesPrivate/vP1`))
  );
  // ⬅ הבדיקה שמונעת "האפליקציה הפסיקה לשמור": שמירה רגילה כשהרשימה **ריקה**
  //   חייבת לעבור, אחרת `size() >= 1` היה חוסם כל כתיבה בזמן ההגירה.
  await expectAllowed(
    "legacy: שמירת הגדרות עוברת גם כשהרשימה עוד לא קיימת",
    setDoc(doc(dbLegacy, "orgs", ORG), { settings: { contractAlertDays: 70 } }, { merge: true })
  );
  await expectAllowed("legacy: והאדמין מאכלס את הרשימה הראשונה", setList(dbLegacy, ["legacy@x.example"]));
  await expectDenied("legacy לא מעניק גישה למי שאינו במפה", getDoc(doc(dbOutsider, "orgs", ORG)));

  // ⬅ אכלוס ראשוני דרך **קוד הקליינט האמיתי**: writeOrgDiff עם selfEmail.
  await seedOrg(undefined, { [LEGACY]: "admin" });
  {
    const prev = emptyData();
    const next = emptyData();
    next.org = { id: ORG, name: "צי בדיקה P", members: { [LEGACY]: "admin" }, adminEmails: [] };
    next.settings = { ...next.settings, onboarded: true, contractAlertDays: 65 };
    await expectAllowed(
      "writeOrgDiff עם selfEmail מאכלס את הרשימה בשמירה הראשונה",
      writeOrgDiff(dbLegacy, ORG, prev, next, { selfUid: LEGACY, selfEmail: "Legacy@X.Example" })
    );
    const org = await readOrg(dbLegacy);
    expectEq("והכתובת נשמרה מנורמלת", (org?.org?.adminEmails || []).join(","), "legacy@x.example");
  }
  // ואחרי שהרשימה מאוכלסת — writeOrgDiff **לא** נוגע בה יותר, כדי שלא ידרוס
  // אדמין שנוסף במקביל ע"י מישהו אחר (מערך נדרס כשלמותו, לא ממוזג).
  {
    await expectAllowed("אדמין נוסף מתווסף במקביל", setList(dbLegacy, ["legacy@x.example", HILDA_EMAIL]));
    const prev = emptyData();
    const next = emptyData();
    next.org = { id: ORG, name: "צי בדיקה P", members: { [LEGACY]: "admin" }, adminEmails: ["legacy@x.example"] };
    next.settings = { ...next.settings, onboarded: true, contractAlertDays: 55 };
    await expectAllowed(
      "שמירה עם snapshot מיושן עוברת",
      writeOrgDiff(dbLegacy, ORG, prev, next, { selfUid: LEGACY, selfEmail: "legacy@x.example" })
    );
    const org = await readOrg(dbLegacy);
    expectEq(
      "ו**אינה** מוחקת את האדמין שנוסף במקביל",
      (org?.org?.adminEmails || []).slice().sort().join(","),
      [HILDA_EMAIL, "legacy@x.example"].sort().join(",")
    );
    expectEq("וההגדרה כן נשמרה", org?.settings?.contractAlertDays, 55);
  }

  // -- 8. memberships — מסמך תיעוד, ולא מקור סמכות ------------------------
  // הכלל הקודם היה `orgId == request.auth.uid`, כלומר אפשר היה להצהיר על
  // חברות **רק בארגון של עצמך**; זה גם חסם אדמין שני. עכשיו התנאי הוא
  // isOrgAdmin — כלומר אותה בדיקת allowlist. אף החלטת הרשאה אינה נשענת על
  // הרשומה, אבל היא עדיין לא ניתנת לזיוף.
  await seedOrg([RONEN_EMAIL, HILDA_EMAIL]);
  await expectDenied(
    "מי שאינו ברשימה לא מצהיר על חברות בארגון של אחר",
    setDoc(doc(dbOutsider, `memberships/${OUTSIDER}`), { uid: OUTSIDER, orgId: ORG, role: "admin" })
  );
  await expectDenied(
    "וגם לא על הארגון השני שבמסד",
    setDoc(doc(dbOutsider, `memberships/${OUTSIDER}`), { uid: OUTSIDER, orgId: "orgOther", role: "admin" })
  );
  await expectDenied(
    "מייל לא מאומת לא כותב רשומת חברות",
    setDoc(doc(dbHildaUnv, "memberships/hildaUnverifiedUid"), { orgId: ORG, role: "admin" })
  );
  await expectDenied(
    "אין כתיבה לרשומה של משתמש אחר",
    setDoc(doc(dbHilda, `memberships/${RONEN}`), { uid: RONEN, orgId: ORG, role: "admin" })
  );
  await expectDenied(
    "אין הצהרה על ארגון שאינו קיים",
    setDoc(doc(dbHilda, `memberships/${HILDA}`), { uid: HILDA, orgId: "noSuchOrg", role: "admin" })
  );
  await expectAllowed(
    "אדמין ב-allowlist כן כותב את הרשומה שלו",
    setDoc(doc(dbHilda, `memberships/${HILDA}`), { uid: HILDA, orgId: ORG, role: "admin" })
  );
  await expectAllowed("וקורא רק את שלו", getDoc(doc(dbHilda, `memberships/${HILDA}`)));
  await expectDenied("ולא של אחרים", getDoc(doc(dbHilda, `memberships/${RONEN}`)));

  // -- 9. קוד הגישה האמיתי, מקצה לקצה ------------------------------------
  // ⚠️ **זה המקטע שהיה תופס את באג 17.8.** כל הבדיקות שמעליו מפעילות כללים;
  // הבאג היה בקליינט (`orgId = user.uid`), ובדיקת כללים לבדה הייתה עוברת
  // בהצלחה בזמן שהאפליקציה שולחת את מנהלת הכספים למסך הקמה.
  await seedOrg([RONEN_EMAIL]);
  const hildaUser = { uid: HILDA, email: HILDA_EMAIL, emailVerified: true };
  const ronenUser = { uid: RONEN, email: RONEN_EMAIL, emailVerified: true };
  const cfg = { configuredOrgId: ORG };

  // 9א. **בדיוק המצב בפרודקשן**: היא מחוברת, אבל אינה ברשימה.
  const before = await resolveOrgAccess(dbHilda, hildaUser, cfg);
  expectEq("(הבאג) לא ברשימה ⇒ 'none' — מסך 'פנה למנהל', לא הקמה", before.status, "none");
  expectEq("(הבאג) ואין orgId להאזין לו", before.orgId, null);
  expectEq("(הבאג) וזו אינה שגיאה", before.error, null);
  expectTrue("(הבאג) ובשום מצב לא 'bootstrap'", before.status !== "bootstrap");

  // 9ב. האדמין המקורי מוסיף אותה — דרך הקוד האמיתי.
  const orgNow = await readOrg(dbRonen);
  const added = await addAdminEmail(dbRonen, { orgId: ORG, org: orgNow.org, email: "HildaVazana@Gmail.Example" });
  expectTrue("addAdminEmail הצליח", added.ok);
  {
    const org = await readOrg(dbRonen);
    expectEq(
      "והכתובת נשמרה מנורמלת ל-lowercase",
      (org?.org?.adminEmails || []).slice().sort().join(","),
      [HILDA_EMAIL, RONEN_EMAIL].sort().join(",")
    );
  }

  // 9ג. **הגזירה**: אותו orgId לשניהם, ולא ה-uid של אף אחד מהם.
  const member = await resolveOrgAccess(dbHilda, hildaUser, cfg);
  expectEq("אחרי ההוספה — status 'member'", member.status, "member");
  expectEq("וה-orgId הוא הארגון הקיים", member.orgId, ORG);
  expectTrue("וה-orgId **אינו** ה-uid שלה — זה בדיוק מה שהיה קשיח", member.orgId !== HILDA);
  const ronenAccess = await resolveOrgAccess(dbRonen, ronenUser, cfg);
  expectEq("והאדמין המקורי — ללא רגרסיה", ronenAccess.status, "member");
  expectEq("ועל אותו ארגון בדיוק", ronenAccess.orgId, ORG);

  // 9ד. ומכאן זרימת הנתונים הרגילה עובדת, כולל D1.
  {
    const ev = { missing: 0, data: [], errors: [] };
    const stop = await startOrgSync(dbHilda, member.orgId, {
      selfUid: HILDA,
      onMissing: () => ev.missing++,
      onData: (d) => ev.data.push(d),
      onError: (err, phase) => ev.errors.push({ code: err?.code || String(err), phase }),
    });
    const got = await waitFor(() => ev.data.length > 0, { timeoutMs: 8000 });
    expectTrue("האדמין השני מקבל את נתוני הצי", got);
    expectEq("בלי שגיאות", ev.errors.length, 0);
    expectEq("ובלי onMissing (הארגון קיים)", ev.missing, 0);
    const live = ev.data[ev.data.length - 1];
    expectEq("שם הארגון הנכון", live?.org?.name || null, "צי בדיקה P");
    expectTrue("הרכבים הגיעו", (live?.vehicles?.length || 0) >= 1);
    expectEq("וגם המסמך הפרטי (D1) — אדמין מלא", live?.vehiclesPrivate?.length, 1);
    expectEq("ושתי הכתובות ב-allowlist", (live?.org?.adminEmails || []).length, 2);
    stop();
  }

  // 9ה. הסרה דרך הקוד האמיתי, וההגנה על האחרון.
  {
    const org = (await readOrg(dbRonen)).org;
    const removed = await removeAdminEmail(dbRonen, { orgId: ORG, org, email: HILDA_EMAIL });
    expectTrue("removeAdminEmail הצליח", removed.ok);
    const afterRemove = await resolveOrgAccess(dbHilda, hildaUser, cfg);
    expectEq("ומי שהוסר חוזר ל-'none' מיד", afterRemove.status, "none");
    const org2 = (await readOrg(dbRonen)).org;
    const last = await removeAdminEmail(dbRonen, { orgId: ORG, org: org2, email: RONEN_EMAIL });
    expectEq("והאדמין האחרון נחסם גם בקוד האמיתי", last.ok, false);
    expectEq("עם הסיבה הנכונה", last.errorKey, "team.err.lastAdmin");
  }

  // 9ו. `bootstrap` — **המסלול היחיד** ל-onboarding: אין דגל build, ומזהה
  //     הארגון הוא ה-uid שלנו, כלומר התקנה חדשה שאין למי לפנות בה.
  {
    const fresh = { uid: "brandNewUid", email: "new@x.example", emailVerified: true };
    const dbFresh = testEnv.authenticatedContext(fresh.uid, { email: fresh.email, email_verified: true }).firestore();
    const boot = await resolveOrgAccess(dbFresh, fresh, { configuredOrgId: null });
    expectEq("בלי דגל build ובלי מסמך — 'bootstrap'", boot.status, "bootstrap");
    expectEq("וה-orgId הוא ה-uid שלו", boot.orgId, fresh.uid);
    // ⚠️ ועם דגל build שמצביע על ארגון של מישהו אחר — **לא** bootstrap.
    const notMine = await resolveOrgAccess(dbFresh, fresh, cfg);
    expectEq("עם דגל build לארגון של אחר — 'none' ולא 'bootstrap'", notMine.status, "none");
  }

  // 9ז. ארגון שבו orgId === uid ויש דגל build — נפתר כרגיל.
  const soloAccess = await resolveOrgAccess(dbSolo, { uid: SOLO, email: "solo@x.example", emailVerified: true }, {
    configuredOrgId: SOLO,
  });
  expectEq("orgId === uid עם דגל build — 'member'", soloAccess.status, "member");
  expectEq("ועל הארגון שלו", soloAccess.orgId, SOLO);
  // ואותו משתמש **אינו** אדמין בארגון האחר, גם אם יכוון אליו.
  const soloElsewhere = await resolveOrgAccess(dbSolo, { uid: SOLO, email: "solo@x.example", emailVerified: true }, {
    configuredOrgId: "orgOther",
  });
  expectEq("ואינו נכנס לארגון אחר בכוח הדגל", soloElsewhere.status, "none");
}


// ============================================================================
section("(ז) פורטל הנהג — הבידוד, הקישור, והדיווח (פרוסה 2)");
// ============================================================================
// למה המקטע הזה הוא הלב של הפרוסה, ולא "עוד בדיקות":
//
// לפרומול אין חשבונות Google ארגוניים. העובד נכנס מגימייל **פרטי**, שהחברה
// לא הנפיקה ולא יכולה לכבות. ביום שהוא עוזב אין קונסולה שמשביתה את החשבון,
// אין ניתוק סשן, ואין איפוס. ניסוח עדי (3.3): *"אינכם יכולים לכבות את
// החשבון. אתם יכולים רק לחסום אותו אצלכם."*
//
// ומכאן: **סעיפי ה-rules כאן אינם הגנת עומק — הם מנגנון הביטול היחיד שקיים.**
// בידוד שנאכף בקומפוננטה משאיר לעובד שעזב גישת קריאה מלאה עם סשן תקף. לכן
// כל תנאי נבדק כאן **בנפרד**, בהיפוך, ולא כחלק מתרחיש מוצלח: בדיקה שעוברת
// כי משהו אחר חסם אינה בדיקה, היא צירוף מקרים.
{
  const ORG = "orgDrv";
  const AD_MAIL = "fleet.admin@promall.example";

  // ========================================================================
  // ⚠️ **1.10.2026 — העוגן הוא הנייד.** לכל נהג מספר בצורת כתיבה **אחרת
  // בכוונה**: אם הכלל היה משווה מחרוזות, רק אחד מהם היה נכנס.
  //   DA — E.164, כפי שה-UI שומר מעכשיו;
  //   DB — צורה מקומית בלי מפרידים (כמו שהוקלד ביד);
  //   DC — מקפים, הצורה הנפוצה ביותר בהקלדה אנושית;
  //   DR — רווחים;
  //   DD — **קו נייח**, ולכן אינו עוגן זהות בכלל (עדי §2.2.4).
  // הטוקן, לעומת זה, חוזר **תמיד** ב-E.164 — זו ההגדרה של phone_number.
  // ========================================================================
  const DA = "drvA";   const UIDA = "uidDriverA"; const PH_A = "+972501110001"; const RAW_A = "+972501110001";
  const DB = "drvB";   const UIDB = "uidDriverB"; const PH_B = "+972501110002"; const RAW_B = "0501110002";
  const DC = "drvC";   const UIDC = "uidDriverC"; const PH_C = "+972540000017"; const RAW_C = "054-000-0017";
  const DR = "drvRev"; const UIDR = "uidDriverR"; const PH_R = "+972501110004"; const RAW_R = "050 111 0004";
  // קו נייח — הבקרה השלילית: שבע הספרות זהות לנייד של DC, ובכל זאת אינו
  // ניתן לקישור בשום טוקן.
  const DD = "drvDot"; const RAW_D = "03-0000017";
  // ⬅ מיילים נשארים ברשומות **כפרטי קשר**, כדי לוודא שהם לא מקנים גישה.
  const MAIL_A = "driver.a@promall.example";
  const MAIL_C = "hilda.v@gmail.com";

  const VA = "vehA";   const VB = "vehB";

  // --------------------------------------------------------------------
  // seed — VA הוחזק ע"י B ואז עבר ל-A. זה **בדיוק** תרחיש D2: הקנס והסריקה
  // של B נשארים קשורים אליו, בזמן שהרכב כבר אצל A.
  // --------------------------------------------------------------------
  const seed = () =>
    testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const put = (path, data) => setDoc(doc(db, path), { orgId: ORG, ...data });

      await setDoc(doc(db, `orgs/${ORG}`), {
        org: { id: ORG, name: "צי הנהגים", adminEmails: [AD_MAIL], members: {} },
        settings: { onboarded: true },
        schemaVersion: 2,
      });

      await put(`orgs/${ORG}/drivers/${DA}`, {
        id: DA, fullName: "נהג א", phone: RAW_A, email: MAIL_A, userId: UIDA, portalStatus: "active", status: "active",
      });
      await put(`orgs/${ORG}/drivers/${DB}`, {
        id: DB, fullName: "נהג ב", phone: RAW_B, userId: UIDB, portalStatus: "active", status: "active",
      });
      await put(`orgs/${ORG}/drivers/${DC}`, {
        id: DC, fullName: "נהג ג", phone: RAW_C, email: MAIL_C, userId: null, portalStatus: "none", status: "active",
      });
      await put(`orgs/${ORG}/drivers/${DR}`, {
        id: DR, fullName: "עזב", phone: RAW_R, userId: null, portalStatus: "revoked", status: "active",
      });
      await put(`orgs/${ORG}/drivers/${DD}`, {
        id: DD, fullName: "נייח", phone: RAW_D, userId: null, portalStatus: "none", status: "active",
      });

      await put(`orgs/${ORG}/vehicles/${VA}`, { id: VA, plate: "111-11-111", model: "דגם א", leaseCompanyId: "lc1" });
      await put(`orgs/${ORG}/vehicles/${VB}`, { id: VB, plate: "222-22-222", model: "דגם ב", leaseCompanyId: "lc1" });
      await put(`orgs/${ORG}/vehiclesPrivate/${VA}`, { id: VA, vehicleId: VA, monthlyCost: 3900 });
      await put(`orgs/${ORG}/leaseCompanies/lc1`, { id: "lc1", name: "ליסינג בדיקה", phone: "03-0000000" });

      // ההחזקות. asgOld — B החזיק את VA בעבר; asgA — A מחזיק אותו היום.
      await put(`orgs/${ORG}/assignments/asgOld`, {
        id: "asgOld", vehicleId: VA, driverId: DB, driverUid: null, fromDate: "2024-01-01", toDate: "2025-12-31",
      });
      await put(`orgs/${ORG}/assignments/asgA`, {
        id: "asgA", vehicleId: VA, driverId: DA, driverUid: null, fromDate: "2026-01-01", toDate: null,
      });
      await put(`orgs/${ORG}/assignments/asgB`, {
        id: "asgB", vehicleId: VB, driverId: DB, driverUid: UIDB, fromDate: "2026-01-01", toDate: null,
      });

      // ⚠️ הקנס והסריקה של **המחזיק הקודם**, על הרכב שכעת אצל A.
      await put(`orgs/${ORG}/fines/finOld`, {
        id: "finOld", vehicleId: VA, driverId: DB, driverUid: UIDB, amount: 750, violationDate: "2025-05-05",
      });
      await put(`orgs/${ORG}/fineScans/scnOld`, {
        id: "scnOld", fineId: "finOld", driverId: DB, driverUid: UIDB, fileName: "s.pdf",
      });
      // קנס של A — driverUid **null**, כמו כל מה שיובא מהאקסל לפני הקישור.
      await put(`orgs/${ORG}/fines/finA`, {
        id: "finA", vehicleId: VA, driverId: DA, driverUid: null, amount: 250, violationDate: "2026-03-01",
      });
      await put(`orgs/${ORG}/fineScans/scnA`, {
        id: "scnA", fineId: "finA", driverId: DA, driverUid: null, fileName: "a.pdf",
      });
      await put(`orgs/${ORG}/finesPrivate/finA`, { id: "finA", fineId: "finA", adminNotes: "נהג חוזר" });

      await put(`orgs/${ORG}/odometerReadings/odoA`, {
        id: "odoA", vehicleId: VA, driverId: DA, driverUid: null, date: "2026-02-01", km: 10000, source: "admin",
      });
      await put(`orgs/${ORG}/odometerReadings/odoB`, {
        id: "odoB", vehicleId: VB, driverId: DB, driverUid: UIDB, date: "2026-02-01", km: 20000, source: "admin",
      });

      await put(`orgs/${ORG}/incidents/incA`, { id: "incA", vehicleId: VA, driverId: DA, description: "שריטה" });
      await put(`orgs/${ORG}/incidentsPrivate/incA`, { id: "incA", incidentId: "incA", adminAssessment: "רשלנות" });
      await put(`orgs/${ORG}/documents/docA`, { id: "docA", vehicleId: VA, type: "insurance", title: "ביטוח" });
      await put(`orgs/${ORG}/serviceRecords/srvA`, { id: "srvA", vehicleId: VA, date: "2026-01-10", km: 9000 });

      // ההיטל — נגזר מהקוד האמיתי (utils/portal.js), לא משוכפל כאן ביד.
      const model = {
        org: { id: ORG },
        schemaVersion: 2,
        drivers: [
          { id: DA, orgId: ORG, status: "active" },
          { id: DB, orgId: ORG, status: "active" },
          { id: DC, orgId: ORG, status: "active" },
        ],
        assignments: [
          { id: "asgA", vehicleId: VA, driverId: DA, fromDate: "2026-01-01", toDate: null },
          { id: "asgB", vehicleId: VB, driverId: DB, fromDate: "2026-01-01", toDate: null },
        ],
        vehicles: [
          { id: VA, plate: "111-11-111", model: "דגם א", manufacturer: "יצרן", leaseCompanyId: "lc1", contractEnd: "2028-01-01" },
          { id: VB, plate: "222-22-222", model: "דגם ב", manufacturer: "יצרן", leaseCompanyId: "lc1", contractEnd: "2028-01-01" },
        ],
        leaseCompanies: [{ id: "lc1", name: "ליסינג בדיקה", phone: "03-0000000", email: "", contactName: "" }],
      };
      const portal = buildDriverPortal(model, "2026-06-01");
      expectEq("(ז0) ההיטל נבנה לשלושת הנהגים", portal.length, 3);
      for (const entry of portal) await setDoc(doc(db, `orgs/${ORG}/driverPortal/${entry.id}`), entry);

      // ⬅ הבדיקה שקושרת את הקוד לכללים: **אין monthlyCost בהיטל.** אם מישהו
      //   יוסיף שדה מסחרי ל-driverVehicleProjection, זה ייפול כאן ולא בפרודקשן.
      const forA = portal.find((x) => x.id === DA);
      expectEq("(ז0) ההיטל של A מצביע לרכב שלו", forA.vehicleId, VA);
      expectTrue("(ז0) ואין בו monthlyCost", !("monthlyCost" in forA));
      expectTrue("(ז0) ואין בו notes של האדמין", !("notes" in forA));
    });

  await seed();

  // ctxOf — זהות **אדמין**: מייל + email_verified. לא נגענו בזה.
  const ctxOf = (uid, email, verified = true) =>
    testEnv.authenticatedContext(uid, email ? { email, email_verified: verified } : {});

  // ========================================================================
  // ctxDrv — זהות **נהג**: טוקן עם `phone_number` בלבד.
  //
  // ⚠️ ואין כאן `phone_number_verified`, כי **אין דבר כזה**: ב-Firebase Auth
  // הקליים `phone_number` קיים בטוקן רק אחרי שקוד ה-SMS אומת בפועל. זה
  // ההבדל המבני מול המייל, ששם `email_verified` הוא תנאי שחייבים לזכור
  // לבדוק — ובלעדיו כל אחד נרשם עם הכתובת של כל אחד.
  // ========================================================================
  const ctxDrv = (uid, phone) =>
    testEnv.authenticatedContext(uid, phone ? { phone_number: phone } : {});

  const dbAdminD = ctxOf("fleetAdminUid", AD_MAIL).firestore();
  const dbA = ctxDrv(UIDA, PH_A).firestore();
  const dbB = ctxDrv(UIDB, PH_B).firestore();

  const P = (rest) => `orgs/${ORG}/${rest}`;
  const col = (db, name) => collection(db, `orgs/${ORG}/${name}`);

  // ======================================================================
  // ז.1 — אדמין: אפס רגרסיה. הפרוסה הזו נגעה בכל סעיף בקובץ.
  // ======================================================================
  await expectAllowed("ז.1 אדמין קורא את מסמך הארגון", getDoc(doc(dbAdminD, "orgs", ORG)));
  for (const c of [
    "vehicles", "vehiclesPrivate", "drivers", "assignments", "fines", "finesPrivate",
    "fineScans", "odometerReadings", "serviceRecords", "documents", "incidents",
    "incidentsPrivate", "leaseCompanies", "driverPortal",
  ]) {
    await expectAllowed(`ז.1 אדמין קורא ${c}`, getDocs(col(dbAdminD, c)));
  }
  await expectAllowed(
    "ז.1 אדמין כותב היטל",
    setDoc(doc(dbAdminD, P(`driverPortal/${DA}`)), { id: DA, driverId: DA, vehicleId: VA, orgId: ORG }, { merge: true })
  );
  await expectAllowed(
    "ז.1 אדמין כותב קריאת מד רגילה (source=admin)",
    setDoc(doc(dbAdminD, P("odometerReadings/odoAdmin")), {
      id: "odoAdmin", orgId: ORG, vehicleId: VA, driverId: DA, date: "2026-06-01", km: 12345, source: "admin",
    })
  );
  await expectAllowed("ז.1 ואדמין מוחק קריאה", deleteDoc(doc(dbAdminD, P("odometerReadings/odoAdmin"))));

  // ======================================================================
  // ז.2 — מה שנהג A **כן** רואה. הרשימה סגורה, וזהו כל הפורטל.
  // ======================================================================
  await expectAllowed("ז.2 A קורא את רשומת הנהג שלו", getDoc(doc(dbA, P(`drivers/${DA}`))));
  await expectAllowed(
    "ז.2 A מוצא את עצמו בשאילתה לפי uid",
    getDocs(query(col(dbA, "drivers"), where("userId", "==", UIDA)))
  );
  await expectAllowed("ז.2 A קורא את ההיטל שלו", getDoc(doc(dbA, P(`driverPortal/${DA}`))));
  await expectAllowed(
    "ז.2 A קורא את ההחזקות שלו",
    getDocs(query(col(dbA, "assignments"), where("driverId", "==", DA)))
  );
  await expectAllowed(
    "ז.2 A קורא את הקנסות שלו (driverUid ריק — נתוני ייבוא)",
    getDocs(query(col(dbA, "fines"), where("driverId", "==", DA)))
  );
  await expectAllowed("ז.2 A קורא את סריקת הקנס שלו", getDoc(doc(dbA, P("fineScans/scnA"))));
  await expectAllowed(
    "ז.2 A קורא את דיווחי הק״מ שלו",
    getDocs(query(col(dbA, "odometerReadings"), where("driverId", "==", DA)))
  );

  // ======================================================================
  // ז.3 — **החומה מול נהג אחר.** פר-אוסף, בקריאת מסמך ובשאילתה.
  // ======================================================================
  await expectDenied("ז.3 A לא קורא את רשומת הנהג של B", getDoc(doc(dbA, P(`drivers/${DB}`))));
  await expectDenied("ז.3 A לא קורא את ההיטל של B", getDoc(doc(dbA, P(`driverPortal/${DB}`))));
  await expectDenied("ז.3 A לא קורא את ההחזקה של B", getDoc(doc(dbA, P("assignments/asgB"))));
  await expectDenied("ז.3 A לא קורא את הקנס של B", getDoc(doc(dbA, P("fines/finOld"))));
  await expectDenied("ז.3 A לא קורא את דיווח הק״מ של B", getDoc(doc(dbA, P("odometerReadings/odoB"))));
  await expectDenied("ז.3 A לא קורא את הרכב של B", getDoc(doc(dbA, P(`vehicles/${VB}`))));
  // ⬅ ולא דרך שאילתה שמנסה לעקוף את מסמך-מסמך.
  await expectDenied("ז.3 ולא בשאילתה על כל הנהגים", getDocs(col(dbA, "drivers")));
  await expectDenied("ז.3 ולא בשאילתה על כל הקנסות", getDocs(col(dbA, "fines")));
  await expectDenied("ז.3 ולא בשאילתה על כל ההחזקות", getDocs(col(dbA, "assignments")));
  await expectDenied("ז.3 ולא בשאילתה על כל דיווחי הק״מ", getDocs(col(dbA, "odometerReadings")));
  await expectDenied(
    "ז.3 ולא בשאילתה ממוקדת על הנהג האחר",
    getDocs(query(col(dbA, "fines"), where("driverId", "==", DB)))
  );
  await expectDenied(
    "ז.3 ולא בשאילתה על רשומת הנהג של B לפי הנייד שלו",
    getDocs(query(col(dbA, "drivers"), where("phone", "==", RAW_B)))
  );
  // ⬅ וגם לא בצורה הקנונית של אותו מספר. שתי מחרוזות, אותו אדם, אותה דחייה.
  await expectDenied(
    "ז.3 ולא בצורה הקנונית של הנייד של B",
    getDocs(query(col(dbA, "drivers"), where("phone", "==", PH_B)))
  );
  // ⬅ **והמייל אינו מקנה שום גישה יותר.** הכתובת עדיין יושבת ברשומה כפרט
  //   קשר, ו-A מחזיק טוקן בלי מייל בכלל — ובכל זאת שאילתה לפי מייל נדחית.
  await expectDenied(
    "ז.3 ושאילתה לפי מייל אינה מקנה גישה (העוגן אינו מייל)",
    getDocs(query(col(dbA, "drivers"), where("email", "==", MAIL_A)))
  );

  // ======================================================================
  // ז.4 — **שלושת האוספים הפרטיים (D1), גם על הרכב שהוא מחזיק עכשיו.**
  // זו נקודת ה"חסום מוחלט": הרכב שלו, הקנס שלו, התקלה שלו — ובכל זאת לא.
  // ======================================================================
  await expectDenied("ז.4 A לא קורא vehiclesPrivate של הרכב **שלו**", getDoc(doc(dbA, P(`vehiclesPrivate/${VA}`))));
  await expectDenied("ז.4 A לא קורא finesPrivate של הקנס **שלו**", getDoc(doc(dbA, P("finesPrivate/finA"))));
  await expectDenied("ז.4 A לא קורא incidentsPrivate של התקלה **שלו**", getDoc(doc(dbA, P("incidentsPrivate/incA"))));
  await expectDenied("ז.4 ולא בשאילתה על vehiclesPrivate", getDocs(col(dbA, "vehiclesPrivate")));
  await expectDenied("ז.4 ולא בשאילתה על finesPrivate", getDocs(col(dbA, "finesPrivate")));
  await expectDenied("ז.4 ולא בשאילתה על incidentsPrivate", getDocs(col(dbA, "incidentsPrivate")));
  // ⬅ וגם מסמך הרכב עצמו סגור — הנהג קורא את ההיטל, לא את הרכב. אחרת כל
  //   שדה שיתווסף לרכב בעתיד היה מגיע אליו בשקט.
  await expectDenied("ז.4 A לא קורא את מסמך הרכב **שלו**", getDoc(doc(dbA, P(`vehicles/${VA}`))));
  await expectDenied("ז.4 A לא קורא את אוסף חברות הליסינג", getDocs(col(dbA, "leaseCompanies")));
  await expectDenied("ז.4 A לא קורא מסמכי רכב", getDoc(doc(dbA, P("documents/docA"))));
  await expectDenied("ז.4 A לא קורא טיפולים", getDoc(doc(dbA, P("serviceRecords/srvA"))));
  await expectDenied("ז.4 A לא קורא תקלות", getDoc(doc(dbA, P("incidents/incA"))));
  await expectDenied("ז.4 A לא קורא את מסמך הארגון", getDoc(doc(dbA, "orgs", ORG)));

  // ======================================================================
  // ז.5 — **הדליפה של D2.** A מחזיק את VA היום. הקנס והסריקה שייכים ל-B,
  // שהחזיק את אותו רכב עד סוף 2025. השיוך הוא לפי **הקנס**, לא לפי הרכב.
  // ======================================================================
  await expectDenied(
    "ז.5 A לא קורא סריקת קנס של המחזיק הקודם — למרות שהרכב שלו",
    getDoc(doc(dbA, P("fineScans/scnOld")))
  );
  await expectDenied(
    "ז.5 ולא את הקנס שממנו היא נגזרת",
    getDoc(doc(dbA, P("fines/finOld")))
  );
  await expectDenied(
    "ז.5 ולא בשאילתה על סריקות הרכב שלו",
    getDocs(query(col(dbA, "fineScans"), where("fineId", "==", "finOld")))
  );
  await expectDenied("ז.5 ולא בשאילתה על כל הסריקות", getDocs(col(dbA, "fineScans")));
  await expectAllowed("ז.5 ו-B כן קורא את הסריקה שלו", getDoc(doc(dbB, P("fineScans/scnOld"))));
  // ⬅ ואותה תשובה בדיוק מגיעה מהקוד הטהור, על אותם נתונים.
  {
    const model = {
      drivers: [
        { id: DA, userId: UIDA, portalStatus: "active", status: "active" },
        { id: DB, userId: UIDB, portalStatus: "active", status: "active" },
      ],
    };
    const scanOld = { id: "scnOld", fineId: "finOld", driverId: DB, driverUid: UIDB };
    expectTrue("ז.5 access.js מסכים: A לא קורא", !ownedByDriver(model, scanOld, UIDA));
    expectTrue("ז.5 access.js מסכים: B כן קורא", ownedByDriver(model, scanOld, UIDB));
  }

  // ======================================================================
  // ז.6 — **הכתיבה.** דיווח ק״מ לרכב שלו כן; כל השאר לא.
  // ======================================================================
  const reading = (over = {}) => ({
    id: "odoNew", orgId: ORG, createdAt: "2026-06-01", updatedAt: "2026-06-01", schemaVersion: 2,
    vehicleId: VA, driverId: DA, driverUid: UIDA, date: "2026-06-01", km: 12500, source: "driver",
    photoRef: null, photoName: "", photoStorageMode: "none", metadataStripped: false,
    retentionClass: "odometer", notes: "",
    ...over,
  });
  const write = (db, id, data) => setDoc(doc(db, P(`odometerReadings/${id}`)), data);

  await expectAllowed("ז.6 A כותב קריאה לרכב שלו", write(dbA, "odoNew", reading()));
  // ⬅ ואותה רשומה בדיוק עוברת גם ב-access.js — הקוד והכללים מסכימים.
  {
    const model = {
      drivers: [{ id: DA, userId: UIDA, portalStatus: "active", status: "active" }],
      driverPortal: [{ id: DA, driverId: DA, vehicleId: VA }],
    };
    expectTrue("ז.6 access.js מאשר את אותה רשומה", driverCanWriteReading(model, reading(), UIDA));
  }

  // -- **השיניים**: כל תנאי בהיפוך, בנפרד. ------------------------------
  // כל שורה כאן מחזירה **בדיוק תנאי אחד**, כדי שאם מישהו יסיר אותו מהכלל
  // הבדיקה תיפול — ולא תיוותר ירוקה כי תנאי אחר במקרה חסם.
  const teeth = [
    ["רכב שאינו שלו", { id: "t1", vehicleId: VB }],
    ["רכב לא קיים", { id: "t2", vehicleId: "vehX" }],
    ["בלי vehicleId", { id: "t3", vehicleId: "" }],
    ["driverId של נהג אחר", { id: "t4", driverId: DB }],
    ["driverUid של מישהו אחר", { id: "t5", driverUid: UIDB }],
    ["driverUid ריק", { id: "t6", driverUid: null }],
    ["source=admin (התחזות לרשומת אדמין)", { id: "t7", source: "admin" }],
    ["⚠️ עם צילום — D4", { id: "t8", photoRef: "orgs/x/p.jpg", photoStorageMode: "storage" }],
    ["⚠️ עם שם קובץ צילום", { id: "t9", photoName: "IMG_4471.jpg" }],
    ["⚠️ עם חותמת דיוק-שנייה ב-createdAt — D4.3", { id: "t10", createdAt: "2026-06-01T22:47:13.000Z" }],
    ["⚠️ עם חותמת דיוק-שנייה ב-updatedAt", { id: "t11", updatedAt: "2026-06-01T22:47:13.000Z" }],
    ["⚠️ עם שדה מיקום שאינו בסכימה", { id: "t12", latitude: 32.08 }],
    ["עם הערה חופשית", { id: "t13", notes: "עצרתי בתחנת דלק" }],
    ["ק״מ שלילי", { id: "t14", km: -5 }],
    ["ק״מ אפס", { id: "t15", km: 0 }],
    ["ק״מ כמחרוזת", { id: "t16", km: "12500" }],
    ["ק״מ מעל הגבול", { id: "t17", km: 5000000 }],
    ["תאריך בפורמט שגוי", { id: "t18", date: "1.6.2026", createdAt: "1.6.2026", updatedAt: "1.6.2026" }],
    ["retentionClass אחר", { id: "t19", retentionClass: "fine" }],
    ["orgId של ארגון אחר", { id: "t20", orgId: "orgA" }],
  ];
  for (const [label, over] of teeth) {
    await expectDenied(`ז.6 נדחה — ${label}`, write(dbA, over.id, reading(over)));
  }
  // מזהה המסמך חייב להתאים ל-id שבגוף — אחרת אפשר לדרוס רשומה קיימת.
  await expectDenied("ז.6 נדחה — id בגוף שונה ממזהה המסמך", write(dbA, "odoMismatch", reading({ id: "odoNew" })));
  await expectDenied(
    "ז.6 נדחה — דריסת דיווח קיים (אין update לנהג)",
    updateDoc(doc(dbA, P("odometerReadings/odoNew")), { km: 999999 })
  );
  await expectDenied("ז.6 נדחה — מחיקת דיווח", deleteDoc(doc(dbA, P("odometerReadings/odoNew"))));
  await expectDenied("ז.6 נדחה — כתיבת דיווח בשם נהג אחר", write(dbA, "odoForB", reading({ id: "odoForB", driverId: DB, driverUid: UIDB, vehicleId: VB })));
  await expectDenied(
    "ז.6 נדחה — כתיבה לרכב",
    setDoc(doc(dbA, P(`vehicles/${VA}`)), { plate: "hacked" }, { merge: true })
  );
  await expectDenied(
    "ז.6 נדחה — כתיבה להיטל של עצמו",
    setDoc(doc(dbA, P(`driverPortal/${DA}`)), { vehicleId: VB }, { merge: true })
  );
  await expectDenied(
    "ז.6 נדחה — כתיבת קנס",
    setDoc(doc(dbA, P("fines/finFake")), { id: "finFake", orgId: ORG, driverId: DA, amount: 0 })
  );
  await expectDenied(
    "ז.6 נדחה — סגירת ההחזקה של עצמו",
    updateDoc(doc(dbA, P("assignments/asgA")), { toDate: "2026-06-01" })
  );

  // ======================================================================
  // ז.7 — **הקישור.** האירוע החד-פעמי שבו נייד מאומת הופך ל-uid.
  // ======================================================================
  // ⚠️ 1.10.2026 — המקטע הזה היה כולו בצורת מייל. ההסבה אינה "החלפת שם
  // שדה": `email_verified` היה **תנאי** שהכלל חייב לבדוק, ואילו
  // `phone_number` קיים בטוקן רק אחרי אימות SMS — כלומר התנאי עבר מ"בדיקה
  // שאנחנו עושים" ל"תכונה של הספק". ובכל זאת `tokenPhone() != ''` נבדק כאן
  // מפורשות, כי כלל שמסתמך על הנחה שאינה כתובה נשבר בשקט ביום שהספק ישתנה.
  const linkWrite = (db, driverId, fields) => updateDoc(doc(db, P(`drivers/${driverId}`)), fields);

  // 7א. נייד תואם — ובצורת כתיבה **שונה** מזו שנשמרה: ברשומה יושב
  //     054-000-0017, והטוקן מגיע כ-+972540000017. אותו אדם, שתי מחרוזות,
  //     ובלי canonPhone הכניסה הייתה נכשלת בלי שאיש יבין למה.
  expectEq("ז.7 canonicalPhone מאחד את שתי הצורות", canonicalPhone(RAW_C), PH_C);
  const dbC = ctxDrv(UIDC, PH_C).firestore();
  // ⬅ הפורטל מחפש בכמה צורות כתיבה (phone.js:phoneQueryForms), וכל אחת מהן
  //   חייבת להיות **מותרת** — או להחזיר ריק. שתיהן תוצאה תקינה.
  await expectAllowed(
    "ז.7 רשומה לא מקושרת נמצאת בשאילתה לפי הצורה שנשמרה",
    getDocs(query(col(dbC, "drivers"), where("phone", "==", RAW_C)))
  );
  await expectAllowed(
    "ז.7 וגם שאילתה בצורה הקנונית אינה נדחית (מחזירה ריק)",
    getDocs(query(col(dbC, "drivers"), where("phone", "==", PH_C)))
  );

  // ======================================================================
  // ⚠️ **הבדיקה שמונעת את צורת הכשל הגרועה מכולן: אף נהג לא נקשר.**
  // ======================================================================
  // זה בדיוק מה שקרה במסלול המייל — הכללים היו תקינים, 328 בדיקות עברו,
  // ואפס נהגים נקשרו. הסיבה שם הייתה חברתית (אין גימייל ארגוני); כאן
  // הסיבה המקבילה תהיה **טכנית ושקטה**: שאילתת Firestore היא השוואת
  // מחרוזות מדויקת בלי נרמול, והמספר שבכרטיס הוקלד ביד. אם אף אחת מצורות
  // החיפוש אינה תואמת את מה ששמור — הפורטל פשוט לא מוצא את הרשומה,
  // ואף כלל לא נדחה, ואין שגיאה באף לוג.
  //
  // ולכן: **הצורות נלקחות מהקוד האמיתי** (phone.js:phoneQueryForms), כל
  // אחת מהן חייבת להיות מותרת (שאילתה שנדחית = באנר שגיאה לעובד), ולפחות
  // אחת מהן חייבת **באמת למצוא** את הרשומה.
  {
    const forms = phoneQueryForms(PH_C);
    expectTrue(`ז.7 יש צורות חיפוש (${forms.length})`, forms.length >= 4);
    let found = 0;
    for (const form of forms) {
      try {
        const snap = await getDocs(query(col(dbC, "drivers"), where("phone", "==", form)));
        if (!snap.empty) found++;
        pass++;
      } catch (err) {
        failed++;
        failures.push(`ז.7 צורת החיפוש ${form} נדחתה`);
        console.error("  FAIL (שאילתה נדחתה):", form, "·", err?.code || err);
      }
    }
    expectTrue(
      `ז.7 ולפחות צורה אחת מצאה את הרשומה שנשמרה כ-${RAW_C} (נמצאו ${found})`,
      found >= 1
    );
  }
  // ⬅ **והקישור עצמו נבנה מהקוד האמיתי** (driverLink.js:linkFields), ולא
  //   נכתב ביד. אחרת הבדיקה מאשרת את מה שכתבתי בבדיקה, ולא את מה שהאפליקציה
  //   שולחת — וזו בדיוק הדרך שבה `hasOnly` נשבר בשקט.
  const CLAIM_C = linkFields(UIDC, PH_C, "2026-10-01");
  expectEq("ז.7 linkFields שולח בדיוק את מה ש-hasOnly מתיר",
    Object.keys(CLAIM_C).sort().join(","), [...LINK_WRITABLE_KEYS].sort().join(","));
  await expectAllowed("ז.7 נייד תואם ⇒ הקישור מתבצע", linkWrite(dbC, DC, CLAIM_C));
  await expectAllowed("ז.7 ומכאן הוא קורא את ההיטל שלו", getDoc(doc(dbC, P(`driverPortal/${DC}`))));

  // 7ב. **השיניים של הקישור** — כל תנאי בנפרד, על רשומה נקייה בכל פעם.
  const resetDC = () =>
    testEnv.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), P(`drivers/${DC}`)), {
        id: DC, orgId: ORG, fullName: "נהג ג", phone: RAW_C, email: MAIL_C, userId: null,
        portalStatus: "none", status: "active",
      })
    );

  await resetDC();
  const PH_X = "+972509998888";
  const dbWrongPhone = ctxDrv("uidWrong", PH_X).firestore();
  await expectDenied(
    "ז.7 נדחה — נייד שאינו תואם",
    linkWrite(dbWrongPhone, DC, linkFields("uidWrong", PH_X, "x"))
  );
  await expectDenied(
    "ז.7 נדחה — וגם לא קורא את הרשומה",
    getDoc(doc(dbWrongPhone, P(`drivers/${DC}`)))
  );

  // ⬅ **טוקן בלי נייד בכלל** — זה בדיוק האדמין שנכנס ב-Google. בלי התנאי
  //   `tokenPhone() != ''` הוא היה מותאם לכל רשומה שאין בה טלפון.
  const dbNoPhone = ctxDrv("uidNoPhone", null).firestore();
  await expectDenied(
    "ז.7 נדחה — טוקן בלי נייד בכלל",
    linkWrite(dbNoPhone, DC, { userId: "uidNoPhone", portalStatus: "active", portalLinkedPhone: "", updatedAt: "x" })
  );
  await expectDenied("ז.7 ולא קורא את הרשומה", getDoc(doc(dbNoPhone, P(`drivers/${DC}`))));
  // ⬅ ואותו טוקן מול רשומה **בלי טלפון** — שני צדדים ריקים אינם "התאמה".
  await testEnv.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), P("drivers/drvNoPhone")), {
      id: "drvNoPhone", orgId: ORG, fullName: "בלי נייד", phone: "", userId: null,
      portalStatus: "none", status: "active",
    })
  );
  await expectDenied(
    "ז.7 נדחה — טוקן בלי נייד מול רשומה בלי נייד (שני ריקים ≠ התאמה)",
    linkWrite(dbNoPhone, "drvNoPhone", { userId: "uidNoPhone", portalStatus: "active", portalLinkedPhone: "", updatedAt: "x" })
  );
  await expectDenied(
    "ז.7 ורשומה בלי נייד אינה נקראת גם ע\"י מי שיש לו נייד",
    getDoc(doc(dbC, P("drivers/drvNoPhone")))
  );

  // ⬅ **הבקרה השלילית של הקו הנייח** (עדי §2.2.4). שבע הספרות של DD זהות
  //   לנייד של DC: `03-0000017` מול `054-000-0017`. בלי החסימה הזו,
  //   התנגשות בנתונים הייתה הופכת לגישה לרשומה של עובד אחר.
  const dbLandline = ctxDrv("uidLand", "+972000001700").firestore();
  await expectDenied(
    "ז.7 נדחה — קו נייח אינו עוגן זהות, גם בטוקן שנראה דומה",
    linkWrite(dbLandline, DD, { userId: "uidLand", portalStatus: "active", portalLinkedPhone: "+972000001700", updatedAt: "x" })
  );
  await expectDenied(
    "ז.7 ומי שיש לו את אותן שבע ספרות כנייד אינו תובע את רשומת הנייח",
    linkWrite(dbC, DD, linkFields(UIDC, PH_C, "x"))
  );
  await expectDenied("ז.7 וגם אינו קורא אותה", getDoc(doc(dbC, P(`drivers/${DD}`))));
  expectEq("ז.7 וגם canonicalPhone בקוד דוחה קו נייח", canonicalPhone(RAW_D), "");

  // רשומה **שכבר מקושרת** אינה ניתנת לתפיסה, גם ע"י מי שהמספר שלו תואם.
  await testEnv.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), P(`drivers/${DC}`)), {
      id: DC, orgId: ORG, fullName: "נהג ג", phone: RAW_C, userId: "someoneElseUid",
      portalStatus: "active", status: "active",
    })
  );
  await expectDenied(
    "ז.7 נדחה — הרשומה כבר מקושרת למישהו אחר",
    linkWrite(dbC, DC, linkFields(UIDC, PH_C, "x"))
  );
  await expectDenied("ז.7 וגם לא קורא אותה", getDoc(doc(dbC, P(`drivers/${DC}`))));

  // 7ג. **שינוי שדה נוסף באותה כתיבה** — הסעיף שמונע מהעובד לערוך את עצמו.
  await resetDC();
  for (const [label, extra] of [
    ["שם", { fullName: "שם אחר" }],
    ["מחלקה", { department: "הנהלה" }],
    ["מספר עובד", { employeeNumber: "999" }],
    ["הערות", { notes: "מגיע לי רכב אחר" }],
    ["רשומת היידוע (D8)", { notice: { policyVersion: "9.9", deliveredAt: "2026-01-01" } }],
    ["סטטוס העובד", { status: "inactive" }],
    ["הנייד עצמו", { phone: "+972509998888" }],
    // ⬅ **השדה שהוסר מ-hasOnly ב-1.10.2026.** בלי הדחייה הזו, נהג היה כותב
    //   לעצמו כתובת מייל שרירותית ברשומה שלו, ואף אחד לא היה בודק אותה.
    ["כתובת המייל (אינה ב-hasOnly יותר)", { portalLinkedEmail: "whatever@gmail.com" }],
  ]) {
    await expectDenied(
      `ז.7 נדחה — הקישור נוגע גם ב${label}`,
      linkWrite(dbC, DC, { ...linkFields(UIDC, PH_C, "x"), ...extra })
    );
  }
  await expectDenied(
    "ז.7 נדחה — portalStatus שאינו active",
    linkWrite(dbC, DC, { ...linkFields(UIDC, PH_C, "x"), portalStatus: "invited" })
  );
  await expectDenied(
    "ז.7 נדחה — קישור ל-uid של מישהו אחר",
    linkWrite(dbC, DC, { ...linkFields(UIDC, PH_C, "x"), userId: UIDB })
  );
  await expectDenied(
    "ז.7 נדחה — portalLinkedPhone שאינו המספר שבטוקן",
    linkWrite(dbC, DC, { ...linkFields(UIDC, PH_C, "x"), portalLinkedPhone: "+972509998888" })
  );
  // ⬅ וגם לא "המספר הנכון בצורה הלא-קנונית": הכלל אוכף E.164, אחרת השדה
  //   התיעודי הזה היה הופך למחרוזת חופשית שאי אפשר להשוות לכלום.
  await expectDenied(
    "ז.7 נדחה — portalLinkedPhone בצורה מקומית ולא E.164",
    linkWrite(dbC, DC, { ...linkFields(UIDC, PH_C, "x"), portalLinkedPhone: RAW_C })
  );
  await expectDenied(
    "ז.7 נדחה — portalLinkedPhone ריק",
    linkWrite(dbC, DC, { ...linkFields(UIDC, PH_C, "x"), portalLinkedPhone: "" })
  );
  await expectDenied(
    "ז.7 נדחה — נהג מקושר משנה את רשומת נהג אחר",
    linkWrite(dbA, DC, linkFields(UIDA, PH_A, "x"))
  );

  // 7ד. **'revoked' אינו ניתן לתביעה מחדש.** זה מה שהופך את כפתור הניתוק
  //     לאפקטיבי: בלעדיו עובד שעזב היה מקשר את עצמו בחזרה בלחיצה אחת.
  const dbLeft = ctxDrv(UIDR, PH_R).firestore();
  expectEq("ז.7 והמספר שלו שמור עם רווחים — אותו אדם", canonicalPhone(RAW_R), PH_R);
  await expectDenied(
    "ז.7 נדחה — רשומה שנותקה ('revoked') אינה ניתנת לקישור מחדש",
    linkWrite(dbLeft, DR, linkFields(UIDR, PH_R, "x"))
  );
  await expectDenied("ז.7 ומי שנותק גם לא קורא את הרשומה שלו", getDoc(doc(dbLeft, P(`drivers/${DR}`))));
  // ורק אחרי שהאדמין מזמין מחדש ('invited') — הקישור אפשרי שוב.
  await expectAllowed(
    "ז.7 אדמין מחזיר גישה: portalStatus='invited'",
    updateDoc(doc(dbAdminD, P(`drivers/${DR}`)), { portalStatus: "invited" })
  );
  await expectAllowed(
    "ז.7 ואז הקישור מתבצע",
    linkWrite(dbLeft, DR, linkFields(UIDR, PH_R, "x"))
  );

  // ======================================================================
  // 7ו. ⚠️ **מצב-הביניים שריצת המוטציות חשפה.**
  // ======================================================================
  // שתי מוטציות **שרדו את כל החבילה** בריצה הראשונה:
  //   • הוצאת `userId == null` מ-`isSelfLinkClaim`  (תביעת רשומה מקושרת);
  //   • הוצאת אותו תנאי מסעיף ה-read של `drivers`  (קריאת רשומה מקושרת).
  //
  // הסיבה היא בדיוק הלקח של ז.8ב: בבדיקה שהייתה כאן, הרשומה המקושרת היא
  // גם `portalStatus: 'active'` — ולכן התנאי `in ['none','invited']` חסם
  // ממילא, ו-`userId == null` **מעולם לא נבחן לבדו**. בדיקה שעוברת כי
  // משהו אחר חסם אינה בדיקה.
  //
  // והמצב הזה אמיתי לגמרי, לא מלאכתי: `userId` ו-`portalStatus` נכתבים
  // באותה כתיבה, אבל רשומה יכולה להגיע למצב שבו uid נצרב וה-status לא —
  // uid שהוזן ידנית בקונסולת Firestore, ייבוא, או שארית ממירוץ. ואם זה
  // קורה, **המספר התואם לבדו** היה מספיק כדי לתבוע ולקרוא רשומה של עובד
  // אחר: שם, טלפון, מחלקה, מספר עובד, הערות ורשומת היידוע.
  await testEnv.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), P(`drivers/${DC}`)), {
      id: DC, orgId: ORG, fullName: "נהג ג", phone: RAW_C, userId: "someoneElseUid",
      portalStatus: "none", status: "active",
    })
  );
  await expectDenied(
    "ז.7ו נדחה — רשומה שכבר נתפסה, גם כשה-portalStatus נשאר 'none'",
    linkWrite(dbC, DC, linkFields(UIDC, PH_C, "x"))
  );
  await expectDenied(
    "ז.7ו וגם אינה נקראת — userId != null לבדו חוסם",
    getDoc(doc(dbC, P(`drivers/${DC}`)))
  );
  // ⬅ ואותו דבר ב-'invited': זה המצב שאדמין מייצר בלחיצה על "אפשר קישור
  //   מחדש", והוא לא אמור לפתוח רשומה שמישהו אחר כבר מחזיק.
  await testEnv.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), P(`drivers/${DC}`)), {
      id: DC, orgId: ORG, fullName: "נהג ג", phone: RAW_C, userId: "someoneElseUid",
      portalStatus: "invited", status: "active",
    })
  );
  await expectDenied(
    "ז.7ו נדחה — אותו מצב גם ב-'invited'",
    linkWrite(dbC, DC, linkFields(UIDC, PH_C, "x"))
  );
  await expectDenied(
    "ז.7ו ואינה נקראת גם ב-'invited'",
    getDoc(doc(dbC, P(`drivers/${DC}`)))
  );

  // 7ה. נהג בארכיון — לא מקשר, ולא קורא.
  await testEnv.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), P(`drivers/${DD}`)), {
      id: DD, orgId: ORG, fullName: "בארכיון", phone: "0501110009", userId: null,
      portalStatus: "invited", status: "archived",
    })
  );
  const dbArch = ctxDrv("uidArch", "+972501110009").firestore();
  await expectDenied(
    "ז.7 נדחה — נהג בארכיון אינו מקשר חשבון",
    linkWrite(dbArch, DD, linkFields("uidArch", "+972501110009", "x"))
  );
  await expectDenied("ז.7 וגם אינו קורא את הרשומה", getDoc(doc(dbArch, P(`drivers/${DD}`))));

  // ======================================================================
  // ז.8 — **הניתוק.** יום העזיבה, בסדר שעדי הגדירה (3.3): קודם כל ה-rules.
  // ======================================================================
  await expectAllowed("ז.8 לפני הניתוק — A קורא את ההיטל שלו", getDoc(doc(dbA, P(`driverPortal/${DA}`))));
  // ⬅ הניתוק נבנה מ-`unlinkFields` האמיתי, ולא ביד: אם מישהו יסיר ממנו את
  //   איפוס `portalLinkedPhone`, הבדיקה למטה תתפוס עקבת זהות שנשארה.
  const UNLINK = unlinkFields("2026-10-01");
  expectEq("ז.8 unlinkFields מאפס את עקבת הזהות", UNLINK.portalLinkedPhone, null);
  await expectAllowed(
    "ז.8 האדמין מנתק",
    updateDoc(doc(dbAdminD, P(`drivers/${DA}`)), UNLINK)
  );
  // ⬅ **הבדיקה שמצדיקה את כל המקטע.** לא נגענו באף מסמך קנס, החזקה או דיווח —
  //   ובכל זאת אף אחד מהם אינו קריא יותר. זו הסיבה שהבידוד חייב לשבת ב-rules:
  //   בלקוח, עובד עם סשן Google תקף היה ממשיך לקרוא את כולם.
  await expectDenied("ז.8 אחרי הניתוק — ההיטל", getDoc(doc(dbA, P(`driverPortal/${DA}`))));
  await expectDenied("ז.8 אחרי הניתוק — הקנס שלו", getDoc(doc(dbA, P("fines/finA"))));
  await expectDenied("ז.8 אחרי הניתוק — סריקת הקנס שלו", getDoc(doc(dbA, P("fineScans/scnA"))));
  await expectDenied("ז.8 אחרי הניתוק — ההחזקה שלו", getDoc(doc(dbA, P("assignments/asgA"))));
  await expectDenied("ז.8 אחרי הניתוק — דיווח הק״מ שלו", getDoc(doc(dbA, P("odometerReadings/odoA"))));
  await expectDenied("ז.8 אחרי הניתוק — רשומת הנהג שלו", getDoc(doc(dbA, P(`drivers/${DA}`))));
  await expectDenied("ז.8 אחרי הניתוק — אין דיווח חדש", write(dbA, "odoAfter", reading({ id: "odoAfter" })));
  // ⬅ ולא ניתן לתבוע את הרשומה מחדש עם אותו מייל.
  await expectDenied(
    "ז.8 ומי שנותק לא מקשר את עצמו בחזרה",
    linkWrite(dbA, DA, linkFields(UIDA, PH_A, "x"))
  );
  // B, שלא נגעו בו, ממשיך לעבוד — הניתוק ממוקד ולא כללי.
  await expectAllowed("ז.8 ו-B אינו מושפע", getDoc(doc(dbB, P(`driverPortal/${DB}`))));

  // ======================================================================
  // ז.8ב — **שני מצבי-ביניים שהניתוק המלא מסתיר.**
  //
  // ⚠️ שתי הבדיקות האלה נוספו אחרי ריצת מוטציות: הוצאת `portalStatus=='active'`
  // ו-`status!='archived'` מ-`isMyDriverId` **שרדה את כל החבילה**. הסיבה היא
  // שבתרחיש הניתוק המלא (ז.8) גם `userId` מתאפס, ולכן התנאי הראשון חסם ממילא
  // ושני התנאים האחרים מעולם לא נבחנו לבדם. בדיקה שעוברת כי משהו אחר חסם
  // אינה בדיקה.
  //
  // שני המצבים אמיתיים לגמרי:
  //   • **השעיה זמנית** — האדמין מכבה גישה בלי לנתק (portalStatus='disabled').
  //   • **ארכוב** — העובד סומן כעזב, אבל הקישור נשאר. זו בדיוק התקלה
  //     ש-3.3.7 בהכוונת עדי מזהיר מפניה: "נהגים בארכיון עם גישת פורטל פעילה".
  // ======================================================================
  {
    const DS = "drvSusp";
    const UIDS = "uidSusp";
    const DZ = "drvArch2";
    const UIDZ = "uidArch2";
    const mk = (id, over) =>
      testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, P(`drivers/${id}`)), {
          id, orgId: ORG, fullName: "ביניים", phone: `+97250111${id === "drvSusp" ? "0011" : "0012"}`,
          portalStatus: "active", status: "active", ...over,
        });
        await setDoc(doc(db, P(`driverPortal/${id}`)), {
          id, driverId: id, orgId: ORG, vehicleId: VB, plate: "222-22-222",
        });
        await setDoc(doc(db, P(`fines/fin_${id}`)), {
          id: `fin_${id}`, orgId: ORG, vehicleId: VB, driverId: id, driverUid: null, amount: 100,
        });
      });

    // (1) קישור פעיל, אבל הגישה **מושהית**.
    await mk(DS, { userId: UIDS, portalStatus: "disabled" });
    const dbSusp = ctxDrv(UIDS, "+972501110011").firestore();
    await expectDenied("ז.8ב portalStatus='disabled' — אין היטל", getDoc(doc(dbSusp, P(`driverPortal/${DS}`))));
    await expectDenied("ז.8ב ואין קנסות", getDoc(doc(dbSusp, P(`fines/fin_${DS}`))));
    await expectDenied(
      "ז.8ב ואין דיווח ק״מ",
      setDoc(doc(dbSusp, P("odometerReadings/odoSusp")), {
        id: "odoSusp", orgId: ORG, createdAt: "2026-06-01", updatedAt: "2026-06-01", schemaVersion: 2,
        vehicleId: VB, driverId: DS, driverUid: UIDS, date: "2026-06-01", km: 100, source: "driver",
        photoRef: null, photoName: "", photoStorageMode: "none", metadataStripped: false,
        retentionClass: "odometer", notes: "",
      })
    );
    // ⬅ והשוואה: אותה רשומה בדיוק, עם portalStatus='active' — כן עוברת.
    //   בלי הצמד הזה אי אפשר לדעת אם הדחייה נבעה מהתנאי הנכון.
    await mk(DS, { userId: UIDS, portalStatus: "active" });
    await expectAllowed("ז.8ב ובאותה רשומה עם 'active' — כן", getDoc(doc(dbSusp, P(`driverPortal/${DS}`))));

    // (2) קישור פעיל, אבל העובד **בארכיון** (3.3.7).
    await mk(DZ, { userId: UIDZ, portalStatus: "active", status: "archived" });
    const dbArch2 = ctxDrv(UIDZ, "+972501110012").firestore();
    await expectDenied("ז.8ב עובד בארכיון עם קישור פעיל — אין היטל", getDoc(doc(dbArch2, P(`driverPortal/${DZ}`))));
    await expectDenied("ז.8ב ואין קנסות", getDoc(doc(dbArch2, P(`fines/fin_${DZ}`))));
    await mk(DZ, { userId: UIDZ, portalStatus: "active", status: "active" });
    await expectAllowed("ז.8ב ובאותה רשומה כשאינו בארכיון — כן", getDoc(doc(dbArch2, P(`driverPortal/${DZ}`))));

    // ⬅ ו-access.js מגיע לאותן שתי התשובות, על אותם נתונים.
    const model = (over) => ({ drivers: [{ id: DS, userId: UIDS, portalStatus: "active", status: "active", ...over }] });
    expectTrue("ז.8ב access.js מסכים: 'disabled' חסום", !driverForUidRef(model({ portalStatus: "disabled" }), UIDS));
    expectTrue("ז.8ב access.js מסכים: 'archived' חסום", !driverForUidRef(model({ status: "archived" }), UIDS));
    expectTrue("ז.8ב ו'active' מותר", Boolean(driverForUidRef(model({}), UIDS)));
  }

  // ======================================================================
  // ז.9 — access.js ו-firestore.rules מדברים על אותה רשימה.
  // ======================================================================
  expectEq(
    "ז.9 רשימת האוספים הקריאים לנהג היא בדיוק זו שנבדקה למעלה",
    [...DRIVER_READABLE_COLLECTIONS].sort().join(","),
    ["assignments", "driverPortal", "drivers", "fineScans", "fines", "odometerReadings"].sort().join(",")
  );
  for (const c of ["vehicles", "vehiclesPrivate", "finesPrivate", "incidentsPrivate", "leaseCompanies"]) {
    expectTrue(`ז.9 ${c} אינו ברשימה הקריאה לנהג`, !DRIVER_READABLE_COLLECTIONS.includes(c));
  }

  // -- אנונימיזציה של המקטע, כדי שהבא אחריו יתחיל נקי --------------------
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const c of ["drivers", "vehicles", "assignments", "fines", "fineScans", "odometerReadings", "driverPortal"]) {
      const snap = await getDocs(collection(db, `orgs/${ORG}/${c}`));
      for (const d of snap.docs) await deleteDoc(d.ref);
    }
  });
}


// ============================================================================
section("(ח) canonPhone ב-rules מול canonicalPhone בקוד — אותו קלט, שני הצדדים");
// ============================================================================
// למה המקטע הזה קיים, ולמה הוא לא "עוד בדיקות נרמול":
//
// `canonEmail` ב-firestore.rules ו-`canonicalEmail` ב-admins.js הן שתי
// מימושות של אותו כלל, בשתי שפות, בשני קבצים. ההערה שם מזהירה מזה במפורש:
// *"כל שינוי כאן = שינוי שם"*. מהרגע שעוגן הזהות של הנהג הוא נייד, **אותה
// מלכודת חוזרת** — והפעם היא מסוכנת יותר, כי מספר נכתב בחמש צורות שונות
// ולא בשתיים.
//
// ניסוח עדי (§5.2): *"כל סטייה ביניהן = הרשאה שלא עובדת או הרשאת יתר. ולכן
// צריכות להיות בדיקות אמולטור שמריצות את אותו מערך קלט בשני הצדדים."*
//
// וזה מה שקורה כאן, ולא קריאה בעיניים:
//   • עבור כל קלט, `canonicalPhone` (JS) מחשב את הצורה הקנונית;
//   • נזרעת רשומת נהג שהטלפון בה הוא **הקלט הגולמי**;
//   • והאמולטור מכריע: טוקן עם הצורה הקנונית — האם הוא מצליח לקשר?
//   • אם ה-JS אמר "זהו המספר" והכלל דחה → **הרשאה שלא עובדת**: נהג שלא ייכנס.
//   • אם ה-JS אמר "זה לא נייד" והכלל אישר → **הרשאת יתר**: קו נייח, לוחית
//     רישוי או מספר פגום שהופכים למפתח של רשומת עובד.
// ============================================================================
{
  const ORG = "orgParity";
  const AD = "parity.admin@promall.example";

  // ⚠️ **מערך הקלט המשותף.** הוא כתוב פעם אחת, ומורץ בשני הצדדים. כל שורה
  // כאן היא צורה שראינו או שסביר לראות בכרטיס נהג שהוקלד ביד או הודבק
  // מאקסל. השדה השני הוא מה ש-JS מחזיר — **לא** מה שאנחנו מקווים שהכלל
  // יחזיר; אם הם נפרדים, הבדיקה נופלת ולא "מסתדרת".
  const PHONE_PARITY = [
    "0540000017",        // צורה מקומית, בלי מפרידים
    "054-000-0017",      // מקפים — הצורה האנושית הנפוצה
    "054-0000017",       // מקף אחד
    "054 000 0017",      // רווחים
    "+972540000017",     // E.164 — מה שה-UI שומר מעכשיו
    "+972-54-000-0017",  // E.164 עם מפרידים
    "972540000017",      // בלי '+'
    "00972540000017",    // קידומת יציאה
    "(054) 000-0017",    // סוגריים
    "'0540000017",       // ⬅ **גרש מוביל מאקסל** — מלכודת ייבוא אמיתית
    " 0540000017 ",      // רווחים בקצוות
    "0501110007",        // נייד אחר, כבקרה חיובית נוספת
    "03-0000017",        // ⬅ **קו נייח** — אותן שבע ספרות, ואינו עוגן זהות
    "02-6295555",        // קו נייח אחר
    // ⚠️ **שתי השורות הבאות נוספו אחרי ריצת מוטציות.** בלעדיהן שרדו שתי
    // מוטציות: אחת שהחליפה את בדיקת הקידומת ב-'^0[0-9]{9}$', והשנייה
    // ב-'^972[0-9]{9}$'. הסיבה שלא נתפסו היא **חור במערך הקלט**, לא בכלל:
    // קו נייח ישראלי הוא **9 ספרות** (0X + 7), ולכן אף שורה כאן לא בחנה
    // מספר בן **10 ספרות שאינו נייד**. 07X הוא בדיוק זה — ובלעדיו "כל
    // קידומת בת 10 ספרות" נראתה שקולה ל-05X.
    "073-7222333",       // ⬅ 10 ספרות, ואינו נייד (קו 07X)
    "+972737222333",     // ⬅ ואותו מספר בצורה בינלאומית
    "0000017",           // ⬅ שבע ספרות לבדן — לעולם לא
    "054000001",         // ספרה חסרה
    "05400000177",       // ספרה עודפת
    "+9720540000017",    // ⬅ קידומת כפולה — מספר פגום, לא "כמעט נכון"
    "12345678",          // ⬅ לוחית רישוי מהצי
    "30092026",          // תאריך בלי מפרידים
    "+447911123456",     // מספר זר (ה-region policy נעולה לישראל ממילא)
    "",                  // ריק
  ];

  // uid/doc ייחודיים לכל שורה — אחרת הקישור הראשון היה "מלכלך" את הבא.
  const rows = PHONE_PARITY.map((input, i) => {
    const expected = canonicalPhone(input);
    const digits = String(input).replace(/[^0-9]/g, "");
    // ========================================================================
    // לשורות הפסולות: **לא טוקן אחד, אלא כל הטוקנים ה"סבירים"** שנגזרים מאותן
    // ספרות — ושכולם חייבים להידחות.
    //
    // ⚠️ זו אינה קפדנות יתר, זה ממצא מריצת מוטציות: עם טוקן בודד
    // (`+972` + תשע הספרות האחרונות), מוטציה שהחליפה את בדיקת האורך
    // ב-`{7,9}` **שרדה את כל החבילה**. הסיבה: 05400000177 הפך תחת המוטציה
    // ל-+972540000017, והטוקן הבודד שבדקנו היה +972400000177 — כלומר הכלל
    // דחה, אבל **לא בגלל התנאי שנשבר.** בדיקה שעוברת כי משהו אחר חסם אינה
    // בדיקה; זה בדיוק הלקח של ז.8ב.
    // ========================================================================
    const tokens = expected
      ? [expected]
      : [...new Set([
          `+972${digits.slice(-9) || "000000000"}`, // תשע אחרונות
          `+972${digits.slice(1, 10) || "000000000"}`, // מה שהתעלמות מה-0 הייתה מייצרת
          `+972${digits.slice(0, 9) || "000000000"}`, // מה שחיתוך מהתחלה היה מייצר
          `+${digits || "000000000"}`, // הספרות כפי שהן
        ])];
    return { id: `pd${i}`, uid: `puid${i}`, input, expected, tokens };
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `orgs/${ORG}`), {
      org: { id: ORG, name: "תאום נרמול", adminEmails: [AD], members: {} },
      settings: { onboarded: true },
      schemaVersion: 2,
    });
    for (const r of rows) {
      await setDoc(doc(db, `orgs/${ORG}/drivers/${r.id}`), {
        id: r.id, orgId: ORG, fullName: "תאום", phone: r.input,
        userId: null, portalStatus: "none", status: "active",
      });
      // היטל, כדי שההצלחה תהיה מלאה ולא "כתיבה שעברה אבל אין מה לקרוא".
      await setDoc(doc(db, `orgs/${ORG}/driverPortal/${r.id}`), {
        id: r.id, driverId: r.id, orgId: ORG, vehicleId: "pv1", plate: "11-111-11",
      });
    }
  });

  let valid = 0;
  let invalid = 0;
  for (const r of rows) {
    const label = `ח ${JSON.stringify(r.input)} → ${r.expected || "''"}`;
    if (r.expected) {
      valid++;
      const db = testEnv.authenticatedContext(r.uid, { phone_number: r.expected }).firestore();
      const ref = doc(db, `orgs/${ORG}/drivers/${r.id}`);
      // שני הצדדים מסכימים שזה מספר: הכלל **חייב** לאשר, אחרת זהו נהג
      // שמקליד את המספר הנכון ולא נכנס.
      await expectAllowed(`${label} · הכלל מאשר קישור`, updateDoc(ref, {
        userId: r.uid, portalStatus: "active", portalLinkedPhone: r.expected, updatedAt: "2026-10-01",
      }));
      await expectAllowed(`${label} · ואז קורא את ההיטל`, getDoc(doc(db, `orgs/${ORG}/driverPortal/${r.id}`)));
    } else {
      invalid++;
      // שני הצדדים מסכימים שזה **אינו** נייד: הכלל חייב לדחות **כל** טוקן
      // מועמד, אחרת לוחית רישוי או קו נייח הופכים למפתח של רשומת עובד.
      for (const [j, token] of r.tokens.entries()) {
        const uid = `${r.uid}_${j}`;
        const db = testEnv.authenticatedContext(uid, { phone_number: token }).firestore();
        const ref = doc(db, `orgs/${ORG}/drivers/${r.id}`);
        await expectDenied(`${label} · נדחה גם מטוקן ${token}`, updateDoc(ref, {
          userId: uid, portalStatus: "active", portalLinkedPhone: token, updatedAt: "2026-10-01",
        }));
        await expectDenied(`${label} · ואינו קורא את הרשומה (${token})`, getDoc(ref));
      }
    }
  }
  expectTrue(`ח מערך הקלט מכיל גם תקפים (${valid}) וגם פסולים (${invalid})`, valid >= 10 && invalid >= 8);

  // ⬅ **ובכיוון ההפוך**: מספר תקף, אבל טוקן של מספר תקף **אחר**. בלי זה כל
  //   מה שהוכחנו הוא "הכלל מאשר כשהכול נכון", וזו אינה בדיקת בידוד.
  {
    const a = rows.find((r) => r.expected === "+972540000017");
    const other = testEnv.authenticatedContext("puidX", { phone_number: "+972501110007" }).firestore();
    await expectDenied(
      "ח נייד תקף אחר אינו תובע את הרשומה",
      updateDoc(doc(other, `orgs/${ORG}/drivers/${a.id}`), {
        userId: "puidX", portalStatus: "active", portalLinkedPhone: "+972501110007", updatedAt: "x",
      })
    );
  }

  // ניקוי, כדי שהמקטע הבא יתחיל נקי.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const c of ["drivers", "driverPortal"]) {
      const snap = await getDocs(collection(db, `orgs/${ORG}/${c}`));
      for (const d of snap.docs) await deleteDoc(d.ref);
    }
  });
}

await testEnv.cleanup();

console.log("\n" + "=".repeat(60));
if (failed) {
  console.error(`נכשלו ${failed} בדיקות כללים מתוך ${pass + failed}`);
  for (const f of failures) console.error("  ✗", f);
  process.exit(1);
}
console.log(`✓ כל ${pass} בדיקות הכללים עברו (firestore.rules + storage.rules)`);
