// ============================================================================
// smoke.mjs — בדיקות עשן ללוגיקה הטהורה (בלי React, בלי DOM, בלי Firebase,
// **בלי רשת**). מריצים: npm run smoke
//
// הכיסוי מכוון לשלושה דברים:
//   1. **מנוע התזכורות** — הלוגיקה שמצדיקה את קיום המוצר. היא נבדקת כאן
//      לפני שקיים מסך אחד, כי היא ליבת האמינות.
//   2. **חוסמי-התכנון של עדי (N1-N7 + O6/O10)** — כדי שרגרסיה בפרטיות תיפול
//      כאן ולא בשער המשפטי.
//   3. **סריקות סטטיות** — דברים שאי אפשר לבדוק בקריאה לפונקציה: מחלקות
//      אסורות, geolocation, getDownloadURL מחוץ למקומו, ו-hid==uid ב-rules.
// ============================================================================

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const SRC = path.join(ROOT, "src");

import {
  createHousehold,
  createVehicle,
  createVehiclePrivate,
  createDriver,
  createVehicleAccess,
  createTask,
  createDocument,
  createPersonalDoc,
  createServiceRecord,
  createOdometerReading,
  createUserProfile,
  createMembership,
  createReminderLogEntry,
  appendNotice,
  hasAcknowledged,
  makeFileRef,
  makeGuardianConsent,
  canAcceptInvite,
  vehicleAccessId,
  resetSchedule,
  FACTORY_BY_COLLECTION,
} from "../src/schema.js";

import {
  EMPTY,
  ENTITY_COLLECTIONS,
  OWNER_ONLY_COLLECTIONS,
  SUBJECT_ONLY_COLLECTIONS,
  SERVER_ONLY_COLLECTIONS,
  ALL_COLLECTIONS,
  REMINDER_LOG_FIELDS,
  REMINDER_LOG_FORBIDDEN_FIELDS,
  SIGNED_URL_MARKERS,
  SIGNED_URL_TTL_MINUTES,
  FORBIDDEN_FIELDS,
  VEHICLE_FORBIDDEN_FIELDS,
  RETENTION_CLASSES,
  STORAGE_DOMAINS,
  SENSITIVITY_BY_DOC_TYPE,
  VISIBILITY_BY_DOC_TYPE,
  REMINDER_LADDER,
  POLICY_VERSION,
} from "../src/constants.js";

import { todayIso, addDays, addMonths, addYears, daysInMonth, minDay, isDay } from "../src/utils/dates.js";

import {
  computeStatus,
  statusHintKey,
  ladderFor,
  dueSteps,
  nextFireDate,
  withNextFire,
  acknowledge,
  snooze,
  mute,
  markFired,
  bucketFor,
  bucketForTask,
  engineMessage,
  urgencyRank,
  sortTasks,
  mostUrgent,
  heroTask,
  isUrgent,
  nextTaskForVehicle,
  daysToDue,
} from "../src/utils/reminders.js";

import { attributionFor, fixActionKey } from "../src/utils/reminders.js";
import { createStore } from "../src/utils/store.js";
import { writeVehicleWithTasks, writeTaskCompletion } from "../src/utils/writes.js";
import { seedTasksForVehicle } from "../src/utils/seed.js";
import { buildEmergencyCard, cardLeaks, EMERGENCY_DOC_TYPES } from "../src/utils/emergency.js";
import { completeTask, nextDueDate, undoComplete } from "../src/utils/renewal.js";
import { kmPerDay, estimateDateForKm, nextServiceDue, serviceKmLine, readingsForVehicle } from "../src/utils/service.js";

import {
  MOT,
  normalizePlate,
  digitsOf,
  isValidPlate,
  formatPlate,
  buildLookupUrl,
  mapActiveRecord,
  mapInactiveRecord,
  lookupVehicle,
  motSourceFrom,
  mergeMotIntoVehicle,
} from "../src/utils/mot.js";

import {
  roleOf,
  isOwner,
  isMember,
  owners,
  hasVehicleAccess,
  canReadVehicle,
  vehicleIdsForUid,
  canReadVehiclePrivate,
  canReadPersonalDoc,
  canDeletePersonalDoc,
  canReadDocument,
  canEdit,
  canWriteGuardianFields,
  ownerOnlyCollectionsAreDenied,
  subjectOnlyCollectionsAreDenied,
  serverOnlyCollectionsAreDenied,
  ownerContactProjection,
} from "../src/utils/access.js";

import {
  archiveVehicle,
  restoreVehicle,
  removeVehicleCascade,
  removeDocument,
  removePersonalDoc,
  removeDriverCascade,
  clearHouseholdData,
} from "../src/utils/cascade.js";

import {
  collectVehicleStoragePaths,
  collectDriverStoragePaths,
  collectHouseholdStoragePaths,
  exportHousehold,
  deleteHouseholdPlan,
  anonymizeDriver,
  retentionClassOf,
} from "../src/utils/retention.js";

import { storagePath, validateFile, isAcceptedType, personalDocsAllowed, ACCEPTED_TYPES } from "../src/utils/files.js";
import { emergencyCacheKey, keyBelongsToUid } from "../src/utils/localCache.js";
import { vehicleLabel, vehiclePlate } from "../src/utils/options.js";
import { parseHash, hrefFor } from "../src/utils/routes.js";
import dict, { translate, LANGS } from "../src/i18n/index.js";

// ---------------------------------------------------------------------------
let pass = 0;
let failed = 0;
const failures = [];

function ok(name, cond) {
  try {
    assert.ok(cond, name);
    pass++;
  } catch {
    failed++;
    failures.push(name);
    console.error("  FAIL:", name);
  }
}
function eq(name, a, b) {
  try {
    assert.deepStrictEqual(a, b, name);
    pass++;
  } catch {
    failed++;
    failures.push(name);
    console.error("  FAIL:", name, "\n    got:", JSON.stringify(a), "\n    want:", JSON.stringify(b));
  }
}
function section(title) {
  console.log(`\n— ${title}`);
}

const HID = "hh1";
const OWNER = "uid_owner";
const KID = "uid_kid";
const TODAY = "2026-08-13";

// קיצור לתרגום עברי, לבדיקות שמשוות טקסט מוצג.
const t2 = (key, vars) => translate("he", key, vars);

// מצב ריק טרי לכל בדיקה — כדי ששתי בדיקות לא יחלקו מערכים.
const deepEmpty = () => JSON.parse(JSON.stringify(EMPTY));

function readSrc(rel) {
  return fs.readFileSync(path.join(SRC, rel), "utf8");
}
// ============================================================================
// הסריקות הסטטיות בודקות **קוד, לא פרוזה.** בלי הסרת הערות, כל הערה שמסבירה
// למה משהו אסור ("אין navigator.geolocation", "לעולם לא hid == auth.uid")
// הופכת בעצמה לכשל — והתוצאה היא שמפסיקים לתעד. הרגקס משאיר `https://`
// במקומו כדי לא לחתוך כתובות באמצע מחרוזת.
// ============================================================================
function stripComments(txt) {
  return txt.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:'"`\\])\/\/.*$/gm, "$1");
}
function readCode(file) {
  return stripComments(fs.readFileSync(file, "utf8"));
}
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const SRC_FILES = walk(SRC);

// ============================================================================
section("1. סכימה — כל ישות, householdId, retentionClass");
// ============================================================================

const vehicle = createVehicle({ householdId: HID, plate: "1234567", nickname: "האוטו של אמא", manufacturer: "מאזדה", model: "3", year: 2019 });
const vehiclePriv = createVehiclePrivate(vehicle.id, { householdId: HID, purchasePrice: 90000 });
const driver = createDriver({ householdId: HID, fullName: "דנה", relation: "child" });
const access = createVehicleAccess({ householdId: HID, driverUid: KID, driverId: driver.id, vehicleId: vehicle.id });
const task = createTask({ householdId: HID, vehicleId: vehicle.id, type: "test", dueDate: addDays(TODAY, 20) });
const document1 = createDocument({ householdId: HID, vehicleId: vehicle.id, type: "vehicleLicence" });
const personalDoc = createPersonalDoc({ householdId: HID, driverId: driver.id, driverUid: KID });
const serviceRec = createServiceRecord({ householdId: HID, vehicleId: vehicle.id, date: TODAY, km: 100000 });
const odo = createOdometerReading({ householdId: HID, vehicleId: vehicle.id, date: TODAY, km: 100000 });

const ALL_ENTITIES = [vehicle, vehiclePriv, driver, access, task, document1, personalDoc, serviceRec, odo];

for (const e of ALL_ENTITIES) {
  ok(`לישות יש householdId: ${e.id}`, Object.prototype.hasOwnProperty.call(e, "householdId"));
}
ok("לכל ישות נושאת-PII יש retentionClass (N6)", [vehicle, driver, task, document1, personalDoc, serviceRec, odo].every((e) => retentionClassOf(e) !== null));
ok("כל retentionClass מוכר ב-RETENTION_CLASSES", ALL_ENTITIES.every((e) => !e.retentionClass || e.retentionClass in RETENTION_CLASSES));
eq("ENTITY_COLLECTIONS מכיל 9 אוספים", ENTITY_COLLECTIONS.length, 9);
ok("reminderLog אינו ב-ENTITY_COLLECTIONS (שרת בלבד)", !ENTITY_COLLECTIONS.includes("reminderLog"));
ok("לכל אוסף יש factory", ENTITY_COLLECTIONS.every((c) => typeof FACTORY_BY_COLLECTION[c] === "function"));
ok("EMPTY מכיל מערך לכל אוסף", ENTITY_COLLECTIONS.every((c) => Array.isArray(EMPTY[c])));

// -- FORBIDDEN_FIELDS: אין שדה אסור בשום factory ---------------------------
function keysDeep(obj, depth = 2) {
  const out = [];
  if (!obj || typeof obj !== "object" || depth < 0) return out;
  for (const [k, v] of Object.entries(obj)) {
    out.push(k);
    if (v && typeof v === "object" && !Array.isArray(v)) out.push(...keysDeep(v, depth - 1));
  }
  return out;
}
for (const e of ALL_ENTITIES) {
  const bad = keysDeep(e).filter((k) => FORBIDDEN_FIELDS.includes(k));
  eq(`אין שדה אסור בישות ${e.id?.slice(0, 3)}`, bad, []);
}
ok("misgeret/vin ב-FORBIDDEN_FIELDS", FORBIDDEN_FIELDS.includes("misgeret") && FORBIDDEN_FIELDS.includes("vin"));
ok("N2 — url/downloadUrl/downloadURL/signedUrl ב-FORBIDDEN_FIELDS", ["url", "downloadUrl", "downloadURL", "signedUrl"].every((f) => FORBIDDEN_FIELDS.includes(f)));
ok("אין ת.ז./מספר רישיון ב-FORBIDDEN-אישור", ["nationalId", "idNumber", "licenceNumber", "drivingLicenceNumber"].every((f) => FORBIDDEN_FIELDS.includes(f)));
ok("birthDate אסור — isMinor הוא הצהרה, לא גיל", FORBIDDEN_FIELDS.includes("birthDate"));
const vehicleKeys = keysDeep(vehicle);
eq("לרכב אין מחיר/פרמיה/הערות בעלים (הם ב-VehiclePrivate)", VEHICLE_FORBIDDEN_FIELDS.filter((f) => vehicleKeys.includes(f)), []);
ok("VehiclePrivate כן מחזיק את המחיר", Object.prototype.hasOwnProperty.call(vehiclePriv, "purchasePrice"));

// ============================================================================
section("2. N2 — fileRef הוא נתיב, לעולם לא URL");
// ============================================================================

const ref = makeFileRef({ storagePath: "households/hh1/vehicles/v1/shared/x.jpg", contentType: "image/jpeg", size: 1234 });
eq("fileRef הוא בדיוק 4 שדות", Object.keys(ref).sort(), ["contentType", "size", "storagePath", "uploadedAt"]);
ok("fileRef לא מכיל url", !("url" in ref) && !("downloadUrl" in ref) && !("src" in ref));
eq("makeFileRef בלי נתיב מחזיר null", makeFileRef({}), null);
const docWithFile = createDocument({ householdId: HID, vehicleId: vehicle.id, type: "policy", fileRef: ref });
eq("Document.fileRef שומר נתיב", docWithFile.fileRef.storagePath, ref.storagePath);
ok("אין מפתח url בשום ישות עם קובץ", !keysDeep(docWithFile).some((k) => ["url", "downloadUrl", "downloadURL", "signedUrl"].includes(k)));

// ============================================================================
section("3. N3 — sensitivity על כל מסמך, לא רק על מסמך אישי");
// ============================================================================

eq("רישיון רכב מסומן containsIdNumber", createDocument({ householdId: HID, type: "vehicleLicence" }).sensitivity, "containsIdNumber");
eq("ביטוח חובה מסומן containsIdNumber", createDocument({ householdId: HID, type: "compulsory" }).sensitivity, "containsIdNumber");
eq("ביטוח מקיף (פוליסה) מסומן containsIdNumber", createDocument({ householdId: HID, type: "comprehensive" }).sensitivity, "containsIdNumber");
eq("קבלה — none", createDocument({ householdId: HID, type: "receipt" }).sensitivity, "none");
eq("רישיון נהיגה — id", personalDoc.sensitivity, "id");
ok("לכל סוג מסמך יש ברירת מחדל של רגישות", Object.keys(SENSITIVITY_BY_DOC_TYPE).length >= 7);
// ההחלטה המודעת: רישיון רכב + ביטוח חובה = shared; פוליסה + קבלות = owner.
eq("רישיון רכב shared", VISIBILITY_BY_DOC_TYPE.vehicleLicence, "shared");
eq("ביטוח חובה shared", VISIBILITY_BY_DOC_TYPE.compulsory, "shared");
eq("פוליסה מקיפה owner", VISIBILITY_BY_DOC_TYPE.comprehensive, "owner");
eq("קבלה owner", VISIBILITY_BY_DOC_TYPE.receipt, "owner");

