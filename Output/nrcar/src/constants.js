// ============================================================================
// constants.js — קבועים, enums, ומצב פתיחה ריק (EMPTY, לא SAMPLE).
//
// המבנה כאן מיישם את חוסמי-התכנון של עדי
// (adi/Outputs/2026-08-13-nrcar-privacy-by-design.md):
//   N1 — למטמון במכשיר יש מפתח שכולל uid, והוא צלע שלישית ב-cascade.
//   N2 — fileRef הוא **נתיב Storage**, לעולם לא URL. url/downloadUrl/
//        downloadURL/signedUrl נכנסים ל-FORBIDDEN_FIELDS.
//   N3 — `sensitivity` הוא שדה על **כל** מסמך, לא רק על מסמך אישי.
//   N4 — hid הוא מזהה אטום. תפקיד נקרא מ-members, לעולם לא מ-hid == uid.
//   N5 — notices הוא מערך append-only.
//   N6 — retentionClass על כל ישות נושאת-PII.
//   N7 — guardianConsent נכתב ע"י הבעלים בלבד, append-only.
//   O10 — serviceChannels מופרד מ-marketingConsent, מהיום.
// ============================================================================

export const SCHEMA_VERSION = 1;

// גרסת מסמכי היידוע. כל שינוי בנוסח = העלאת גרסה (N5 — היסטוריה, לא דריסה).
export const POLICY_VERSION = "0.1-draft";

// שמות תת-האוספים ב-Firestore — households/{hid}/<collection>/{id}.
// זהים לשמות המערכים במודל שבזיכרון, כדי שהמיפוי יהיה 1:1.
export const ENTITY_COLLECTIONS = [
  "vehicles",
  "vehiclesPrivate", // בעלים בלבד **לתמיד** — rules לא יודעים להסתיר שדה
  "drivers", // פרוסה 2 (מסך), אבל הסכימה נכתבת מלאה היום
  "vehicleAccess", // מזהה מורכב `${driverUid}__${vehicleId}` — מכוון, ראו access.js
  "tasks",
  "documents",
  "personalDocs", // read = driverUid == auth.uid בלבד; גם הבעלים לא קורא
  "serviceRecords",
  "odometerReadings",
];

// אוספים שנהג לעולם לא קורא מהם — נבדק גם ב-rules וגם ב-smoke.
export const OWNER_ONLY_COLLECTIONS = ["vehiclesPrivate"];

// אוסף שנקרא **רק ע"י נושא המידע** — גם הבעלים לא (הבעלים מקבל delete בלי read).
export const SUBJECT_ONLY_COLLECTIONS = ["personalDocs"];

// ============================================================================
// אוספים שהשרת בלבד כותב (פרוסה 2). **בכוונה לא ב-ENTITY_COLLECTIONS** —
// הקליינט לא מסנכרן אותם ולא כותב אליהם.
//
// ⚠️ ובדיוק בגלל זה הם מסוכנים: הלולאה "לכל אוסף ב-ENTITY_COLLECTIONS יש
// כלל ב-rules" **לא תתפוס אוסף שקיים אבל אינו ברשימה**, והוא גם עלול ליפול
// מ-deleteHousehold() ומ-exportHousehold(). זה כשל fleet, במראה.
// לכן קיימת גם הבדיקה ההפוכה (smoke): **כל אוסף שמופיע ב-firestore.rules
// חייב להיות באחת משתי הרשימות**, והמעבר של המחיקה והייצוא עובר על שתיהן.
// ============================================================================
export const SERVER_ONLY_COLLECTIONS = ["reminderLog", "accessLog"];

