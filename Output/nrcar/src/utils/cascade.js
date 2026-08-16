// ============================================================================
// cascade.js — מחיקות עם ניקוי תלויות. טהור: מקבל data ומחזיר data חדש.
//
// 🔴 N1 — **ל-cascade יש שלוש צלעות, לא שתיים:**
//         Firestore → Storage → **מכשיר**.
// הצלע השלישית (localCache.js) היא מה שמונע את התרחיש שבו נהג שהוסר ממשק
// הבית ממשיך לראות את כרטיס החירום המלא, אופליין, לנצח. אפשר לבנות 4
// דומייני Storage מושלמים ולהדליף הכול דרך localStorage.
//
// חלוקת העבודה:
//   · כאן            — Firestore (הפונקציות הטהורות)
//   · retention.js   — איסוף נתיבי ה-Storage שיש למחוק
//   · files.js       — המחיקה בפועל מ-Storage (וביטול הטוקן הקבוע)
//   · localCache.js  — המכשיר
// המתזמר הוא `hooks/useActions.js`, שקורא לשלושתם ברצף.
// ============================================================================

import { collectVehicleStoragePaths, collectDriverStoragePaths } from "./retention.js";
import { purgeVehicleCache, purgeLocalCache } from "./localCache.js";
import { nowIso } from "./id.js";

export { collectVehicleStoragePaths, collectDriverStoragePaths, purgeVehicleCache, purgeLocalCache };

// ============================================================================
// archiveVehicle — **הדרך הנכונה להיפרד מרכב** (PRD §7: רכב שנמכר עובר
// לארכיון כדי לשמר היסטוריה ומסמכים). התזכורות נפסקות, שום דבר לא נמחק.
// זו לא מחיקה, וההבחנה נשמרת גם בנוסח שהמשתמש רואה.
// ============================================================================
export function archiveVehicle(data, vehicleId) {
  const at = nowIso();
  return {
    ...data,
    vehicles: (data.vehicles || []).map((v) =>
      v.id === vehicleId ? { ...v, status: "archived", archivedAt: at, updatedAt: at } : v
    ),
    // משימות של רכב מארכב מושתקות — אבל נשמרות.
    tasks: (data.tasks || []).map((t) =>
      t.vehicleId === vehicleId
        ? { ...t, schedule: { ...(t.schedule || {}), muted: true, nextFireAt: null }, updatedAt: at }
        : t
    ),
  };
}

export function restoreVehicle(data, vehicleId) {
  const at = nowIso();
  return {
    ...data,
    vehicles: (data.vehicles || []).map((v) =>
      v.id === vehicleId ? { ...v, status: "active", archivedAt: null, updatedAt: at } : v
    ),
    tasks: (data.tasks || []).map((t) =>
      t.vehicleId === vehicleId
        ? { ...t, schedule: { ...(t.schedule || {}), muted: false }, updatedAt: at }
        : t
    ),
  };
}

// ============================================================================
// removeVehicleCascade — מחיקה לצמיתות. הקורא **חייב** למחוק גם את
// collectVehicleStoragePaths(data, vehicleId) לפני שהוא מפעיל את זה, אחרת
// יישארו קבצים יתומים עם טוקן פעיל.
// ============================================================================
export function removeVehicleCascade(data, vehicleId) {
  const byVehicle = (arr) => (arr || []).filter((x) => x.vehicleId !== vehicleId);
  return {
    ...data,
    vehicles: (data.vehicles || []).filter((v) => v.id !== vehicleId),
    vehiclesPrivate: (data.vehiclesPrivate || []).filter((p) => p.vehicleId !== vehicleId),
    vehicleAccess: byVehicle(data.vehicleAccess),
    tasks: byVehicle(data.tasks),
    documents: byVehicle(data.documents),
    serviceRecords: byVehicle(data.serviceRecords),
    odometerReadings: byVehicle(data.odometerReadings),
  };
}

export function removeDocument(data, documentId) {
  return { ...data, documents: (data.documents || []).filter((d) => d.id !== documentId) };
}

export function removePersonalDoc(data, docId) {
  return { ...data, personalDocs: (data.personalDocs || []).filter((d) => d.id !== docId) };
}

export function removeTask(data, taskId) {
  return { ...data, tasks: (data.tasks || []).filter((t) => t.id !== taskId) };
}

// נהג שמוסר ממשק הבית: ההרשאות והמסמכים האישיים יורדים איתו.
export function removeDriverCascade(data, driverId) {
  return {
    ...data,
    drivers: (data.drivers || []).filter((d) => d.id !== driverId),
    vehicleAccess: (data.vehicleAccess || []).filter((a) => a.driverId !== driverId),
    personalDocs: (data.personalDocs || []).filter((d) => d.driverId !== driverId),
  };
}

// ============================================================================
// clearHouseholdData — הצלע ה-Firestore של deleteHousehold() (N6).
// משאירה שלד ריק; המתזמר מוחק גם Storage וגם את המטמון במכשיר.
// ============================================================================
// ============================================================================
// 🔴 T5 (נגזרת ל-N6) — מחיקת חשבון **חייבת לאפס `nextFireAt`**.
//
// לא מספיק למחוק את המשימות: אצווה שכבר נטענה לזיכרון בתחילת ריצת ה-
// scheduler תשלח בכל מקרה. **הודעה שמגיעה משירות שאדם מחק היא כשל אמון
// שלא מתאוששים ממנו** — הוא עשה את הפעולה היחידה שהמערכת מציעה לו,
// והמערכת המשיכה לפנות אליו.
//
// לכן: קודם מנטרלים את התזמון, ורק אז מוחקים.
// ============================================================================
export function cancelAllReminders(data) {
  return {
    ...data,
    tasks: (data.tasks || []).map((t) => ({
      ...t,
      schedule: { ...(t.schedule || {}), nextFireAt: null, muted: true },
      updatedAt: nowIso(),
    })),
  };
}

export function clearHouseholdData(data) {
  return {
    ...cancelAllReminders(data),
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
}