// ============================================================================
section("4. N5 + O10 — notices append-only, וערוצי שירות מופרדים משיווק");
// ============================================================================

let profile = createUserProfile({ uid: OWNER, householdId: HID, displayName: "רונן" });
ok("notices הוא מערך", Array.isArray(profile.notices));
eq("בהתחלה ריק", profile.notices.length, 0);
profile = appendNotice(profile, { policyVersion: "0.1-draft" });
profile = appendNotice(profile, { policyVersion: "0.2" });
eq("append — שתי רשומות, לא דריסה", profile.notices.length, 2);
eq("הרשומה הראשונה שרדה", profile.notices[0].policyVersion, "0.1-draft");
ok("לכל רשומה יש acknowledgedAt ו-method", profile.notices.every((n) => n.acknowledgedAt && n.method));
ok("hasAcknowledged מזהה גרסה", hasAcknowledged(profile, "0.2") && !hasAcknowledged(profile, "9.9"));
// O10
ok("serviceChannels קיים ומופרד", profile.serviceChannels && "push" in profile.serviceChannels && "sms" in profile.serviceChannels && "email" in profile.serviceChannels);
eq("marketingConsent נפרד וריק כברירת מחדל", profile.marketingConsent, null);
ok("marketingConsent אינו בתוך serviceChannels", !("marketingConsent" in profile.serviceChannels));

// ============================================================================
section("5. N7 — קטינים: guardianConsent append-only, והזמנה חסומה בלי הסכמה");
// ============================================================================

let minor = createDriver({ householdId: HID, fullName: "יונתן", isMinor: true, inviteStatus: "invited" });
ok("guardianConsent הוא מערך", Array.isArray(minor.guardianConsent));
ok("קטין בלי הסכמה — ההזמנה לא ניתנת לקבלה", !canAcceptInvite(minor));
const consent = makeGuardianConsent({ byUid: OWNER, byName: "רונן" });
ok("להסכמה יש byUid — בלעדיו אין ראיה מי אישר", Boolean(consent.byUid));
ok("להסכמה יש policyVersion", consent.policyVersion === POLICY_VERSION);
minor = { ...minor, guardianConsent: [...minor.guardianConsent, consent] };
ok("אחרי הסכמה — ההזמנה ניתנת לקבלה", canAcceptInvite(minor));
ok("בגיר לא צריך הסכמה", canAcceptInvite(createDriver({ householdId: HID, isMinor: false })));
ok("אין שדה birthDate על נהג — isMinor הוא הצהרה", !("birthDate" in minor));
ok("אין מספר רישיון על נהג — רק תאריך", !("licenceNumber" in minor) && "drivingLicenceValidUntil" in minor);

// ============================================================================
section("6. תאריכים — אריתמטיקת חודשים במחרוזות, בלי אזורי זמן");
// ============================================================================

eq("+12 חודשים", addMonths("2026-08-13", 12), "2027-08-13");
eq("31 בינואר + חודש נקטם לפברואר", addMonths("2026-01-31", 1), "2026-02-28");
eq("29 בפברואר בשנה מעוברת + 12 חודשים", addMonths("2028-02-29", 12), "2029-02-28");
eq("חציית שנה", addMonths("2026-12-15", 1), "2027-01-15");
eq("חודשים שליליים", addMonths("2026-01-15", -1), "2025-12-15");
eq("addYears", addYears("2026-08-13", 1), "2027-08-13");
eq("ימים בפברואר 2028 (מעוברת)", daysInMonth(2028, 2), 29);
eq("ימים בפברואר 2100 (לא מעוברת)", daysInMonth(2100, 2), 28);
eq("minDay מתעלם מ-null", minDay(null, "2026-05-01", "2026-03-01"), "2026-03-01");
ok("addMonths על קלט לא תקין מחזיר null", addMonths("nope", 1) === null);
ok("כל התאריכים במנוע הם מחרוזות YYYY-MM-DD", isDay(addMonths(TODAY, 12)));

// ============================================================================
section("7. המנוע — גזירת סטטוס, כולל הגבולות");
// ============================================================================

const mk = (p = {}) => createTask({ householdId: HID, vehicleId: "v1", type: "test", ...p });

eq("31 יום קדימה → פתוח", computeStatus(mk({ dueDate: addDays(TODAY, 31) }), TODAY), "open");
eq("30 יום קדימה → מתקרב (הגבול)", computeStatus(mk({ dueDate: addDays(TODAY, 30) }), TODAY), "upcoming");
eq("היום → מתקרב", computeStatus(mk({ dueDate: TODAY }), TODAY), "upcoming");
eq("יום אחד באיחור → באיחור", computeStatus(mk({ dueDate: addDays(TODAY, -1) }), TODAY), "overdue");
eq("בוצע → בוצע", computeStatus(mk({ dueDate: addDays(TODAY, -5), completedAt: "2026-08-10T00:00:00Z" }), TODAY), "done");
eq("manualStatus לפני התאריך → בטיפול", computeStatus(mk({ dueDate: addDays(TODAY, 5), manualStatus: "inProgress" }), TODAY), "inProgress");

// ★ הכלל הלא-אינטואיטיבי, ולכן האסרשן המפורש:
eq(
  '"באיחור" גובר על "בטיפול" — קבעת תור, אבל התאריך עבר',
  computeStatus(mk({ dueDate: addDays(TODAY, -1), manualStatus: "inProgress" }), TODAY),
  "overdue"
);
eq(
  "ולמשתמש מוצגת המחרוזת שמסבירה למה זה לא באג",
  statusHintKey(mk({ dueDate: addDays(TODAY, -1), manualStatus: "inProgress" }), TODAY),
  "task.status.overdue.hintFromInProgress"
);
eq("בלי תאריך יעד → פתוח", computeStatus(mk({ dueDate: null }), TODAY), "open");

// -- leadDays מותאם משנה את הגבול ואת הסולם --------------------------------
const lead7 = mk({ dueDate: addDays(TODAY, 14), leadDays: 7 });
eq("leadDays=7: 14 יום קדימה → עדיין פתוח", computeStatus(lead7, TODAY), "open");
eq("leadDays=7: הסולם מסונן", ladderFor(lead7), [7, 3, 1, 0]);
eq("leadDays=30: הסולם המלא", ladderFor(mk({ dueDate: TODAY })), REMINDER_LADDER);
eq("leadDays=7 ו-7 ימים קדימה → מתקרב", computeStatus(mk({ dueDate: addDays(TODAY, 7), leadDays: 7 }), TODAY), "upcoming");

// ============================================================================
section("8. המנוע — nextFireAt, שלבים, השהיה והשתקה");
// ============================================================================

const due30 = mk({ dueDate: addDays(TODAY, 30) });
eq("30 יום קדימה: השלב הראשון נורה היום", nextFireDate(due30, TODAY), TODAY);
eq("dueSteps מחזיר את שלב ה-30", dueSteps(due30, TODAY), [30]);

const afterFirst = markFired(due30, { step: 30 }, TODAY);
eq("אחרי שלב 30, הבא הוא 14 יום לפני היעד", nextFireDate(afterFirst, TODAY), addDays(due30.dueDate, -14));
eq("nextFireAt נכתב על המשימה", afterFirst.schedule.nextFireAt, addDays(due30.dueDate, -14));
// 🔴 T3 — markFired מעדכן **רק** את השלב ברמת המשימה. החותמת, הערוץ ומצב
// המסירה הם תכונות של אדם ויורדים ל-tasks/{id}/private/state (שרת בלבד).
ok("★★ ואין על המשימה חותמת מסירה", afterFirst.schedule.lastFiredAt === undefined);
ok("★★ ואין ערוצים שנוסו", afterFirst.schedule.channelsTried === undefined);

const overdue = mk({ dueDate: addDays(TODAY, -3) });
eq("משימה באיחור ממשיכה להזכיר היום", nextFireDate(overdue, TODAY), TODAY);
ok("ושלב 0 חוזר גם אחרי שנורה", dueSteps(overdue, TODAY).includes(0));

eq("done → אין תזכורת", nextFireDate(mk({ dueDate: addDays(TODAY, -3), completedAt: "x" }), TODAY), null);
eq("muted → אין תזכורת", nextFireDate(mute(due30, true, TODAY), TODAY), null);
eq("muted → אין שלבים", dueSteps(mute(due30, true, TODAY), TODAY), []);
const snoozed = snooze(overdue, addDays(TODAY, 7), TODAY);
eq("snoozed → התזכורת נדחית לתאריך שנבחר", nextFireDate(snoozed, TODAY), addDays(TODAY, 7));
eq("snoozed → אין שלבים בשלים", dueSteps(snoozed, TODAY), []);
const acked = acknowledge(overdue, { step: 0 });
eq("אישור → אין תזכורת", nextFireDate(acked, TODAY), null);
eq("★ אישור נרשם כעובדה בוליאנית", acked.schedule.acknowledged, true);
ok("★★ ובלי חותמת זמן — היא הרגישה, לא העובדה", acked.schedule.acknowledgedAt === undefined);
eq("withNextFire הוא הכותב היחיד ל-nextFireAt", withNextFire(due30, TODAY).schedule.nextFireAt, TODAY);

// ============================================================================
section("9. המנוע — דליים, מסרים ו-mostUrgent על fixture רב-רכבי");
// ============================================================================

eq("31 → מחוץ לדלי (לא כרטיס-גיבור)", bucketFor(31), null);
eq("30 → d30", bucketFor(30), "d30");
eq("15 → d30", bucketFor(15), "d30");
eq("14 → d14", bucketFor(14), "d14");
eq("8 → d14", bucketFor(8), "d14");
eq("7 → d7", bucketFor(7), "d7");
eq("4 → d7", bucketFor(4), "d7");
eq("3 → d3", bucketFor(3), "d3");
eq("2 → d3", bucketFor(2), "d3");
eq("1 → d1", bucketFor(1), "d1");
eq("0 → d0", bucketFor(0), "d0");
eq("-1 → overdue", bucketFor(-1), "overdue");

const m2 = engineMessage(mk({ dueDate: addDays(TODAY, 2) }), "המאזדה", TODAY);
eq('יומיים → ווריאנט .two ("יומיים", לא "2 ימים")', m2.titleKey, "engine.test.d3.title.two");
const m3 = engineMessage(mk({ dueDate: addDays(TODAY, 3) }), "המאזדה", TODAY);
eq("שלושה ימים → המפתח הרגיל", m3.titleKey, "engine.test.d3.title");
const mOver1 = engineMessage(mk({ dueDate: addDays(TODAY, -1) }), "המאזדה", TODAY);
eq('יום אחד באיחור → .one ("אתמול")', mOver1.titleKey, "engine.test.overdue.title.one");
eq("days תמיד חיובי", mOver1.days, 1);
eq("מעל 30 יום — אין מסר מנוע", engineMessage(mk({ dueDate: addDays(TODAY, 45) }), "המאזדה", TODAY), null);

// ★ ביטוח באיחור: "אסור לנסוע" רק על חובה, לעולם לא על מקיף
const insOverCompulsory = createTask({ householdId: HID, vehicleId: "v1", type: "insurance", coverage: "compulsory", dueDate: addDays(TODAY, -4) });
const insOverComp = createTask({ householdId: HID, vehicleId: "v1", type: "insurance", coverage: "comprehensive", dueDate: addDays(TODAY, -4) });
const insOverGeneric = createTask({ householdId: HID, vehicleId: "v1", type: "insurance", dueDate: addDays(TODAY, -4) });
eq("חובה באיחור → sub.compulsory", engineMessage(insOverCompulsory, "המאזדה", TODAY).subKey, "engine.insurance.overdue.sub.compulsory");
eq("מקיף באיחור → sub.comprehensive", engineMessage(insOverComp, "המאזדה", TODAY).subKey, "engine.insurance.overdue.sub.comprehensive");
eq("כיסוי לא ידוע → נופל למקיף, לא ל-'אסור לנסוע'", engineMessage(insOverGeneric, "המאזדה", TODAY).subKey, "engine.insurance.overdue.sub.comprehensive");
ok('המחרוזת "אסור לנסוע" לא מוצגת על מקיף', !translate("he", engineMessage(insOverComp, "x", TODAY).subKey).includes("אסור לנסוע"));

// -- fixture רב-רכבי --
const tA = createTask({ id: "a", householdId: HID, vehicleId: "v1", type: "test", dueDate: addDays(TODAY, 40) });
const tB = createTask({ id: "b", householdId: HID, vehicleId: "v2", type: "insurance", coverage: "compulsory", dueDate: addDays(TODAY, -3) });
const tC = createTask({ id: "c", householdId: HID, vehicleId: "v1", type: "service", dueDate: addDays(TODAY, 5) });
const tD = createTask({ id: "d", householdId: HID, vehicleId: "v2", type: "repair", dueDate: addDays(TODAY, -10), completedAt: "2026-08-05T00:00:00Z" });
const fleetTasks = [tA, tB, tC, tD];