// ============================================================================
// 🔴 T3 — השדות הרגישים יורדים ממסמך המשימה.
//
// `schedule.acknowledgedAt`, `lastFiredAt` ו-`channelsTried[]` ישבו על מסמך
// המשימה — **שהבעלים קורא במלואו**. ו-rules לא יודעים להסתיר שדה (זה D1,
// פעם שלישית בפרויקט).
//
// בפרוסה 2א אין נהגים ולכן אין דליפה. **בפרוסה 2ב, עם נהג יחיד על משימה,
// `acknowledgedAt` הוא בדיוק "מתי הוא נגע בטלפון"** — הדגימה ההתנהגותית
// שהוצאה מ-`reminderLog`, נכנסת מהחלון. `channelsTried` גרוע יותר: הוא
// מסגיר איזה ערוץ **של אדם אחר** נכשל.
//
// לכן: **החותמת היא החלק הרגיש, לא העובדה.** המשימה חושפת `acknowledged`
// בוליאני ו-`acknowledgedStep`; כל החותמות והמצב הפר-נמען יורדים ל-
// `tasks/{id}/private/state` — תת-מסמך **שרת בלבד** (נופל ל-deny הגורף).
//
// עלות היום: עיצוב שדה. עלות אחרי פרוסה 2ב: הגירת סכימה + שכתוב המנוע.
// ============================================================================
export const TASK_PRIVATE_SUBCOLLECTION = "private";
export const TASK_PRIVATE_DOC = "state";

// כל האוספים תחת households/{hid} — שתי הרשימות יחד.
export const ALL_COLLECTIONS = [...ENTITY_COLLECTIONS, ...SERVER_ONLY_COLLECTIONS];

// ============================================================================
// reminderLog — משמעת השדות.
//
// ⚠️ **הכלל `allow write: if false` אינו מגן על התוכן.** ה-Cloud Function
// כותבת ב-Admin SDK ועוקפת rules לחלוטין. המשמעת נאכפת כאן, ב-factory
// (`createReminderLogEntry`) וב-smoke — ולא ב-rules.
//
// הרשומה מתעדת **מה קרה, לא לאיזו כתובת**: היעד עצמו יושב ב-
// `users/{uid}.serviceChannels` ונגיש בזמן בירור.
// ============================================================================
export const REMINDER_LOG_FIELDS = [
  "id",
  "householdId",
  "taskId",
  "vehicleId",
  "recipientUid",
  "step",
  "channel", // סוג בלבד: push | email | sms
  "deliveryState",
  "errorCode", // קוד גס בלבד
  "firedAt",
  "acknowledgedAt",
  "retentionClass",
  "schemaVersion",
];

export const REMINDER_LOG_FORBIDDEN_FIELDS = [
  // היעד עצמו — הוא כבר ב-users/{uid}.serviceChannels
  "phone",
  "email",
  "to",
  "fcmToken",
  "token",
  "deviceId",
  // תגובות ספק גולמיות וגוף ההודעה המרונדר
  "rawResponse",
  "providerResponse",
  "raw",
  "body",
  "message",
  "renderedBody",
  // טביעות רגל של מכשיר ורשת
  "ip",
  "ipAddress",
  "userAgent",
  "deviceModel",
  "platform",
];

// -- enums ------------------------------------------------------------------
export const ROLES = ["owner", "driver"];
export const VEHICLE_STATUS = ["active", "archived"];
export const DRIVER_STATUS = ["active", "inactive", "archived"];
export const INVITE_STATUS = ["none", "invited", "accepted", "revoked"];
export const DRIVER_RELATION = ["self", "spouse", "child", "parent", "other"];

export const TASK_TYPE = ["test", "insurance", "service", "repair", "other"];
// רשימה סגורה — בלי הקלדה חופשית (PRD §3.4).
export const TASK_TAG = ["insurance", "maintenance", "authorities", "money", "other"];
// חמשת הסטטוסים של ה-PRD. ארבעה מהם **נגזרים**; רק inProgress ידני.
export const TASK_STATUS = ["open", "upcoming", "inProgress", "overdue", "done"];
export const TASK_MANUAL_STATUS = ["inProgress"];
export const INSURANCE_COVERAGE = ["compulsory", "comprehensive", "generic"];

export const DOCUMENT_TYPE = [
  "vehicleLicence",
  "compulsory",
  "comprehensive",
  "testCertificate",
  "serviceReport",
  "receipt",
  "other",
];
export const PERSONAL_DOC_TYPE = ["drivingLicence"];
export const DOC_VISIBILITY = ["shared", "owner"];

