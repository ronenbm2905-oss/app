// ============================================================================
// schema.js — מודל הנתונים המלא, כולל שדות שעדיין לא מוצגים במסך, כדי לא
// לשבור סכימה בפרוסה 2 (פורטל נהג).
//
// עקרונות שמוטבעים כאן (סקירת ה-privacy-by-design של עדי, 2026-08-12):
//   D1  כל שדה שנהג לא רשאי לראות יושב ב**ישות נפרדת** (VehiclePrivate /
//       FinePrivate / IncidentPrivate) — כי firestore.rules לא מסתירים שדה.
//   D2  סריקת קנס היא ישות עצמאית (FineScan) המורשית לפי **הקנס**, לא לפי הרכב.
//   D3  מדנרמלים **מפתח** (`orgId`, `driverUid`) — ולעולם לא **שם**.
//   D5  לכל שיוך קנס יש שרשרת ראיות (`attribution`) + מצב מחלוקת.
//   D6  `retentionClass` על כל ישות נושאת-PII; העזיבה = אנונימיזציה, לא מחיקה.
//   D7  אין שדות שכר/ניכוי/ת.ז./רישיון/דירוג עובד — בשום ישות.
//   D8  `Driver.notice` מתעד **יידוע**, לא הסכמה.
//
// אמנת תאריכים: שדה תאריך = "YYYY-MM-DD" (יום בלבד, בלי שעה ובלי אזור זמן),
// כדי שהשוואות ב-driverAtDate יהיו לקסיקוגרפיות ובטוחות. חותמות זמן מלאות
// (createdAt/reportedAt) הן ISO מלא — אבל **לא** על קריאת מד-אוץ' (D4.3).
// ============================================================================

import { newId, nowIso } from "./utils/id.js";
import { emptyNotice } from "./utils/notice.js";
import { SCHEMA_VERSION, POLICY_VERSION } from "./constants.js";

const base = (prefix, orgId) => ({
  id: newId(prefix),
  orgId: orgId || null,
  createdAt: nowIso(),
  updatedAt: nowIso(),
  schemaVersion: SCHEMA_VERSION,
});

// -- 1. Vehicle — מה שנהג רשאי לראות ----------------------------------------
export function createVehicle(p = {}) {
  return {
    ...base("veh", p.orgId),
    plate: p.plate || "",
    model: p.model || "",
    manufacturer: p.manufacturer || "",
    year: p.year ?? null,
    leaseCompanyId: p.leaseCompanyId || null,
    contractStart: p.contractStart || null,
    contractEnd: p.contractEnd || null,
    annualKmAllowance: num(p.annualKmAllowance),
    // startKm — מד האוץ' בתחילת החוזה. לא הופיע באפיון; נדרש כדי שחישוב
    // חריגת הק"מ יהיה נכון ברכב שנכנס לחוזה לא-חדש. ברירת מחדל 0.
    startKm: num(p.startKm),
    status: p.status || "active", // active | pool | returned
    currentKm: p.currentKm ?? null, // נגזר מקריאות המד — לא מוזן
    notes: p.notes || "",
    // ⚠️ monthlyCost **אינו כאן** בכוונה — D1. ראה createVehiclePrivate.
  };
}

// -- 1b. VehiclePrivate — אדמין בלבד (D1) ------------------------------------
// מסמך נפרד עם אותו id כמו הרכב, כדי שהמיפוי יהיה טריוויאלי.
export function createVehiclePrivate(vehicleId, p = {}) {
  return {
    id: vehicleId,
    vehicleId,
    orgId: p.orgId || null,
    monthlyCost: num(p.monthlyCost),
    commercialNotes: p.commercialNotes || "",
    updatedAt: nowIso(),
    schemaVersion: SCHEMA_VERSION,
  };
}