eq("mostUrgent בוחר את המשימה באיחור", mostUrgent(fleetTasks, TODAY).id, tB.id);
eq("מיון: באיחור → מתקרב → פתוח → בוצע", sortTasks(fleetTasks, TODAY).map((t) => t.id), ["b", "c", "a", "d"]);
eq("heroTask מחזיר אותה", heroTask(fleetTasks, TODAY).id, tB.id);
eq("המשימה הקרובה של רכב 1", nextTaskForVehicle(fleetTasks, "v1", TODAY).id, tC.id);
ok("משימה ל-40 יום אינה דחופה", !isUrgent(tA, TODAY));
ok("משימה ל-5 ימים כן דחופה", isUrgent(tC, TODAY));
eq("כשאין דחוף — אין כרטיס-גיבור (מצב 'הכול מסודר')", heroTask([tA, tD], TODAY), null);
ok("urgencyRank: באיחור לפני מתקרב", urgencyRank(tB, TODAY) < urgencyRank(tC, TODAY));
// "חשוב" שובר שוויון בתוך אותו יום, אבל התאריך גובר עליו
const sameDayPlain = createTask({ id: "p", householdId: HID, vehicleId: "v1", type: "other", dueDate: addDays(TODAY, 5) });
const sameDayImportant = createTask({ id: "i", householdId: HID, vehicleId: "v1", type: "other", dueDate: addDays(TODAY, 5), important: true });
eq('"חשוב" שובר שוויון באותו תאריך', sortTasks([sameDayPlain, sameDayImportant], TODAY).map((t) => t.id), ["i", "p"]);
const earlierPlain = createTask({ id: "e", householdId: HID, vehicleId: "v1", type: "other", dueDate: addDays(TODAY, 2) });
eq("אבל תאריך מוקדם יותר גובר על 'חשוב'", sortTasks([sameDayImportant, earlierPlain], TODAY)[0].id, "e");

// ============================================================================
section("10. חידוש אוטומטי — הכלל של כל סוג");
// ============================================================================

const testTask = createTask({ householdId: HID, vehicleId: "v1", type: "test", dueDate: "2026-08-01" });
const rTest = completeTask(testTask, { completedDate: TODAY, today: TODAY });
eq("טסט: +12 חודשים מ**תאריך הביצוע**", rTest.next.dueDate, "2027-08-13");
eq("המשימה סומנה בוצע", Boolean(rTest.completed.completedAt), true);
eq("ולמשימה שבוצעה אין תזכורת", rTest.completed.schedule.nextFireAt, null);
eq("המשימה הבאה נושאת sourceTaskId", rTest.next.sourceTaskId, testTask.id);
eq("ולוח מאופס: lastFiredStep", rTest.next.schedule.lastFiredStep, null);
eq("ולוח מאופס: acknowledged", rTest.next.schedule.acknowledged, false);
eq("ולוח מאופס: acknowledgedStep", rTest.next.schedule.acknowledgedStep, null);
ok("אבל nextFireAt כבר מחושב", isDay(rTest.next.schedule.nextFireAt));
ok("והמשימה הבאה עוד לא בוצעה", rTest.next.completedAt === null);

const rTestMot = completeTask(testTask, { completedDate: TODAY, motDate: "2027-09-01", today: TODAY });
eq("טסט: tokef_dt מהמאגר **גובר** על החישוב", rTestMot.next.dueDate, "2027-09-01");

const insTask = createTask({ householdId: HID, vehicleId: "v1", type: "insurance", coverage: "compulsory", dueDate: "2026-08-01" });
const rIns = completeTask(insTask, { completedDate: TODAY, today: TODAY });
eq("ביטוח: +12 חודשים מ**תאריך היעד הישן**, לא מהיום", rIns.next.dueDate, "2027-08-01");
eq("והכיסוי נשמר", rIns.next.coverage, "compulsory");

const repairTask = createTask({ householdId: HID, vehicleId: "v1", type: "repair", title: "החלפת צמיגים", dueDate: "2026-08-01" });
const rRepair = completeTask(repairTask, { completedDate: TODAY, today: TODAY });
eq("תיקון: **אין** משימה הבאה", rRepair.next, null);
eq("אחר: אין משימה הבאה", completeTask(createTask({ householdId: HID, type: "other", dueDate: "2026-08-01" }), { today: TODAY }).next, null);
eq("nextDueDate ישירות: תיקון → null", nextDueDate(repairTask, { today: TODAY }), null);

const undone = undoComplete(rTest.completed, TODAY);
eq("ביטול הסימון מחזיר את המשימה לרשימה", undone.completedAt, null);
ok("ומחזיר לה תזכורת", undone.schedule.nextFireAt !== undefined);

// ============================================================================
section("11. טיפול — הק\"מ מייצר תאריך מוערך, ונופל בשקט כשאין נתונים");
// ============================================================================

const readings = [
  createOdometerReading({ householdId: HID, vehicleId: "v1", date: "2026-01-01", km: 100000 }),
  createOdometerReading({ householdId: HID, vehicleId: "v1", date: "2026-07-01", km: 110000 }),
];
ok("קצב מחושב משתי קריאות", kmPerDay(readingsForVehicle(readings, "v1")) > 50);
eq("קריאה אחת → אין קצב (נופלים לזמן בלבד)", kmPerDay([readings[0]]), null);
eq("אין קריאות → אין קצב", kmPerDay([]), null);

const dueKm = nextServiceDue({ id: "v1" }, readings, { lastServiceDate: "2026-06-01", lastServiceKm: 105000, intervalKm: 15000, intervalMonths: 12 }, TODAY);
eq("יעד ק\"מ = אחרון + מרווח", dueKm.kmDue, 120000);
ok("יש הערכת תאריך לפי ק\"מ", isDay(dueKm.estimatedKmDate));
eq("המוקדם מבין השניים נבחר", dueKm.effectiveDate, minDay(dueKm.dateDue, dueKm.estimatedKmDate));
eq("והבסיס מסומן km", dueKm.basis, "km");
ok("hasKmData=true", dueKm.hasKmData);

const dueNoKm = nextServiceDue({ id: "v1" }, [readings[0]], { lastServiceDate: "2026-06-01", lastServiceKm: 105000 }, TODAY);
eq("בלי מספיק קריאות — אין הערכת ק\"מ", dueNoKm.estimatedKmDate, null);
eq("ונשענים על התאריך בלבד", dueNoKm.effectiveDate, "2027-06-01");
eq("הבסיס date", dueNoKm.basis, "date");
eq("ושורת הקופי מבקשת בעדינות לעדכן", serviceKmLine(dueNoKm).key, "engine.service.km.noData");
eq("כשעברו את הק\"מ — שורה אחרת", serviceKmLine({ kmDue: 120000, hasKmData: true, lastKm: 125000 }).key, "engine.service.km.reached");
eq("אחרת — הערכה", serviceKmLine({ kmDue: 120000, hasKmData: true, lastKm: 111000 }).key, "engine.service.km.estimate");

const serviceTask = createTask({ householdId: HID, vehicleId: "v1", type: "service", dueDate: "2026-08-01" });
const rSvc = completeTask(serviceTask, { completedDate: TODAY, completedKm: 112000, today: TODAY, readings, vehicle: { id: "v1" } });
ok("טיפול: יש משימה הבאה", rSvc.next !== null);
ok("והתאריך שלה הוא המוקדם מבין זמן לק\"מ", rSvc.next.dueDate <= addMonths(TODAY, 12));

// ============================================================================
section("12. משרד התחבורה — מול תגובות אמיתיות מוקלטות, בלי רשת");
// ============================================================================

const fx = (name) => JSON.parse(fs.readFileSync(path.join(HERE, "fixtures", `${name}.json`), "utf8"));
const fxActive = fx("mot-active");
const fxInactive = fx("mot-inactive");
const fxNotFound = fx("mot-notfound");

// ★ החוד: mispar_rechev הוא numeric, ולכן אפסים מובילים חייבים לרדת.
eq('normalizePlate("012-34-567")', normalizePlate("012-34-567"), "1234567");
eq("normalizePlate מסיר מקפים ורווחים", normalizePlate(" 12-345-67 "), "1234567");
eq("normalizePlate על 8 ספרות", normalizePlate("687-08-404"), "68708404");
eq("normalizePlate על ריק", normalizePlate(""), "");
eq("digitsOf שומר את האפסים לצורך אימות אורך", digitsOf("012-34-567"), "01234567");
ok("7 ספרות תקין", isValidPlate("1234567"));
ok("8 ספרות תקין", isValidPlate("12345678"));
ok("2 ספרות לא תקין", !isValidPlate("12"));
ok("9 ספרות לא תקין", !isValidPlate("123456789"));
eq("formatPlate 7 ספרות", formatPlate("1234567"), "12-345-67");
eq("formatPlate 8 ספרות", formatPlate("68708404"), "687-08-404");

const url = buildLookupUrl({ resourceId: MOT.ACTIVE, plate: "012-34-567" });
ok("ה-URL משתמש ב-filters (התאמה מדויקת)", url.includes("filters="));
ok("ולא ב-q (חיפוש חופשי שיכול להחזיר רכב אחר)", !/[?&]q=/.test(url));
ok("ה-URL מכיל את המספר בלי אפסים מובילים", decodeURIComponent(url).includes('{"mispar_rechev":1234567}'));

const active = mapActiveRecord(fxActive.result.records[0], "68708404");
eq("★ tokef_dt → testValidUntil", active.testValidUntil, "2027-08-01");
eq("mivchan_acharon_dt → lastTestDate", active.lastTestDate, "2026-08-02");
eq("tozeret_nm → manufacturer", active.manufacturer, "ג'אקו סין");
eq("kinuy_mishari → commercialName", active.commercialName, "JAECOO 7 PHEV");
eq("degem_nm → model", active.model, "BBDE");
eq("shnat_yitzur → year", active.year, 2026);
eq("tzeva_rechev → color", active.color, "שנהב לבן");
eq("sug_delek_nm → fuelType", active.fuelType, "חשמל/בנזין");
eq("baalut → ownershipType", active.ownershipType, "ליסינג");
eq("status פעיל", active.status, "active");
// ★ ה-whitelist: המאגר מחזיר misgeret, והמודל שלנו לא.
ok("אין מפתח misgeret בפלט", !("misgeret" in active));
ok("אין מפתח vin בפלט", !("vin" in active));
eq("אין שום שדה אסור בפלט המיפוי", Object.keys(active).filter((k) => FORBIDDEN_FIELDS.includes(k)), []);
ok("המאגר עצמו כן מחזיר misgeret — כלומר ה-whitelist באמת עובד", "misgeret" in fxActive.result.records[0]);

const inactive = mapInactiveRecord(fxInactive.result.records[0], "9318684");
eq("רכב מבוטל → status deregistered", inactive.status, "deregistered");
eq("bitul_dt → deregisteredAt", inactive.deregisteredAt, "2026-07-17");
ok("גם כאן אין misgeret", !("misgeret" in inactive));

// זרימה מלאה מול fixtures — fetchImpl מוזרק, בלי רשת.
function fakeFetch(map) {
  return async (u) => {
    const isActive = u.includes(MOT.ACTIVE);
    return { ok: true, json: async () => (isActive ? map.active : map.inactive) };
  };
}
const foundActive = await lookupVehicle("687-08-404", { fetchImpl: fakeFetch({ active: fxActive, inactive: fxNotFound }) });
eq("נמצא במאגר הפעילים", foundActive.source, "active");
eq("והתאריך שיזרע את משימת הטסט", foundActive.vehicle.testValidUntil, "2027-08-01");
const foundInactive = await lookupVehicle("9318684", { fetchImpl: fakeFetch({ active: fxNotFound, inactive: fxInactive }) });
eq("לא בפעילים → מחפשים במבוטלים", foundInactive.source, "inactive");
eq("ומסמנים deregistered", foundInactive.vehicle.status, "deregistered");
const notFound = await lookupVehicle("1111111", { fetchImpl: fakeFetch({ active: fxNotFound, inactive: fxNotFound }) });
eq("לא נמצא בשניהם → notFound (ולא חריגה)", notFound.reason, "notFound");
const invalid = await lookupVehicle("12", { fetchImpl: fakeFetch({ active: fxActive, inactive: fxActive }) });
eq("רישוי לא תקין → invalid, בלי לגעת ברשת", invalid.reason, "invalid");
const netErr = await lookupVehicle("1234567", {
  fetchImpl: async () => {
    throw new Error("boom");
  },
});
eq("שגיאת רשת → network, בלי לזרוק", netErr.reason, "network");
ok("ובלי לחשוף את גוף התגובה", !("raw" in netErr));

eq("motSource מינימלי — שלושה שדות בלבד", Object.keys(motSourceFrom(foundActive)).sort(), ["fetchedAt", "found", "resourceId"]);
ok("ואין בו raw", !("raw" in motSourceFrom(foundActive)));

// ★ המאגר ממלא ריק, ולעולם לא דורס בשקט
const mine = createVehicle({ householdId: HID, plate: "1234567", testValidUntil: "2026-12-01", color: "" });
const merged = mergeMotIntoVehicle(mine, { testValidUntil: "2027-08-01", color: "לבן", manufacturer: "מאזדה" });
ok("שדה ריק מולא", merged.filled.includes("color") && merged.vehicle.color === "לבן");
eq("שדה שהמשתמש הזין **לא** נדרס", merged.vehicle.testValidUntil, "2026-12-01");
ok("אלא מדווח כהתנגשות להכרעת המשתמש", merged.conflicts.some((c) => c.field === "testValidUntil"));

// ============================================================================
section("13. N4 — התפקיד נקרא מ-members, לעולם לא מהשוואת מזהים");
// ============================================================================

const household = createHousehold({ id: HID, ownerUid: OWNER });
eq("היוצר נרשם כבעלים במפה", roleOf(household, OWNER), "owner");
ok("isOwner לפי המפה", isOwner(household, OWNER));
ok("מי שלא במפה אינו בעלים", !isOwner(household, KID));
ok("ולא חבר", !isMember(household, KID));
// זה המבחן האמיתי: hid זהה ל-uid, והתפקיד עדיין נקבע רק לפי המפה.
const squatted = createHousehold({ id: OWNER, ownerUid: "someone_else" });
ok("hid ששווה ל-uid **לא** הופך אותו לבעלים", !isOwner(squatted, OWNER));
ok("אלא מי שרשום במפה", isOwner(squatted, "someone_else"));
// בעלים שני (בני זוג) — נתמך מבנית בלי הגירה
const twoOwners = { ...household, members: { ...household.members, uid_spouse: "owner" } };
eq("בעלים שני נתמך מבנית", owners(twoOwners).sort(), [OWNER, "uid_spouse"].sort());
ok("canEdit נגזר מהמפה", canEdit(twoOwners, "uid_spouse") && !canEdit(twoOwners, KID));
ok("canWriteGuardianFields — בעלים בלבד (N7)", canWriteGuardianFields(household, OWNER) && !canWriteGuardianFields(household, KID));