// ============================================================================
// N3 — `sensitivity` על **כל** מסמך.
//   "id"               — המסמך *הוא* מסמך זהות (רישיון נהיגה).
//   "containsIdNumber" — המסמך נושא ת.ז. אף שאיננו מסמך זהות
//                        (רישיון רכב, פוליסת ביטוח). זה הממצא של עדי:
//                        "בלי ת.ז." נכון ברמת השדה ולא ברמת הקובץ.
//   "none"             — קבלה, דוח טיפול.
// ============================================================================
export const SENSITIVITY = ["none", "containsIdNumber", "id"];

// ברירת המחדל של הרגישות לכל סוג מסמך — נגזרת, לא מוזנת.
export const SENSITIVITY_BY_DOC_TYPE = {
  vehicleLicence: "containsIdNumber",
  compulsory: "containsIdNumber",
  comprehensive: "containsIdNumber",
  testCertificate: "none",
  serviceReport: "none",
  receipt: "none",
  other: "none",
};

// ============================================================================
// ברירת המחדל של הנראות — **החלטה מודעת, לא גזירה בשקט** (N3, סעיף 2).
// רישיון רכב וביטוח חובה = shared, כי נהג שנעצר צריך אותם. המשמעות: בן משפחה
// שנוהג יראה גם את ת.ז. של הבעלים שמופיעה עליהם — ולכן פוליסה וקבלות נשארות
// owner, וכך ת.ז. של הבעלים לא זולגת פעמיים.
// פרוסה 2: המשפט הזה נאמר במפורש במסך ניהול הנהגים.
// ============================================================================
export const VISIBILITY_BY_DOC_TYPE = {
  vehicleLicence: "shared",
  compulsory: "shared",
  comprehensive: "owner",
  testCertificate: "shared",
  serviceReport: "owner",
  receipt: "owner",
  other: "owner",
};

// ============================================================================
// ארבעה דומייני Storage — **בנתיב עצמו, מהיום הראשון** (החסם של עדי).
// נתיב שממופתח רק ב-vehicleId מדליף את סריקות הפוליסה של הבעלים לכל בן
// משפחה שיצורף לרכב משותף. העברת קבצים בדיעבד היא המיגרציה הכי כואבת.
//   households/{hid}/vehicles/{vid}/shared/{file}  ← רישיון רכב, ביטוח חובה
//   households/{hid}/vehicles/{vid}/owner/{file}   ← פוליסות, קבלות — לתמיד
//   households/{hid}/vehicles/{vid}/photo/{file}
//   households/{hid}/people/{driverId}/docs/{file} ← אותו אדם בלבד
// ============================================================================
export const STORAGE_DOMAINS = {
  shared: "shared",
  owner: "owner",
  photo: "photo",
  personal: "personal",
};

export const STORAGE_DOMAIN_BY_VISIBILITY = {
  shared: STORAGE_DOMAINS.shared,
  owner: STORAGE_DOMAINS.owner,
};

// ============================================================================
// מנוע התזכורות — הסולם. מסונן לפי leadDays של המשימה.
// PRD §4.8: 30 יום מראש, ואז 14 / 7 / 3 / 1 / 0.
// ============================================================================
export const REMINDER_LADDER = [30, 14, 7, 3, 1, 0];

// דלי → טווח ימים (מיפוי הקופי של שירה §2.0). הסדר יורד; הראשון שמתאים מנצח.
export const REMINDER_BUCKETS = [
  { key: "d30", min: 15, max: 30 },
  { key: "d14", min: 8, max: 14 },
  { key: "d7", min: 4, max: 7 },
  { key: "d3", min: 2, max: 3 },
  { key: "d1", min: 1, max: 1 },
  { key: "d0", min: 0, max: 0 },
];

export const DELIVERY_STATE = ["pending", "sending", "sent", "acknowledged", "failed", "muted"];
// ערוצי ההובלה. הסדר הוא סדר ההסלמה (PRD §4.8).
export const REMINDER_CHANNELS = ["push", "sms", "email"];

