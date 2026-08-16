// ============================================================================
// fines.js — עזרי קנסות: פתוח/סגור, גזירת שיוך + שרשרת ראיות (D5), ואימות.
// טהור.
// ============================================================================

import { FINE_CLOSED_STATUS, FINE_PRE_TRANSFER_STATUS } from "../constants.js";
import { resolveDriverForFine } from "./assignments.js";
import { daysUntil, isDay, todayIso } from "./dates.js";
import { emptyAttribution } from "../schema.js";
import { nowIso } from "./id.js";

export function isFineOpen(fine) {
  return !FINE_CLOSED_STATUS.includes(fine.status);
}

// D5 — קנס שטרם הוסב לנהג (התקבל / נמסרה הודעה לנהג / במחלוקת).
export function isAwaitingTransfer(fine) {
  return FINE_PRE_TRANSFER_STATUS.includes(fine.status);
}

export function isDisputed(fine) {
  return fine.status === "disputed";
}

export function openFinesForVehicle(fines, vehicleId) {
  return (fines || []).filter((f) => f.vehicleId === vehicleId && isFineOpen(f));
}

export function finesForDriver(fines, driverId) {
  return (fines || []).filter((f) => f.driverId === driverId);
}

export function totalAmount(fines) {
  return (fines || []).reduce((s, f) => s + (Number(f.amount) || 0), 0);
}

export function dueSoon(fine, alertDays, today = todayIso()) {
  if (!isFineOpen(fine) || !isDay(fine.dueDate)) return null;
  const left = daysUntil(fine.dueDate, today);
  if (left === null) return null;
  if (left <= alertDays) return { daysLeft: left, overdue: left < 0 };
  return null;
}

// ============================================================================
// buildAttribution — D5. בונה את שרשרת הראיות של השיוך.
// כל שיוך (אוטומטי או ידני) מתועד: מאיזו החזקה נגזר, מתי, מי עקף, למה,
// ומה היה השיוך הקודם. בלי זה אין ראיה להגינות ההליך מול העובד.
// ============================================================================
export function buildAttribution({ derivation, manual, manualDriverId, reason, actor, previous }) {
  const prevAttr = previous?.attribution || emptyAttribution();
  const at = nowIso();
  if (!manual) {
    return {
      ...emptyAttribution(),
      source: "auto",
      assignmentId: derivation.assignmentId || null,
      resolvedAt: at,
      resolvedStatus: derivation.status,
      // התאריך שממנו נגזר השיוך היה משוער (מיובא) — נשמר בראיה.
      fromDateInferred: Boolean(derivation.fromDateInferred),
      previousDriverId: previous?.driverId ?? null,
    };
  }
  return {
    ...prevAttr,
    source: "manual",
    assignmentId: derivation.assignmentId || null,
    resolvedAt: prevAttr.resolvedAt || at,
    resolvedStatus: derivation.status,
    fromDateInferred: Boolean(derivation.fromDateInferred),
    overriddenBy: actor || null,
    overriddenAt: at,
    reason: reason || "",
    // מה המערכת גזרה לפני העקיפה — התיעוד שמאפשר לבדוק את ההחלטה בדיעבד.
    previousDriverId: derivation.driverId ?? previous?.driverId ?? null,
  };
}

// מחשב את שדות השיוך של טיוטת קנס מתוך תאריך העבירה.
export function applyDerivedDriver(data, draft, { actor } = {}) {
  const derivation = resolveDriverForFine(data, draft.vehicleId, draft.violationDate);
  const manual = draft.attribution?.source === "manual";
  const driverId = manual ? draft.driverId || null : derivation.driverId;
  const driver = (data.drivers || []).find((d) => d.id === driverId) || null;
  return {
    ...draft,
    driverId,
    // D3 — מדנרמלים את המפתח (uid), אף פעם לא את השם.
    driverUid: driver?.userId || null,
    attribution: buildAttribution({
      derivation,
      manual,
      reason: draft.attribution?.reason,
      actor,
      previous: draft,
    }),
  };
}

