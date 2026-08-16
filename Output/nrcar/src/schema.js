// ============================================================================
// schema.js — מודל הנתונים **המלא**, כולל ישויות שהמסך שלהן בפרוסה 2
// (drivers, vehicleAccess, personalDocs). הסכימה נכתבת פעם אחת; המסכים
// מגיעים אחר כך. שינוי סכימה אחרי שיש משתמשים אמיתיים הוא הגירה.
//
// חוסמי-התכנון של עדי (adi/Outputs/2026-08-13-nrcar-privacy-by-design.md):
//   N2  `fileRef` = { storagePath, contentType, size, uploadedAt } —
//       **בלי url, בלי downloadUrl, בלי src.** getDownloadURL נפתר על פי
//       דרישה בתוך utils/files.js בלבד, והתוצאה חיה בזיכרון בלבד.
//   N3  `sensitivity` על **כל** Document, לא רק על PersonalDoc.
//       ⚠️ ומכאן הנקודה היקרה ל-v1.1: **ה-allowlist הוא על שדות הפלט של
//       החילוץ, לא blocklist על מסמכי הקלט.** רישיון רכב אינו
//       sensitivity:"id" ובכל זאת נושא ת.ז., ו-OCR עליו יחלץ אותה. החילוץ
//       יהיה רשאי להחזיר אך ורק
//       {plate, manufacturer, model, year, testValidUntil, insurerName,
//        policyNumber, validFrom, validUntil} — וכל דבר אחר נזרק לפני
//       שהוא נוגע ב-state. חינם היום כהחלטת ארכיטקטורה, יקר מאוד אחר כך.
//   N5  `users/{uid}.notices` הוא מערך **append-only**, לא אובייקט שנדרס.
//       השאלה שתישאל בעוד שנתיים היא "איזו גרסה המשתמש ראה, ומתי".
//   N6  `retentionClass` על כל ישות נושאת-PII.
//   N7  `guardianConsent` append-only, ונכתב ע"י הבעלים בלבד (rules).
//   O10 `serviceChannels` מופרד מ-`marketingConsent`.
//
// אמנת תאריכים: שדה תאריך = "YYYY-MM-DD" (יום בלבד, בלי שעה ובלי אזור זמן),
// כדי שכל ההשוואות במנוע התזכורות יהיו לקסיקוגרפיות ובטוחות. חותמות זמן
// מלאות (createdAt/uploadedAt/acknowledgedAt) הן ISO מלא.
// ============================================================================

import { newId, nowIso } from "./utils/id.js";
import {
  SCHEMA_VERSION,
  POLICY_VERSION,
  DEFAULTS,
  REMINDER_LADDER,
  SENSITIVITY_BY_DOC_TYPE,
  VISIBILITY_BY_DOC_TYPE,
  STORAGE_DOMAIN_BY_VISIBILITY,
  STORAGE_DOMAINS,
} from "./constants.js";

