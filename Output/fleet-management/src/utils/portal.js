// ============================================================================
// portal.js — **ההיטל שנשלח למכשיר של הנהג**, כישות עצמאית.
//
// ============================================================================
// למה אוסף נפרד ולא קריאה ישירה ל-`vehicles`
// ============================================================================
// firestore.rules לא יודעים לענות על "האם המשתמש הזה מחזיק את הרכב הזה
// **היום**": זו שאלה שדורשת שאילתה על `assignments`, ובכללים אין שאילתות.
// שלוש הדרכים האפשריות היו:
//   1. לפתוח לנהג את כל אוסף הרכבים — 36 רכבים במקום אחד. נפסל.
//   2. לדנרמל `currentDriverId` על מסמך הרכב — עובד, אבל משאיר את הנהג
//      קורא את **מסמך הרכב עצמו**, ולכן כל שדה שיתווסף לרכב בעתיד ידלוף
//      אליו בשקט. זו בדיוק צורת הכשל של D1 (שדה שנוסף במקום הלא נכון).
//   3. **ההיטל כמסמך משלו** — `orgs/{orgId}/driverPortal/{driverId}` — שמכיל
//      רק את מה שהנהג רשאי לראות. זה מה שנבחר.
//
// היתרון של (3) הוא שהבידוד הוא **מבני ולא הצהרתי**: אי אפשר להדליף לנהג
// שדה שלא הוכנס לכאן ביד. `access.js:driverVehicleProjection` כבר תיאר את
// ההיטל הזה מפרוסה 1 — כאן הוא הופך למסמך אמיתי.
//
// ⚠️ הנגזרת חייבת להיות **טהורה ויציבה**: אין בה `nowIso()` ואין `newId()`.
// המסמכים נכתבים ב-diff (`writeOrgDiff`), ושדה שמשתנה בכל חישוב היה גורם
// לכתיבה חוזרת של 27 מסמכים בכל שמירה — ואם היינו מפרסמים גם בטעינה, ללולאה.
// ============================================================================

import { normalizeEmail } from "./admins.js";
import { todayIso } from "./dates.js";
import { inRange } from "./dates.js";

export const PORTAL_COLLECTION = "driverPortal";

// חברת הליסינג נכנסת **לתוך** ההיטל ולא נקראת מהאוסף שלה: לנהג אין דרך
// להוכיח ב-rules שהוא קשור לחברת ליסינג מסוימת (אין שאילתות הפוכות), ולכן
// פתיחת האוסף הייתה חושפת את כל ספקי החברה לכל עובד. חברת ליסינג היא ישות
// עסקית ולא PII, ולכן העתקת פרטי הקשר לכאן אינה נוגעת ב-D3 (שאוסר דנרמול
// **שם עובד**, כי הוא שובר את האנונימיזציה של D6).
function leaseBlock(companies, id) {
  const c = (companies || []).find((x) => x.id === id) || null;
  if (!c) return null;
  return {
    id: c.id,
    name: c.name || "",
    contactName: c.contactName || "",
    phone: c.phone || "",
    email: c.email || "",
  };
}

