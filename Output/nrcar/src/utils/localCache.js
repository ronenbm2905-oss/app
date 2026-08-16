// ============================================================================
// localCache.js — 🔴 N1: **המטמון במכשיר הוא חלק מ-cascade המחיקה.**
//
// בנינו 4 דומייני Storage ו-personalDocs שגם הבעלים לא קורא, כדי שבן משפחה
// לא יגיע למסמכים שאינם שלו. **מטמון שלא מתנקה עוקף את כל זה בבת אחת:**
// נהג שהוסר ממשק הבית ממשיך לראות את כרטיס החירום המלא, אופליין, לנצח.
// כך "מחיקה" הופכת לתיאורטית — הכשל שכבר נסגר בצד השרת חוזר בצד הלקוח.
// ההקשר הוא לא תיאורטי: משק בית מתפרק (פרידה), רכב נמכר, בן משפחה עוזב.
//
// שני הכללים:
//   1. **מפתח המטמון כולל את ה-uid**: `nrcar:emergency:<uid>:<vehicleId>`.
//      בלי זה, טאבלט משפחתי משותף מציג למשתמש ב' את הכרטיס של משתמש א'.
//   2. `purgeLocalCache` נקראת ב**שלושה** מסלולים: יציאה מהחשבון, החלפת
//      משתמש (onAuthStateChanged ל-uid אחר), ומחיקת/ארכוב מסמך או רכב.
//
// ⚠️ הבטחה שחייבת להיות אמת: הטקסט שמוצג למשתמש ב-opt-in אומר "הוא יימחק
// כשתתנתק מהאפליקציה". אם המטמון שורד התנתקות — זה מצג שווא.
// ============================================================================

import { LOCAL_CACHE_PREFIX, DOC_CACHE_NAME } from "../constants.js";

// N1(1) — המפתח. פונקציה אחת, כדי שלא ייבנה מפתח בלי uid בשום מקום.
export function emergencyCacheKey(uid, vehicleId) {
  if (!uid || !vehicleId) return null;
  return `${LOCAL_CACHE_PREFIX}:${uid}:${vehicleId}`;
}

function storage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function allCacheKeys() {
  const ls = storage();
  if (!ls) return [];
  const keys = [];
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k && k.startsWith(`${LOCAL_CACHE_PREFIX}:`)) keys.push(k);
  }
  return keys;
}

export function keyBelongsToUid(key, uid) {
  return typeof key === "string" && key.startsWith(`${LOCAL_CACHE_PREFIX}:${uid}:`);
}

// ============================================================================
// ⚠️ **המטמון שומר טקסט (ובעתיד blob) — לעולם לא קישור חתום.**
//
// זו נקודת הכשל הגרועה ביותר האפשרית במוצר הזה: מטמון שמכיל signed URL
// **עובד מצוין בבדיקות ונשבר בשקט בתאונה שלושה ימים אחר כך**, כי הקישור פג.
// פיצ'ר בטיחות שנכשל בדיוק ברגע שבשבילו נבנה, ובאופן שאף בדיקה רגילה לא
// רואה. נאכף ב-smoke: אין `X-Goog-Signature` בשום ערך שנשמר.
// ============================================================================

// -- כתיבה/קריאה של כרטיס החירום הטקסטואלי ----------------------------------
// ברירת המחדל היא `emergencyOffline: "text"` — שדות הטקסט בלבד.
// **קובצי המסמכים אינם נשמרים כאן**, ובוודאי לא כתובות הורדה (N2).
export function writeEmergencyCache(uid, vehicleId, card) {
  const ls = storage();
  const key = emergencyCacheKey(uid, vehicleId);
  if (!ls || !key) return false;
  try {
    ls.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), card }));
    return true;
  } catch {
    return false; // מכסה מלא / מצב פרטי — לא מפילים את המסך
  }
}

export function readEmergencyCache(uid, vehicleId) {
  const ls = storage();
  const key = emergencyCacheKey(uid, vehicleId);
  if (!ls || !key) return null;
  try {
    const raw = ls.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ============================================================================
// purgeLocalCache — הצלע השלישית של ה-cascade.
//   purgeLocalCache(uid)  → מוחק את המטמון של המשתמש הזה.
//   purgeLocalCache()     → מוחק **הכול** (יציאה מהחשבון / מחיקת חשבון).
// מוחק גם את ה-Cache Storage של קובצי המסמכים (רלוונטי ל-textAndDocs).
// ============================================================================
export function purgeLocalCache(uid = null) {
  const ls = storage();
  let removed = 0;
  if (ls) {
    for (const k of allCacheKeys()) {
      if (uid && !keyBelongsToUid(k, uid)) continue;
      ls.removeItem(k);
      removed++;
    }
  }
  purgeDocCache();
  return removed;
}

// מטמון של משתמש **אחר** — נקרא כשה-uid מתחלף על אותו מכשיר.
export function purgeOtherUsersCache(currentUid) {
  const ls = storage();
  let removed = 0;
  if (!ls) return removed;
  for (const k of allCacheKeys()) {
    if (currentUid && keyBelongsToUid(k, currentUid)) continue;
    ls.removeItem(k);
    removed++;
  }
  return removed;
}

// מטמון הקבצים (Cache Storage). קיים גם בפרוסה 1 כדי שהניקוי יהיה במקום
// אחד ביום שבו `textAndDocs` יידלק.
export function purgeDocCache() {
  try {
    if (typeof caches !== "undefined" && caches?.delete) {
      return caches.delete(DOC_CACHE_NAME);
    }
  } catch {
    /* אין Cache Storage בסביבה הזאת — לא נורא */
  }
  return Promise.resolve(false);
}

// מחיקה ממוקדת: רכב שנמחק/אורכב, או מסמך שהוסר.
export function purgeVehicleCache(uid, vehicleId) {
  const ls = storage();
  const key = emergencyCacheKey(uid, vehicleId);
  if (!ls || !key) return false;
  ls.removeItem(key);
  return true;
}
