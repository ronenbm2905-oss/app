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

// אוספים שנהג עשוי לקרוא מהם (בפרוסה 2), ברמת-מסמך ובכפוף לתנאים למטה.
export const DRIVER_READABLE_COLLECTIONS = [
  "vehicles",
  "assignments",
  "fines",
  "fineScans",
  "odometerReadings",
  "serviceRecords",
  "documents",
  "incidents",
  "leaseCompanies",
];

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