// ============================================================================
// buildDriverPortal — ההיטל לכל נהג שמחזיק רכב היום.
//
// נבנה לכל נהג פעיל, **גם לפני שהוא קישר חשבון**: הקישור הוא אירוע שהנהג
// יוזם מהטלפון שלו, ואם ההיטל היה נוצר רק אחריו הוא היה רואה מסך ריק עד
// שאדמין ייכנס וישמור משהו. הרשאת הקריאה נשענת ממילא על `drivers/{id}.userId`
// ב-rules, ולא על עצם קיום המסמך.
// ============================================================================
export function buildDriverPortal(data, today = todayIso()) {
  const out = [];
  for (const driver of data?.drivers || []) {
    if (!driver?.id) continue;
    if (driver.status === "archived") continue;

    const asg =
      (data.assignments || []).find(
        (a) => a.driverId === driver.id && inRange(today, a.fromDate, a.toDate)
      ) || null;
    const vehicle = asg ? (data.vehicles || []).find((v) => v.id === asg.vehicleId) || null : null;

    out.push({
      // id === driverId בכוונה: זה מה שהופך את הרשאת הקריאה ב-rules לבדיקה
      // אחת על נתיב ידוע (`drivers/{driverId}.userId == uid`), בלי שאילתה.
      id: driver.id,
      driverId: driver.id,
      orgId: driver.orgId || data?.org?.id || null,
      assignmentId: asg?.id || null,
      fromDate: asg?.fromDate || null,
      toDate: asg?.toDate || null,
      vehicleId: vehicle?.id || null,
      // ⚠️ D1 — הרשימה הזו היא **חוזה**. אין כאן monthlyCost, אין notes של
      // האדמין, ואין שדה שיתווסף לרכב בעתיד. מי שמוסיף שדה עושה זאת ביודעין.
      plate: vehicle?.plate || "",
      model: vehicle?.model || "",
      manufacturer: vehicle?.manufacturer || "",
      year: vehicle?.year ?? null,
      contractEnd: vehicle?.contractEnd || null,
      leaseCompany: vehicle ? leaseBlock(data.leaseCompanies, vehicle.leaseCompanyId) : null,
      schemaVersion: data?.schemaVersion || 2,
    });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function portalEntryForDriver(portal, driverId) {
  if (!driverId) return null;
  return (portal || []).find((p) => p.driverId === driverId) || null;
}

// ============================================================================
// normalizeDriverEmails — הכתובת ב-`Driver.email` חייבת להיות lowercase.
//
// לא קוסמטיקה: הקישור מתבצע בשאילתה `where('email','==', <המייל מהטוקן>)`,
// שהיא **התאמה מדויקת**. רשומה שנשמרה "Hilda@…" פשוט לא תימצא, והעובד יראה
// "אין לך הרשאה" בלי שאף אחד יבין למה. אותה מלכודת בדיוק כמו ב-allowlist של
// האדמינים (admins.js), רק שכאן אין מסך שמראה את הרשימה.
// ============================================================================
export function normalizeDriverEmails(drivers) {
  return (drivers || []).map((d) => {
    const e = normalizeEmail(d?.email);
    return e === (d?.email ?? "") ? d : { ...d, email: e };
  });
}

// ============================================================================
// portalPublishNeeded — האם המצב שבענן כבר משקף את הנגזרת.
//
// זה מה שמאפשר "פרסום בטעינה" בלי לולאה: השוואה עמוקה, ואם אין הפרש —
// אין כתיבה. ההפרש כן משתנה **פעם ביום** (כי `today` זז), וזה רצוי: כך
// החזקה שהסתיימה אתמול מפסיקה להיות קריאה לנהג בלי שאדמין יעשה דבר.
// ============================================================================
export function portalPublishNeeded(data, today = todayIso()) {
  const next = buildDriverPortal(data, today);
  const prev = [...(data?.driverPortal || [])].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );
  if (JSON.stringify(next) !== JSON.stringify(prev)) return true;
  return (data?.drivers || []).some((d) => normalizeEmail(d?.email) !== (d?.email ?? ""));
}

// ============================================================================
// createDriverReading — הישות שנהג יוצר. **הפונקציה היחידה** שמייצרת
// `source: 'driver'`, וכל תנאי בה מקביל לתנאי ב-firestore.rules.
//
// ⚠️ D4 — **היעדר הצילום הוא החלטה, לא מקריות טכנית.** נכון להיום Storage
// דורש Blaze ואינו פעיל, אבל `schema.js` עדיין מגדיר `photoRef`/`photoName`/
// `photoStorageMode`/`metadataStripped`. הפעלת Blaze ועוד חמש-עשרה שורות היו
// מחזירות את כל וקטור ה-EXIF **בלי סקירה** — כי לא נוסף שדה, שדה קיים פשוט
// התמלא. לכן השדות **לא נמחקו אלא ננעלו**: כאן, ב-`driverCanWriteReading`,
// ב-`isDriverReadingCreate` שב-rules, ובבדיקה שסורקת את קוד הפורטל.
//
// ⚠️ D4.3 — `createdAt === date`. חותמת דיוק-שנייה על דיווח ק"מ מתעדת מתי
// בדיוק העובד עמד ליד הרכב; זה מעקב אחר עובדים. התאריך הוא כל מה שנדרש כדי
// לחשב מכסה, וכל מה שנשמר.
//
// ⚠️ אין `navigator.geolocation` בשום מקום בפורטל, ואין שדה מיקום בישות.
// ============================================================================
export const DRIVER_READING_LOCKED = {
  photoRef: null,
  photoName: "",
  photoStorageMode: "none",
  metadataStripped: false,
};

export function createDriverReading({ id, orgId, driverId, driverUid, vehicleId, km, date }) {
  return {
    id,
    orgId: orgId || null,
    createdAt: date,
    updatedAt: date,
    schemaVersion: 2,
    vehicleId: vehicleId || null,
    driverId: driverId || null,
    driverUid: driverUid || null,
    date,
    km: Number(km),
    source: "driver",
    ...DRIVER_READING_LOCKED,
    retentionClass: "odometer",
    notes: "",
  };
}

// ============================================================================
// validateDriverReading — מה שהמסך חוסם לפני שה-rules ידחו.
//
// `previousKm` נבדק כ**אזהרה ולא כחסימה**: קריאה נמוכה מהקודמת קורית בעולם
// האמיתי (החלפת לוח מחוונים, טעות בקריאה הקודמת), ומסך שחוסם אותה מלמד את
// העובד שלא כדאי לדווח. 2.3(ג) בהכוונת עדי — תיקון הוא דיווח נוסף, לא מחיקה.
// ============================================================================
export const KM_MAX = 3000000;

export function validateDriverReading({ km, vehicleId }, { previousKm = null } = {}) {
  const errors = [];
  const warnings = [];
  const n = Number(km);
  if (km === "" || km === null || km === undefined || !Number.isFinite(n)) {
    errors.push("odoReport.err.km");
  } else if (!Number.isInteger(n)) errors.push("odoReport.err.integer");
  else if (n <= 0) errors.push("odoReport.err.km");
  else if (n >= KM_MAX) errors.push("odoReport.err.tooBig");
  if (!vehicleId) errors.push("odoReport.err.noVehicle");
  if (!errors.length && previousKm !== null && n < previousKm) warnings.push("odoReport.warn.lower");
  return { errors, warnings, ok: errors.length === 0 };
}
