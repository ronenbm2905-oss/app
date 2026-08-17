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
// ✅ 16.8.2026 — הורצו מול האמולטור: 66/66 עברו (JDK 21 הותקן).
//    JAVA_HOME אינו מוגדר גלובלית — להריץ עם:
//    $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot"
//    $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
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
const { doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, collection, getDocs, FieldPath } =
  await import("firebase/firestore");
const { ref, uploadBytes, getBytes, deleteObject } = await import("firebase/storage");

// שכבת הנתונים **האמיתית** של הקליינט — נבדקת מול הכללים האמיתיים, ולא
// משוכפלת כאן. מקטע (ה) הוא הבדיקה שהייתה תופסת את באג הפרודקשן של 16.8.
const { probeOrg, subscribeOrg, startOrgSync, writeOrgDiff } = await import(
  "../src/utils/firestoreSync.js"
);
// מקטע (ו) — קוד הגישה האמיתי, לא שכפול. הבאג של 17.8 היה **בקליינט**
// (orgId = user.uid קשיח), ולכן בדיקה שרק מפעילה כללים לא הייתה תופסת אותו.
const { resolveOrgAccess, claimInvite, sendInvite, revokeInvite, removeMember } = await import(
  "../src/utils/orgMembers.js"
);
const { buildInvite, inviteExpiresAt, listInvites } = await import("../src/utils/invites.js");
const { EMPTY } = await import("../src/constants.js");
const emptyData = () => JSON.parse(JSON.stringify(EMPTY));

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
section("(ו) אדמין שני — תביעת הזמנה לפי מייל מאומת (באג פרודקשן 17.8)");
// ============================================================================
// למה המקטע הזה קיים: המשתמש שלח את הקישור למנהלת הכספים כדי שתהיה אדמין
// שנייה. היא התחברה וקיבלה **מסך הקמה ראשונית** — ואילו השלימה אותו, היה
// נוצר ארגון שני נפרד עם אפס רכבים. שני שורשים נפרדים:
//   • בקליינט: `useData.js:63` — `orgId = user.uid` **קשיח**. `memberships/{uid}`
//     נכתב ולא נקרא מעולם, ולכן גם הוספה ידנית ל-`org.members` לא הייתה עוזרת.
//   • בכללים: לא היה שום מסלול להוסיף אדמין. הכלל שחוסם רישום-עצמי היה נכון,
//     וגם חסם את הפתרון.
//
// המקטע בודק את **שני** הצדדים: את הכלל isInviteClaim מול כל מצבי הקצה, ואת
// קוד הגישה האמיתי (resolveOrgAccess/claimInvite/sendInvite) מקצה לקצה.
{
  const HILDA = "hildaUid";
  const HILDA_EMAIL = "hildav@promall.example";
  const OUTSIDER = "outsiderUid";
  const OUTSIDER_EMAIL = "outsider@elsewhere.example";
  const DRIVER = "driverInviteeUid";
  const DRIVER_EMAIL = "driver@promall.example";
  const SECOND = "secondHolderUid"; // מי שקיבל את תיבת הדואר אחרי שהעובדת עזבה
  const SOLO = "soloAdminUid"; // ארגון שבו orgId === uid ואין רשומת חברות

  const future = () => inviteExpiresAt(Date.now());
  const past = () => Date.now() - 60 * 1000;
  const inviteRec = (role, expiresAt) => ({
    role,
    invitedBy: "adminP",
    invitedAt: new Date().toISOString(),
    expiresAt,
  });

  // seedOrgP — מצב פתיחה נקי לכל תרחיש. נכתב עם כללים מנוטרלים; זו הדרך
  // היחידה להגיע למצב פתיחה בלי להסתמך על הכללים שאותם בודקים.
  // ⚠️ orgId ('orgP') **אינו** ה-uid של האדמין ('adminP') בכוונה: זה בדיוק
  // המצב של אדמין שני, ובדיקה שבה orgId === uid לא הייתה תופסת את הבאג.
  const seedOrgP = (invites = {}, members = { adminP: "admin" }) =>
    testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "orgs/orgP"), {
        org: { id: "orgP", name: "צי בדיקה P", createdAt: "2026-01-01T00:00:00.000Z", members, invites },
        settings: { onboarded: true, contractAlertDays: 90, policyVersion: "0.1-draft" },
        schemaVersion: 2,
      });
      await setDoc(doc(db, "orgs/orgP/vehicles/vP1"), { plate: "998", orgId: "orgP" });
      await setDoc(doc(db, "orgs/orgP/vehiclesPrivate/vP1"), { vehicleId: "vP1", monthlyCost: 4100, orgId: "orgP" });
      await setDoc(doc(db, "orgs/orgP/drivers/dP1"), { fullName: "בדיקה", orgId: "orgP" });
      await setDoc(doc(db, "memberships/adminP"), { uid: "adminP", orgId: "orgP", role: "admin" });
      // ארגון נפרד שבו orgId === uid ואין רשומת חברות — תאימות לאחור.
      await setDoc(doc(db, `orgs/${SOLO}`), {
        org: { id: SOLO, name: "יחיד", members: { [SOLO]: "admin" }, invites: {} },
        settings: { onboarded: true },
      });
      await deleteDoc(doc(db, `memberships/${SOLO}`)).catch(() => {});
      await deleteDoc(doc(db, `memberships/${HILDA}`)).catch(() => {});
      await deleteDoc(doc(db, `invites/${HILDA_EMAIL}`)).catch(() => {});
      await deleteDoc(doc(db, `invites/${DRIVER_EMAIL}`)).catch(() => {});
    });

  // זהויות. `email_verified` הוא **התנאי שהופך מייל למפתח**, ולכן יש כאן
  // גם את אותו מייל בדיוק עם דגל כבוי — ואת אותו מייל עם uid אחר.
  const ctxAdminP = testEnv.authenticatedContext("adminP", { email: "ronen@promall.example", email_verified: true });
  const ctxHilda = testEnv.authenticatedContext(HILDA, { email: HILDA_EMAIL, email_verified: true });
  const ctxHildaUnv = testEnv.authenticatedContext("hildaUnverifiedUid", { email: HILDA_EMAIL, email_verified: false });
  const ctxHildaUpper = testEnv.authenticatedContext("hildaUpperUid", { email: HILDA_EMAIL.toUpperCase(), email_verified: true });
  const ctxOutsider = testEnv.authenticatedContext(OUTSIDER, { email: OUTSIDER_EMAIL, email_verified: true });
  const ctxNoEmail = testEnv.authenticatedContext("noEmailUid");
  const ctxDriver = testEnv.authenticatedContext(DRIVER, { email: DRIVER_EMAIL, email_verified: true });
  const ctxSecond = testEnv.authenticatedContext(SECOND, { email: HILDA_EMAIL, email_verified: true });
  const ctxSolo = testEnv.authenticatedContext(SOLO, { email: "solo@x.example", email_verified: true });

  const dbAdminP = ctxAdminP.firestore();
  const dbHilda = ctxHilda.firestore();
  const dbHildaUnv = ctxHildaUnv.firestore();
  const dbHildaUpper = ctxHildaUpper.firestore();
  const dbOutsider = ctxOutsider.firestore();
  const dbNoEmail = ctxNoEmail.firestore();
  const dbDriver = ctxDriver.firestore();
  const dbSecond = ctxSecond.firestore();
  const dbSolo = ctxSolo.firestore();

  // claim — **בדיוק** מה ש-claimInvite שולח: שני עלים, בלי לקרוא את המסמך.
  // התובעת אינה רשאית לקרוא את מסמך הארגון, ולכן היא לא יכולה לכתוב את
  // מפת החברים חזרה — updateDoc+FieldPath הוא לא נוחות, הוא הכרח.
  const claim = (db, uid, email, role, extra = []) =>
    updateDoc(
      doc(db, "orgs/orgP"),
      new FieldPath("org", "members", uid),
      role,
      new FieldPath("org", "invites", email),
      deleteField(),
      ...extra
    );

  // -- 1. המסלול שצריך לעבוד ------------------------------------------------
  await seedOrgP({ [HILDA_EMAIL]: inviteRec("admin", future()) });
  await expectAllowed(
    "מייל מוזמן ומאומת — התביעה עוברת",
    claim(dbHilda, HILDA, HILDA_EMAIL, "admin")
  );
  // ⬅ זו גם הבדיקה שההזמנה ה**אחרונה** במפה ניתנת לתביעה: אחרי המחיקה
  //    org.invites מתרוקן, וגישה ישירה (בלי .get) הייתה מפילה את הכלל.
  await expectAllowed("האדמין החדש קורא את מסמך הארגון", getDoc(doc(dbHilda, "orgs/orgP")));
  await expectAllowed("האדמין החדש קורא רכבים", getDocs(collection(dbHilda, "orgs/orgP/vehicles")));
  await expectAllowed("האדמין החדש קורא נהגים", getDocs(collection(dbHilda, "orgs/orgP/drivers")));
  // ⬅ הבדיקה שהמשימה דרשה במפורש: **כולל vehiclesPrivate.**
  await expectAllowed(
    "האדמין החדש קורא vehiclesPrivate (D1)",
    getDoc(doc(dbHilda, "orgs/orgP/vehiclesPrivate/vP1"))
  );
  await expectAllowed(
    "האדמין החדש כותב רכב",
    setDoc(doc(dbHilda, "orgs/orgP/vehicles/vP2"), { plate: "997", orgId: "orgP" })
  );
  await expectAllowed(
    "האדמין החדש כותב את רשומת החברות שלו",
    setDoc(doc(dbHilda, `memberships/${HILDA}`), { uid: HILDA, orgId: "orgP", role: "admin" })
  );
  // -- האדמין המקורי לא נפגע ----------------------------------------------
  await expectAllowed("האדמין המקורי עדיין קורא את הארגון", getDoc(doc(dbAdminP, "orgs/orgP")));
  await expectAllowed(
    "האדמין המקורי עדיין קורא vehiclesPrivate",
    getDoc(doc(dbAdminP, "orgs/orgP/vehiclesPrivate/vP1"))
  );
  await expectAllowed(
    "האדמין המקורי עדיין כותב הגדרות",
    setDoc(doc(dbAdminP, "orgs/orgP"), { settings: { contractAlertDays: 80 } }, { merge: true })
  );
  {
    const after = await getDoc(doc(dbAdminP, "orgs/orgP"));
    expectEq("שני האדמינים במפה", Object.keys(after.data()?.org?.members || {}).sort().join(","), "adminP,hildaUid");
    expectEq("תפקיד האדמין המקורי לא נגע", after.data()?.org?.members?.adminP, "admin");
    expectEq("ההזמנה נצרכה", Object.keys(after.data()?.org?.invites || {}).length, 0);
  }
  // -- הזמנה שכבר נתבעה ----------------------------------------------------
  // ⚠️ נקודה עדינה שנתפסה בהרצה הראשונה: תביעה **חוזרת של אותה משתמשת**
  // עוברת — אבל לא במסלול התביעה. אחרי שהיא כבר אדמין, אותה כתיבה בדיוק
  // היא no-op של אדמין (התפקיד זהה, ההזמנה כבר לא קיימת), והיא מאושרת
  // במסלול `isOrgAdmin && adminStaysAdmin`. זה לא חור: אדמין ממילא רשאי
  // לכתוב למסמך, והכתיבה אינה משנה דבר. מה ש**כן** חייב להיחסם הוא uid
  // אחר שינסה לתבוע הזמנה שנצרכה — וזו הבדיקה שמתחתיה.
  await expectAllowed(
    "תביעה חוזרת של מי שכבר אדמין — no-op, לא מסלול תביעה",
    claim(dbHilda, HILDA, HILDA_EMAIL, "admin")
  );
  {
    const after = await getDoc(doc(dbAdminP, "orgs/orgP"));
    expectEq("והיא לא שינתה כלום במפה", Object.keys(after.data()?.org?.members || {}).sort().join(","), "adminP,hildaUid");
  }
  await expectDenied(
    "uid אחר עם אותו מייל אחרי שההזמנה נצרכה — נדחה",
    claim(dbSecond, SECOND, HILDA_EMAIL, "admin")
  );
  await expectDenied(
    "וגם לא בתפקיד driver, אחרי שההזמנה נצרכה",
    claim(dbSecond, SECOND, HILDA_EMAIL, "driver")
  );

  // -- 2. מייל לא מוזמן -----------------------------------------------------
  await seedOrgP({ [HILDA_EMAIL]: inviteRec("admin", future()) });
  await expectDenied(
    "מייל שלא הוזמן — נדחה",
    claim(dbOutsider, OUTSIDER, OUTSIDER_EMAIL, "admin")
  );
  await expectDenied(
    "מי שלא הוזמן לא יכול לתבוע הזמנה של אחר",
    claim(dbOutsider, OUTSIDER, HILDA_EMAIL, "admin")
  );
  await expectDenied("מי שלא הוזמן לא קורא את הארגון", getDoc(doc(dbOutsider, "orgs/orgP")));

  // -- 3. מייל לא מאומת ----------------------------------------------------
  // **הכתובת נכונה** — רק הדגל כבוי. בלי התנאי הזה כל אחד היה נרשם ב-Auth
  // עם כתובת שאינה שלו ותובע את ההזמנה.
  await expectDenied(
    "מייל מוזמן אך לא מאומת — נדחה",
    claim(dbHildaUnv, "hildaUnverifiedUid", HILDA_EMAIL, "admin")
  );
  await expectDenied(
    "משתמש בלי מייל בטוקן — נדחה",
    claim(dbNoEmail, "noEmailUid", HILDA_EMAIL, "admin")
  );
  // אותיות גדולות: המפתח במפה מנורמל, ו-request.auth.token.email.lower()
  // משווה אליו — ולכן חייב לעבוד גם כשהמשתמש הקליד אחרת.
  await expectAllowed(
    "אותו מייל באותיות גדולות — עובר (נרמול lower)",
    claim(dbHildaUpper, "hildaUpperUid", HILDA_EMAIL, "admin")
  );

  // -- 4. הזמנה שפג תוקפה: מייל עבודה שעבר לעובד אחר -----------------------
  // התופעה האמיתית: `hildav@…` היא תיבת **תפקיד**. אם העובדת עוזבת ומישהו
  // אחר יקבל את התיבה, הזמנה שנשארה פתוחה הייתה מעניקה לו אדמין על כל הצי.
  // **מה שמגביל את זה בזמן** הוא expiresAt, ונאכף כאן ולא בקליינט.
  await seedOrgP({ [HILDA_EMAIL]: inviteRec("admin", past()) });
  await expectDenied("הזמנה שפג תוקפה — נדחית", claim(dbHilda, HILDA, HILDA_EMAIL, "admin"));
  await expectDenied(
    "ומי שקיבל את התיבה אחריה — גם כן",
    claim(dbSecond, SECOND, HILDA_EMAIL, "admin")
  );
  await seedOrgP({ [HILDA_EMAIL]: { role: "admin", invitedBy: "adminP" } }); // בלי expiresAt
  await expectDenied("הזמנה בלי expiresAt — נדחית", claim(dbHilda, HILDA, HILDA_EMAIL, "admin"));

  // -- 5. תפקיד: מה שבהזמנה, לא מה שהתובע ביקש -----------------------------
  await seedOrgP({ [DRIVER_EMAIL]: inviteRec("driver", future()) });
  await expectDenied(
    "הזמנה ל-driver, ניסיון להעניק לעצמו admin — נדחה",
    claim(dbDriver, DRIVER, DRIVER_EMAIL, "admin")
  );
  await expectAllowed(
    "הזמנה ל-driver, תפקיד תואם — עוברת",
    claim(dbDriver, DRIVER, DRIVER_EMAIL, "driver")
  );
  // ⚠️ וחבר בתפקיד driver **אינו** אדמין: אין לו גישה לשום דבר, ובפרט לא
  //    ל-vehiclesPrivate. isOrgAdmin דורש members[uid] == 'admin' בדיוק.
  await expectDenied("חבר בתפקיד driver לא קורא vehiclesPrivate (D1)", getDoc(doc(dbDriver, "orgs/orgP/vehiclesPrivate/vP1")));
  await expectDenied("חבר בתפקיד driver לא קורא את מסמך הארגון", getDoc(doc(dbDriver, "orgs/orgP")));
  await expectDenied("חבר בתפקיד driver לא קורא רכבים", getDocs(collection(dbDriver, "orgs/orgP/vehicles")));
  await expectDenied("חבר בתפקיד driver לא כותב רכב", setDoc(doc(dbDriver, "orgs/orgP/vehicles/vX"), { plate: "1" }));
  await expectDenied(
    "חבר בתפקיד driver לא מקדם את עצמו ל-admin",
    updateDoc(doc(dbDriver, "orgs/orgP"), new FieldPath("org", "members", DRIVER), "admin")
  );
  await seedOrgP({ [HILDA_EMAIL]: inviteRec("owner", future()) });
  await expectDenied("הזמנה לתפקיד שאינו מוכר — נדחית", claim(dbHilda, HILDA, HILDA_EMAIL, "owner"));

  // -- 6. התובע לא נוגע בשום דבר אחר באותה כתיבה ---------------------------
  await seedOrgP({ [HILDA_EMAIL]: inviteRec("admin", future()), [OUTSIDER_EMAIL]: inviteRec("admin", future()) });
  await expectDenied(
    "תובע שמוסיף חבר נוסף מלבד עצמו — נדחה",
    claim(dbHilda, HILDA, HILDA_EMAIL, "admin", [new FieldPath("org", "members", OUTSIDER), "admin"])
  );
  await expectDenied(
    "תובע שזורק את האדמין הקיים — נדחה",
    claim(dbHilda, HILDA, HILDA_EMAIL, "admin", [new FieldPath("org", "members", "adminP"), deleteField()])
  );
  await expectDenied(
    "תובע שמוריד את האדמין הקיים לתפקיד driver — נדחה",
    claim(dbHilda, HILDA, HILDA_EMAIL, "admin", [new FieldPath("org", "members", "adminP"), "driver"])
  );
  await expectDenied(
    "תובע שנוגע ב-settings — נדחה",
    claim(dbHilda, HILDA, HILDA_EMAIL, "admin", [new FieldPath("settings", "contractAlertDays"), 5])
  );
  await expectDenied(
    "תובע שנוגע בשם הארגון — נדחה",
    claim(dbHilda, HILDA, HILDA_EMAIL, "admin", [new FieldPath("org", "name"), "השתלטות"])
  );
  await expectDenied(
    "תובע שנוגע ב-schemaVersion — נדחה",
    claim(dbHilda, HILDA, HILDA_EMAIL, "admin", [new FieldPath("schemaVersion"), 99])
  );
  await expectDenied(
    "תובע שמוחק את ההזמנה של מישהו אחר — נדחה",
    claim(dbHilda, HILDA, HILDA_EMAIL, "admin", [new FieldPath("org", "invites", OUTSIDER_EMAIL), deleteField()])
  );
  await expectDenied(
    "תובע שמוסיף הזמנה חדשה — נדחה",
    claim(dbHilda, HILDA, HILDA_EMAIL, "admin", [
      new FieldPath("org", "invites", "friend@x.example"),
      inviteRec("admin", future()),
    ])
  );
  await expectDenied(
    "תובע שמוסיף את עצמו בלי לצרוך את ההזמנה — נדחה",
    updateDoc(doc(dbHilda, "orgs/orgP"), new FieldPath("org", "members", HILDA), "admin")
  );
  await expectDenied(
    "תובע שמוחק את ההזמנה בלי להוסיף את עצמו — נדחה",
    updateDoc(doc(dbHilda, "orgs/orgP"), new FieldPath("org", "invites", HILDA_EMAIL), deleteField())
  );
  // ואחרי כל הניסיונות האלה — המסלול הנקי עדיין עובד, וההזמנה השנייה שרדה.
  await expectAllowed("אחרי כל הניסיונות — התביעה הנקייה עוברת", claim(dbHilda, HILDA, HILDA_EMAIL, "admin"));
  {
    const after = await getDoc(doc(dbAdminP, "orgs/orgP"));
    expectEq("ההזמנה של האחר שרדה", Object.keys(after.data()?.org?.invites || {}).join(","), OUTSIDER_EMAIL);
    expectEq("settings לא נגע", after.data()?.settings?.contractAlertDays, 90);
    expectEq("שם הארגון לא נגע", after.data()?.org?.name, "צי בדיקה P");
  }

  // -- 7. memberships — החור שהכי חשוב לסגור --------------------------------
  // ⚠️ הרשומה הזו היא מה שקובע לאיזה ארגון הקליינט מקשיב. אם היה אפשר
  // להצהיר עליה חופשית, כל משתמש היה מפנה את עצמו לארגון של כל אחד — וכל
  // מנגנון ההזמנות היה מיותר. ההכרעה: הרשומה מותרת **רק אם היא משקפת את
  // מפת החברים במסמך הארגון**, כלומר היא מצביע נגזר ולא הצהרת חברות.
  await seedOrgP({ [HILDA_EMAIL]: inviteRec("admin", future()) });
  await expectDenied(
    "משתמש לא מוזמן לא מצביע על ארגון של אחר",
    setDoc(doc(dbOutsider, `memberships/${OUTSIDER}`), { uid: OUTSIDER, orgId: "orgP", role: "admin" })
  );
  await expectDenied(
    "וגם לא בתפקיד driver",
    setDoc(doc(dbOutsider, `memberships/${OUTSIDER}`), { uid: OUTSIDER, orgId: "orgP", role: "driver" })
  );
  await expectDenied(
    "**הזמנה לבדה אינה חברות** — לפני התביעה הרשומה נדחית",
    setDoc(doc(dbHilda, `memberships/${HILDA}`), { uid: HILDA, orgId: "orgP", role: "admin" })
  );
  await expectDenied(
    "אין כתיבה לרשומה של משתמש אחר",
    setDoc(doc(dbHilda, "memberships/adminP"), { uid: "adminP", orgId: "orgP", role: "admin" })
  );
  await expectDenied(
    "אין הצהרה על ארגון שאינו קיים",
    setDoc(doc(dbHilda, `memberships/${HILDA}`), { uid: HILDA, orgId: "noSuchOrg", role: "admin" })
  );
  await expectDenied(
    "אדמין לא מצהיר על תפקיד שאינו שלו",
    setDoc(doc(dbAdminP, "memberships/adminP"), { uid: "adminP", orgId: "orgP", role: "driver" })
  );
  await expectAllowed(
    "אדמין קיים כותב רשומה שמשקפת את המפה",
    setDoc(doc(dbAdminP, "memberships/adminP"), { uid: "adminP", orgId: "orgP", role: "admin" })
  );
  await expectAllowed("תביעה", claim(dbHilda, HILDA, HILDA_EMAIL, "admin"));
  await expectAllowed(
    "אחרי התביעה — הרשומה כן נכתבת",
    setDoc(doc(dbHilda, `memberships/${HILDA}`), { uid: HILDA, orgId: "orgP", role: "admin" })
  );
  await expectAllowed("וקוראת רק לעצמו", getDoc(doc(dbHilda, `memberships/${HILDA}`)));
  await expectDenied("ולא לאחרים", getDoc(doc(dbHilda, "memberships/adminP")));

  // -- 8. הסרת אדמין, והאיסור על הסרה עצמית --------------------------------
  // ארגון בלי אף אדמין הוא מצב שאין ממנו דרך חזרה. ספירת אדמינים במפה אינה
  // ניתנת לביטוי ב-rules; "הכותב נשאר admin אחרי הכתיבה" **כן** — ולכן
  // המצב הזה בלתי-אפשרי מבנית ולא רק חסום ב-UI.
  await seedOrgP({}, { adminP: "admin", [HILDA]: "admin" });
  await expectDenied(
    "אדמין לא מסיר את עצמו",
    updateDoc(doc(dbAdminP, "orgs/orgP"), new FieldPath("org", "members", "adminP"), deleteField())
  );
  await expectDenied(
    "אדמין לא מוריד את עצמו לתפקיד driver",
    updateDoc(doc(dbAdminP, "orgs/orgP"), new FieldPath("org", "members", "adminP"), "driver")
  );
  await expectDenied(
    "אדמין לא מוחק את מפת החברים כולה",
    updateDoc(doc(dbAdminP, "orgs/orgP"), new FieldPath("org", "members"), {})
  );
  await expectAllowed(
    "אדמין כן מסיר אדמין אחר",
    updateDoc(doc(dbAdminP, "orgs/orgP"), new FieldPath("org", "members", HILDA), deleteField())
  );
  await expectDenied("ומי שהוסר מאבד גישה מיד", getDoc(doc(dbHilda, "orgs/orgP")));
  await expectDenied(
    "ומי שהוסר לא מחזיר את עצמו",
    updateDoc(doc(dbHilda, "orgs/orgP"), new FieldPath("org", "members", HILDA), "admin")
  );

  // -- 9. אוסף הגילוי invites/{email} --------------------------------------
  await seedOrgP({ [HILDA_EMAIL]: inviteRec("admin", future()) });
  const pointer = (over = {}) => ({
    email: HILDA_EMAIL,
    orgId: "orgP",
    orgName: "צי בדיקה P",
    role: "admin",
    invitedBy: "adminP",
    invitedAt: new Date().toISOString(),
    expiresAt: future(),
    ...over,
  });
  await expectAllowed("אדמין יוצר מצביע הזמנה", setDoc(doc(dbAdminP, `invites/${HILDA_EMAIL}`), pointer()));
  await expectAllowed("המוזמנת קוראת את המצביע שלה", getDoc(doc(dbHilda, `invites/${HILDA_EMAIL}`)));
  await expectAllowed("האדמין קורא את המצביע שיצר", getDoc(doc(dbAdminP, `invites/${HILDA_EMAIL}`)));
  await expectDenied("מישהו אחר לא קורא את המצביע", getDoc(doc(dbOutsider, `invites/${HILDA_EMAIL}`)));
  await expectDenied(
    "מייל לא מאומת לא קורא את המצביע שלו",
    getDoc(doc(dbHildaUnv, `invites/${HILDA_EMAIL}`))
  );
  await expectDenied(
    "מי שאינו אדמין לא יוצר מצביע לארגון של אחר",
    setDoc(doc(dbOutsider, `invites/${OUTSIDER_EMAIL}`), pointer({ email: OUTSIDER_EMAIL }))
  );
  await expectDenied(
    "המוזמנת עצמה לא יוצרת את המצביע שלה",
    setDoc(doc(dbHilda, `invites/${HILDA_EMAIL}`), pointer())
  );
  await expectDenied(
    "מצביע שבו שדה המייל אינו ה-id — נדחה",
    setDoc(doc(dbAdminP, `invites/${HILDA_EMAIL}`), pointer({ email: OUTSIDER_EMAIL }))
  );
  await expectDenied(
    "מצביע עם שדה עודף — נדחה",
    setDoc(doc(dbAdminP, `invites/${HILDA_EMAIL}`), { ...pointer(), isSuperAdmin: true })
  );
  await expectDenied(
    "מצביע בלי expiresAt — נדחה",
    setDoc(doc(dbAdminP, `invites/${HILDA_EMAIL}`), { email: HILDA_EMAIL, orgId: "orgP", role: "admin" })
  );
  await expectDenied(
    "מצביע עם id באותיות גדולות — נדחה",
    setDoc(doc(dbAdminP, `invites/${HILDA_EMAIL.toUpperCase()}`), pointer({ email: HILDA_EMAIL.toUpperCase() }))
  );
  await expectAllowed("המוזמנת מוחקת את המצביע שלה", deleteDoc(doc(dbHilda, `invites/${HILDA_EMAIL}`)));
  await expectAllowed("ואדמין יוצר אותו מחדש", setDoc(doc(dbAdminP, `invites/${HILDA_EMAIL}`), pointer()));
  await expectDenied("ומי שאינו קשור לא מוחק אותו", deleteDoc(doc(dbOutsider, `invites/${HILDA_EMAIL}`)));
  await expectAllowed("והאדמין מבטל אותו", deleteDoc(doc(dbAdminP, `invites/${HILDA_EMAIL}`)));

  // -- 10. קוד הגישה האמיתי, מקצה לקצה ------------------------------------
  // ⚠️ **זה המקטע שהיה תופס את באג 17.8.** כל הבדיקות שמעליו מפעילות כללים;
  // הבאג היה בקליינט (`orgId = user.uid`), ובדיקת כללים לבדה הייתה עוברת
  // בהצלחה בזמן שהאפליקציה שולחת את מנהלת הכספים למסך הקמה.
  await seedOrgP({});
  const hildaUser = { uid: HILDA, email: HILDA_EMAIL, emailVerified: true };
  const adminPUser = { uid: "adminP", email: "ronen@promall.example", emailVerified: true };

  // 10א. **בדיוק המצב בפרודקשן**: אין חברות ואין הזמנה.
  const before = await resolveOrgAccess(dbHilda, hildaUser);
  expectEq("(הבאג) אין ארגון ואין הזמנה ⇒ 'none' ולא ארגון חדש", before.status, "none");
  expectEq("(הבאג) ואין orgId להאזין לו", before.orgId, null);
  expectEq("(הבאג) וזו אינה שגיאה", before.error, null);

  // 10ב. האדמין הקיים מזמין — דרך הקוד האמיתי, שני המסמכים.
  const sent = await sendInvite(dbAdminP, {
    orgId: "orgP",
    orgName: "צי בדיקה P",
    email: HILDA_EMAIL,
    role: "admin",
    invitedBy: "adminP",
  });
  expectTrue("sendInvite הצליח (מסמך הארגון + מצביע הגילוי)", sent.ok);

  // 10ג. עכשיו היא רואה "יש לך הזמנה" ולא מסך הקמה.
  const invited = await resolveOrgAccess(dbHilda, hildaUser);
  expectEq("אחרי ההזמנה — status 'invited'", invited.status, "invited");
  expectEq("וההזמנה מצביעה על הארגון הנכון", invited.invite?.orgId || null, "orgP");
  expectEq("ובתפקיד שהאדמין קבע", invited.invite?.role || null, "admin");

  // 10ד. התביעה.
  const claimed = await claimInvite(dbHilda, hildaUser, invited.invite);
  expectTrue("claimInvite הצליח", claimed.ok);

  // 10ה. **הגזירה**: ה-orgId הוא של הארגון, לא ה-uid שלה. זה כל הבאג.
  const member = await resolveOrgAccess(dbHilda, hildaUser);
  expectEq("אחרי התביעה — status 'member'", member.status, "member");
  expectEq("וה-orgId הוא הארגון הקיים ולא ה-uid שלה", member.orgId, "orgP");
  expectTrue("וה-orgId **אינו** ה-uid — זה בדיוק מה שהיה קשיח", member.orgId !== HILDA);

  // 10ו. ומכאן זרימת הנתונים הרגילה עובדת, כולל D1.
  {
    const ev = { missing: 0, data: [], errors: [] };
    const stop = await startOrgSync(dbHilda, member.orgId, {
      selfUid: HILDA,
      onMissing: () => ev.missing++,
      onData: (d) => ev.data.push(d),
      onError: (err, phase) => ev.errors.push({ code: err?.code || String(err), phase }),
    });
    const got = await waitFor(() => ev.data.length > 0, { timeoutMs: 8000 });
    expectTrue("האדמין החדש מקבל את נתוני הצי", got);
    expectEq("בלי שגיאות", ev.errors.length, 0);
    expectEq("ובלי onMissing (הארגון קיים)", ev.missing, 0);
    const live = ev.data[ev.data.length - 1];
    expectEq("שם הארגון הנכון", live?.org?.name || null, "צי בדיקה P");
    expectTrue("הרכבים הגיעו", (live?.vehicles?.length || 0) >= 1);
    expectEq("וגם המסמך הפרטי (D1) — הוא אדמין מלא", live?.vehiclesPrivate?.length, 1);
    expectEq("מפת החברים כוללת את שניהם", Object.keys(live?.org?.members || {}).sort().join(","), "adminP,hildaUid");
    expectEq("וההזמנה נצרכה", listInvites(live?.org || {}).length, 0);
    stop();
    // ורשומת החברות נכתבה על **ה-uid שלה**, לא על ה-orgId (הבאג ב-startOrgSync).
    const ms = await getDoc(doc(dbHilda, `memberships/${HILDA}`));
    expectTrue("רשומת החברות נכתבה עבורה", ms.exists());
    expectEq("והיא מצביעה על הארגון הקיים", ms.data()?.orgId || null, "orgP");
  }

  // 10ז. האדמין המקורי — ללא רגרסיה.
  const adminAccess = await resolveOrgAccess(dbAdminP, adminPUser);
  expectEq("האדמין המקורי נשאר member", adminAccess.status, "member");
  expectEq("ועל אותו ארגון", adminAccess.orgId, "orgP");

  // 10ח. תאימות לאחור: ארגון שבו orgId === uid ואין רשומת חברות בכלל.
  const soloAccess = await resolveOrgAccess(dbSolo, { uid: SOLO, email: "solo@x.example", emailVerified: true });
  expectEq("יוצר ארגון בלי רשומת חברות — נמצא לפי orgs/{uid}", soloAccess.status, "member");
  expectEq("וה-orgId הוא ה-uid שלו", soloAccess.orgId, SOLO);

  // 10ט. זר גמור — 'none', ולא שגיאה ולא הקמה.
  const outsiderAccess = await resolveOrgAccess(dbOutsider, {
    uid: OUTSIDER,
    email: OUTSIDER_EMAIL,
    emailVerified: true,
  });
  expectEq("זר — status 'none'", outsiderAccess.status, "none");
  expectEq("ובלי שגיאה", outsiderAccess.error, null);

  // 10י. ביטול והסרה דרך הקוד האמיתי.
  const sent2 = await sendInvite(dbAdminP, { orgId: "orgP", orgName: "צי בדיקה P", email: OUTSIDER_EMAIL, invitedBy: "adminP" });
  expectTrue("sendInvite שני הצליח", sent2.ok);
  const revoked = await revokeInvite(dbAdminP, { orgId: "orgP", email: OUTSIDER_EMAIL });
  expectTrue("revokeInvite הצליח", revoked.ok);
  {
    const after = await getDoc(doc(dbAdminP, "orgs/orgP"));
    expectEq("ההזמנה נמחקה מהמפה (deleteField, לא merge)", Object.keys(after.data()?.org?.invites || {}).length, 0);
  }
  const revokedOutsider = await resolveOrgAccess(dbOutsider, {
    uid: OUTSIDER,
    email: OUTSIDER_EMAIL,
    emailVerified: true,
  });
  expectEq("ומי שבוטל חוזר ל-'none'", revokedOutsider.status, "none");
  const removed = await removeMember(dbAdminP, { orgId: "orgP", uid: HILDA });
  expectTrue("removeMember הצליח", removed.ok);
  const selfRemove = await removeMember(dbAdminP, { orgId: "orgP", uid: "adminP" });
  expectEq("הסרה עצמית נדחית גם דרך הקוד האמיתי", selfRemove.ok, false);
  {
    const after = await getDoc(doc(dbAdminP, "orgs/orgP"));
    expectEq("נשאר אדמין אחד — האדמין המקורי", Object.keys(after.data()?.org?.members || {}).join(","), "adminP");
  }
}

await testEnv.cleanup();

console.log("\n" + "=".repeat(60));
if (failed) {
  console.error(`נכשלו ${failed} בדיקות כללים מתוך ${pass + failed}`);
  for (const f of failures) console.error("  ✗", f);
  process.exit(1);
}
console.log(`✓ כל ${pass} בדיקות הכללים עברו (firestore.rules + storage.rules)`);