// -- 2. Driver ---------------------------------------------------------------
export function createDriver(p = {}) {
  return {
    ...base("drv", p.orgId),
    fullName: p.fullName || "",
    phone: p.phone || "",
    email: p.email || "",
    department: p.department || "",
    employeeNumber: p.employeeNumber || "",
    userId: p.userId || null, // auth.uid — הקישור לפורטל (F1: rules לפי uid בלבד)
    // ============================================================================
    // portalLinkedEmail — **הכתובת שאיתה נקשר החשבון בפועל, לתיעוד בלבד.**
    //
    // 3.2.1 בהכוונת עדי (17.8): המייל נקרא **פעם אחת**, ברגע הקישור, ואחר כך
    // אף החלטת הרשאה אינה נוגעת בו. השדה קיים כדי שאפשר יהיה לענות "מי בעצם
    // נכנס לרשומה הזו" — `email` הוא מה שהאדמין **הקליד**, וזה מה ש-Google
    // **אימתה**. בגימייל השניים נבדלים לגיטימית (נקודות, +alias).
    //
    // ⚠️ 3.3.4: **כתובת גימייל פרטית היא מזהה ישיר של אדם, לא פחות משמו** —
    // ולעיתים יותר, כי היא ייחודית וניתנת לחיפוש. לכן היא נכנסת לסריקת M1
    // (utils/retention.js) ולא רק מתאפסת ברשומה עצמה.
    // ============================================================================
    portalLinkedEmail: p.portalLinkedEmail || null,
    portalStatus: p.portalStatus || "none", // none|invited|active|disabled|revoked
    invitedAt: p.invitedAt || null,
    status: p.status || "active", // active | inactive | archived
    // D8 — תיעוד יידוע (לא הסכמה). `deliveredAt` = מתי נמסר בפועל;
    // `recordedAt` = מתי נלחץ. שני דברים שונים, ולכן שני שדות (utils/notice.js).
    notice: p.notice || emptyNotice(),
    // D6 — אנונימיזציה
    retentionClass: "driver",
    anonymizedAt: p.anonymizedAt || null,
    notes: p.notes || "",
    // D7 — אין ת.ז., אין מספר רישיון, אין נתוני שכר. במכוון.
  };
}

// -- 3. Assignment (החזקה) — לב המערכת --------------------------------------
export function createAssignment(p = {}) {
  return {
    ...base("asg", p.orgId),
    vehicleId: p.vehicleId || null,
    driverId: p.driverId || null,
    driverUid: p.driverUid ?? null, // D3 — מפתח בקרת-גישה מדונרמל
    fromDate: p.fromDate || null, // כולל
    toDate: p.toDate ?? null, // כולל; null = החזקה פעילה
    // ------------------------------------------------------------------
    // fromDateInferred — לאקסל אין תאריך תחילת **החזקה**, רק תאריך תחילת
    // הסכם הליסינג. בייבוא אנחנו לוקחים את contractStart כ-fromDate, כי זו
    // התשובה הכי טובה שיש ובלעדיה השיוך האוטומטי משותק לנצח — אבל מסמנים
    // שהתאריך **משוער**. כשקנס משויך על בסיס החזקה כזו, הממשק חייב להציג
    // אזהרה. החזקה שנוצרת ביד = false. (החלטת דורית, 2026-08-12.)
    // זה **לא** needsReview: השיוך כן קורה, הוא רק מסומן כמשוער.
    // ------------------------------------------------------------------
    fromDateInferred: p.fromDateInferred ?? false,
    // D5 — החזקה שמקורה בטקסט חופשי מיובא לא תשמש לשיוך אוטומטי של קנס.
    needsReview: p.needsReview ?? false,
    // D-Import (עדי) — הטקסט החופשי מהאקסל נכנס לשדה **מבודד** המסומן
    // "לבדיקה", ולעולם לא ל-notes התפעולי החופשי-לצפייה.
    importRaw: p.importRaw || "",
    importedAt: p.importedAt || null,
    importSource: p.importSource || null, // { file, sheet, row }
    // D6/M1 — כשעובד עובר אנונימיזציה, שמו נמחק גם מהטקסט החופשי הזה
    // (`redactDriverNameEverywhere`). השדה מתעד מתי, כדי שיהיה ברור שהטקסט
    // שמוצג אינו הטקסט המקורי מהקובץ. `importSource` נשאר שלם — הוא העקבה.
    importRawRedactedAt: p.importRawRedactedAt || null,
    // ------------------------------------------------------------------
    // מסך 7 (תיקון החזקות שסומנו לבדיקה) — עקבות הפתרון. `importRaw` **נשאר**
    // גם אחרי הפתרון; השדות כאן מתעדים מי פתר, מתי ואיך, כדי שאפשר יהיה
    // לבדוק בדיעבד על סמך מה שויך קנס. `reviewSplitFrom` מסמן החזקה
    // היסטורית שנוצרה בפיצול של החזקה אחרת (ולכן אינה פריט-בדיקה בפני עצמה).
    // ------------------------------------------------------------------
    reviewResolvedAt: p.reviewResolvedAt || null,
    reviewResolvedBy: p.reviewResolvedBy || null, // uid של האדמין
    reviewResolution: p.reviewResolution || null, // driver | pool | split
    reviewSplitFrom: p.reviewSplitFrom || null,
    retentionClass: "assignment",
    notes: p.notes || "",
  };
}