// `p.id` נשמר כשהוא קיים — כך שעריכה של ישות קיימת לא מייצרת מזהה חדש
// (וה-diff של firestoreSync ממשיך לזהות אותה כאותו מסמך).
const base = (prefix, p = {}, retentionClass = null) => ({
  id: p.id || newId(prefix),
  householdId: p.householdId || null,
  createdAt: p.createdAt || nowIso(),
  updatedAt: nowIso(),
  schemaVersion: SCHEMA_VERSION,
  retentionClass,
});

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v) {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function day(v) {
  if (!v) return null;
  const head = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null;
}

// ============================================================================
// N2 — fileRef. ארבעה שדות, ואף אחד מהם אינו כתובת.
// "לא שומרים URL" אינו כלל סגנון: הטוקן של getDownloadURL **אינו פג**, URL
// ב-Firestore שורד את מחיקת הקובץ, נכנס לכל גיבוי, ונקרא ע"י כל מי שרשאי
// לקרוא את **המסמך** — כולל מי שאינו רשאי לקרוא את **הקובץ**.
// ============================================================================
export function makeFileRef({ storagePath, contentType, size } = {}) {
  if (!storagePath) return null;
  return {
    storagePath: String(storagePath),
    contentType: contentType || null,
    size: num(size),
    uploadedAt: nowIso(),
  };
}

export function emptyFileRef() {
  return null;
}

// ============================================================================
// 0. משק בית (מסמך השורש households/{hid}).
// hid הוא **מזהה אטום**. הוא נזרע מה-uid של הבעלים, אבל שום קוד ושום כלל
// לא מסיק ממנו תפקיד — התפקיד יושב ב-members (N4).
// ============================================================================
export function createHousehold(p = {}) {
  const id = p.id || null;
  return {
    id,
    name: str(p.name),
    createdAt: p.createdAt || nowIso(),
    updatedAt: nowIso(),
    schemaVersion: SCHEMA_VERSION,
    members: p.members || (p.ownerUid ? { [p.ownerUid]: "owner" } : {}),
  };
}

// ============================================================================
// 1. Vehicle — הישות המרכזית.
// **בלי misgeret/VIN, בלי ת.ז., בלי מחיר.** המחיר והפרמיה יושבים ב-
// VehiclePrivate, כי firestore.rules לא יודעים להסתיר שדה בודד.
// ============================================================================
export function createVehicle(p = {}) {
  return {
    ...base("veh", p, "vehicle"),
    plate: str(p.plate),
    // הכינוי הוא מה שמופיע במשפטי המנוע ("האוטו של אמא"). בהיעדרו —
    // יצרן+דגם. **לעולם לא מספר רישוי** (ראו utils/options.js#vehicleLabel).
    nickname: str(p.nickname),

    // -- ממשרד התחבורה (whitelist ב-utils/mot.js, לא spread) --
    manufacturer: str(p.manufacturer),
    commercialName: str(p.commercialName),
    model: str(p.model),
    trim: str(p.trim),
    year: num(p.year),
    fuelType: str(p.fuelType),
    color: str(p.color),
    ownershipType: str(p.ownershipType), // baalut — פרטי/ליסינג/חברה.
    // ⚠️ לא מוצג כאמירה על המשתמש ולא כהוכחת בעלות (עדי 1.4, תוספת 4).

    // ★ tokef_dt — הערך שזורע את משימת הטסט. זה הניצחון של המוצר:
    //   מספר רישוי → תאריך אמיתי → תזכורת אמיתית, בלי הקלדה.
    testValidUntil: day(p.testValidUntil),
    lastTestDate: day(p.lastTestDate),

    // -- ביטוח (הזנת משתמש; המאגר הציבורי לא מכיל נתוני ביטוח) --
    compulsoryInsuranceUntil: day(p.compulsoryInsuranceUntil),
    comprehensiveInsuranceUntil: day(p.comprehensiveInsuranceUntil),
    insurerName: str(p.insurerName),
    policyNumber: str(p.policyNumber),
    insurerEmergencyPhone: str(p.insurerEmergencyPhone),
    insuranceAgent: { name: str(p.insuranceAgent?.name), phone: str(p.insuranceAgent?.phone) },
    garage: { name: str(p.garage?.name), phone: str(p.garage?.phone) },

    // -- תחזוקה --
    currentKm: num(p.currentKm),
    currentKmDate: day(p.currentKmDate),
    lastServiceDate: day(p.lastServiceDate),
    lastServiceKm: num(p.lastServiceKm),

    // -- תמונה — N2: נתיב, לא כתובת --
    photoRef: p.photoRef || null,
    photoName: str(p.photoName),
    photoStorageMode: p.photoStorageMode || "none", // none | local | storage
    // base64 — **רק במצב fallback מקומי**, ורק לתמונת רכב. בענן תמיד null.
    // (מסמכים אישיים חסומים לגמרי במצב מקומי — ראו utils/files.js.)
    photoData: p.photoData || null,

    // PRD §7 — רכב שנמכר עובר ל**ארכיון**, לא נמחק. ארכוב ≠ מחיקה (N6.4).
    status: p.status || "active", // active | archived
    archivedAt: p.archivedAt || null,

    // עדי 1.4, תוספת 1: מינימלי במפורש. **בלי `raw` "לצורך דיבוג".**
    motSource: {
      resourceId: p.motSource?.resourceId || null,
      fetchedAt: p.motSource?.fetchedAt || null,
      found: p.motSource?.found ?? null,
    },
  };
}

// ============================================================================
// 1b. VehiclePrivate — בעלים בלבד, **לתמיד** (גם בפרוסה 2).
// קיים כי rules לא יכולים להסתיר שדה. אותו id כמו הרכב.
// ============================================================================
export function createVehiclePrivate(vehicleId, p = {}) {
  return {
    id: vehicleId,
    vehicleId,
    householdId: p.householdId || null,
    purchasePrice: num(p.purchasePrice),
    insurancePremium: num(p.insurancePremium),
    ownerNotes: str(p.ownerNotes),
    updatedAt: nowIso(),
    schemaVersion: SCHEMA_VERSION,
    retentionClass: "vehiclePrivate",
  };
}

// ============================================================================
// 2. Driver — המסך בפרוסה 2, הסכימה היום.
// **בלי ת.ז. ובלי מספר רישיון**: למסך החירום צריך את *התמונה*, ולתזכורת צריך
// רק את *התאריך*. ה-rules נשענים על uid בלבד, לעולם לא על email.
// ============================================================================
export function createDriver(p = {}) {
  return {
    ...base("drv", p, "driver"),
    fullName: str(p.fullName),
    phone: str(p.phone),
    relation: p.relation || "other", // self | spouse | child | parent | other
    role: p.role || "driver", // owner | driver — נקרא מ-members, נשמר לנוחות
    userUid: p.userUid || null, // auth.uid — הקישור היחיד שה-rules סומכים עליו
    inviteStatus: p.inviteStatus || "none", // none | invited | accepted | revoked
    invitedAt: p.invitedAt || null,

    // רק **התאריך** — לא מספר הרישיון ולא סריקה. הסריקה היא PersonalDoc נפרד.
    drivingLicenceValidUntil: day(p.drivingLicenceValidUntil),

    // N7 — isMinor הוא **הצהרה של המזמין**, לא תאריך לידה (עדי 1.3, פריט 1):
    // אין לנו יכולת אימות גיל אמיתית, ולא צריך את הגיל — צריך את הדגל.
    isMinor: Boolean(p.isMinor),
    // N7 — append-only, כמו notices (N5). ראיה, ולכן לא נדרסת.
    // כל רשומה: { byUid, byName, at, method, policyVersion }.
    // byUid הוא הקריטי — בלעדיו אין ראיה מי אישר.
    // ⚠️ נכתב **רק ע"י owner** — נאכף ב-firestore.rules, לא ב-UI.
    guardianConsent: Array.isArray(p.guardianConsent) ? p.guardianConsent : [],

    status: p.status || "active", // active | inactive | archived
    anonymizedAt: p.anonymizedAt || null,
  };
}

// N7 — רשומת הסכמת אפוטרופוס. append, לעולם לא replace.
export function makeGuardianConsent({ byUid, byName, method } = {}) {
  return {
    byUid: byUid || null,
    byName: str(byName),
    at: nowIso(),
    method: method || "inApp",
    policyVersion: POLICY_VERSION,
  };
}

// N7(ב) — הזמנה של קטין לא ניתנת לקבלה לפני שיש הסכמה. תנאי אחד, חינם היום.
export function canAcceptInvite(driver) {
  if (!driver) return false;
  if (!driver.isMinor) return true;
  return (driver.guardianConsent || []).some((c) => Boolean(c?.at));
}

// ============================================================================
// 2b. VehicleAccess — **מזהה מורכב `${driverUid}__${vehicleId}`, בכוונה.**
// firestore.rules לא יכולים להריץ שאילתה. כדי לבטא "הנהג הזה רשאי לקרוא את
// הרכב הזה" צריך exists() על נתיב שאפשר **לבנות** מהבקשה. מזהה אקראי הופך
// את זה לבלתי אפשרי ומחייב מיגרציה בפרוסה 2. עולה 0 היום.
// ============================================================================
export function vehicleAccessId(driverUid, vehicleId) {
  if (!driverUid || !vehicleId) return null;
  return `${driverUid}__${vehicleId}`;
}

export function createVehicleAccess(p = {}) {
  const id = vehicleAccessId(p.driverUid, p.vehicleId);
  return {
    id,
    householdId: p.householdId || null,
    driverUid: p.driverUid || null,
    driverId: p.driverId || null,
    vehicleId: p.vehicleId || null,
    grantedAt: nowIso(),
    grantedByUid: p.grantedByUid || null,
    updatedAt: nowIso(),
    schemaVersion: SCHEMA_VERSION,
    retentionClass: "vehicleAccess",
  };
}

// ============================================================================
// 3. Task ★ — הישות שהמוצר קיים בשבילה.
//
// `schedule` הוא **חוזה ההובלה של פרוסה 2**, ונכתב היום: פרוסה 2 תריץ שאילתה
// אחת על nextFireAt <= today, תייבא את *אותן פונקציות בדיוק* מ-reminders.js,
// ותוסיף רק *הובלה* (FCM/SMS/מייל) — לא לוגיקה.
// ============================================================================
export function createTask(p = {}) {
  const leadDays = num(p.leadDays) ?? DEFAULTS.leadDays;
  return {
    ...base("tsk", p, "task"),
    vehicleId: p.vehicleId || null,
    type: p.type || "other", // test | insurance | service | repair | other
    title: str(p.title), // רק ל-repair/other; לשאר הכותרת מהמנוע
    dueDate: day(p.dueDate),
    tag: p.tag || null, // רשימה סגורה — בלי הקלדה חופשית
    important: Boolean(p.important), // עדיפות **בינארית** (PRD §3.4)
    // כיסוי הביטוח — קובע איזו שורת overdue מוצגת. "אסור לנסוע" נכון
    // לחובה בלבד; אסור להציג אותו על מקיף (הערת שירה 3).
    coverage: p.type === "insurance" ? p.coverage || "generic" : null,

    // ⚠️ הסטטוס היחיד שהמשתמש קובע ידנית. שאר ארבעת הסטטוסים **נגזרים**
    //    מהתאריכים — ראו utils/reminders.js#computeStatus.
    manualStatus: p.manualStatus || null, // null | "inProgress"

    completedAt: p.completedAt || null, // ISO מלא
    completedDate: day(p.completedDate), // היום שבו בוצע בפועל
    completedKm: num(p.completedKm),
    sourceTaskId: p.sourceTaskId || null, // המשימה שממנה נולדה (חידוש אוטומטי)

    renewalRule: {
      // completionDate = טסט (+12ח' מהביצוע) · dueDate = ביטוח (+12ח'
      // מתאריך היעד הישן — פוליסה מתחדשת ביום השנה, לא ביום שנזכרת ללחוץ)
      // earliestOfDateOrKm = טיפול · none = תיקון/אחר
      basis: p.renewalRule?.basis || defaultRenewalBasis(p.type),
      months: p.renewalRule?.months ?? defaultRenewalMonths(p.type),
      km: p.renewalRule?.km ?? (p.type === "service" ? DEFAULTS.serviceIntervalKm : null),
    },

    schedule: createSchedule(p.schedule, leadDays),
  };
}

// ============================================================================
// 🔴 T3 — ה-`schedule` הציבורי. **בלי חותמות זמן ובלי מצב פר-נמען.**
//
// מסמך המשימה נקרא במלואו ע"י הבעלים, ו-rules לא מסתירים שדה. לכן כאן יושב
// רק מה שהוא **תכונה של המשימה**: מתי היא אמורה להזכיר, ואיזה שלב כבר יצא.
// כל מה שהוא **תכונה של אדם** — מתי נשלח אליו, לאיזה ערוץ, ומתי הוא אישר —
// יורד ל-`tasks/{id}/private/state` (שרת בלבד).
//
// `acknowledged` בוליאני, ולא `acknowledgedAt`: העובדה אינה רגישה, החותמת כן.
// ============================================================================
export function createSchedule(s = {}, leadDays = DEFAULTS.leadDays) {
  const lead = num(s?.leadDays) ?? leadDays;
  return {
    leadDays: lead,
    ladder: Array.isArray(s?.ladder) ? s.ladder : REMINDER_LADDER.filter((d) => d <= lead),
    nextFireAt: s?.nextFireAt ?? null, // "YYYY-MM-DD" — השאילתה של ה-scheduler
    // שלב ברמת ה**משימה** (הקטן ביותר שיצא לאיזשהו נמען). נגזר מהתאריך
    // ולכן אינו נושא מידע על אף אדם.
    lastFiredStep: s?.lastFiredStep ?? null,
    acknowledged: Boolean(s?.acknowledged),
    acknowledgedStep: s?.acknowledgedStep ?? null,
    snoozedUntil: s?.snoozedUntil ?? null,
    muted: Boolean(s?.muted),
    // ⚠️ `escalateToOwner` הוסר במכוון (T1): הבעלים אינו "מוסלם אליו" אלא
    // נמען בזכות עצמו, עם סולם משלו (OWNER_LADDER). ראו constants.js.
  };
}

// ============================================================================
// 🔴 T3 — המצב הפר-נמען. יושב ב-`tasks/{id}/private/state`, **שרת בלבד**
// (נופל ל-deny הגורף ב-firestore.rules; אין לו match, בכוונה).
//
// `recipients[uid]` מחזיק את מה שאסור שיהיה על המשימה: חותמות מסירה,
// הערוצים שנוסו, והאישור עם השעה שלו.
// ============================================================================
export function createTaskPrivateState(p = {}) {
  return {
    taskId: p.taskId || null,
    householdId: p.householdId || null,
    recipients: p.recipients || {},
    updatedAt: nowIso(),
    schemaVersion: SCHEMA_VERSION,
    retentionClass: "operational-short",
  };
}

export function createRecipientState(p = {}) {
  return {
    lastFiredStep: p.lastFiredStep ?? null,
    lastFiredAt: p.lastFiredAt ?? null,
    channelsTried: Array.isArray(p.channelsTried) ? p.channelsTried : [],
    deliveryState: p.deliveryState || "pending",
    acknowledgedAt: p.acknowledgedAt ?? null,
    acknowledgedStep: p.acknowledgedStep ?? null,
    consecutiveFailures: num(p.consecutiveFailures) ?? 0,
  };
}

// לוח מנוקה למשימה הבאה: אותה הגדרה, בלי היסטוריית שליחה.
export function resetSchedule(schedule) {
  return createSchedule({ leadDays: schedule?.leadDays }, schedule?.leadDays ?? DEFAULTS.leadDays);
}

export function defaultRenewalBasis(type) {
  switch (type) {
    case "test":
      return "completionDate";
    case "insurance":
      return "dueDate";
    case "service":
      return "earliestOfDateOrKm";
    default:
      return "none"; // תיקון, אחר — אין משימה הבאה
  }
}

export function defaultRenewalMonths(type) {
  switch (type) {
    case "test":
      return DEFAULTS.testIntervalMonths;
    case "insurance":
      return DEFAULTS.insuranceIntervalMonths;
    case "service":
      return DEFAULTS.serviceIntervalMonths;
    default:
      return null;
  }
}

export const DEFAULT_TAG_BY_TYPE = {
  test: "authorities",
  insurance: "insurance",
  service: "maintenance",
  repair: "maintenance",
  other: "other",
};

// ============================================================================
// 4. Document — מסמך **רכב**.
// N3 — `sensitivity` כאן, לא רק ב-PersonalDoc: רישיון רכב ופוליסה נושאים
// ת.ז. בפורמט תמונה. זו ההשלכה על נוסח המדיניות ועל צורת ה-allowlist ב-v1.1.
// ============================================================================
export function createDocument(p = {}) {
  const type = p.type || "other";
  const visibility = p.visibility || VISIBILITY_BY_DOC_TYPE[type] || "owner";
  return {
    ...base("doc", p, "document"),
    vehicleId: p.vehicleId || null,
    type,
    title: str(p.title),
    visibility, // shared | owner
    validFrom: day(p.validFrom),
    validUntil: day(p.validUntil),

    // N2 — נתיב + מטא-דאטה. אין כאן כתובת, ולא תהיה.
    fileRef: p.fileRef || null,
    fileName: str(p.fileName),
    storageMode: p.storageMode || "none", // none | local | storage
    storageDomain: p.storageDomain || STORAGE_DOMAIN_BY_VISIBILITY[visibility] || STORAGE_DOMAINS.owner,
    metadataStripped: p.metadataStripped ?? null,
    // base64 — **רק במצב fallback מקומי**. בענן תמיד null; הקובץ יושב
    // ב-Storage ו-fileRef מחזיק את הנתיב בלבד (N2).
    localData: p.localData || null,

    sensitivity: p.sensitivity || SENSITIVITY_BY_DOC_TYPE[type] || "none",
  };
}

// ============================================================================
// 5. PersonalDoc — מסמך **אדם** (רישיון נהיגה).
// read = `driverUid == request.auth.uid` בלבד. **גם הבעלים לא קורא** —
// הבעלים מקבל delete (לצורך cascade) בלי read.
// ההנמקה, כדי שלא "יתקנו" את זה בעתיד (עדי 1.3, פריט 6):
//   (א) אין לו צורך — תאריך התפוגה יושב ב-Driver.drivingLicenceValidUntil
//       שהבעלים כן רואה, ולכן התזכורת עובדת;
//   (ב) קריאה של הורה בסריקת מסמך הזהות של בן 17 לא מוסיפה ערך ומוסיפה
//       יכולת מעקב;
//   (ג) כלל אחיד הוא כלל שלא נשבר.
// היום יש משתמש אחד, אז זה חינם — ואחר כך יקר מאוד.
// ============================================================================
export function createPersonalDoc(p = {}) {
  return {
    ...base("pdoc", p, "personalDoc"),
    driverId: p.driverId || null,
    driverUid: p.driverUid || null, // המפתח היחיד שה-rules בודקים
    type: p.type || "drivingLicence",
    validUntil: day(p.validUntil),
    fileRef: p.fileRef || null,
    fileName: str(p.fileName),
    storageMode: p.storageMode || "none",
    storageDomain: STORAGE_DOMAINS.personal,
    metadataStripped: p.metadataStripped ?? null,
    sensitivity: "id",
  };
}

// -- 6. ServiceRecord --------------------------------------------------------
export function createServiceRecord(p = {}) {
  return {
    ...base("svc", p, "serviceRecord"),
    vehicleId: p.vehicleId || null,
    date: day(p.date),
    km: num(p.km),
    kind: p.kind || "periodic", // periodic | repair | tires | test | other
    garageName: str(p.garageName),
    cost: num(p.cost),
    notes: str(p.notes),
    taskId: p.taskId || null,
  };
}

// -- 7. OdometerReading ------------------------------------------------------
// היום בלבד, בלי שעה: קריאת מד-אוץ' עם חותמת מדויקת היא נקודת זמן על אדם.
export function createOdometerReading(p = {}) {
  return {
    ...base("odo", p, "odometerReading"),
    vehicleId: p.vehicleId || null,
    date: day(p.date),
    km: num(p.km),
    source: p.source || "owner", // owner | driver
  };
}

// ============================================================================
// 8. UserProfile — users/{uid}. **נכתב ע"י הנושא בלבד.**
//
// N5 — `notices` הוא מערך append-only. מדיניות של מוצר צרכני **תשתנה**, כמה
// פעמים, והשאלה שתישאל היא "איזו גרסה המשתמש הזה ראה בפועל, ומתי". שדה
// שנדרס מוחק את התשובה בלי אפשרות שחזור.
//
// ⚠️ נקודת חוזק שלא "מתקנים": כשקטין הופך לבגיר, המסלול הנכון הוא שהוא
// מאשר את היידוע **בעצמו** — וזה כבר נתמך, כי notices נכתב ע"י הנושא.
//
// O10 — serviceChannels (הודעות שירות שהמשתמש ביקש) מופרד מ-marketingConsent
// (דבר פרסומת לפי ס' 30א). הוספת השדה היום: אפס. איסוף הסכמה רטרואקטיבית
// מבסיס משתמשים קיים: קמפיין שלם.
// ============================================================================
export function createUserProfile(p = {}) {
  return {
    uid: p.uid || null,
    displayName: str(p.displayName),
    email: str(p.email),
    phone: str(p.phone),
    householdId: p.householdId || null,
    lang: p.lang || "he",
    notices: Array.isArray(p.notices) ? p.notices : [],
    serviceChannels: {
      push: p.serviceChannels?.push ?? true,
      sms: p.serviceChannels?.sms ?? false,
      email: p.serviceChannels?.email ?? false,
    },
    marketingConsent: p.marketingConsent || null, // { at, policyVersion } | null
    createdAt: p.createdAt || nowIso(),
    updatedAt: nowIso(),
    schemaVersion: SCHEMA_VERSION,
    retentionClass: "user",
  };
}

// N5 — append, לעולם לא replace.
export function appendNotice(profile, { policyVersion = POLICY_VERSION, method = "inApp" } = {}) {
  const notices = Array.isArray(profile?.notices) ? profile.notices : [];
  return {
    ...profile,
    notices: [...notices, { policyVersion, acknowledgedAt: nowIso(), method }],
    updatedAt: nowIso(),
  };
}

export function hasAcknowledged(profile, policyVersion = POLICY_VERSION) {
  return (profile?.notices || []).some((n) => n?.policyVersion === policyVersion && n?.acknowledgedAt);
}

// ============================================================================
// 8b. ReminderLogEntry — households/{hid}/reminderLog/{id}.
// **נכתב ע"י Cloud Function בלבד** (פרוסה 2), ונקרא ע"י **הנמען בלבד**.
//
// ⚠️ הפונקציה הזאת היא **ההגנה היחידה על התוכן**. `allow write: if false`
// ב-rules אינו מגן: ה-Function כותבת ב-Admin SDK ועוקפת rules לחלוטין.
// לכן ה-factory בונה whitelist מפורש, ו-smoke אוכף שאין בו שדה אסור.
//
// הרשומה מתעדת **מה קרה, לא לאיזו כתובת** — היעד יושב ב-
// `users/{uid}.serviceChannels` ונגיש בזמן בירור. בלי טלפון, בלי מייל, בלי
// טוקן מכשיר, בלי תגובת ספק גולמית, בלי גוף ההודעה, בלי IP ו-userAgent.
// ============================================================================
export function createReminderLogEntry(p = {}) {
  const channel = ["push", "email", "sms"].includes(p.channel) ? p.channel : null;
  return {
    id: p.id || newId("rlog"),
    householdId: p.householdId || null,
    taskId: p.taskId || null,
    vehicleId: p.vehicleId || null,
    // ★ מפתח ההרשאה: רק הנמען קורא את הרשומה הזאת.
    recipientUid: p.recipientUid || null,
    step: num(p.step),
    channel, // סוג בלבד
    deliveryState: p.deliveryState || "pending",
    errorCode: p.errorCode ? String(p.errorCode).slice(0, 40) : null, // קוד גס
    firedAt: p.firedAt || nowIso(),
    acknowledgedAt: p.acknowledgedAt || null,
    retentionClass: "operational-short",
    schemaVersion: SCHEMA_VERSION,
  };
}

// -- 9. Membership — memberships/{uid} → { householdId, role, driverId } ------
export function createMembership(p = {}) {
  return {
    uid: p.uid || null,
    householdId: p.householdId || null,
    role: p.role || "owner",
    driverId: p.driverId || null,
    updatedAt: nowIso(),
    schemaVersion: SCHEMA_VERSION,
  };
}

// מיפוי אוסף → factory, לשימוש ה-smoke ולבדיקות שפיות.
export const FACTORY_BY_COLLECTION = {
  vehicles: createVehicle,
  vehiclesPrivate: (p) => createVehiclePrivate(p.vehicleId || "veh_x", p),
  drivers: createDriver,
  vehicleAccess: createVehicleAccess,
  tasks: createTask,
  documents: createDocument,
  personalDocs: createPersonalDoc,
  serviceRecords: createServiceRecord,
  odometerReadings: createOdometerReading,
};