// ============================================================================
// סולם ההסלמה בין ערוצים (PRD §4.8): Push → אם לא נפתח/אושר בזמן מוגדר →
// SMS → ובמקרים קריטיים גם מייל.
//
// "מקרה קריטי" = טסט וביטוח. אלה השניים שאי-טיפול בהם הוא עבירה על החוק,
// ולכן רק הם מצדיקים ערוץ שלישי. טיפול, תיקון ו"אחר" נעצרים ב-SMS.
// ============================================================================
export const ESCALATION_HOURS = { pushToSms: 6, smsToEmail: 12 };
export const CRITICAL_TASK_TYPES = ["test", "insurance"];

// ============================================================================
// 🔴 T1 — **הבעלים אינו "מוסלם אליו". הוא נמען בזכות עצמו.**
//
// הסולם המקורי היה: הנהג מקבל, ואם **לא אישר** — מסלימים לבעלים. עדי פירקה
// את זה: אם ההסלמה נורית *כי הנהג לא אישר*, עצם קבלתה מלמדת את הבעלים
// שהנהג לא אישר. **ניקוי נוסח ההודעה לא מנקה את ההסקה.**
//
// לכן: לבעלים סולם **משלו**, מאוחר יותר, והפרדיקט הוא `!completedAt` —
// לעולם לא `!acknowledgedAt` של אדם אחר. ההסקה נמחקת במקום להתרכך.
//
// וזו גם ההנדסה הנכונה: רשת הביטחון נועדה לתפוס טלפון כבוי, התראות חסומות
// ואפליקציה שנמחקה. **הסלמה שמותנית באי-אישור לא תופסת מקרה שבו לא הייתה
// מסירה כלל** — כלומר בדיוק את התרחיש שבשבילו היא קיימת.
// ============================================================================
export const OWNER_LADDER = [7, 3, 1, 0];

// ============================================================================
// V4 signed URLs (פרוסה 2) — סוגרים את N2 ואת דרישת PRD §8.4.
// TTL קצר בכוונה: הכתובת נועדה לפתיחה מיידית של מסמך במסך, לא לשיתוף.
// ⚠️ זה מה שמחליף את `getDownloadURL` עם הטוקן ה**קבוע** על מסמכים רגישים.
// ============================================================================
// ⚠️ 5 דקות, וההנמקה חשובה מהמספר: **מסך החירום לא מושך signed URL בזירת
// תאונה בכלל** — המסמכים מגיעים מהמטמון, או שאינם זמינים אופליין בשום תוקף.
// ה-TTL שולט רק במקרה המקוון, שבו הקישור נצרך בשניות.
//
// 🔴 ונקודת הכשל שאסור להגיע אליה: **המטמון שומר blob, לעולם לא קישור.**
// מטמון עם signed URL עובד מצוין בבדיקות ונשבר בשקט בתאונה שלושה ימים אחר
// כך — פיצ'ר בטיחות שנכשל בדיוק ברגע שבשבילו נבנה. נאכף ב-smoke.
export const SIGNED_URL_TTL_MINUTES = 5;

// חתימות שאסור שיופיעו בשום ערך שנשמר במכשיר (localStorage / Cache Storage).
export const SIGNED_URL_MARKERS = ["X-Goog-Signature", "X-Goog-Credential", "GoogleAccessId"];

// ============================================================================
// O19/R13 — בקרות השליחה. **ברירת המחדל: כבוי.**
//
// R13: התקלה הקלאסית של פרוסה ראשונה בשליחה היא בדיקה ששולחת אלפי הודעות
// אמיתיות. לכן ה-Function **מסרבת לשלוח** אלא אם דגל סביבה מפורש דלוק.
// O19: ובנוסף — מתג עצירה ב-Firestore, שעוצר הכול **בלי deploy**. באג
// בגזירת הסטטוס כבר אינו תצוגה שגויה לאחד; הוא SMS שגוי לכולם.
// ============================================================================
export const RUNTIME_CONFIG_DOC = "config/runtime";
export const SEND_ENABLED_ENV = "NRCAR_SENDING_ENABLED";