// -- 4. Fine (קנס) -----------------------------------------------------------
export function createFine(p = {}) {
  return {
    ...base("fin", p.orgId),
    vehicleId: p.vehicleId || null,
    // driverId נגזר אוטומטית מה-Assignment שהיה תקף בתאריך העבירה.
    driverId: p.driverId ?? null,
    driverUid: p.driverUid ?? null, // D3
    violationDate: p.violationDate || null,
    violationTime: p.violationTime || "",
    amount: num(p.amount),
    authority: p.authority || "",
    violationType: p.violationType || "",
    referenceNumber: p.referenceNumber || "",
    dueDate: p.dueDate || null,
    status: p.status || "received",
    notifiedDriverAt: p.notifiedDriverAt || null,
    transferredDate: p.transferredDate || null,
    paidDate: p.paidDate || null,
    // D5 — שרשרת ראיות מלאה לכל שיוך ולכל עקיפה.
    attribution: p.attribution || emptyAttribution(),
    // D5 — תגובת העובד לפני ההסבה.
    driverStatement: p.driverStatement || { text: "", at: null },
    scanId: p.scanId || null, // → FineScan (D2), לא VehicleDocument
    retentionClass: "fine",
    // ⚠️ notes הפנימי של האדמין **אינו כאן** — D1. ראה createFinePrivate.
    // ⚠️ אין deductionAmount / deductedFromSalary — D7, חסום עד חוו"ד עו"ד עבודה.
  };
}

export function emptyAttribution() {
  return {
    source: "auto", // auto | manual
    assignmentId: null,
    resolvedAt: null,
    resolvedStatus: null, // resolved | ambiguous | none | pool | needsReview
    // האם ההחזקה שממנה נגזר השיוך נשענת על תאריך התחלה **משוער** (מיובא
    // מתאריך תחילת הסכם הליסינג, ולא מתאריך מסירה ידוע). חלק משרשרת
    // הראיות של D5 — מי שיבדוק את השיוך בדיעבד חייב לדעת את זה.
    fromDateInferred: false,
    overriddenBy: null,
    overriddenAt: null,
    reason: "",
    previousDriverId: null,
  };
}

// -- 4b. FinePrivate — אדמין בלבד (D1) ---------------------------------------
export function createFinePrivate(fineId, p = {}) {
  return {
    id: fineId,
    fineId,
    orgId: p.orgId || null,
    adminNotes: p.adminNotes || "",
    updatedAt: nowIso(),
    schemaVersion: SCHEMA_VERSION,
  };
}

// -- 4c. FineScan — סריקת הקנס כישות עצמאית (D2) -----------------------------
// מורשית לאדמין ולנהג המשויך **לקנס**, לא לנהג הנוכחי של הרכב.
export function createFineScan(p = {}) {
  return {
    ...base("scn", p.orgId),
    fineId: p.fineId || null,
    driverId: p.driverId ?? null,
    driverUid: p.driverUid ?? null, // D3
    fileRef: p.fileRef || null, // ענן: נתיב Storage · מקומי: dataURL (דמו)
    fileName: p.fileName || "",
    fileSize: p.fileSize ?? null,
    contentType: p.contentType || "",
    storageMode: p.storageMode || "none", // none | local | storage
    metadataStripped: p.metadataStripped ?? false, // D4
    uploadedBy: p.uploadedBy || "",
    retentionClass: "fineScan",
  };
}

