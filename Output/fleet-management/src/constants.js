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
  // פרוסה 2 — **ההיטל שנשלח למכשיר של הנהג**. מסמך פר-נהג (id === driverId)
  // שמכיל רק את מה שהנהג רשאי לראות על הרכב שלו. נגזר במלואו מ-vehicles/
  // assignments/leaseCompanies (utils/portal.js) ואינו מקור אמת.
  // למה אוסף ולא קריאה ישירה ל-vehicles: ב-rules אין שאילתות, ולכן "האם הוא
  // מחזיק את הרכב הזה **היום**" אינה שאלה שניתן לשאול על מסמך הרכב.
  "driverPortal",
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

// ============================================================================
// D8 — שיטות מסירת היידוע. **enum, לא מחרוזת חופשית** (שער עדי 16.8, 4.3ג).
//
// הסדר כאן אינו אלפביתי ואינו שרירותי: הוא **דירוג הראיות** של עדי (4.2),
// מהחזק לחלש. `admin_recorded` אחרון בכוונה — הוא מתעד ש**מישהו לחץ**, לא
// **איך נמסר**, ולכן הוא גם ברירת המחדל: אסור שהמערכת תטען ראיה חזקה יותר
// ממה שקרה בפועל. הוא אינו חוסם — הוא מקבל חיווי שקט בכרטיס הנהג.
// ============================================================================
export const NOTICE_METHODS = [
  "signed_form", // אישור קבלה חתום
  "email_individual", // מייל אישי עם המסמך
  "email_bulk", // מייל לרשימה
  "meeting_minuted", // מסירה בישיבה מתועדת
  "admin_recorded", // רישום ידני בלי ראיה חיצונית — החלש ביותר
];
export const NOTICE_METHOD_WEAK = "admin_recorded";
export const NOTICE_METHOD_DEFAULT = "admin_recorded";

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
    // adminEmails: **allowlist של מיילים** — מודל הגישה של האדמינים (17.8).
    // מוסיפים כתובת → הבעלים של הכתובת מתחבר עם Google → הוא בפנים. הדפוס
    // מ-basketball-scheduler, שחי בפרודקשן. נאכף ב-firestore.rules יחד עם
    // `email_verified == true`, ומוחזק תמיד lowercase.
    // ⚠️ כתובות **מלאות ומדויקות, מכל ספק** — אין הנחת דומיין ארגוני: מנהלת
    // הכספים נכנסה דווקא מ-Gmail פרטי. הגבלת דומיין (R-b של עדי) אינה ישימה.
    // ⚠️ הגבול: זה לאדמינים בלבד. בידוד נהגים בפרוסה 2 יישאר לפי uid (F1).
    adminEmails: [],
    // members: מיפוי uid→role. **legacy** — נשאר בסכימה ומוכר ב-rules כמסלול
    // חלופי, כדי שה-deploy לא ינעל את המשתמש מחוץ למסמך הארגון הקיים, שאינו
    // מכיל עוד adminEmails. אין קוד חדש שנשען עליו.
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
  driverPortal: [], // נגזר — ראה utils/portal.js
};