// ============================================================================
section("14. בידוד — מי קורא מה");
// ============================================================================

const v1 = createVehicle({ id: "v1", householdId: HID, plate: "1111111" });
const v2 = createVehicle({ id: "v2", householdId: HID, plate: "2222222" });
const accessV1 = createVehicleAccess({ householdId: HID, driverUid: KID, driverId: driver.id, vehicleId: "v1" });
const world = { vehicles: [v1, v2], vehicleAccess: [accessV1] };

eq("מזהה מורכב, כדי ש-rules יוכלו לבנות אותו מהבקשה", vehicleAccessId(KID, "v1"), `${KID}__v1`);
eq("בלי מזהה — null", vehicleAccessId(null, "v1"), null);
ok("★ נהג עם גישה לרכב א' קורא אותו", canReadVehicle(world, household, KID, "v1"));
ok("★ ואינו קורא את רכב ב'", !canReadVehicle(world, household, KID, "v2"));
ok("הבעלים קורא את שניהם", canReadVehicle(world, household, OWNER, "v1") && canReadVehicle(world, household, OWNER, "v2"));
eq("רשימת הרכבים של הנהג", vehicleIdsForUid(world, household, KID), ["v1"]);
eq("ושל הבעלים — הכול", vehicleIdsForUid(world, household, OWNER).sort(), ["v1", "v2"]);
ok("hasVehicleAccess ישירות", hasVehicleAccess(world, KID, "v1") && !hasVehicleAccess(world, KID, "v2"));

// ★ vehiclesPrivate — בעלים בלבד, לתמיד
ok("★ אף אחד לא קורא vehiclesPrivate חוץ מהבעלים", canReadVehiclePrivate(household, OWNER) && !canReadVehiclePrivate(household, KID));
ok("vehiclesPrivate אינו קריא לנהג בתצורה", ownerOnlyCollectionsAreDenied());
eq("OWNER_ONLY_COLLECTIONS מכיל vehiclesPrivate", OWNER_ONLY_COLLECTIONS, ["vehiclesPrivate"]);

// ★ personalDocs — גם הבעלים לא קורא
const kidDoc = createPersonalDoc({ householdId: HID, driverId: driver.id, driverUid: KID });
ok("★ הבעלים **לא** קורא personalDocs של נהג", !canReadPersonalDoc(kidDoc, OWNER));
ok("נושא המידע כן קורא", canReadPersonalDoc(kidDoc, KID));
ok("אבל הבעלים כן מוחק (לצורך cascade)", canDeletePersonalDoc(household, kidDoc, OWNER));
ok("personalDocs אינו קריא לנהג אחר בתצורה", subjectOnlyCollectionsAreDenied());
eq("SUBJECT_ONLY_COLLECTIONS", SUBJECT_ONLY_COLLECTIONS, ["personalDocs"]);
ok("reminderLog חסום לקליינט", serverOnlyCollectionsAreDenied() && SERVER_ONLY_COLLECTIONS.includes("reminderLog"));

// מסמכי רכב — shared מול owner
const sharedDoc = createDocument({ householdId: HID, vehicleId: "v1", type: "vehicleLicence" });
const ownerDoc = createDocument({ householdId: HID, vehicleId: "v1", type: "receipt" });
ok("נהג קורא מסמך shared של הרכב שלו", canReadDocument(world, household, KID, sharedDoc));
ok("★ ולא מסמך owner — גם על אותו רכב", !canReadDocument(world, household, KID, ownerDoc));
const sharedDocV2 = createDocument({ householdId: HID, vehicleId: "v2", type: "vehicleLicence" });
ok("ולא מסמך shared של רכב אחר", !canReadDocument(world, household, KID, sharedDocV2));

// O7 — מיזעור כרטיס החירום
const contact = ownerContactProjection({ displayName: "רונן", phone: "0500000000", email: "x@y.z", address: "רחוב" });
eq("פרטי הבעלים בכרטיס החירום = שם + טלפון בלבד", Object.keys(contact).sort(), ["name", "phone"]);
ok("בלי מייל ובלי כתובת", !("email" in contact) && !("address" in contact));

// ============================================================================
section("15. Storage — ארבעה דומיינים, ו-null כשחסר מזהה");
// ============================================================================

eq(
  "דומיין shared",
  storagePath({ domain: STORAGE_DOMAINS.shared, hid: HID, vehicleId: "v1", docId: "d1", fileName: "a b.jpg" }),
  "households/hh1/vehicles/v1/shared/d1_a_b.jpg"
);
eq(
  "דומיין owner",
  storagePath({ domain: STORAGE_DOMAINS.owner, hid: HID, vehicleId: "v1", docId: "d1", fileName: "p.pdf" }),
  "households/hh1/vehicles/v1/owner/d1_p.pdf"
);
eq(
  "דומיין photo",
  storagePath({ domain: STORAGE_DOMAINS.photo, hid: HID, vehicleId: "v1", docId: "ph", fileName: "car.jpg" }),
  "households/hh1/vehicles/v1/photo/ph_car.jpg"
);
eq(
  "דומיין personal — ממופתח באדם, לא ברכב",
  storagePath({ domain: STORAGE_DOMAINS.personal, hid: HID, driverId: "drv1", docId: "pd", fileName: "lic.jpg" }),
  "households/hh1/people/drv1/docs/pd_lic.jpg"
);
eq("★ חסר vehicleId → null, לא נתיב שטוח", storagePath({ domain: STORAGE_DOMAINS.shared, hid: HID, fileName: "x.jpg" }), null);
eq("★ חסר driverId → null", storagePath({ domain: STORAGE_DOMAINS.personal, hid: HID, fileName: "x.jpg" }), null);
eq("דומיין לא מוכר → null", storagePath({ domain: "whatever", hid: HID, vehicleId: "v1" }), null);
ok("ארבעה דומיינים בדיוק", Object.keys(STORAGE_DOMAINS).length === 4);

// O6 — סוגי קובץ וגודל
ok("תמונות ו-PDF בלבד", isAcceptedType("image/jpeg") && isAcceptedType("application/pdf") && !isAcceptedType("application/zip"));
eq("ACCEPTED_TYPES מכיל 4 סוגים", ACCEPTED_TYPES.split(",").length, 4);
eq("קובץ מסוג לא נתמך נחסם", validateFile({ type: "application/zip", size: 100 }, { local: false }).errorKey, "error.upload.type");
eq("קובץ גדול מדי נחסם", validateFile({ type: "image/jpeg", size: 50 * 1024 * 1024 }, { local: false }).errorKey, "error.upload.tooLarge");
ok("קובץ תקין עובר", validateFile({ type: "image/jpeg", size: 1000 }, { local: false }).ok);

// ★ הכרעת המוצר: מסמכים אישיים חסומים במצב מקומי
ok("מסמכים אישיים חסומים במצב מקומי", !personalDocsAllowed({ local: true }));
ok("ומותרים כשמחוברים", personalDocsAllowed({ local: false }));
eq(
  "וההודעה היא של שירה, לא שגיאה טכנית",
  validateFile({ type: "image/jpeg", size: 1000 }, { local: true, domain: STORAGE_DOMAINS.personal }).errorKey,
  "error.localMode.docs"
);
ok("תמונת רכב במצב מקומי — בסדר", validateFile({ type: "image/jpeg", size: 1000 }, { local: true, domain: STORAGE_DOMAINS.photo }).ok);

// ============================================================================
section("16. N1 — cascade תלת-צלעי, ומפתח מטמון שכולל uid");
// ============================================================================

eq("★ מפתח המטמון כולל את ה-uid", emergencyCacheKey(OWNER, "v1"), `nrcar:emergency:${OWNER}:v1`);
ok("מפתח בלי uid לא נבנה", emergencyCacheKey(null, "v1") === null);
ok("keyBelongsToUid מבדיל בין משתמשים", keyBelongsToUid(emergencyCacheKey(OWNER, "v1"), OWNER) && !keyBelongsToUid(emergencyCacheKey(OWNER, "v1"), KID));

const withFiles = {
  vehicles: [{ ...v1, photoRef: makeFileRef({ storagePath: "households/hh1/vehicles/v1/photo/p.jpg" }) }, v2],
  vehiclesPrivate: [createVehiclePrivate("v1", { householdId: HID })],
  drivers: [driver],
  vehicleAccess: [accessV1],
  tasks: [createTask({ householdId: HID, vehicleId: "v1", type: "test", dueDate: TODAY })],
  documents: [
    { ...sharedDoc, fileRef: makeFileRef({ storagePath: "households/hh1/vehicles/v1/shared/d1.jpg" }) },
    { ...createDocument({ householdId: HID, vehicleId: "v2", type: "receipt" }), fileRef: makeFileRef({ storagePath: "households/hh1/vehicles/v2/owner/r.pdf" }) },
  ],
  personalDocs: [{ ...kidDoc, fileRef: makeFileRef({ storagePath: "households/hh1/people/drv1/docs/lic.jpg" }) }],
  serviceRecords: [serviceRec],
  odometerReadings: readings,
};

eq("נתיבי Storage של רכב — תמונה + מסמכים", collectVehicleStoragePaths(withFiles, "v1").sort(), [
  "households/hh1/vehicles/v1/photo/p.jpg",
  "households/hh1/vehicles/v1/shared/d1.jpg",
]);
eq("נתיבי Storage של נהג — המסמכים האישיים", collectDriverStoragePaths(withFiles, driver.id), ["households/hh1/people/drv1/docs/lic.jpg"]);

// ★ כל ישות עם fileRef חייבת להיתפס על ידי איזשהו collect*
const allRefs = [
  ...withFiles.vehicles.map((v) => v.photoRef?.storagePath),
  ...withFiles.documents.map((d) => d.fileRef?.storagePath),
  ...withFiles.personalDocs.map((d) => d.fileRef?.storagePath),
].filter(Boolean);
const collected = collectHouseholdStoragePaths(withFiles);
eq("★ אין קובץ שנשאר יתום אחרי מחיקת משק בית", allRefs.filter((p) => !collected.includes(p)), []);

const archived = archiveVehicle(withFiles, "v1");
eq("ארכוב ≠ מחיקה — הרכב נשאר", archived.vehicles.find((v) => v.id === "v1").status, "archived");
ok("והמסמכים נשארים", archived.documents.length === withFiles.documents.length);
ok("אבל התזכורות מושתקות", archived.tasks.every((t) => t.vehicleId !== "v1" || t.schedule.muted));
eq("שחזור מחזיר לפעיל", restoreVehicle(archived, "v1").vehicles.find((v) => v.id === "v1").status, "active");

const removed = removeVehicleCascade(withFiles, "v1");
eq("מחיקת רכב — הרכב", removed.vehicles.length, 1);
eq("והמסמך הפרטי שלו", removed.vehiclesPrivate.length, 0);
eq("וההרשאות", removed.vehicleAccess.length, 0);
eq("והמשימות", removed.tasks.length, 0);
eq("והמסמכים", removed.documents.length, 1);
eq("וקריאות המד", removed.odometerReadings.length, 0);
eq("מחיקת מסמך", removeDocument(withFiles, withFiles.documents[0].id).documents.length, 1);
eq("מחיקת מסמך אישי", removePersonalDoc(withFiles, kidDoc.id).personalDocs.length, 0);
const noDriver = removeDriverCascade(withFiles, driver.id);
eq("מחיקת נהג מורידה את ההרשאות", noDriver.vehicleAccess.length, 0);
eq("ואת המסמכים האישיים", noDriver.personalDocs.length, 0);
const cleared = clearHouseholdData(withFiles);
ok("מחיקת משק בית מרוקנת את כל האוספים", ENTITY_COLLECTIONS.every((c) => (cleared[c] || []).length === 0));

const anon = anonymizeDriver(withFiles, driver.id);
eq("אנונימיזציה מוחקת את המסמכים האישיים", anon.data.personalDocs.length, 0);
eq("ומחזירה את הנתיבים למחיקה מ-Storage", anon.storagePaths.length, 1);
eq("והנהג מסומן archived", anon.data.drivers[0].status, "archived");

// ============================================================================
section("17. N6 — ייצוא ומחיקת חשבון על אותו cascade");
// ============================================================================

const exported = exportHousehold({ ...withFiles, household, settings: EMPTY.settings, schemaVersion: 1 }, { profile });
ok("הייצוא כולל את כל האוספים", ENTITY_COLLECTIONS.every((c) => Array.isArray(exported.json[c])));
ok("ואת הפרופיל (כולל היסטוריית היידוע)", exported.json.profile.notices.length === 2);
ok("ואת רשימת הקבצים", exported.files.length === 4);
const plan = deleteHouseholdPlan(withFiles);
eq("תוכנית המחיקה מונה את כל האוספים", plan.collections.length, ENTITY_COLLECTIONS.length);
ok("ומראה כמה קבצים יימחקו", plan.storagePaths.length === 4);
ok("וכמה רשומות", plan.total > 0);

// ============================================================================
section("18. תוויות — {vehicle} הוא הכינוי, לעולם לא מספר רישוי");
// ============================================================================

eq("כינוי מנצח", vehicleLabel({ nickname: "האוטו של אמא", manufacturer: "מאזדה", model: "3", plate: "1234567" }), "האוטו של אמא");
eq("בלי כינוי — יצרן + שם מסחרי", vehicleLabel({ manufacturer: "מאזדה", commercialName: "3", plate: "1234567" }), "מאזדה 3");
eq("בלי כינוי ובלי שם מסחרי — יצרן + דגם", vehicleLabel({ manufacturer: "מאזדה", model: "3", plate: "1234567" }), "מאזדה 3");
ok("★ מספר רישוי לעולם לא נכנס לתווית", !vehicleLabel({ plate: "1234567" }).includes("1234567"));
eq("בלי שום פרט — fallback ריק", vehicleLabel({ plate: "1234567" }), "");
eq("לוחית מוצגת מפורמטת (בתוך .num)", vehiclePlate({ plate: "1234567" }), "12-345-67");

