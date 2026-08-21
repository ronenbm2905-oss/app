// ============================================================================
// access.js — מודל הגישה כקוד טהור, במקום כהערה ב-rules.
//
// למה זה קיים כבר בפרוסה 1, שהיא admin-only: הבידוד של פרוסה 2 חייב להיות
// **ניתן לבדיקה עכשיו**, כשעוד אפשר לשנות סכימה בזול. הפונקציות כאן מבטאות
// בדיוק את מה ש-firestore.rules יאכפו, ומכוסות ב-smoke tests. אם בדיקה כאן
// נופלת — ה-rules יהיו שגויים.
//
// ⚠️ זו **אינה** שכבת אכיפה. האכיפה היא ב-rules בלבד; זה הביטוי הבדיק שלה.
// ============================================================================

import { ADMIN_ONLY_COLLECTIONS, ENTITY_COLLECTIONS } from "../constants.js";
import { inRange } from "./dates.js";

// ============================================================================
// מה שנהג באמת קורא בפרוסה 2 — הרשימה הזו **תואמת אחד-לאחד** ל-firestore.rules.
//
// היא צומצמה ביודעין מול הטיוטה של פרוסה 1, ובשני מקומות היא **צרה יותר**
// ממה שהאפיון התיר:
//   • `vehicles` **אינו** כאן. הנהג אינו קורא את מסמך הרכב בכלל, אלא את
//     ההיטל `driverPortal/{driverId}` (utils/portal.js). הסיבה מבנית: ב-rules
//     אין שאילתות, ולכן "האם הוא מחזיק את הרכב הזה היום" אינה שאלה שאפשר
//     לשאול על מסמך הרכב — וכל פתרון שכן פותח את מסמך הרכב מדליף בשקט כל
//     שדה שיתווסף לרכב בעתיד. זו צורת הכשל של D1.
//   • `leaseCompanies` **אינו** כאן. פרטי חברת הליסינג נכנסים לתוך ההיטל.
//     לנהג אין דרך להוכיח ב-rules זיקה לחברת ליסינג מסוימת, ולכן פתיחת
//     האוסף הייתה חושפת את **כל** ספקי החברה לכל עובד.
// המסך של הנהג מציג בדיוק את אותו מידע; רק ההרשאה צרה יותר.
//
// `serviceRecords` / `documents` / `incidents` אינם נפתחים בסבב הזה כלל —
// אין להם מסך בפורטל. (`driverCanReadVehicleDocument` נשאר להלן כביטוי בדיק
// לסבב הבא; **הוא אינו נאכף כרגע**, וזה מכוון.)
// ============================================================================
export const DRIVER_READABLE_COLLECTIONS = [
  "driverPortal", // ההיטל: הרכב שלו, בלי שדות מסחריים
  "drivers", // הרשומה שלו בלבד (userId == uid), או תביעה חד-פעמית לפי מייל
  "assignments",
  "fines",
  "fineScans",
  "odometerReadings",
];

// אוספים שתוכננו לנהג אבל **טרם נפתחו** — כדי שהפער יהיה מתועד ולא נשכח.
export const DRIVER_PLANNED_COLLECTIONS = ["documents", "serviceRecords", "incidents"];

// אוספים שנהג לעולם לא קורא מהם.
export const DRIVER_DENIED_COLLECTIONS = ENTITY_COLLECTIONS.filter(
  (c) => !DRIVER_READABLE_COLLECTIONS.includes(c)
);

// D1 — בדיקת שפיות: כל אוסף אדמין-בלבד באמת חסום לנהג.
export function adminOnlyCollectionsAreDenied() {
  return ADMIN_ONLY_COLLECTIONS.every((c) => !DRIVER_READABLE_COLLECTIONS.includes(c));
}

// הנהג המשויך ל-uid נתון (F1 — לפי uid בלבד, לעולם לא לפי email).
export function driverForUid(data, uid) {
  if (!uid) return null;
  return (
    (data.drivers || []).find(
      (d) => d.userId === uid && d.portalStatus === "active" && d.status !== "archived"
    ) || null
  );
}

// הרכב שהנהג מחזיק היום.
export function activeVehicleIdsForUid(data, uid, today) {
  const driver = driverForUid(data, uid);
  if (!driver) return [];
  return (data.assignments || [])
    .filter((a) => a.driverId === driver.id && inRange(today, a.fromDate, a.toDate))
    .map((a) => a.vehicleId);
}

// ============================================================================
// D2 — סריקת קנס: מורשית לפי **הקנס**, לא לפי הרכב.
// זו הדליפה שעדי תפסה: רכב עובר בין נהגים לאורך השנים, ואם הסריקה הייתה
// מסמך-רכב, המחזיק הנוכחי היה קורא את הקנסות של המחזיק הקודם.
// ============================================================================
export function driverCanReadFineScan(data, scan, uid) {
  if (!scan || !uid) return false;
  const driver = driverForUid(data, uid);
  if (!driver) return false;
  // ההרשאה נשענת על המפתח המדונרמל (D3) — בדיקת שוויון פשוטה, בלי join.
  if (scan.driverUid) return scan.driverUid === uid;
  const fine = (data.fines || []).find((f) => f.id === scan.fineId);
  return Boolean(fine && fine.driverId === driver.id);
}

