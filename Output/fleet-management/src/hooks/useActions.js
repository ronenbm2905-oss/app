import { useMemo } from "react";
import { ENTITY_COLLECTIONS } from "../constants.js";
import {
  removeVehicleCascade,
  removeLeaseCompanyDetach,
  removeDocument,
  removeFineScan,
} from "../utils/cascade.js";
import { archiveDriver, anonymizeDriver, collectVehicleStoragePaths } from "../utils/retention.js";
import { closeOpenAssignments } from "../utils/assignments.js";
import { buildReviewWrite } from "../utils/reviewBuild.js";
import { buildImportAck } from "../utils/importBuild.js";
import { applyDerivedDriver, fineStatusChange, noticeGateError } from "../utils/fines.js";
import { createVehiclePrivate, createFinePrivate } from "../schema.js";
import { deleteStorageObjects } from "../utils/files.js";
import { storage, isFirebaseConfigured } from "../firebase.js";
import { nowIso } from "../utils/id.js";
import { todayIso } from "../utils/dates.js";

// ============================================================================
// useActions — כל הכתיבות למודל במקום אחד, כדי שהלוגיקה (cascade, שרשרת
// הראיות של השיוך, פיצול D1, מחיקת Storage) לא תתפזר בתוך ה-UI.
// ============================================================================
export function useActions(update, orgId, actor) {
  return useMemo(() => {
    const stamp = (e) => ({ ...e, orgId: orgId || e.orgId || null, updatedAt: nowIso() });
    const activeStorage = isFirebaseConfigured ? storage : null;

    const putIn = (list, entity) => {
      const i = list.findIndex((x) => x.id === entity.id);
      if (i >= 0) list[i] = entity;
      else list.push(entity);
      return list;
    };

    const upsert = (collection, entity) =>
      update((d) => {
        if (!ENTITY_COLLECTIONS.includes(collection)) throw new Error(`unknown collection ${collection}`);
        d[collection] = putIn(d[collection] || [], stamp(entity));
      });

    const remove = (collection, id) =>
      update((d) => {
        d[collection] = (d[collection] || []).filter((x) => x.id !== id);
      });

    return {
      upsert,
      remove,

      setOrg: (patch) =>
        update((d) => {
          d.org = { ...d.org, ...patch };
        }),

      setSettings: (patch) =>
        update((d) => {
          d.settings = { ...d.settings, ...patch };
        }),

      completeOnboarding: ({ orgName, company, vehicle, monthlyCost }) =>
        update((d) => {
          d.org = { ...d.org, id: orgId || d.org.id, name: orgName, createdAt: nowIso() };
          d.settings = { ...d.settings, onboarded: true };
          d.leaseCompanies = [...(d.leaseCompanies || []), { ...company, orgId: orgId || null }];
          d.vehicles = [...(d.vehicles || []), { ...vehicle, orgId: orgId || null }];
          // D1 — העלות החודשית למסמך הפרטי, לא למסמך הרכב.
          d.vehiclesPrivate = [
            ...(d.vehiclesPrivate || []),
            createVehiclePrivate(vehicle.id, { orgId, monthlyCost }),
          ];
        }),

      // -- רכב: המסמך הציבורי + המסמך הפרטי נכתבים יחד (D1) -----------------
      saveVehicle: (vehicle, monthlyCost) =>
        update((d) => {
          d.vehicles = putIn(d.vehicles || [], stamp(vehicle));
          d.vehiclesPrivate = putIn(
            d.vehiclesPrivate || [],
            createVehiclePrivate(vehicle.id, { orgId, monthlyCost })
          );
        }),

      deleteVehicle: async (vehicleId) => {
        let paths = [];
        await update((d) => {
          paths = collectVehicleStoragePaths(d, vehicleId);
          return removeVehicleCascade(d, vehicleId);
        });
        // D6 — המחיקה כוללת את Storage, לא רק את המטא-דאטה.
        await deleteStorageObjects(paths, activeStorage);
      },

      // ====================================================================
      // applyImport — מסך 6. כותב את כל תוצרי הייבוא בפעולה **אחת**, כדי
      // שלא ייווצר מצב ביניים שבו יש רכבים בלי החזקות (או להפך) אם הכתיבה
      // נכשלת באמצע. הקלט הוא הפלט של buildImportWrite, שנבנה רק אחרי
      // שהמשתמש אישר את התצוגה המקדימה.
      //
      // M3 (שער עדי, 2026-08-13) — **אישור שלא נרשם אינו ראיה.** תיבת
      // "הייבוא מתבצע בהתאם לחובת היידוע" חסמה את הכפתור ולא הותירה עקבה:
      // ברגע הכי רגיש בזרימה — 29 עובדים אמיתיים נכנסים למאגר — לא נשאר
      // תיעוד שהשער נחצה. `settings.importAck` שומר מי הצהיר, מתי, ולפי
      // איזו גרסת מדיניות. זו הצהרת אדמין, **לא** הסכמת עובד (D8).
      // ====================================================================
      applyImport: (built, ack = null) =>
        update((d) => {
          for (const c of built.leaseCompanies || []) d.leaseCompanies = putIn(d.leaseCompanies || [], stamp(c));
          for (const v of built.vehicles || []) d.vehicles = putIn(d.vehicles || [], stamp(v));
          for (const p of built.vehiclesPrivate || [])
            d.vehiclesPrivate = putIn(d.vehiclesPrivate || [], { ...p, orgId: orgId || p.orgId || null });
          for (const dr of built.drivers || []) d.drivers = putIn(d.drivers || [], stamp(dr));
          for (const a of built.assignments || []) d.assignments = putIn(d.assignments || [], stamp(a));
          d.settings = {
            ...d.settings,
            lastImportAt: built.summary?.importedAt || nowIso(),
            importAck: buildImportAck({
              ack,
              actor,
              settings: d.settings,
              summary: built.summary,
            }),
          };
        }),

      // -- החזקות ----------------------------------------------------------
      addAssignment: (assignment, { autoCloseOpen = true } = {}) =>
        update((d) => {
          const driver = (d.drivers || []).find((x) => x.id === assignment.driverId) || null;
          let list = d.assignments || [];
          if (autoCloseOpen) list = closeOpenAssignments(list, assignment.vehicleId, assignment.fromDate);
          d.assignments = [...list, stamp({ ...assignment, driverUid: driver?.userId || null })];
        }),

      // ====================================================================
      // resolveReview — מסך 7. פתרון החזקה שסומנה לבדיקה: נהג (קיים או חדש
      // inline), תאריך תחילה אמיתי, ואופציונלית **פיצול** לשתי החזקות רציפות.
      // הכל בכתיבה אחת, כדי שלא ייווצר מצב ביניים עם חפיפה או עם נהג יתום.
      // מחזיר { ok, errors } — ה-UI לא כותב בעצמו ולא מניח שהצליח.
      // ====================================================================
      resolveReview: async (assignmentId, input) => {
        let outcome = { ok: false, errors: ["reviewx.err.noAssignment"] };
        await update((d) => {
          const built = buildReviewWrite(d, assignmentId, input, { orgId, actor });
          outcome = { ok: built.ok, errors: built.errors };
          if (!built.ok) return;
          for (const dr of built.drivers) d.drivers = putIn(d.drivers || [], stamp(dr));
          for (const a of built.assignments) d.assignments = putIn(d.assignments || [], stamp(a));
          if (built.vehicle) d.vehicles = putIn(d.vehicles || [], stamp(built.vehicle));
        });
        return outcome;
      },

      endAssignment: (assignmentId, toDate) =>
        update((d) => {
          d.assignments = (d.assignments || []).map((a) =>
            a.id === assignmentId ? { ...a, toDate, updatedAt: nowIso() } : a
          );
        }),

      // -- נהגים: ארכוב ואנונימיזציה, לא מחיקה (D6) -------------------------
      archiveDriver: (driverId) => update((d) => archiveDriver(d, driverId, todayIso())),

      anonymizeDriver: async (driverId) => {
        let paths = [];
        await update((d) => {
          const res = anonymizeDriver(d, driverId);
          paths = res.storagePaths;
          return res.data;
        });
        await deleteStorageObjects(paths, activeStorage);
      },

      acknowledgeNotice: (driverId, policyVersion, method = "admin_recorded") =>
        update((d) => {
          d.drivers = (d.drivers || []).map((x) =>
            x.id === driverId
              ? { ...x, notice: { policyVersion, acknowledgedAt: nowIso(), method }, updatedAt: nowIso() }
              : x
          );
        }),

      deleteLeaseCompany: (companyId) => update((d) => removeLeaseCompanyDetach(d, companyId)),

      deleteDocument: async (documentId) => {
        let path = null;
        await update((d) => {
          const doc = (d.documents || []).find((x) => x.id === documentId);
          if (doc?.storageMode === "storage") path = doc.fileRef;
          return removeDocument(d, documentId);
        });
        await deleteStorageObjects([path], activeStorage);
      },

      deleteFineScan: async (scanId) => {
        let path = null;
        await update((d) => {
          const s = (d.fineScans || []).find((x) => x.id === scanId);
          if (s?.storageMode === "storage") path = s.fileRef;
          return removeFineScan(d, scanId);
        });
        await deleteStorageObjects([path], activeStorage);
      },

      // ====================================================================
      // saveFine — כותב את הקנס, את שרשרת הראיות של השיוך (D5), את הערת
      // האדמין למסמך הפרטי (D1), ואת הסריקה כישות FineScan נפרדת (D2).
      // ====================================================================
      // M4 — גם המסלול הזה נחסם: אין שמירת קנס במצב "נמסרה הודעה"/"הוסב"
      // כשלנהג המשויך אין יידוע מתועד. הוולידציה בטופס היא ההסבר למשתמש;
      // הבדיקה כאן היא האכיפה. מחזיר { ok, errorKey }.
      saveFine: async (fine, { scan, adminNotes } = {}) => {
        let outcome = { ok: true, errorKey: null };
        await update((d) => {
          const resolved = applyDerivedDriver(d, fine, { actor });
          const gate = noticeGateError(d, resolved);
          if (gate) {
            outcome = { ok: false, errorKey: gate };
            return;
          }
          let scanId = resolved.scanId || null;

          if (scan) {
            const withOwner = stamp({
              ...scan,
              fineId: resolved.id,
              driverId: resolved.driverId,
              driverUid: resolved.driverUid,
            });
            d.fineScans = putIn(d.fineScans || [], withOwner);
            scanId = withOwner.id;
          }

          d.fines = putIn(d.fines || [], stamp({ ...resolved, scanId }));

          if (adminNotes !== undefined) {
            d.finesPrivate = putIn(
              d.finesPrivate || [],
              createFinePrivate(resolved.id, { orgId, adminNotes })
            );
          }
        });
        return outcome;
      },

      // ====================================================================
      // setFineStatus — מעבר סטטוס מבוקר. לא מדלגים על יידוע הקנס (D5),
      // ו-M4: לא מודיעים/מסבים לעובד שאין לו יידוע מתועד על המערכת (D8).
      // מחזיר { ok, errorKey } — הפעולה שקטה כשהיא נחסמת, ולכן ה-UI חייב
      // לקבל את הסיבה ולהציג אותה, ולא "ללחוץ ולא יקרה כלום".
      // ====================================================================
      setFineStatus: async (fineId, next) => {
        let outcome = { ok: false, errorKey: "fine.err.notFound" };
        await update((d) => {
          const fine = (d.fines || []).find((f) => f.id === fineId) || null;
          outcome = fineStatusChange(d, fine, next);
          if (!outcome.ok) return;
          d.fines = (d.fines || []).map((f) => {
            if (f.id !== fineId) return f;
            const patch = { status: next, updatedAt: nowIso() };
            const today = todayIso();
            if (next === "notified_driver") patch.notifiedDriverAt = nowIso();
            if (next === "transferred") patch.transferredDate = today;
            if (next === "paid") patch.paidDate = today;
            return { ...f, ...patch };
          });
        });
        return outcome;
      },

      // D5 — תגובת העובד נשמרת ומוצגת לאדמין.
      setDriverStatement: (fineId, text) =>
        update((d) => {
          d.fines = (d.fines || []).map((f) =>
            f.id === fineId
              ? { ...f, driverStatement: { text, at: nowIso() }, status: "disputed", updatedAt: nowIso() }
              : f
          );
        }),
    };
  }, [update, orgId, actor]);
}