// R11 — שעות שקטות. מחוץ לחלון: **דוחים את השלב, לא מדלגים עליו.**
export const QUIET_HOURS = { startHour: 8, endHour: 21 };

// O20 — תקרה יומית לנמען. רשת ביטחון אחרונה מפני באג שלא מקדם nextFireAt:
// מטח SMS למשתמש מבוגר הוא נזק אמיתי, לא רק עלות.
export const MAX_MESSAGES_PER_RECIPIENT_PER_DAY = 6;

// O21 — אחרי כמה כשלים רצופים ערוץ מושבת אוטומטית ומוצג באפליקציה.
export const CHANNEL_FAILURE_LIMIT = 3;

export const DEFAULTS = {
  leadDays: 30, // "כמה זמן מראש להזכיר לי" — ברירת המחדל
  leadDaysOptions: [30, 14, 7],
  testIntervalMonths: 12,
  insuranceIntervalMonths: 12,
  serviceIntervalMonths: 12,
  serviceIntervalKm: 15000,
  // מינימום קריאות מד-אוץ' לחישוב קצב. מתחת לזה — נופלים לזמן בלבד, בשקט.
  minOdometerReadingsForRate: 2,
  docExpiryAlertDays: 30,
};

// ============================================================================
// N6 — מחלקות שמירה. **המספרים ⚖️ עו"ד** (L5 בסקירת עדי); כאן רק המבנה,
// ו-null = טרם נקבע.
// ============================================================================
export const RETENTION_CLASSES = {
  vehicle: { months: null, note: "legal.retention.pending" },
  vehiclePrivate: { months: null, note: "legal.retention.pending" },
  driver: { months: null, note: "legal.retention.pending" },
  vehicleAccess: { months: null, note: "legal.retention.pending" },
  task: { months: null, note: "legal.retention.pending" },
  document: { months: null, note: "legal.retention.pending" },
  personalDoc: { months: null, note: "legal.retention.pending" },
  serviceRecord: { months: null, note: "legal.retention.pending" },
  odometerReading: { months: null, note: "legal.retention.pending" },
  user: { months: null, note: "legal.retention.pending" },
  // יומן התזכורות — נתון תפעולי קצר-טווח. ההמלצה 12 חודשים, **המספר ⚖️**.
  // הניקוי יתבצע ע"י אותו scheduler שמריץ את התזכורות בפרוסה 2.
  "operational-short": { months: null, recommendedMonths: 12, note: "legal.retention.pending" },
};

// ============================================================================
// שמות שדות שאסור שיופיעו בשום ישות. נאכף ב-smoke, לא רק בהערה.
//
//   ת.ז. / מספר רישיון — אין להם מטרה. למסך החירום צריך את *התמונה*,
//        ולתזכורת צריך רק את *התאריך*.
//   misgeret / VIN — חוזר מהמאגר של משרד התחבורה, וה-PRD הסיר אותו מהמודל
//        במפורש (§3.1). לכן המיפוי הוא whitelist ולא spread.
//   url/downloadUrl/downloadURL/signedUrl — N2. הטוקן של getDownloadURL אינו
//        פג; URL ב-Firestore הוא מפתח קריאה בלתי-מאומת ששורד מחיקה.
//   GPS — אין navigator.geolocation באפליקציה, ו-EXIF מופשט בהעלאה. זה גם מה
//        ששומר על התשובה "לא ניטור שיטתי" ומרחיק את חובת ה-DPO.
//   birthDate — isMinor הוא הצהרה של המזמין, לא תאריך לידה (עדי 1.3, פריט 1).
// ============================================================================
export const FORBIDDEN_FIELDS = [
  "nationalId",
  "idNumber",
  "tz",
  "licenceNumber",
  "licenseNumber",
  "drivingLicenceNumber",
  "drivingLicenseNumber",
  "misgeret",
  "vin",
  "chassis",
  "chassisNumber",
  "url",
  "downloadUrl",
  "downloadURL",
  "signedUrl",
  "gps",
  "latitude",
  "longitude",
  "geo",
  "birthDate",
];