// ============================================================================
section("19. ראוטר — hash, כדי שה-shortcut וכפתור ה-back יעבדו");
// ============================================================================

eq("בית", parseHash("#/").name, "home");
eq("בלי hash בכלל", parseHash("").name, "home");
eq("רכבים", parseHash("#/vehicles").name, "vehicles");
eq("הוספת רכב", parseHash("#/vehicles/new").name, "vehicleNew");
eq("רכב בודד", parseHash("#/vehicle/abc").params.id, "abc");
eq("משימה", parseHash("#/task/t1").params.id, "t1");
eq("מסמכים", parseHash("#/docs").name, "docs");
eq("★ החירום — היעד של ה-shortcut ב-manifest", parseHash("#/emergency").name, "emergency");
eq("הגדרות", parseHash("#/settings").name, "settings");
eq("נגישות", parseHash("#/settings/accessibility").name, "accessibility");
eq("יידוע", parseHash("#/settings/notice").name, "notice");
eq("מסלול לא מוכר", parseHash("#/nope/nope").name, "notFound");
eq("hrefFor", hrefFor("/emergency"), "#/emergency");

// ============================================================================
section("20. i18n — parity מלא בין he ל-en");
// ============================================================================

const heKeys = Object.keys(dict.he).sort();
const enKeys = Object.keys(dict.en).sort();
eq("אותו מספר מפתחות", heKeys.length, enKeys.length);
const missingEn = heKeys.filter((k) => !(k in dict.en));
const missingHe = enKeys.filter((k) => !(k in dict.he));
eq("אין מפתח שקיים רק בעברית", missingEn, []);
eq("אין מפתח שקיים רק באנגלית", missingHe, []);
ok("אין ערך ריק בעברית", heKeys.every((k) => String(dict.he[k]).trim().length > 0));
ok("אין ערך ריק באנגלית", enKeys.every((k) => String(dict.en[k]).trim().length > 0));
console.log(`  (${heKeys.length} מפתחות בכל שפה)`);

// כל מפתח שהמנוע יכול לייצר — קיים בפועל
for (const type of ["test", "insurance", "service", "repair", "other"]) {
  for (const bucket of ["d30", "d14", "d7", "d3", "d1", "d0", "overdue"]) {
    ok(`מפתח מנוע קיים: engine.${type}.${bucket}.title`, Boolean(dict.he[`engine.${type}.${bucket}.title`]));
  }
}
for (const type of ["test", "insurance", "service", "repair", "other"]) {
  ok(`ווריאנט .two בדלי d3: ${type}`, Boolean(dict.he[`engine.${type}.d3.title.two`]));
  ok(`ווריאנט .one ב-overdue: ${type}`, Boolean(dict.he[`engine.${type}.overdue.title.one`]));
}
ok("לביטוח יש שתי שורות overdue נפרדות", Boolean(dict.he["engine.insurance.overdue.sub.compulsory"]) && Boolean(dict.he["engine.insurance.overdue.sub.comprehensive"]));
ok("ולסוגים האחרים שורה אחת", Boolean(dict.he["engine.test.overdue.sub"]));

// נסיגת ווריאנט: מפתח .two שלא קיים נופל למפתח הבסיס
eq("נסיגה מ-.two למפתח הבסיס", translate("he", "engine.test.d7.title.two", { days: 2, vehicle: "x" }), translate("he", "engine.test.d7.title", { days: 2, vehicle: "x" }));
eq("מפתח חסר לגמרי מוחזר כפי שהוא (fail-visible)", translate("he", "no.such.key"), "no.such.key");
eq("החלפת משתנים", translate("he", "task.due", { date: "13.08.2026" }), "תאריך יעד: 13.08.2026");
eq("שתי שפות בלבד", LANGS, ["he", "en"]);

// ★ כלל אות השימוש של שירה: אסור להצמיד ב'/ל'/ה' ל-{vehicle} או ל-{title}
const glued = heKeys.filter((k) => /[בלהוכמש]\{(vehicle|title)\}/.test(dict.he[k]) && !/ו\{coverage\}/.test(dict.he[k]));
eq("★ אין אות שימוש מוצמדת ל-{vehicle}/{title}", glued, []);
// המילה "המערכת" אסורה בממשק (PRD §9.1)
eq('אין את המילה "המערכת" בשום מחרוזת', heKeys.filter((k) => String(dict.he[k]).includes("המערכת")), []);
// הכרעת עדי על נוסח האישור
eq('כפתור היידוע הוא "קראתי", לא "אני מסכים"', dict.he["legal.notice.cta"], "קראתי");
ok('ואין בשום מקום "אני מסכים"', !heKeys.some((k) => String(dict.he[k]).includes("אני מסכים")));
// O3 — הבהרת האמינות קיימת בקופי
ok("קיימת הבהרת אמינות (O3)", String(dict.he["legal.disclaimer.reminders"]).includes("עזר בלבד"));
// עדי: המדיניות **לא** מתיימרת ל-signed URLs בפרוסה 1
eq('אין טענה על "קישור חתום"', heKeys.filter((k) => /קישור חתום|signed url/i.test(String(dict.he[k]))), []);

// ============================================================================
section("21. סריקות סטטיות — מה שאי אפשר לבדוק בקריאה לפונקציה");
// ============================================================================

// (א) אין geolocation בשום מקום — ההחלטה הזאת נושאת משקל מעבר ל-EXIF:
//     היא מה ששומר על התשובה "אין ניטור שיטתי" ומרחיק את חובת ה-DPO.
const geoHits = SRC_FILES.filter((f) => readCode(f).includes("navigator.geolocation"));
eq("★ אין navigator.geolocation בשום קובץ", geoHits.map((f) => path.relative(ROOT, f)), []);

