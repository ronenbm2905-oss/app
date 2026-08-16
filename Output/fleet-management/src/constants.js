// ============================================================================
// constants.js — קבועים, enums, ומצב פתיחה ריק (EMPTY, לא SAMPLE).
//
// המבנה כאן מיישם את חוסמי-התכנון של עדי
// (adi/Outputs/2026-08-12-fleet-management-privacy-by-design.md):
//   D1 — נתונים שהנהג לא רשאי לראות יושבים ב**מסמכים נפרדים** (vehiclesPrivate/
//        finesPrivate/incidentsPrivate), כי firestore.rules לא יודעים להסתיר שדה.
//   D2 — סריקות קנס הן ישות נפרדת (fineScans), לא VehicleDocument.
//   D6 — retentionClass על כל ישות נושאת-PII; המספרים ⚖️ עו"ד, לא ממציאים.
//   D7 — אין שדות שכר/ניכוי/ת.ז. בשום מקום.
// ============================================================================

export const SCHEMA_VERSION = 2;

// שמות תת-האוספים ב-Firestore — orgs/{orgId}/<collection>/{id}
// (זהים לשמות המערכים במודל שבזיכרון, כדי שהמיפוי יהיה 1:1).
export const ENTITY_COLLECTIONS = [
  "leaseCompanies",
  "vehicles",
  "vehiclesPrivate", // D1 — אדמין בלבד (monthlyCost וכל נתון מסחרי)
  "drivers",
  "assignments",
  "fines",
  "finesPrivate", // D1 — אדמין בלבד (הערות אדמין על העובד)
  "fineScans", // D2 — סריקות קנס, מורשות לפי הקנס ולא לפי הרכב
  "odometerReadings",
  "serviceRecords",
  "documents",
  "incidents",
  "incidentsPrivate", // D1 — אדמין בלבד (הערכת האדמין)
];

// אוספים שנהג לעולם לא קורא מהם — נבדק גם ב-rules וגם ב-smoke.
export const ADMIN_ONLY_COLLECTIONS = ["vehiclesPrivate", "finesPrivate", "incidentsPrivate"];

// -- enums ------------------------------------------------------------------
export const VEHICLE_STATUS = ["active", "pool", "returned"];
// D6 — 'archived' הוא היעד של עובד שעזב; המחיקה היא אנונימיזציה, לא מחיקה.
export const DRIVER_STATUS = ["active", "inactive", "archived"];
// F1 — 'revoked' נבדק ב-rules בפרוסה 2, לא רק קיום uid.
export const PORTAL_STATUS = ["none", "invited", "active", "disabled", "revoked"];

// D5 — state machine מורחב: העובד רואה ומגיב **לפני** ההסבה.
// received → notified_driver → (disputed) → transferred → paid | appealed | cancelled
export const FINE_STATUS = [
  "received",
  "notified_driver",
  "disputed",
  "transferred",
  "paid",
  "appealed",
  "cancelled",
];
export const FINE_CLOSED_STATUS = ["paid", "cancelled"];
// סטטוסים שבהם הקנס עוד לא הוסב לנהג — ההתראה המרכזית בדשבורד.
export const FINE_PRE_TRANSFER_STATUS = ["received", "notified_driver", "disputed"];

export const ODOMETER_SOURCE = ["admin", "driver"];
export const SERVICE_TYPE = ["periodic", "repair", "tires", "accident", "test"];
// D2 — 'fineScan' **הוסר** מכאן בכוונה: סריקת קנס אינה מסמך רכב.
export const DOCUMENT_TYPE = ["insurance", "license", "test", "leaseContract", "other"];
export const INCIDENT_STATUS = ["open", "handled", "closed"];
export const ROLES = ["admin", "driver"];

// סוגי מסמך שפקיעתם מנוטרת בדשבורד
export const EXPIRING_DOC_TYPES = ["insurance", "test", "license"];

// ============================================================================
// D2 — תחומי Storage. הנתיב מקודד את התחום מהיום הראשון, כי הזזת קבצים
// בדיעבד היא ההגירה הכי כואבת, ו-storage.rules מתאימים לפי נתיב.
// ============================================================================
export const STORAGE_DOMAINS = {
  fine: "fine", // orgs/{orgId}/fines/{fineId}/...
  odometer: "odometer", // orgs/{orgId}/drivers/{driverId}/odometer/...
  incident: "incident", // orgs/{orgId}/drivers/{driverId}/incidents/...
  vehicleDoc: "vehicleDoc", // orgs/{orgId}/vehicles/{vehicleId}/docs/...
};