// שדות שאסורים על ישות **הרכב** בלבד (הם לגיטימיים ב-VehiclePrivate).
export const VEHICLE_FORBIDDEN_FIELDS = ["purchasePrice", "price", "insurancePremium", "ownerNotes"];

// ============================================================================
// N1 — מטמון מקומי. **המפתח כולל uid**: בלי זה, טאבלט משפחתי משותף מציג
// למשתמש ב' את כרטיס החירום של משתמש א'.
// ============================================================================
export const LOCAL_CACHE_PREFIX = "nrcar:emergency";
export const LOCAL_DATA_KEY = "nrcar_data";
export const LOCAL_LANG_KEY = "nrcar_lang";
// שם ה-Cache Storage לקבצי המסמכים (רק במצב textAndDocs, פרוסה 2).
export const DOC_CACHE_NAME = "nrcar-docs";

// גבול גודל לקובץ שנשמר base64 ב-localStorage (מצב מקומי בלבד).
export const LOCAL_FILE_MAX_BYTES = 1.5 * 1024 * 1024;
// גבול העלאה בענן — נאכף גם ב-storage.rules (O6).
export const CLOUD_FILE_MAX_BYTES = 10 * 1024 * 1024;

export const LOCALE_BY_LANG = { he: "he-IL", en: "en-GB" };

// מספרי חירום ציבוריים — קישורי tel: בלבד, לעולם לא חיוג תכנותי.
export const EMERGENCY_NUMBERS = { police: "100", mda: "101" };

// ============================================================================
// הגדרות ברירת מחדל של משק הבית.
//   emergencyAuth: "session"  — סשן קיים מספיק (הכרעת המוצר; עדי אישרה).
//                  "always"   — מוצג כרדיו מושבת "בקרוב", לא כמימוש חלש.
//   emergencyOffline: "text"  — שדות הטקסט של הכרטיס נשמרים מקומית.
//                  "textAndDocs" — opt-in מפורש; כרוך בהסכמה נפרדת (עדי 1.1ג).
// ============================================================================
export const EMERGENCY_AUTH_MODES = ["session", "always"];
export const EMERGENCY_OFFLINE_MODES = ["text", "textAndDocs"];

export const DEFAULT_SETTINGS = {
  policyVersion: POLICY_VERSION,
  onboarded: false,
  leadDays: DEFAULTS.leadDays,
  // השעה (Asia/Jerusalem) שבה יוצאות התזכורות של משק הבית. ה-scheduler רץ
  // כל שעה ומטפל רק במשקי הבית שהשעה שלהם התאימה — כך אפשר לכבד העדפה
  // אישית בלי להריץ פונקציה נפרדת לכל משתמש.
  notificationHour: 8,
  emergencyAuth: "session",
  emergencyOffline: "text",
  language: "he",
  textSize: "default",
};

// מצב פתיחה ריק. `household` הוא מסמך השורש households/{hid};
// המערכים הם תת-האוספים.
export const EMPTY = {
  schemaVersion: SCHEMA_VERSION,
  household: {
    id: null,
    name: "",
    createdAt: null,
    // N4 — members: מיפוי uid→role. **זה** מקור התפקיד. אף כלל לא משווה
    // hid ל-request.auth.uid: העברת בעלות ובעלים שני (בני זוג) הם תרחישים
    // ודאיים במוצר לקהל מבוגר, ושוויון מחרוזות הופך אותם להגירה מלאה.
    members: {},
  },
  settings: { ...DEFAULT_SETTINGS },
  // פרופיל המשתמש הנוכחי (users/{uid}) — נכתב ע"י הנושא בלבד.
  profile: null,
  vehicles: [],
  vehiclesPrivate: [],
  drivers: [],
  vehicleAccess: [],
  tasks: [],
  documents: [],
  personalDocs: [],
  serviceRecords: [],
  odometerReadings: [],
};
