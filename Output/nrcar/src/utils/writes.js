// ============================================================================
// writes.js — מוטטורים **טהורים** לפעולות שנוגעות ביותר מאוסף אחד.
//
// 🔴 למה הקובץ הזה קיים:
//
// "הוסף רכב" היא **פעולה מוצרית אחת**, ולכן היא צריכה להיות **כתיבה אחת**.
// כשהיא מומשה כ-`saveVehicle()` ואז `saveTask()` נפרדים, נוצרו שלוש בעיות
// בבת אחת:
//   1. באג רצף הכתיבות (ראו `store.js`) — הרכב נעלם והמשימה נשארה יתומה;
//   2. **שתי כתיבות ל-Firestore** במקום אחת;
//   3. **מצב-ביניים אפשרי בענן** — משימה שמצביעה לרכב שעדיין לא נכתב,
//      שנראה לכל קורא אחר (ולפרוסה 2, ל-Cloud Function) כרשומה יתומה.
//
// התיקון ב-`store.js` הופך את הרצף לנכון, והוא נשאר כרשת ביטחון. הקובץ הזה
// מסיר את הצורך בו: מוטטור אחד, `update()` אחד, כתיבת דלתא אחת.
//
// הכול טהור — מקבל טיוטה, משנה אותה, ולא נוגע ב-React, ב-Firebase או בשעון.
// ============================================================================

import { createOdometerReading, createServiceRecord } from "../schema.js";

// upsert לפי id, בתוך מערך של טיוטה.
function putIn(list, entity) {
  const i = list.findIndex((x) => x.id === entity.id);
  if (i >= 0) list[i] = entity;
  else list.push(entity);
  return list;
}

// ============================================================================
// writeVehicleWithTasks — "הוסף/ערוך רכב" **כאטום אחד**: הרכב, המסמך הפרטי
// שלו, והמשימות שנזרעו מהתאריכים שלו (טסט מ-tokef_dt, ביטוח, טיפול).
// ============================================================================
export function writeVehicleWithTasks(draft, { vehicle, tasks = [], priv = null } = {}) {
  if (!vehicle) return draft;
  draft.vehicles = putIn(draft.vehicles || [], vehicle);
  if (priv) draft.vehiclesPrivate = putIn(draft.vehiclesPrivate || [], priv);
  draft.tasks = draft.tasks || [];
  for (const task of tasks) putIn(draft.tasks, task);
  return draft;
}

// ============================================================================
// writeTaskCompletion — סימון "בוצע" **כאטום אחד**: המשימה שהושלמה,
// המשימה הבאה, עדכון הרכב, וההיסטוריה.
//
// ⚠️ שני הדברים שנוספו כאן ולא היו קודם, ובלעדיהם המוצר לא סוגר מעגל:
//   · **OdometerReading** — בלי רשומות מד-אוץ' אמיתיות, `service.js` לעולם
//     לא מגיע לשתי קריאות, ולכן הערכת הק"מ **לעולם לא עובדת**. הק"מ שהמשתמש
//     הקליד במסך "בוצע" היה נכתב לשדה על הרכב ונעלם.
//   · **ServiceRecord** — היסטוריית הטיפולים. האוסף היה מוגדר, ולא היה לו
//     אף כותב בקוד.
// שניהם נכתבים **באותו מוטטור** — לא בקריאה נוספת.
// ============================================================================
export function writeTaskCompletion(draft, { completed, next, ctx = {} } = {}) {
  if (!completed) return draft;
  const { completedDate, completedKm, householdId } = ctx;
  const km = Number.isFinite(Number(completedKm)) ? Number(completedKm) : null;

  draft.tasks = putIn(draft.tasks || [], completed);
  if (next) putIn(draft.tasks, next);

  const vehicleId = completed.vehicleId;
  const isService = completed.type === "service";

  if (vehicleId && (km !== null || isService)) {
    draft.vehicles = (draft.vehicles || []).map((v) => {
      if (v.id !== vehicleId) return v;
      return {
        ...v,
        ...(km !== null ? { currentKm: km, currentKmDate: completedDate } : {}),
        ...(isService ? { lastServiceDate: completedDate, lastServiceKm: km ?? v.lastServiceKm } : {}),
      };
    });
  }

  // ★ הקריאה נשמרת כישות — זה מה שמאפשר להערכת הק"מ להתחיל לעבוד.
  if (vehicleId && km !== null && completedDate) {
    draft.odometerReadings = draft.odometerReadings || [];
    const already = draft.odometerReadings.some(
      (r) => r.vehicleId === vehicleId && r.date === completedDate && Number(r.km) === km
    );
    if (!already) {
      draft.odometerReadings.push(
        createOdometerReading({ householdId, vehicleId, date: completedDate, km, source: "owner" })
      );
    }
  }

  // ★ היסטוריית טיפולים.
  if (vehicleId && isService && completedDate) {
    draft.serviceRecords = draft.serviceRecords || [];
    draft.serviceRecords.push(
      createServiceRecord({
        householdId,
        vehicleId,
        date: completedDate,
        km,
        kind: "periodic",
        garageName: ctx.garageName || "",
        taskId: completed.id,
      })
    );
  }

  return draft;
}
