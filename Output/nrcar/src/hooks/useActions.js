import { useMemo } from "react";
import { ENTITY_COLLECTIONS, POLICY_VERSION } from "../constants.js";
import {
  archiveVehicle,
  restoreVehicle,
  removeVehicleCascade,
  removeDocument,
  removePersonalDoc,
  removeTask,
  removeDriverCascade,
  clearHouseholdData,
} from "../utils/cascade.js";
import {
  collectVehicleStoragePaths,
  collectDriverStoragePaths,
  collectHouseholdStoragePaths,
  exportHousehold as buildExport,
  deleteHouseholdPlan,
} from "../utils/retention.js";
import { deleteStorageObjects } from "../utils/files.js";
import { purgeLocalCache, purgeVehicleCache } from "../utils/localCache.js";
import { createVehiclePrivate, createUserProfile, appendNotice } from "../schema.js";
import { writeVehicleWithTasks, writeTaskCompletion } from "../utils/writes.js";
import { completeTask as computeRenewal, undoComplete } from "../utils/renewal.js";
import { withNextFire, snooze as snoozeTask, mute as muteTask } from "../utils/reminders.js";
import { storage, isFirebaseConfigured } from "../firebase.js";
import { nowIso } from "../utils/id.js";
import { todayIso } from "../utils/dates.js";