export function driverCanReadFine(data, fine, uid) {
  if (!fine || !uid) return false;
  const driver = driverForUid(data, uid);
  if (!driver) return false;
  if (fine.driverUid) return fine.driverUid === uid;
  return fine.driverId === driver.id;
}

// מסמכי רכב (ביטוח/רישיון/טסט/חוזה) — לנהג **הפעיל** של הרכב.
export function driverCanReadVehicleDocument(data, doc, uid, today) {
  if (!doc || !uid) return false;
  return activeVehicleIdsForUid(data, uid, today).includes(doc.vehicleId);
}

// ============================================================================
// D1 — ההיטל שנשלח למכשיר של הנהג. אין כאן monthlyCost, ואין הערות אדמין.
// ============================================================================
export function driverVehicleProjection(vehicle) {
  if (!vehicle) return null;
  return {
    id: vehicle.id,
    plate: vehicle.plate,
    model: vehicle.model,
    manufacturer: vehicle.manufacturer,
    leaseCompanyId: vehicle.leaseCompanyId,
    contractEnd: vehicle.contractEnd,
    status: vehicle.status,
    currentKm: vehicle.currentKm,
    annualKmAllowance: vehicle.annualKmAllowance,
  };
}

// כל השדות שאסור שיגיעו למכשיר של נהג — נבדק ב-smoke מול הישויות בפועל.
export const DRIVER_FORBIDDEN_FIELDS = ["monthlyCost", "commercialNotes", "adminNotes", "adminAssessment"];

export function leaksForbiddenField(obj) {
  if (!obj || typeof obj !== "object") return [];
  return DRIVER_FORBIDDEN_FIELDS.filter((f) => Object.prototype.hasOwnProperty.call(obj, f));
}

// ============================================================================
// ownedByDriver — **הביטוי המדויק של סעיף הקריאה ב-rules** לכל ישות נושאת-נהג
// (assignment / fine / fineScan / odometerReading).
//
// שני התנאים, ובסדר הזה:
//   1. `driverId` של המסמך הוא רשומת הנהג **הפעילה** של ה-uid הזה. זה התנאי
//      שנושא את המשקל, והוא זה שגורם ל-`portalStatus='revoked'` לשלול גישה
//      **מיד** — בלי לגעת באף מסמך אחר.
//   2. אם `driverUid` מדונרמל (D3) — הוא חייב להסכים. נתונים שיובאו לפני
//      הקישור נושאים `driverUid: null`, ולכן היעדרו אינו שולל גישה; אבל ערך
//      **סותר** כן שולל, כי אחד משני השדות משקר ואין לדעת איזה.
//
// ⚠️ ההרשאה נשענת על **הישות**, לא על הרכב. זו הדליפה שעדי תפסה ב-D2: רכב
// עובר בין נהגים לאורך השנים, וסריקת קנס של המחזיק הקודם אסור שתהיה קריאה
// למחזיק הנוכחי. השיוך הוא לפי הקנס.
// ============================================================================
export function ownedByDriver(data, entity, uid) {
  if (!entity || !uid) return false;
  const driver = driverForUid(data, uid);
  if (!driver) return false;
  if (entity.driverId !== driver.id) return false;
  if (entity.driverUid !== null && entity.driverUid !== undefined && entity.driverUid !== uid) {
    return false;
  }
  return true;
}

// ההיטל של הנהג — נקרא לפי **מזהה המסמך**, שהוא driverId. אין כאן שאילתה
// ואין join: זו בדיקה אחת על נתיב ידוע, וזו כל הסיבה ש-id === driverId.
export function driverCanReadPortalEntry(data, entry, uid) {
  if (!entry || !uid) return false;
  const driver = driverForUid(data, uid);
  return Boolean(driver && entry.driverId === driver.id);
}

// ============================================================================
// driverCanWriteReading — הכתיבה **היחידה** שנהג מבצע במערכת.
//
// המפתח: `vehicleId` נבדק מול ההיטל (`driverPortal/{driverId}.vehicleId`)
// ולא מול `assignments`. ב-rules אין שאילתות, ולכן זו הדרך היחידה לענות
// "האם זה הרכב שלו **היום**" בקריאת מסמך אחת בנתיב ידוע.
// ============================================================================
export function driverCanWriteReading(data, reading, uid) {
  if (!reading || !uid) return false;
  const driver = driverForUid(data, uid);
  if (!driver) return false;
  if (reading.driverId !== driver.id) return false;
  if (reading.driverUid !== uid) return false;
  if (reading.source !== "driver") return false;
  const entry = (data.driverPortal || []).find((p) => p.driverId === driver.id) || null;
  if (!entry || !entry.vehicleId) return false;
  if (reading.vehicleId !== entry.vehicleId) return false;
  // D4 — בלי צילום ובלי מיקום. Storage דורש Blaze ואינו פעיל, ו-navigator.
  // geolocation לא נקרא בשום מקום בפורטל; הכלל אוכף את זה גם בצד השרת.
  if (reading.photoRef) return false;
  if (reading.photoStorageMode && reading.photoStorageMode !== "none") return false;
  // D4.3 — בלי חותמת דיוק-שנייה. `createdAt` של דיווח נהג הוא **היום**, לא
  // רגע הלחיצה: אחרת המערכת מתעדת מתי בדיוק העובד עמד ליד הרכב.
  if (reading.createdAt !== reading.date) return false;
  return true;
}