// ============================================================================
// D6 — מחלקות שמירה. **המספרים ⚖️ עו"ד** (מס/חשבונאות, התיישנות עבירות
// תעבורה, התיישנות תביעות עבודה). כאן רק המבנה + null = טרם נקבע.
// ============================================================================
export const RETENTION_CLASSES = {
  driver: { months: null, note: "legal.retention.pending" },
  assignment: { months: null, note: "legal.retention.pending" },
  fine: { months: null, note: "legal.retention.pending" },
  fineScan: { months: null, note: "legal.retention.pending" },
  odometer: { months: null, note: "legal.retention.pending" },
  incident: { months: null, note: "legal.retention.pending" },
  vehicleDoc: { months: null, note: "legal.retention.pending" },
};

// ============================================================================
// D7 — שמות שדות שאסור שיופיעו בשום ישות. נאכף ב-smoke test, לא רק בהערה.
//   שכר/ניכוי — חסום עד חוות דעת עו"ד עבודה (ס' 25 לחוק הגנת השכר).
//   ת.ז./רישיון — אין לו מטרה במערכת; ההסבה מתבצעת מחוץ לאפליקציה.
//   דנרמול שם נהג — שובר את האנונימיזציה של D6.
//   ציון/דירוג עובד — לא בונים שדות הערכה על עובדים.
// ============================================================================
export const FORBIDDEN_FIELDS = [
  "deductionAmount",
  "deductedFromSalary",
  "salary",
  "salaryDeduction",
  "nationalId",
  "idNumber",
  "tz",
  "licenseNumber",
  "driverLicenseScan",
  "driverFullName",
  "driverName",
  "riskScore",
  "behaviourScore",
  "behaviorScore",
  "driverRating",
  "gps",
  "latitude",
  "longitude",
  "geo",
];

// -- ספי התראה (ניתנים לשינוי ב-settings) -----------------------------------
export const DEFAULTS = {
  contractAlertDays: 90,
  fineDueAlertDays: 14,
  docExpiryAlertDays: 30,
  serviceDueDays: 30,
  serviceDueKm: 1000,
  kmWarnRatio: 0.95,
};

// גבול גודל לקובץ שנשמר base64 ב-localStorage (מצב דמו בלבד).
export const LOCAL_FILE_MAX_BYTES = 1.5 * 1024 * 1024;
// גבול העלאה בענן — נאכף גם ב-storage.rules.
export const CLOUD_FILE_MAX_BYTES = 10 * 1024 * 1024;

export const CURRENCY = "ILS";
export const LOCALE_BY_LANG = { he: "he-IL", en: "en-GB" };

// גרסת מסמכי היידוע (D8). כל שינוי בנוסח = העלאת גרסה.
export const POLICY_VERSION = "0.1-draft";

// מצב פתיחה ריק. `org` הוא מסמך השורש orgs/{orgId}; המערכים הם תת-האוספים.
export const EMPTY = {
  schemaVersion: SCHEMA_VERSION,
  org: {
    id: null,
    name: "",
    createdAt: null,
    // members: מיפוי uid→role. בסיס הבידוד ב-rules; בפרוסה 1 יש רק admin.
    members: {},
  },
  settings: {
    currency: CURRENCY,
    contractAlertDays: DEFAULTS.contractAlertDays,
    fineDueAlertDays: DEFAULTS.fineDueAlertDays,
    docExpiryAlertDays: DEFAULTS.docExpiryAlertDays,
    policyVersion: POLICY_VERSION,
    onboarded: false,
    lastImportAt: null, // מסך 6 — מתי בוצע ייבוא אחרון מהאקסל
  },
  leaseCompanies: [],
  vehicles: [],
  vehiclesPrivate: [],
  drivers: [],
  assignments: [],
  fines: [],
  finesPrivate: [],
  fineScans: [],
  odometerReadings: [],
  serviceRecords: [],
  documents: [],
  incidents: [],
  incidentsPrivate: [],
};
