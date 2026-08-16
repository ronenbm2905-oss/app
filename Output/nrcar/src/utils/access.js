// ============================================================================
// access.js — מודל הגישה **כקוד טהור**, במקום כהערה ב-rules.
//
// למה זה קיים כבר בפרוסה 1, שהיא בעלים-בלבד: הבידוד של פרוסה 2 חייב להיות
// **ניתן לבדיקה עכשיו**, כשעוד אפשר לשנות סכימה בזול. הפונקציות כאן מבטאות
// בדיוק את מה ש-firestore.rules יאכפו, ומכוסות ב-smoke. אם בדיקה כאן
// נופלת — ה-rules שגויים.
//
// ⚠️ זו **אינה** שכבת אכיפה. האכיפה היא ב-rules בלבד; זה הביטוי הבדיק שלה.
//
// ============================================================================
// 🔴 N4 — החוק המרכזי של הקובץ הזה:
//   **התפקיד נקרא מ-`household.members[uid]`. לעולם לא מהשוואת מזהים.**
// אין כאן, ולא יהיה, שום `hid === uid`. hid הוא מזהה אטום. שני תרחישים
// ודאיים שוברים את הקיצור הזה: בעלים שני (בני זוג), והעברת בעלות — שהיא
// תרחיש ודאי במוצר לקהל מבוגר.
// ============================================================================

import { OWNER_ONLY_COLLECTIONS, SUBJECT_ONLY_COLLECTIONS, SERVER_ONLY_COLLECTIONS } from "../constants.js";
import { vehicleAccessId } from "../schema.js";

export { vehicleAccessId };

// -- תפקידים ----------------------------------------------------------------
export function roleOf(household, uid) {
  if (!household || !uid) return null;
  return household.members?.[uid] ?? null;
}

export function isOwner(household, uid) {
  return roleOf(household, uid) === "owner";
}

export function isMember(household, uid) {
  return roleOf(household, uid) !== null;
}

export function owners(household) {
  return Object.entries(household?.members || {})
    .filter(([, role]) => role === "owner")
    .map(([uid]) => uid);
}

// -- גישה לרכב --------------------------------------------------------------
// בפרוסה 1 רק הבעלים; בפרוסה 2 נוסף הנהג דרך vehicleAccess. מבוטא כבר עכשיו
// כדי שהבדיקה "נהג עם גישה לרכב א' לא קורא את רכב ב'" תרוץ היום.
export function hasVehicleAccess(data, uid, vehicleId) {
  const id = vehicleAccessId(uid, vehicleId);
  if (!id) return false;
  return (data?.vehicleAccess || []).some((a) => a.id === id);
}

export function canReadVehicle(data, household, uid, vehicleId) {
  if (isOwner(household, uid)) return true;
  return hasVehicleAccess(data, uid, vehicleId);
}

export function vehicleIdsForUid(data, household, uid) {
  if (isOwner(household, uid)) return (data?.vehicles || []).map((v) => v.id);
  return (data?.vehicleAccess || []).filter((a) => a.driverUid === uid).map((a) => a.vehicleId);
}

// -- vehiclesPrivate — בעלים בלבד, לתמיד -----------------------------------
export function canReadVehiclePrivate(household, uid) {
  return isOwner(household, uid);
}

// ============================================================================
// personalDocs — **read = נושא המידע בלבד. גם הבעלים לא.**
// הבעלים מקבל delete (לצורך cascade) בלי read.
// ============================================================================
export function canReadPersonalDoc(doc, uid) {
  if (!doc || !uid) return false;
  return doc.driverUid === uid;
}

export function canWritePersonalDoc(doc, uid) {
  return canReadPersonalDoc(doc, uid);
}

export function canDeletePersonalDoc(household, doc, uid) {
  return isOwner(household, uid) || canReadPersonalDoc(doc, uid);
}

// -- מסמכי רכב --------------------------------------------------------------
// visibility:'shared' = רישיון רכב + ביטוח חובה — נהג שנעצר צריך אותם.
// visibility:'owner'  = פוליסה + קבלות — בעלים בלבד, לתמיד.
export function canReadDocument(data, household, uid, doc) {
  if (!doc) return false;
  if (isOwner(household, uid)) return true;
  if (doc.visibility !== "shared") return false;
  return hasVehicleAccess(data, uid, doc.vehicleId);
}

// -- כתיבה — ניהול המשימות והרכבים בלעדי לבעלים (PRD פרק 6) ----------------
export function canEdit(household, uid) {
  return isOwner(household, uid);
}

// N7 — guardianConsent ו-isMinor: בעלים בלבד.
export function canWriteGuardianFields(household, uid) {
  return isOwner(household, uid);
}

// ============================================================================
// בדיקות שפיות על התצורה — נקראות מה-smoke.
// ============================================================================
export const DRIVER_READABLE_COLLECTIONS = ["vehicles", "tasks", "documents", "vehicleAccess"];

export function ownerOnlyCollectionsAreDenied() {
  return OWNER_ONLY_COLLECTIONS.every((c) => !DRIVER_READABLE_COLLECTIONS.includes(c));
}

export function subjectOnlyCollectionsAreDenied() {
  return SUBJECT_ONLY_COLLECTIONS.every((c) => !DRIVER_READABLE_COLLECTIONS.includes(c));
}

export function serverOnlyCollectionsAreDenied() {
  return SERVER_ONLY_COLLECTIONS.every((c) => !DRIVER_READABLE_COLLECTIONS.includes(c));
}

// ============================================================================
// O7 — מיזעור כרטיס החירום: **שם + טלפון בלבד** של הבעלים.
// בלי כתובת, בלי מזהים, בלי מייל. מה שלא על המסך לא דולף — וזה המסך שנפתח
// כשמישהו אחר עשוי להחזיק את הטלפון הפתוח.
// ============================================================================
export function ownerContactProjection(profile) {
  if (!profile) return null;
  return { name: profile.displayName || "", phone: profile.phone || "" };
}