// ============================================================================
// useActions — כל הכתיבות למודל במקום אחד, כדי שהלוגיקה (cascade תלת-צלעי,
// חידוש אוטומטי, nextFireAt) לא תתפזר בתוך ה-UI.
//
// 🔴 N1 — זהו המסלול השלישי של `purgeLocalCache`: מחיקת/ארכוב מסמך או רכב.
//    (שני הראשונים — יציאה מהחשבון והחלפת משתמש — ב-useAuth.)
// ============================================================================
export function useActions(update, householdId, user) {
  return useMemo(() => {
    const uid = user?.uid || null;
    const stamp = (e) => ({ ...e, householdId: householdId || e.householdId || null, updatedAt: nowIso() });
    const activeStorage = isFirebaseConfigured ? storage : null;

    // האם יש בכלל תוכן במסמך הפרטי — כדי לא ליצור מסמך ריק לכל רכב.
    const hasPrivateData = (priv) =>
      Boolean(priv && (priv.purchasePrice != null || priv.insurancePremium != null || priv.ownerNotes));

    const putIn = (list, entity) => {
      const i = list.findIndex((x) => x.id === entity.id);
      if (i >= 0) list[i] = entity;
      else list.push(entity);
      return list;
    };

    // כל שם אוסף חייב להיות ב-ENTITY_COLLECTIONS — נאכף גם ב-smoke.
    const upsert = (collection, entity) =>
      update((d) => {
        if (!ENTITY_COLLECTIONS.includes(collection)) throw new Error(`unknown collection ${collection}`);
        d[collection] = putIn(d[collection] || [], stamp(entity));
      });

    const remove = (collection, id) =>
      update((d) => {
        if (!ENTITY_COLLECTIONS.includes(collection)) throw new Error(`unknown collection ${collection}`);
        d[collection] = (d[collection] || []).filter((x) => x.id !== id);
      });

    return {
      upsert,
      remove,

      setHousehold: (patch) =>
        update((d) => {
          d.household = { ...d.household, ...patch };
        }),

      setSettings: (patch) =>
        update((d) => {
          d.settings = { ...d.settings, ...patch };
        }),

      // ============================================================================
      // ★ saveVehicleWithTasks — "הוסף/ערוך רכב" הוא **פעולה מוצרית אחת**,
      // ולכן **כתיבה אחת**: הרכב, המסמך הפרטי, והמשימות שנזרעו מהתאריכים שלו.
      //
      // כשזה היה `saveVehicle()` ואז `saveTask()` נפרדים, שתי הקריאות רצו
      // באותו tick וראו את אותו מצב-קדם — הרכב נעלם והמשימה נשארה יתומה.
      // התיקון ב-`store.js` הופך את הרצף לנכון וגם נשאר כרשת ביטחון; כאן
      // הצורך בו נעלם, ובדרך נחסכת כתיבה שנייה ל-Firestore ומצב-ביניים
      // שבו משימה מצביעה לרכב שעדיין לא נכתב.
      // ============================================================================
      saveVehicleWithTasks: (vehicle, tasks = [], priv = null) =>
        update((d) =>
          writeVehicleWithTasks(d, {
            vehicle: stamp(vehicle),
            tasks: (tasks || []).map(stamp),
            priv: hasPrivateData(priv)
              ? createVehiclePrivate(vehicle.id, { householdId, ...priv })
              : null,
          })
        ),

      // -- רכב בלבד (בלי זריעת משימות) --------------------------------------
      saveVehicle: (vehicle, priv = {}) =>
        update((d) =>
          writeVehicleWithTasks(d, {
            vehicle: stamp(vehicle),
            priv: hasPrivateData(priv)
              ? createVehiclePrivate(vehicle.id, { householdId, ...priv })
              : null,
          })
        ),

      // PRD §7 — רכב שנמכר עובר ל**ארכיון**, לא נמחק.
      archiveVehicle: (vehicleId) => {
        purgeVehicleCache(uid, vehicleId); // N1 — הצלע השלישית
        return update((d) => archiveVehicle(d, vehicleId));
      },

      restoreVehicle: (vehicleId) => update((d) => restoreVehicle(d, vehicleId)),

      // מחיקה לצמיתות: Firestore → Storage → מכשיר. שלוש צלעות.
      deleteVehicle: async (vehicleId, data) => {
        const paths = collectVehicleStoragePaths(data, vehicleId);
        await deleteStorageObjects(paths, activeStorage);
        purgeVehicleCache(uid, vehicleId);
        return update((d) => removeVehicleCascade(d, vehicleId));
      },

      // -- משימות ----------------------------------------------------------
      saveTask: (task, today = todayIso()) => upsert("tasks", withNextFire(task, today)),

      deleteTask: (taskId) => update((d) => removeTask(d, taskId)),

      // ============================================================================
      // ⚠️ "מציע, לא מבצע": המסך מציג את `next` לאישור **לפני** הקריאה הזאת.
      //
      // ★ **כל ארבע הכתיבות באותו mutator** — המשימה שהושלמה, המשימה הבאה,
      // עדכון הרכב, וההיסטוריה (קריאת מד-אוץ' + רשומת טיפול). זו הזרימה הכי
      // חשובה במוצר אחרי הוספת רכב, ומצב ביניים בה — משימה שסומנה בוצע בלי
      // שנוצרה הבאה — הוא בדיוק הכישלון שהמוצר קיים כדי למנוע.
      // ============================================================================
      completeTask: (task, ctx = {}) =>
        update((d) => {
          const today = ctx.today || todayIso();
          const completedDate = ctx.completedDate || today;
          const { completed, next } = computeRenewal(task, {
            ...ctx,
            today,
            completedDate,
            readings: d.odometerReadings || [],
            vehicle: (d.vehicles || []).find((v) => v.id === task.vehicleId) || null,
          });
          return writeTaskCompletion(d, {
            completed: stamp(completed),
            next: next && ctx.acceptNext !== false ? stamp(next) : null,
            ctx: {
              householdId,
              completedDate,
              completedKm: ctx.completedKm,
              garageName: (d.vehicles || []).find((v) => v.id === task.vehicleId)?.garage?.name || "",
            },
          });
        }),

      undoCompleteTask: (task, today = todayIso()) =>
        update((d) => {
          d.tasks = putIn(d.tasks || [], stamp(undoComplete(task, today)));
        }),

      snoozeTask: (task, until, today = todayIso()) =>
        update((d) => {
          d.tasks = putIn(d.tasks || [], stamp(snoozeTask(task, until, today)));
        }),

      muteTask: (task, muted, today = todayIso()) =>
        update((d) => {
          d.tasks = putIn(d.tasks || [], stamp(muteTask(task, muted, today)));
        }),

      // -- מסמכים ----------------------------------------------------------
      deleteDocument: async (docId, data) => {
        const doc = (data.documents || []).find((d) => d.id === docId);
        const path = doc?.fileRef?.storagePath;
        if (path) await deleteStorageObjects([path], activeStorage);
        if (doc?.vehicleId) purgeVehicleCache(uid, doc.vehicleId); // N1
        return update((d) => removeDocument(d, docId));
      },

      deletePersonalDoc: async (docId, data) => {
        const doc = (data.personalDocs || []).find((d) => d.id === docId);
        const path = doc?.fileRef?.storagePath;
        if (path) await deleteStorageObjects([path], activeStorage);
        purgeLocalCache(uid); // N1 — רישיון הנהיגה מופיע בכרטיס החירום
        return update((d) => removePersonalDoc(d, docId));
      },

      // -- נהגים (פרוסה 2 מפעילה; הפעולה קיימת כדי שה-cascade יהיה שלם) ----
      deleteDriver: async (driverId, data) => {
        const paths = collectDriverStoragePaths(data, driverId);
        await deleteStorageObjects(paths, activeStorage);
        purgeLocalCache();
        return update((d) => removeDriverCascade(d, driverId));
      },

      // -- N5: אישור היידוע — **append**, לעולם לא דריסה -------------------
      acknowledgeNotice: (method = "inApp") =>
        update((d) => {
          const profile = d.profile || createUserProfile({ uid, householdId, displayName: user?.displayName, email: user?.email });
          d.profile = appendNotice(profile, { policyVersion: POLICY_VERSION, method });
        }),

      saveProfile: (patch) =>
        update((d) => {
          const profile = d.profile || createUserProfile({ uid, householdId });
          d.profile = { ...profile, ...patch, updatedAt: nowIso() };
        }),

      // -- N6: זכות העיון וזכות המחיקה, על אותו cascade --------------------
      exportHousehold: (data) => buildExport(data, { profile: data.profile }),

      deleteHouseholdPlan: (data) => deleteHouseholdPlan(data),

      // Firestore → Storage → מכשיר. **שלוש צלעות.**
      deleteHousehold: async (data) => {
        const paths = collectHouseholdStoragePaths(data);
        await deleteStorageObjects(paths, activeStorage);
        purgeLocalCache();
        return update((d) => clearHouseholdData(d));
      },
    };
  }, [update, householdId, user?.uid, user?.displayName, user?.email]);
}