// -- 5. OdometerReading ------------------------------------------------------
export function createOdometerReading(p = {}) {
  return {
    ...base("odo", p.orgId),
    vehicleId: p.vehicleId || null,
    driverId: p.driverId ?? null,
    driverUid: p.driverUid ?? null, // D3
    // D4.3 — תאריך הקריאה בלבד. לא חותמת דיוק-שנייה שמסגירה מתי העובד עבד.
    date: p.date || null,
    km: num(p.km),
    source: p.source || "admin", // admin | driver
    photoRef: p.photoRef || null, // קובץ צילום המד (נתיב/dataURL)
    photoName: p.photoName || "",
    photoStorageMode: p.photoStorageMode || "none",
    metadataStripped: p.metadataStripped ?? false, // D4
    retentionClass: "odometer",
    notes: p.notes || "",
  };
}

// -- 6. ServiceRecord (טיפול) — תפעולי, בלי PII ------------------------------
export function createServiceRecord(p = {}) {
  return {
    ...base("srv", p.orgId),
    vehicleId: p.vehicleId || null,
    type: p.type || "periodic",
    date: p.date || null,
    km: num(p.km),
    cost: num(p.cost),
    garage: p.garage || "",
    nextServiceKm: p.nextServiceKm ?? null,
    nextServiceDate: p.nextServiceDate || null,
    notes: p.notes || "",
  };
}

// -- 7. VehicleDocument — מסמכי הרכב בלבד (ביטוח/רישיון/טסט/חוזה) ------------
// D2: **אין כאן סריקות קנס.** רכב עובר בין נהגים; סריקת קנס של מחזיק קודם
// אסור שתהיה קריאה לנהג הנוכחי.
export function createVehicleDocument(p = {}) {
  return {
    ...base("doc", p.orgId),
    vehicleId: p.vehicleId || null,
    type: p.type || "other", // insurance | license | test | leaseContract | other
    title: p.title || "",
    validFrom: p.validFrom || null,
    validUntil: p.validUntil || null,
    fileRef: p.fileRef || null,
    fileName: p.fileName || "",
    fileSize: p.fileSize ?? null,
    contentType: p.contentType || "",
    storageMode: p.storageMode || "none",
    metadataStripped: p.metadataStripped ?? false, // D4
    uploadedBy: p.uploadedBy || "",
    retentionClass: "vehicleDoc",
    notes: p.notes || "",
  };
}

// -- 8. LeaseCompany ---------------------------------------------------------
export function createLeaseCompany(p = {}) {
  return {
    ...base("lco", p.orgId),
    name: p.name || "",
    contactName: p.contactName || "",
    phone: p.phone || "",
    email: p.email || "",
    notes: p.notes || "",
  };
}

// -- 9. Incident (תקלה/תאונה מדווחת) ----------------------------------------
export function createIncident(p = {}) {
  return {
    ...base("inc", p.orgId),
    vehicleId: p.vehicleId || null,
    driverId: p.driverId ?? null,
    driverUid: p.driverUid ?? null, // D3
    reportedAt: p.reportedAt || nowIso(),
    description: p.description || "",
    photos: p.photos || [], // [{ fileRef, fileName, storageMode, metadataStripped }]
    status: p.status || "open",
    retentionClass: "incident",
    // ⚠️ הערכת האדמין **אינה כאן** — D1. ראה createIncidentPrivate.
  };
}

// -- 9b. IncidentPrivate — אדמין בלבד (D1) -----------------------------------
export function createIncidentPrivate(incidentId, p = {}) {
  return {
    id: incidentId,
    incidentId,
    orgId: p.orgId || null,
    adminAssessment: p.adminAssessment || "",
    updatedAt: nowIso(),
    schemaVersion: SCHEMA_VERSION,
  };
}

function num(v) {
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const FACTORY_BY_COLLECTION = {
  vehicles: createVehicle,
  drivers: createDriver,
  assignments: createAssignment,
  fines: createFine,
  fineScans: createFineScan,
  odometerReadings: createOdometerReading,
  serviceRecords: createServiceRecord,
  documents: createVehicleDocument,
  leaseCompanies: createLeaseCompany,
  incidents: createIncident,
};