// (ב) מחלקות אסורות: text-xs לא קיים בקונפיג, ו-slate-400 נכשל בניגודיות.
const FORBIDDEN_CLASSES = [
  "text-xs",
  "text-slate-400",
  "text-gray-400",
  "text-stone-400",
  "text-slate-500",
  "placeholder:text-slate-400",
];
const jsxFiles = SRC_FILES.filter((f) => f.endsWith(".jsx"));
ok("יש קובצי jsx לסרוק", jsxFiles.length > 0);
for (const cls of FORBIDDEN_CLASSES) {
  const hits = jsxFiles.filter((f) => readCode(f).includes(cls));
  eq(`★ אין ${cls} בשום jsx`, hits.map((f) => path.basename(f)), []);
}
// ובקונפיג עצמו: fontSize ברמת theme, לא ב-extend
const tw = fs.readFileSync(path.join(ROOT, "tailwind.config.js"), "utf8");
const themeIdx = tw.indexOf("theme:");
const extendIdx = tw.indexOf("extend:");
const fontSizeIdx = tw.indexOf("fontSize:");
ok("★ fontSize יושב ב-theme ולא ב-extend (כך text-xs פשוט לא נפלט)", fontSizeIdx > themeIdx && fontSizeIdx < extendIdx);
ok("ואין xs בסקאלה", !/\bxs:\s*\[/.test(tw));

// (ג) viewport — זום תמיד מותר (WCAG 1.4.4)
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const viewport = html.match(/<meta name="viewport"[^>]*>/)?.[0] || "";
ok("יש meta viewport", viewport.length > 0);
ok("★ אין user-scalable", !viewport.includes("user-scalable"));
ok("★ אין maximum-scale", !viewport.includes("maximum-scale"));
ok('lang="he" dir="rtl" על <html>', html.includes('lang="he"') && html.includes('dir="rtl"'));

// (ד) N2 — getDownloadURL בקובץ אחד בלבד
const gdHits = SRC_FILES.filter((f) => readCode(f).includes("getDownloadURL")).map((f) => path.relative(SRC, f).replace(/\\/g, "/"));
eq("★ getDownloadURL מופיע רק ב-utils/files.js", gdHits, ["utils/files.js"]);
ok("ו-openSensitiveDocument הוא נקודת המעבר היחידה (ה-seam של O9)", readSrc("utils/files.js").includes("export async function openSensitiveDocument"));

// (ה) N4 — אף כלל לא משווה hid ל-request.auth.uid
const rulesFiles = ["firestore.rules", "storage.rules"];
for (const rf of rulesFiles) {
  const txt = stripComments(fs.readFileSync(path.join(ROOT, rf), "utf8"));
  const bad = /(hid|householdId)\s*==\s*request\.auth\.uid|request\.auth\.uid\s*==\s*(hid|householdId)/.test(txt);
  ok(`★ ${rf}: אין השוואת hid ל-request.auth.uid`, !bad);
  ok(`${rf}: התפקיד נקרא ממפת ה-members`, txt.includes("members.get(request.auth.uid"));
  ok(`${rf}: deny-by-default בסוף`, /allow read, write: if false;/.test(txt));
}
const fsRules = fs.readFileSync(path.join(ROOT, "firestore.rules"), "utf8");
ok("firestore.rules: personalDocs read = driverUid == auth.uid", /personalDocs[\s\S]{0,400}allow read: if isSignedIn\(\) && resource\.data\.driverUid == request\.auth\.uid/.test(fsRules));
// reminderLog — הבעלים קורא ("למה לא קיבלתי תזכורת?"), הקליינט לעולם לא כותב.
ok("firestore.rules: reminderLog — כתיבה חסומה מהקליינט", /reminderLog[\s\S]{0,220}allow write: if false;/.test(fsRules));
ok("firestore.rules: notices append-only (N5)", fsRules.includes("request.resource.data.notices.size() >= resource.data.notices.size()"));
ok("firestore.rules: guardianConsent append-only (N7)", fsRules.includes("guardianFieldsAppendOnly"));
ok("firestore.rules: הזמנת קטין חסומה בלי הסכמה (N7)", fsRules.includes("minorInviteBlocked"));
const stRules = fs.readFileSync(path.join(ROOT, "storage.rules"), "utf8");
for (const d of ["/shared/", "/owner/", "/photo/", "/people/"]) {
  ok(`storage.rules: הדומיין ${d} קיים בנתיב`, stRules.includes(d));
}
ok("storage.rules: הגבלת contentType (O6)", stRules.includes("request.resource.contentType.matches"));
ok("storage.rules: הגבלת גודל (O6)", stRules.includes("request.resource.size <"));

// ============================================================================
// 🔴🔴 מלכודת הכללים האדיטיביים — הבאג שהאמולטור תפס.
//
// **כללי Storage הם OR של כל הכללים שמתאימים.** כלל ספציפי שאוסר **אינו**
// גובר על כלל רחב שמתיר. "רשת ביטחון" בנוסח
// `match /households/{hid}/{allPaths=**} { allow read: if isOwner(hid) }`
// נתנה לבעלים קריאה על `people/{driverId}/docs/` — כלומר **ביטלה בשקט את כל
// בידוד המסמכים האישיים**, והבעלים יכול היה לקרוא סריקת רישיון נהיגה של כל
// נהג. שום סריקה סטטית ושום code review לא תפסו את זה; רק ההרצה.
//
// האסרשן: אין ב-storage.rules כלל רחב עם `{allPaths=**}` שמעניק הרשאה —
// למעט ה-deny הגורף האחרון.
// ============================================================================
// נסרק בשני הקבצים, ועל שתי צורות ה-wildcard.
function broadGrantsIn(rulesText) {
  const lines = stripComments(rulesText).split("\n");
  const out = [];
  lines.forEach((line, i) => {
    // ⚠️ `[^\n]*` ולא `[^{]*`: הנתיב עצמו מכיל `{hid}` **לפני** ה-wildcard
    // (`/households/{hid}/{allPaths=**}`), ומחלקת תווים ששוללת `{` נעצרת שם
    // ומפספסת בדיוק את הכלל המסוכן. נתפס ב-mutation test, לא בקריאה.
    if (!/match\s+\/[^\n]*\{(allPaths|document|other)\s*=\s*\*\*\}/.test(line)) return;
    const body = lines.slice(i, i + 6).join(" ");
    if (/allow\s+[a-z, ]+:\s*if\s+(?!false)/.test(body)) out.push(line.trim());
  });
  return out;
}
eq("★★ אין כלל רחב מתיר ב-storage.rules (מלכודת ה-OR)", broadGrantsIn(stRules), []);
eq("★★ ואין גם ב-firestore.rules", broadGrantsIn(fsRules), []);
for (const rf of rulesFiles) {
  const txt = fs.readFileSync(path.join(ROOT, rf), "utf8");
  ok(`${rf}: אזהרת האדיטיביות בראש הקובץ`, txt.slice(0, 1400).includes("אדיטיביים"));
}
ok(
  "★ ותיעוד הסיבה נשאר בקובץ כדי שלא תוחזר",
  fs.readFileSync(path.join(ROOT, "storage.rules"), "utf8").includes("אדיטיביים")
);
// גישה למפתח חסר במפה זורקת שגיאת הערכה — משתמשים ב-get עם ברירת מחדל.
for (const rf of rulesFiles) {
  const txt = stripComments(fs.readFileSync(path.join(ROOT, rf), "utf8"));
  // אינדוקס ישיר מותר **רק** על `request.resource.data` (המסמך הנכנס), שם
  // `hasOnly()` כבר מבטיח שהמפתח קיים. על המסמך **השמור** — לעולם לא:
  // מפתח חסר במפה זורק שגיאת הערכה.
  const badIndexing = txt
    .split("\n")
    .filter((l) => l.includes("members[request.auth.uid]") && !l.includes("request.resource.data"));
  eq(`${rf}: אין אינדוקס ישיר על המסמך השמור`, badIndexing.map((l) => l.trim()), []);
}
// ============================================================================
// ★ הבדיקה **ההפוכה** — הפער שהממצא של האמולטור חשף.
//
// הלולאה "לכל אוסף ב-ENTITY_COLLECTIONS יש כלל" לא תתפוס אוסף שקיים ב-rules
// אבל **אינו ברשימה** — והוא גם ייפול מ-deleteHousehold() ומ-exportHousehold().
// זה כשל fleet, במראה. לכן: כל אוסף שמופיע ב-firestore.rules חייב להיות
// ב-ENTITY_COLLECTIONS או ב-SERVER_ONLY_COLLECTIONS.
// ============================================================================
const ROOT_LEVEL_PATHS = ["households", "memberships", "users", "databases"];
const rulesCollections = [...new Set([...stripComments(fsRules).matchAll(/match\s+\/(\w+)\/\{/g)].map((m) => m[1]))]
  .filter((c) => !ROOT_LEVEL_PATHS.includes(c));
ok("נמצאו אוספים ב-rules לבדיקה", rulesCollections.length > 0, rulesCollections);
eq(
  "★★ כל אוסף ב-rules מוכר לאחת משתי הרשימות",
  rulesCollections.filter((c) => !ALL_COLLECTIONS.includes(c)),
  []
);
eq(
  "★ ובכיוון השני — לכל אוסף ברשימות יש כלל ב-rules",
  ALL_COLLECTIONS.filter((c) => !rulesCollections.includes(c)),
  []
);
eq("SERVER_ONLY_COLLECTIONS — יומן התזכורות ולוג הגישה", SERVER_ONLY_COLLECTIONS, ["reminderLog", "accessLog"]);
ok("ו-ALL_COLLECTIONS הוא איחוד שתיהן", ALL_COLLECTIONS.length === ENTITY_COLLECTIONS.length + SERVER_ONLY_COLLECTIONS.length);

// ★ המעבר של הייצוא והמחיקה עובר על **שתי** הרשימות.
const exportedAll = exportHousehold({ ...deepEmpty(), reminderLog: [], accessLog: [] });
ok("★ הייצוא כולל גם אוסף שרת-בלבד", ALL_COLLECTIONS.every((c) => Array.isArray(exportedAll.json[c])), Object.keys(exportedAll.json));
const planAll = deleteHouseholdPlan({ ...deepEmpty(), reminderLog: [], accessLog: [] });
ok("★ תוכנית המחיקה סופרת גם אותו", "reminderLog" in planAll.counts);
eq("★★ ומסמנת מה דורש מחיקה בצד השרת", planAll.serverSideCollections, ["reminderLog", "accessLog"]);
ok("★ ומרימה דגל מפורש", planAll.requiresServerDeletion === true);

// -- reminderLog: הנמען בלבד קורא; הקליינט לעולם לא כותב -------------------
ok(
  "★★ reminderLog: read רק לנמען — לא לבעלים",
  /reminderLog[\s\S]{0,200}allow read: if isSignedIn\(\) && resource\.data\.recipientUid == request\.auth\.uid/.test(fsRules)
);
ok("★ reminderLog: write חסום מהקליינט", /reminderLog[\s\S]{0,260}allow write: if false/.test(fsRules));
ok("★ וההנמקה נשארת בקוד (מעקב נוכחות)", fsRules.includes("escalateToOwner"));
ok(
  "★ והאזהרה ש-write:false אינו מגן על התוכן",
  fsRules.includes("Admin SDK") && fsRules.includes("createReminderLogEntry")
);

// ============================================================================
// ★ משמעת השדות של reminderLog — נאכפת **כאן**, לא ב-rules.
// ה-Cloud Function כותבת ב-Admin SDK ועוקפת rules לחלוטין.
// ============================================================================
const rlog = createReminderLogEntry({
  householdId: HID,
  taskId: "t1",
  vehicleId: "v1",
  recipientUid: KID,
  step: 7,
  channel: "push",
  deliveryState: "sent",
  // ניסיון להבריח שדות אסורים — ה-factory הוא whitelist ולכן הם נופלים.
  phone: "0500000000",
  email: "x@y.z",
  fcmToken: "abc",
  rawResponse: { provider: "fcm", body: "..." },
  body: "הטסט של המאזדה בעוד 5 ימים",
  ip: "1.2.3.4",
  userAgent: "Mozilla",
  deviceModel: "Pixel",
});
eq("★★ אין שום שדה אסור ברשומת היומן", Object.keys(rlog).filter((k) => REMINDER_LOG_FORBIDDEN_FIELDS.includes(k)), []);
eq("★ וכל שדה שכן קיים — מותר במפורש", Object.keys(rlog).filter((k) => !REMINDER_LOG_FIELDS.includes(k)), []);
eq("★ recipientUid הוא מפתח ההרשאה", rlog.recipientUid, KID);
eq("★ הערוץ הוא סוג בלבד", rlog.channel, "push");
eq("ערוץ לא מוכר נזרק", createReminderLogEntry({ channel: "carrier-pigeon" }).channel, null);
eq("★ קוד השגיאה גס וקצוץ", createReminderLogEntry({ errorCode: "x".repeat(200) }).errorCode.length, 40);
eq("★ retentionClass תפעולי קצר-טווח", rlog.retentionClass, "operational-short");
ok("והמחלקה מוגדרת, עם המספר ⚖️ פתוח", RETENTION_CLASSES["operational-short"].months === null);
ok("ועם המלצה מתועדת", RETENTION_CLASSES["operational-short"].recommendedMonths === 12);
ok("★ אין גוף הודעה מרונדר", !JSON.stringify(rlog).includes("המאזדה"));
ok("★ ואין יעד — הוא יושב ב-users/{uid}.serviceChannels", !JSON.stringify(rlog).includes("0500000000"));

// (ו) כל שם אוסף שמועבר ל-upsert קיים ב-ENTITY_COLLECTIONS
const upsertNames = new Set();
for (const f of SRC_FILES) {
  const txt = readCode(f);
  for (const m of txt.matchAll(/upsert\(\s*"([^"]+)"/g)) upsertNames.add(m[1]);
}
eq("★ כל אוסף ב-upsert() מוכר", [...upsertNames].filter((n) => !ENTITY_COLLECTIONS.includes(n)), []);

// (ז) אין firebase deploy בשום סקריפט — הפרסום הוא פעולת משתמש
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
eq("★ אין 'firebase deploy' בסקריפטים", Object.values(pkg.scripts).filter((s) => s.includes("firebase deploy")), []);
ok("יש סקריפט smoke", Boolean(pkg.scripts.smoke));
ok("אין תלות חדשה מעבר לסטאק המוכח", Object.keys(pkg.dependencies).sort().join(",") === "firebase,lucide-react,react,react-dom");

// (ח) הבאג המתועד: onSnapshot עם deps [user?.uid] ו-early return
const useDataSrc = readSrc("hooks/useData.js");
ok("★ ה-effect של הענן תלוי ב-[user?.uid]", useDataSrc.includes("}, [user?.uid]);"));
ok("★ ויש early return לפני ההרשמה", useDataSrc.includes("if (!isFirebaseConfigured || !user) return;"));
ok("ההרשמה עצמה היא onSnapshot", readSrc("utils/firestoreSync.js").includes("onSnapshot"));

// (ט) N1 — purgeLocalCache מחווט לשלושת המסלולים
const useAuthSrc = readSrc("hooks/useAuth.js");
ok("★ purgeLocalCache נקראת ממסלול היציאה מהחשבון", /signOutUser[\s\S]{0,200}purgeLocalCache\(\)/.test(useAuthSrc));
ok("★ והמטמון של משתמש קודם מנוקה בהחלפת uid", useAuthSrc.includes("purgeOtherUsersCache"));
const useActionsSrc = readSrc("hooks/useActions.js");
ok("★ ומחיקת/ארכוב רכב או מסמך מנקה מטמון", useActionsSrc.includes("purgeVehicleCache") && useActionsSrc.includes("purgeLocalCache"));
ok("ומחיקת רכב מוחקת גם מ-Storage", useActionsSrc.includes("deleteStorageObjects"));

// (י) manifest — ה-shortcut לחירום
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "public", "manifest.webmanifest"), "utf8"));
eq("★ ל-manifest יש shortcut לחירום", manifest.shortcuts[0].url, "/#/emergency");
eq("dir/lang במניפסט", [manifest.lang, manifest.dir], ["he", "rtl"]);
ok("ארבעה אייקונים (any + maskable)", manifest.icons.length === 4);
for (const icon of manifest.icons) {
  ok(`האייקון קיים על הדיסק: ${icon.src}`, fs.existsSync(path.join(ROOT, "public", icon.src.replace(/^\//, ""))));
}

// ============================================================================
section("22. הכרעת עדי על ניסוח ה-overdue — נעולה");
// ============================================================================

// הנוסח שאושר, מילה במילה. אם מישהו "ילטש" אותו — הבדיקה תיפול.
eq(
  "ביטוח חובה: הכלל מיוחס לחוק",
  dict.he["engine.insurance.overdue.sub.compulsory"],
  "החוק אוסר לנהוג ברכב שאין לו ביטוח חובה בתוקף"
);
eq(
  "טסט: הכלל מיוחס לחוק",
  dict.he["engine.test.overdue.sub"],
  "לפי החוק, נהיגה ברכב מחייבת רישיון רכב (טסט) בתוקף"
);
ok("ולא נשאר הנוסח המהסס שנדחה", !heKeys.some((k) => String(dict.he[k]).includes("לא אמור להיות על הכביש")));

// ★ הפיצול בין חובה למקיף **נעול**: נהיגה בלי מקיף מותרת לחלוטין, ומיזוג
// שתי השורות הוא אמירה שגויה על החוק.
const comprehensiveKeys = heKeys.filter((k) => k.includes(".comprehensive"));
ok("יש מפתחות comprehensive לבדוק", comprehensiveKeys.length > 0);
eq(
  '★ שום מפתח comprehensive לא מכיל "החוק"',
  comprehensiveKeys.filter((k) => String(dict.he[k]).includes("החוק")),
  []
);
eq(
  '★ ושום מפתח comprehensive לא מכיל "אסור"',
  comprehensiveKeys.filter((k) => String(dict.he[k]).includes("אסור")),
  []
);
const comprehensiveEn = enKeys.filter((k) => k.includes(".comprehensive"));
eq(
  "★ וגם באנגלית — בלי law/prohibited",
  comprehensiveEn.filter((k) => /\b(law|prohibited|illegal)\b/i.test(String(dict.en[k]))),
  []
);

// ★ איסור מוחלט: שום מחרוזת לא תטען שטסט שפג **מבטל את הביטוח**.
// זה תלוי-פוליסה ומשתנה בין חברות. שירה לא כתבה את זה — וזה נעול כך שלא ייכנס.
const VOIDS_INSURANCE = ["מבטל את הביטוח", "הביטוח מתבטל", "מבטלת את הביטוח", "בלי כיסוי ביטוחי בגלל"];
eq(
  "★ אין טענה שטסט שפג מבטל את הביטוח (he)",
  heKeys.filter((k) => VOIDS_INSURANCE.some((p) => String(dict.he[k]).includes(p))),
  []
);
eq(
  "★ ואין גם באנגלית",
  enKeys.filter((k) => /(voids|invalidates|cancels)\s+(the\s+)?insurance/i.test(String(dict.en[k]))),
  []
);

// שורת ייחוס-העובדה — קיימת, ורק על משימה באיחור.
const insOver = createTask({ householdId: HID, vehicleId: "v1", type: "insurance", coverage: "compulsory", dueDate: addDays(TODAY, -2) });
eq("ביטוח באיחור → ייחוס לחברת הביטוח", attributionFor(insOver, null, TODAY).key, "engine.attribution.insurance");
const testOverMot = createTask({ householdId: HID, vehicleId: "v1", type: "test", dueDate: addDays(TODAY, -2) });
eq(
  "טסט באיחור עם נתוני מאגר → ייחוס למשרד התחבורה + תאריך",
  attributionFor(testOverMot, { motSource: { fetchedAt: "2026-08-01T10:00:00Z" } }, TODAY),
  { key: "engine.attribution.test", vars: { date: "2026-08-01" } }
);
eq("טסט באיחור בלי מאגר → ייחוס להזנה ידנית", attributionFor(testOverMot, {}, TODAY).key, "engine.attribution.manual");
eq("משימה שאינה באיחור → אין ייחוס", attributionFor(mk({ dueDate: addDays(TODAY, 5) }), {}, TODAY), null);
ok("לייחוס יש מחרוזת בשתי השפות", Boolean(dict.he["engine.attribution.test"]) && Boolean(dict.en["engine.attribution.test"]));

// פעולת התיקון בלחיצה אחת
eq("ביטוח → 'כבר חידשתי'", t2(fixActionKey(insOver)), "כבר חידשתי");
eq("טסט → 'עשיתי טסט'", t2(fixActionKey(testOverMot)), "עשיתי טסט");
eq("שאר הסוגים → גנרי", fixActionKey(mk({ type: "service" })), "task.fix.generic");

// הודעת הרישוי לא נוקבת במספר ספרות — כי הוולידציה מקבלת 5-8.
ok(
  "הודעת מספר רישוי לא סותרת את הוולידציה",
  !/\b[5-8]\b/.test(dict.he["vehicle.add.plate.error.invalid"])
);
ok("ועדיין מפנה לאן להסתכל", dict.he["vehicle.add.plate.error.invalid"].includes("רישיון הרכב"));

// נוסח "תרגול החירום" של עדי — שלושת המשפטים, ובמיוחד השני.
ok("תרגול חירום: המסך נפתח בלי סיסמה", dict.he["onboarding.drill.notice1"].includes("בלי סיסמה"));
ok("★ תרגול חירום: מי שמחזיק את הטלפון רואה אותו", dict.he["onboarding.drill.notice2"].includes("יכול לראות אותו"));
ok("תרגול חירום: אפשר להתנתק", dict.he["onboarding.drill.notice3"].includes("להתנתק"));
ok("opt-in ל-textAndDocs מבטיח מחיקה בהתנתקות", dict.he["settings.emergency.offline.docs.confirm.meaning"].includes("יימחק כשתתנתק"));

// ============================================================================
section("23. ★ זריעת המשימות — tokef_dt הופך למשימת טסט אמיתית");
// ============================================================================

const fetched = mapActiveRecord(fxActive.result.records[0], "68708404");
const seededVehicle = createVehicle({
  householdId: HID,
  plate: fetched.plate,
  manufacturer: fetched.manufacturer,
  commercialName: fetched.commercialName,
  testValidUntil: fetched.testValidUntil,
  compulsoryInsuranceUntil: "2026-11-01",
  comprehensiveInsuranceUntil: "2026-12-01",
});
const seeded = seedTasksForVehicle(seededVehicle, [], { today: TODAY });
const seededTest = seeded.find((x) => x.type === "test");
ok("★ נוצרה משימת טסט", Boolean(seededTest));
eq("★ ובתאריך שהגיע ממשרד התחבורה", seededTest.dueDate, "2027-08-01");
eq("והיא משויכת לרכב", seededTest.vehicleId, seededVehicle.id);
eq("עם התגית הנכונה", seededTest.tag, "authorities");
ok("ועם nextFireAt מחושב", isDay(seededTest.schedule.nextFireAt));
eq("נוצרו שתי משימות ביטוח נפרדות", seeded.filter((x) => x.type === "insurance").length, 2);
eq(
  "אחת לחובה ואחת למקיף",
  seeded.filter((x) => x.type === "insurance").map((x) => x.coverage).sort(),
  ["comprehensive", "compulsory"]
);
// ★ אין כפילות: הרצה שנייה על אותם נתונים לא מייצרת דבר.
eq("★ הרצה שנייה לא מייצרת כפילות", seedTasksForVehicle(seededVehicle, seeded, { today: TODAY }).length, 0);
eq("רכב בלי תאריכים — אין מה לזרוע", seedTasksForVehicle(createVehicle({ householdId: HID }), [], { today: TODAY }).length, 0);
// והזרימה המלאה: הסטטוס שיוצג בדשבורד
eq("משימת הטסט תוצג כפתוחה (התאריך רחוק)", computeStatus(seededTest, TODAY), "open");
eq("ובקרבת התאריך — מתקרבת", computeStatus({ ...seededTest, dueDate: addDays(TODAY, 20) }, TODAY), "upcoming");

// ============================================================================
section("24. 🔴 כרטיס החירום — מה שהוא לעולם לא מחזיר");
// ============================================================================

const emergencyData = {
  vehicles: [
    createVehicle({
      id: "ve1",
      householdId: HID,
      plate: "1234567",
      nickname: "האוטו של אמא",
      insurerName: "הראל",
      policyNumber: "123456789",
      insurerEmergencyPhone: "037777777",
    }),
  ],
  documents: [
    createDocument({ id: "d-lic", householdId: HID, vehicleId: "ve1", type: "vehicleLicence", fileRef: ref }),
    createDocument({ id: "d-comp", householdId: HID, vehicleId: "ve1", type: "compulsory", fileRef: ref }),
    // ★ פוליסה וקבלה — דומיין owner. הן **חייבות** להישאר בחוץ.
    createDocument({ id: "d-policy", householdId: HID, vehicleId: "ve1", type: "comprehensive", fileRef: ref }),
    createDocument({ id: "d-receipt", householdId: HID, vehicleId: "ve1", type: "receipt", fileRef: ref }),
  ],
  personalDocs: [
    createPersonalDoc({ id: "pd-me", householdId: HID, driverId: "drv-me", driverUid: OWNER, fileRef: ref }),
    // ★ רישיון הנהיגה של אדם אחר — **חייב** להישאר בחוץ.
    createPersonalDoc({ id: "pd-kid", householdId: HID, driverId: "drv-kid", driverUid: KID, fileRef: ref }),
  ],
  profile: { displayName: "רונן", phone: "0500000000", email: "x@y.z", address: "רחוב כלשהו" },
};

const card = buildEmergencyCard({
  data: emergencyData,
  vehicleId: "ve1",
  uid: OWNER,
  profile: emergencyData.profile,
});

ok("הכרטיס נבנה", Boolean(card));
eq("מספר הרישוי מפורמט (הפריט הגדול במסך)", card.plateFormatted, "12-345-67");
eq("התווית היא הכינוי", card.label, "האוטו של אמא");
eq("פרטי המבטח", [card.insurer.name, card.insurer.policyNumber], ["הראל", "123456789"]);

// ★ O7 — שם + טלפון בלבד
eq("★ פרטי הבעלים = שם + טלפון בלבד", Object.keys(card.owner).sort(), ["name", "phone"]);
ok("בלי מייל ובלי כתובת", !("email" in card.owner) && !("address" in card.owner));

// ★ המסך אינו דפדפן מסמכים
eq("★ רק רישיון רכב וביטוח חובה", card.documents.map((d) => d.type).sort(), ["compulsory", "vehicleLicence"]);
ok("★ הפוליסה לא בכרטיס", !card.documents.some((d) => d.id === "d-policy"));
ok("★ הקבלה לא בכרטיס", !card.documents.some((d) => d.id === "d-receipt"));
eq("★ אין שום הפניה לדומיין owner/", card.documents.filter((d) => d.storageDomain === "owner"), []);
eq("★ רק רישיון הנהיגה של המשתמש עצמו", card.personal.map((d) => d.id), ["pd-me"]);
ok("★ ולא של אדם אחר", !card.personal.some((d) => d.id === "pd-kid"));
eq("★ בדיקת הדליפה מחזירה ריק", cardLeaks(card, OWNER), []);

// אותה בדיקה מנקודת המבט של הקטין — הוא רואה את שלו, ולא של הבעלים.
const kidCard = buildEmergencyCard({ data: emergencyData, vehicleId: "ve1", uid: KID, profile: emergencyData.profile });
eq("★ נהג אחר מקבל רק את המסמך האישי שלו", kidCard.personal.map((d) => d.id), ["pd-kid"]);
eq("★ וגם אצלו אין דומיין owner", cardLeaks(kidCard, KID), []);

// הכרטיס הוא טקסט בלבד — ולכן ניתן למטמון וגם נגיש לקורא מסך.
const serialized = JSON.stringify(card);
ok("★ הכרטיס JSON-serializable (טקסט בלבד)", serialized.length > 100);
ok("★ ואין בו שום כתובת הורדה", !/https?:\/\//.test(serialized) && !/blob:/.test(serialized));
eq("EMERGENCY_DOC_TYPES הוא בדיוק שני סוגים", EMERGENCY_DOC_TYPES, ["vehicleLicence", "compulsory"]);
eq("בלי רכב — אין כרטיס", buildEmergencyCard({ data: emergencyData, vehicleId: "nope", uid: OWNER }), null);

// חוק הברזל כתוב בקוד, לא רק בתוכנית
const emergencySrc = readSrc("utils/emergency.js");
ok("★ חוק הברזל מתועד בראש emergency.js", emergencySrc.includes("אין שום נתיב קריאה לא-מאומת"));
// ואין באפליקציה מסלול שעוקף את שער הכניסה
const appSrc = readCode(path.join(SRC, "App.jsx"));
ok("★ שער הכניסה חל על כל המסלולים (אין חריג לחירום)", !/route\.name\s*===\s*"emergency"[\s\S]{0,120}(user|auth)/.test(appSrc));

// ============================================================================
section("25. סריקות סטטיות של פרוסת המסכים");
// ============================================================================

// חיוג — קישורי tel: בלבד, לעולם לא חיוג תכנותי.
for (const f of SRC_FILES) {
  const txt = readCode(f);
  ok(`${path.basename(f)}: אין חיוג תכנותי`, !/window\.location\s*=\s*["'`]tel:/.test(txt));
}
const emergencyScreen = readCode(path.join(SRC, "components", "EmergencyScreen.jsx"));
ok("★ מסך החירום מחייג דרך href=tel:", emergencyScreen.includes("tel:${EMERGENCY_NUMBERS.police}"));
ok("ואין בו מפה או geolocation", !emergencyScreen.includes("geolocation") && !emergencyScreen.includes("<map"));

// ה-DocViewer הוא הצרכן היחיד של openSensitiveDocument, ומשחרר את ה-blob.
const viewerSrc = readCode(path.join(SRC, "components", "DocViewer.jsx"));
ok("★ המציג משתמש ב-openSensitiveDocument", viewerSrc.includes("openSensitiveDocument"));
ok("★ ומשחרר את ה-blob ב-unmount", viewerSrc.includes("revoke?.()"));
ok("★ ואין בו 'שתף' או window.open", !viewerSrc.includes("window.open") && !viewerSrc.includes("navigator.share"));

// role="tab" רק בתוך מסך; הניווט התחתון נשאר <nav> + aria-current.
const navSrc = readCode(path.join(SRC, "components", "BottomNav.jsx"));
ok("★ הניווט התחתון אינו role=tab", !navSrc.includes('role="tab"'));
ok("והוא כן <nav> עם aria-current", navSrc.includes("<nav") && navSrc.includes("aria-current"));
const tabsSrc = readCode(path.join(SRC, "components", "ui", "Tabs.jsx"));
ok("★ תתי-הלשוניות כן role=tablist", tabsSrc.includes('role="tablist"'));
ok("עם aria-selected ו-aria-controls", tabsSrc.includes("aria-selected") && tabsSrc.includes("aria-controls"));

// מסננים ובוררים — aria-pressed (4.1.2)
const docsSrc = readCode(path.join(SRC, "components", "DocumentsScreen.jsx"));
ok("★ כפתורי הסינון נושאים aria-pressed", docsSrc.includes("aria-pressed"));

// מסמכים אישיים במצב מקומי — נחסמים בשכבת ה-utils, לא רק ב-UI
ok("החסימה יושבת ב-validateFile", readCode(path.join(SRC, "utils", "files.js")).includes("personalDocsAllowed"));
ok("וה-UI רק מציג את ההודעה", readCode(path.join(SRC, "components", "DocumentUpload.jsx")).includes("personalDocsAllowed"));

// מחיקת חשבון וייצוא — גלויים במסך ההגדרות (N6 + שער חנויות)
const settingsSrc = readCode(path.join(SRC, "components", "SettingsScreen.jsx"));
ok("★ מחיקת חשבון קיימת במסך ההגדרות", settingsSrc.includes("deleteHousehold"));
ok("★ וייצוא נתונים גם", settingsSrc.includes("exportHousehold"));
ok("★ ויציאה מהחשבון בלחיצה אחת", settingsSrc.includes("onSignOut"));

// היידוע — append בלבד
const noticeSrc = readCode(path.join(SRC, "components", "NoticeScreen.jsx"));
ok("★ מסך היידוע קורא ל-acknowledgeNotice", noticeSrc.includes("acknowledgeNotice"));
ok("ו-useActions כותב append", readCode(path.join(SRC, "hooks", "useActions.js")).includes("appendNotice"));

// אין ScreenStub — כל המסלולים ממומשים
ok("★ אין יותר ScreenStub", !fs.existsSync(path.join(SRC, "components", "ScreenStub.jsx")));

// ============================================================================
section("26. 🔴 רצף כתיבות — באג הרכב שנעלם");
// ============================================================================
//
// הרגרסיה שגם 558 אסרשנים וגם 215 אסרשני render:check פספסו, כי שניהם
// בודקים **פונקציה טהורה אחת** או **רינדור אחד** — ולא **רצף כתיבות**.
//
// התסמין: המסך הודיע "הרכב נשמר, ופתחנו תזכורת לטסט", וב-localStorage היו
// `vehicles: []` ומשימת טסט **יתומה**. הדשבורד הציג מצב ריק אחרי שמירה
// מוצלחת. השורש: המצביע למצב הנוכחי התעדכן **ברינדור**, ולכן שתי קריאות
// `update()` באותו tick שתיהן שכפלו את אותו מצב-קדם.
//
// הבדיקות כאן בודקות את **ההתנהגות**: הן ייכשלו שוב אם מישהו יחזיר את
// המצביע לקרוא ממקור שמתעדכן ברינדור.
// ============================================================================

const seedVehicle = createVehicle({ id: "sv1", householdId: HID, plate: "1234567", testValidUntil: "2027-08-01" });
const seedTasks = seedTasksForVehicle(seedVehicle, [], { today: TODAY });

// -- (א) שתי קריאות apply() רצופות, באותו tick, בלי רינדור ביניהן ---------
const store = createStore(deepEmpty());
store.apply((d) => writeVehicleWithTasks(d, { vehicle: seedVehicle }));
store.apply((d) => {
  d.tasks = [...(d.tasks || []), ...seedTasks];
  return d;
});
const after = store.get();
eq("★ הרכב שרד את הכתיבה השנייה", after.vehicles.length, 1);
eq("★ והמשימה שרדה את הראשונה", after.tasks.length, seedTasks.length);
// ⚠️ `every` על מערך ריק מחזיר true — ולכן הבדיקה מחייבת גם שיש בכלל משימות.
// בלי זה היא הייתה עוברת בדיוק במצב הבאג (הכול נמחק = אין מה לבדוק).
ok(
  "★ ואין משימה יתומה — ה-vehicleId מצביע לרכב שקיים",
  after.tasks.length > 0 && after.tasks.every((t) => after.vehicles.some((v) => v.id === t.vehicleId))
);

// -- (ב) המצביע מתקדם **בכתיבה**, לא ברינדור ------------------------------
const s2 = createStore(deepEmpty());
const r1 = s2.apply((d) => {
  d.vehicles = [seedVehicle];
  return d;
});
ok("★ get() מחזיר את התוצאה **מיד** אחרי apply, בלי רינדור", s2.get().vehicles.length === 1);
ok("apply מחזיר גם prev וגם next", r1.prev.vehicles.length === 0 && r1.next.vehicles.length === 1);
ok("★ prev הוא באמת המצב שלפני (לכתיבת דלתא)", r1.prev !== r1.next);
// המוטטור מקבל **עותק**, ולא את המצב החי — כדי שמוטציה חלקית לא תדלוף.
const s3 = createStore(deepEmpty());
let leaked = null;
s3.apply((d) => {
  leaked = d;
  d.vehicles = [seedVehicle];
  return d;
});
ok("★ המוטטור עובד על טיוטה משוכפלת", leaked !== undefined);

// -- (ג) שלוש כתיבות רצופות — לא רק שתיים -------------------------------
const s4 = createStore(deepEmpty());
s4.apply((d) => {
  d.vehicles = [seedVehicle];
  return d;
});
s4.apply((d) => {
  d.tasks = [seedTasks[0]];
  return d;
});
s4.apply((d) => {
  d.documents = [createDocument({ householdId: HID, vehicleId: "sv1", type: "vehicleLicence" })];
  return d;
});
const s4final = s4.get();
ok("★ שלוש כתיבות רצופות — כולן שרדו", s4final.vehicles.length === 1 && s4final.tasks.length === 1 && s4final.documents.length === 1);

// -- (ד) replace מיישר את המצביע (מסלול onSnapshot) ---------------------
const s5 = createStore(deepEmpty());
s5.replace({ ...deepEmpty(), vehicles: [seedVehicle] });
s5.apply((d) => {
  d.tasks = [seedTasks[0]];
  return d;
});
ok("★ כתיבה אחרי replace לא מוחקת את מה שהגיע מהענן", s5.get().vehicles.length === 1 && s5.get().tasks.length === 1);

// ============================================================================
section("27. ★ פעולה מוצרית אחת = כתיבה אחת");
// ============================================================================

// הוספת רכב — מוטטור **אחד** שכותב את הרכב ואת המשימות שנזרעו ממנו.
const oneShot = writeVehicleWithTasks(deepEmpty(), { vehicle: seedVehicle, tasks: seedTasks });
eq("★ הרכב נכתב", oneShot.vehicles.length, 1);
eq("★ והמשימות איתו, באותה כתיבה", oneShot.tasks.length, seedTasks.length);
ok("★ אין מצב ביניים אפשרי — אין משימה יתומה", oneShot.tasks.every((t) => oneShot.vehicles.some((v) => v.id === t.vehicleId)));
eq("משימת הטסט נושאת את התאריך מהמאגר", oneShot.tasks.find((t) => t.type === "test").dueDate, "2027-08-01");
// עריכה חוזרת — upsert, לא הכפלה
const edited = writeVehicleWithTasks(oneShot, { vehicle: { ...seedVehicle, nickname: "האוטו של אמא" }, tasks: seedTasks });
eq("עריכה לא מכפילה את הרכב", edited.vehicles.length, 1);
eq("ולא מכפילה משימות", edited.tasks.length, seedTasks.length);
eq("והשינוי נשמר", edited.vehicles[0].nickname, "האוטו של אמא");
// מסמך פרטי נוצר רק כשיש בו תוכן
eq("בלי נתונים פרטיים — אין מסמך פרטי", writeVehicleWithTasks(deepEmpty(), { vehicle: seedVehicle }).vehiclesPrivate.length, 0);

// -- סימון "בוצע" — ארבע הכתיבות באותו מוטטור ---------------------------
const svcTask = createTask({ id: "svc-task", householdId: HID, vehicleId: "sv1", type: "service", dueDate: "2026-08-01" });
const svcResult = completeTask(svcTask, { today: TODAY, completedDate: TODAY, completedKm: 112000 });
const completionState = writeTaskCompletion(
  { ...deepEmpty(), vehicles: [seedVehicle], tasks: [svcTask] },
  {
    completed: svcResult.completed,
    next: svcResult.next,
    ctx: { householdId: HID, completedDate: TODAY, completedKm: 112000 },
  }
);
ok("★ המשימה סומנה בוצע", completionState.tasks.find((t) => t.id === "svc-task").completedAt);
eq("★ והמשימה הבאה נוצרה באותה כתיבה", completionState.tasks.length, 2);
eq("★ ונשמרה קריאת מד-אוץ' אמיתית", completionState.odometerReadings.length, 1);
eq("הקריאה נושאת את הק\"מ שהוזן", completionState.odometerReadings[0].km, 112000);
eq("★ ונרשמה רשומת טיפול", completionState.serviceRecords.length, 1);
eq("רשומת הטיפול מקושרת למשימה", completionState.serviceRecords[0].taskId, "svc-task");
eq("והרכב עודכן", completionState.vehicles[0].currentKm, 112000);
eq("וגם תאריך הטיפול האחרון", completionState.vehicles[0].lastServiceDate, TODAY);
// ⚠️ המוטטורים משנים את הטיוטה **במקום** — זה תקין, כי `store.apply` תמיד
// מוסר להם עותק טרי. בבדיקות צריך לשכפל, אחרת בדיקה אחת מזהמת את הבאה.
const completionSnapshot = JSON.parse(JSON.stringify(completionState));

// ★ וזה מה שסוגר את המעגל: עכשיו יש קריאות מד-אוץ', ולכן הערכת הק"מ מתחילה לעבוד.
const secondReading = writeTaskCompletion(JSON.parse(JSON.stringify(completionSnapshot)), {
  completed: { ...svcResult.completed, id: "svc2" },
  next: null,
  ctx: { householdId: HID, completedDate: addDays(TODAY, 180), completedKm: 122000 },
});
eq("שתי קריאות אחרי שני טיפולים", secondReading.odometerReadings.length, 2);
ok("★ ועכשיו יש קצב — הערכת הק\"מ מתחילה לעבוד", kmPerDay(readingsForVehicle(secondReading.odometerReadings, "sv1")) > 0);
// אין כפילות על אותו יום ואותו ק"מ
const dup = writeTaskCompletion(JSON.parse(JSON.stringify(completionSnapshot)), {
  completed: svcResult.completed,
  next: null,
  ctx: { householdId: HID, completedDate: TODAY, completedKm: 112000 },
});
eq("★ אותה קריאה פעמיים — לא נוצרת כפילות", dup.odometerReadings.length, 1);
// משימה שאינה טיפול לא מייצרת רשומת טיפול
const testDone = completeTask(createTask({ id: "tt", householdId: HID, vehicleId: "sv1", type: "test", dueDate: "2026-08-01" }), { today: TODAY, completedDate: TODAY });
const testState = writeTaskCompletion(
  { ...deepEmpty(), vehicles: [seedVehicle], tasks: [] },
  { completed: testDone.completed, next: testDone.next, ctx: { householdId: HID, completedDate: TODAY } }
);
eq("טסט שבוצע לא מייצר רשומת טיפול", testState.serviceRecords.length, 0);
eq("ובלי ק\"מ — לא נוצרת קריאת מד", testState.odometerReadings.length, 0);

// ============================================================================
section("28. סריקה: אין handler שכותב פעמיים");
// ============================================================================
//
// כל מקום שקורא ל-`actions.*` יותר מפעם אחת ב**אותו** handler הוא מועמד
// לבאג הזה. הסריקה סופרת קריאות-כתיבה לכל פונקציה, ומחריגה קריאות קריאה
// בלבד (`exportHousehold`) ו-if/else שרק אחד מענפיו רץ.
// ============================================================================

// הסריקה מחפשת את התבנית המסוכנת בדיוק: **שתי פקודות-כתיבה עוקבות**.
// שורה שמתחילה ב-`actions.` (או `await actions.`) היא פקודה שרצה בוודאות;
// קריאה בתוך `onClick={...}`, בתוך `if`/`else` או בתוך תנאי טרנרי אינה
// מתחילה כך, ולכן אינה נספרת — שם ממילא רץ ענף אחד או handler נפרד.
const READ_ONLY_ACTIONS = ["exportHousehold", "deleteHouseholdPlan"];
const isWriteStatement = (line) => {
  const m = line.trim().match(/^(?:await\s+)?(?:return\s+)?actions\.(\w+)\(/);
  return m && !READ_ONLY_ACTIONS.includes(m[1]) ? m[1] : null;
};

const screenFiles = SRC_FILES.filter((f) => f.endsWith(".jsx"));
const multiWrite = [];
const loopWrite = [];
for (const f of screenFiles) {
  const lines = readCode(f).split("\n");
  const hits = [];
  lines.forEach((line, i) => {
    const name = isWriteStatement(line);
    if (name) hits.push({ i, name });
    // לולאה שכותבת — N כתיבות באותו tick, הגרסה החמורה של אותו באג.
    if (/\b(for|while|forEach|map)\b[^\n]*actions\.\w+\(/.test(line)) {
      loopWrite.push(`${path.basename(f)}:${i + 1}`);
    }
  });
  for (let k = 1; k < hits.length; k++) {
    if (hits[k].i - hits[k - 1].i <= 6) {
      multiWrite.push(`${path.basename(f)}:${hits[k - 1].i + 1} — ${hits[k - 1].name} + ${hits[k].name}`);
    }
  }
}
eq("★ אין שתי פקודות-כתיבה עוקבות בשום handler", multiWrite, []);
eq("★ ואין לולאה שכותבת דרך actions", loopWrite, []);
// בדיקת שפיות של הסורק עצמו: הוא באמת מזהה את התבנית.
ok(
  "הסורק מזהה שתי פקודות עוקבות",
  isWriteStatement("    actions.saveVehicle(v);") === "saveVehicle" &&
    isWriteStatement("      onClick={() => actions.archiveVehicle(id)}") === null &&
    isWriteStatement("    if (x) actions.deleteDocument(id);") === null
);

// שני המסלולים ששברו — עכשיו קוראים לפעולה האטומית
const addSrc = readCode(path.join(SRC, "components", "AddVehicleScreen.jsx"));
ok("★ הוספת רכב: כתיבה אחת", addSrc.includes("saveVehicleWithTasks"));
ok("★ ובלי לולאת saveTask", !/for\s*\([^)]*\)\s*actions\.saveTask/.test(addSrc));
const vehScreenSrc = readCode(path.join(SRC, "components", "VehicleScreen.jsx"));
ok("★ עריכת רכב: כתיבה אחת", vehScreenSrc.includes("saveVehicleWithTasks"));
ok("★ ובלי לולאת saveTask", !/for\s*\([^)]*\)\s*\{\s*actions\.saveTask/.test(vehScreenSrc));

// ה-hook עצמו: המצב-קדם מגיע מה-store, לא ממקור שמתעדכן ברינדור
const useDataSrc2 = readCode(path.join(SRC, "hooks", "useData.js"));
ok("★ update() לוקח את המצב-קדם מה-store", useDataSrc2.includes("store.apply(mutator)"));
ok("★ ואין יותר dataRef שמתעדכן ברינדור", !useDataSrc2.includes("dataRef.current = data"));
ok("onSnapshot מיישר גם את ה-store", useDataSrc2.includes("store.replace(assembled)"));

// -- item 4: המתג מושבת עד שהמימוש קיים ---------------------------------
const settingsSrc2 = readCode(path.join(SRC, "components", "SettingsScreen.jsx"));
ok(
  '★ המתג ל-textAndDocs מושבת ומסומן "בקרוב"',
  !settingsSrc2.includes('emergencyOffline: "textAndDocs"')
);
ok("והמחרוזות של עדי נשמרו במילון לרגע שהמימוש ינחת", Boolean(dict.he["settings.emergency.offline.docs.confirm.meaning"]));

// ============================================================================
section("29. ★ המטמון שומר blob — לעולם לא קישור חתום");
// ============================================================================
//
// זו נקודת הכשל שהכי חשוב למנוע במוצר הזה: מטמון שמכיל signed URL **עובד
// מצוין בבדיקות ונשבר בשקט בתאונה שלושה ימים אחר כך** — פיצ'ר בטיחות
// שנכשל בדיוק ברגע שבשבילו נבנה, ובאופן שאף בדיקה רגילה לא רואה.
// ============================================================================
const cacheSrcFinal = readCode(path.join(SRC, "utils", "localCache.js"));
const emergencySrcFinal = readCode(path.join(SRC, "utils", "emergency.js"));
for (const marker of SIGNED_URL_MARKERS) {
  ok(`★★ אין ${marker} בקוד המטמון`, !cacheSrcFinal.includes(marker));
  ok(`★★ ואין ${marker} בבניית כרטיס החירום`, !emergencySrcFinal.includes(marker));
}
// ⚠️ התיעוד חי בהערה, ולכן נקרא מהקובץ הגולמי — `readCode` מסיר הערות.
ok(
  "★ המטמון מתועד כשומר טקסט בלבד",
  fs.readFileSync(path.join(SRC, "utils", "localCache.js"), "utf8").includes("לעולם לא קישור חתום")
);
ok(
  "★★ ו-openSensitiveDocument מעדיפה signed URL מהשרת",
  readCode(path.join(SRC, "utils", "files.js")).includes("callSignedUrl")
);
eq("★ TTL של חמש דקות — לא טוקן קבוע", SIGNED_URL_TTL_MINUTES, 5);
// T1 — אין ענף isMinor בקוד ההסלמה. כלל אחיד הוא כלל שלא נשבר בריפקטור.
ok("★★ אין ענף isMinor בסולם ההסלמה", !readCode(path.join(SRC, "utils", "escalation.js")).includes("isMinor"));
ok("★ ו-escalateToOwner הוסר מה-schedule", !readCode(path.join(SRC, "schema.js")).includes("escalateToOwner:"));

// ============================================================================
console.log("\n" + "=".repeat(60));
if (failed) {
  console.error(`נכשלו ${failed} בדיקות מתוך ${pass + failed}`);
  for (const f of failures) console.error("  ✗", f);
  process.exit(1);
}
console.log(`✓ כל ${pass} הבדיקות עברו`);