// ============================================================================
// M4 (שער עדי, 2026-08-13) — **השער הקשיח יושב בקנס, לא בייבוא.**
//
// עדי במפורש **לא** דרשה שער בייבוא ("אין ייבוא עד שלכל הנהגים יש notice"):
// הוא מעגלי — אי אפשר לרשום יידוע לנהגים שטרם נוצרו — והוא היה חוסם את הכלי
// בלי להגן על אף אחד. הנקודה הנכונה היא הרגע שבו המערכת **מייצרת החלטה על
// אדם**: הודעה לנהג והסבת הקנס. שם החוק דורש שהעובד ידע *לפני* שהמידע משמש
// נגדו (תיקון 13, חובת יידוע מורחבת).
//
// כלל: אין מעבר ל-notified_driver / transferred כשלנהג המשויך
// `notice.acknowledgedAt === null`. קנס בלי נהג משויך אינו נחסם — אין אדם
// שנפגע, ואין את מי ליידע; החסימה תיכנס לתוקף ברגע שישויך נהג.
// ============================================================================
export const NOTICE_REQUIRED_STATUS = ["notified_driver", "transferred"];

export function hasNotice(driver) {
  return Boolean(driver?.notice?.acknowledgedAt);
}

// כל הנהגים שטרם קיבלו יידוע מתועד (מזין את התראת הדשבורד ואת השער).
export function driversWithoutNotice(data) {
  return (data?.drivers || []).filter((d) => d.status !== "archived" && !hasNotice(d));
}

// מחזיר מפתח שגיאה או null. טהור.
export function noticeGateError(data, draft) {
  if (!draft || !NOTICE_REQUIRED_STATUS.includes(draft.status)) return null;
  if (!draft.driverId) return null;
  const driver = (data?.drivers || []).find((d) => d.id === draft.driverId) || null;
  if (!driver || hasNotice(driver)) return null;
  return "fine.err.driverNoNotice";
}

// השער כפי שהוא נאכף בפעולת שינוי סטטוס (הכפתורים המהירים בטבלת הקנסות).
// מחזיר { ok, errorKey } — הקורא לא מנחש.
export function fineStatusChange(data, fine, next) {
  if (!fine) return { ok: false, errorKey: "fine.err.notFound" };
  if (!canTransition(fine.status, next)) return { ok: false, errorKey: "fine.err.badTransition" };
  const gate = noticeGateError(data, { ...fine, status: next });
  if (gate) return { ok: false, errorKey: gate };
  return { ok: true, errorKey: null };
}

// עקיפה ידנית חייבת להיות מודעת: נדרש נימוק.
// `data` אופציונלי — כשהוא מסופק נאכף גם שער היידוע (M4). ה-UI תמיד מעביר
// אותו; בלעדיו נשארת הוולידציה הישנה בלבד.
export function validateFine(draft, data = null) {
  const errors = [];
  if (!draft.vehicleId) errors.push("fine.err.noVehicle");
  if (!isDay(draft.violationDate)) errors.push("fine.err.noDate");
  if (!(Number(draft.amount) > 0)) errors.push("fine.err.noAmount");
  if (draft.attribution?.source === "manual") {
    const reason = draft.attribution.reason || "";
    if (reason.trim().length < 3) errors.push("fine.err.noOverrideReason");
  }
  // D5 — לא מסבים קנס לנהג לפני שנמסרה לו הודעה והייתה לו הזדמנות להגיב.
  if (draft.status === "transferred" && !draft.notifiedDriverAt) {
    errors.push("fine.err.transferBeforeNotice");
  }
  // D8/M4 — ואין הודעה/הסבה לעובד שלא קיבל יידוע על המערכת מלכתחילה.
  if (data) {
    const gate = noticeGateError(data, draft);
    if (gate) errors.push(gate);
  }
  return errors;
}

// המעברים המותרים ב-state machine (D5). מונע קיצור דרך שמדלג על יידוע העובד.
export const FINE_TRANSITIONS = {
  received: ["notified_driver", "cancelled"],
  notified_driver: ["disputed", "transferred", "paid", "appealed", "cancelled"],
  disputed: ["notified_driver", "transferred", "cancelled", "appealed"],
  transferred: ["paid", "appealed", "cancelled"],
  appealed: ["paid", "cancelled", "transferred"],
  paid: [],
  cancelled: [],
};

export function canTransition(from, to) {
  if (from === to) return true;
  return (FINE_TRANSITIONS[from] || []).includes(to);
}

export function stripInternal(obj) {
  const clean = { ...obj };
  Object.keys(clean).forEach((k) => {
    if (k.startsWith("_")) delete clean[k];
  });
  return clean;
}
