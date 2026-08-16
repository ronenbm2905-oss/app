// ============================================================================
// alerts.js — מנוע ההתראות של הדשבורד (סעיף 5 באפיון).
// שבע קבוצות: חוזים מסתיימים · קנסות שטרם הוסבו · קנסות שמועד התשלום מתקרב ·
// רכבים ללא נהג · חריגת ק"מ · טסט/ביטוח שפג · טיפול שהגיע זמנו.
//
// כל ההתראות נגזרות — אין ישות Alert במסד. טהור, `today` מוזרק.
// ============================================================================

import { DEFAULTS, EXPIRING_DOC_TYPES } from "../constants.js";
import { daysUntil, isDay, todayIso } from "./dates.js";
import { currentAssignment } from "./assignments.js";
import { kmStatus, serviceDue } from "./odometer.js";
import { isFineOpen, isAwaitingTransfer, driversWithoutNotice } from "./fines.js";

export const ALERT_GROUPS = [
  "assignmentsNeedingReview",
  "driversWithoutNotice",
  "contractEnding",
  "finesAwaitingTransfer",
  "finesDueSoon",
  "vehiclesWithoutDriver",
  "kmOverage",
  "documentsExpiring",
  "serviceDue",
];

// severity: 'danger' (עבר/חריגה) | 'warning' (מתקרב) | 'info'
export function computeAlerts(data, today = todayIso(), settings = {}) {
  const s = { ...DEFAULTS, ...(settings || {}) };
  const vehicles = data.vehicles || [];
  const activeVehicles = vehicles.filter((v) => v.status !== "returned");
  const groups = Object.fromEntries(ALERT_GROUPS.map((g) => [g, []]));

  // 0. החזקות שממתינות לאימות (מסך 7). ההתראה הכי "יקרה" בדשבורד: כל עוד
  // ההחזקה מסומנת needsReview, שיוך קנס אוטומטי על הרכב הזה **חסום**.
  // היא נעלמת מעצמה כשכולן נפתרו — אין ישות התראה, הכל נגזר.
  for (const a of data.assignments || []) {
    if (!a.needsReview) continue;
    const v = vehicles.find((x) => x.id === a.vehicleId) || null;
    if (v && v.status === "returned") continue;
    groups.assignmentsNeedingReview.push({
      key: `review_${a.id}`,
      assignmentId: a.id,
      vehicleId: a.vehicleId,
      severity: "warning",
    });
  }

  // 0b. M4/D8 — עובדים שאין להם יידוע מתועד. זו לא "התראה תפעולית" אלא
  // **מד עמידה בחובה**: כל עוד ל-`Driver.notice.deliveredAt` יש null,
  // המערכת חוסמת מסירת הודעת קנס והסבה לאותו עובד (`noticeGateError`).
  // ולכן: עובד שכבר יש עליו קנס במערכת מסומן ב-danger — שם החסימה כבר
  // עולה בפועל; עובד בלי קנסות הוא warning, פער פתוח שאינו חוסם.
  for (const d of driversWithoutNotice(data)) {
    const fineCount = (data.fines || []).filter((f) => f.driverId === d.id).length;
    groups.driversWithoutNotice.push({
      key: `notice_${d.id}`,
      driverId: d.id,
      fineCount,
      severity: fineCount > 0 ? "danger" : "warning",
    });
  }

  // 1. חוזים שנגמרים בתוך X ימים (או שכבר נגמרו ורכב עדיין פעיל)
  for (const v of activeVehicles) {
    if (!isDay(v.contractEnd)) continue;
    const left = daysUntil(v.contractEnd, today);
    if (left === null || left > s.contractAlertDays) continue;
    groups.contractEnding.push({
      key: `contract_${v.id}`,
      vehicleId: v.id,
      daysLeft: left,
      date: v.contractEnd,
      severity: left < 0 ? "danger" : "warning",
    });
  }

  // 2. קנסות שהתקבלו וטרם הוסבו לנהג
  for (const f of data.fines || []) {
    if (!isAwaitingTransfer(f)) continue;
    groups.finesAwaitingTransfer.push({
      key: `fineT_${f.id}`,
      fineId: f.id,
      vehicleId: f.vehicleId,
      driverId: f.driverId,
      amount: f.amount,
      date: f.violationDate,
      severity: f.driverId ? "warning" : "danger", // בלי נהג = לא ניתן להסבה
    });
  }

  // 3. קנסות פתוחים שמועד התשלום שלהם מתקרב או עבר
  for (const f of data.fines || []) {
    if (!isFineOpen(f) || !isDay(f.dueDate)) continue;
    const left = daysUntil(f.dueDate, today);
    if (left === null || left > s.fineDueAlertDays) continue;
    groups.finesDueSoon.push({
      key: `fineD_${f.id}`,
      fineId: f.id,
      vehicleId: f.vehicleId,
      daysLeft: left,
      date: f.dueDate,
      amount: f.amount,
      severity: left < 0 ? "danger" : "warning",
    });
  }

  // 4. רכבים פעילים בלי נהג מוצמד (רכב מאגר לא נחשב חריגה)
  for (const v of activeVehicles) {
    if (v.status === "pool") continue;
    if (currentAssignment(data.assignments, v.id, today)) continue;
    groups.vehiclesWithoutDriver.push({
      key: `nodrv_${v.id}`,
      vehicleId: v.id,
      severity: "warning",
    });
  }

  // 5. חריגת ק"מ מול המכסה השנתית
  for (const v of activeVehicles) {
    const km = kmStatus(v, data.odometerReadings, today, { warnRatio: s.kmWarnRatio });
    if (km.status !== "over" && km.status !== "warning") continue;
    groups.kmOverage.push({
      key: `km_${v.id}`,
      vehicleId: v.id,
      deltaKm: km.deltaKm,
      ratio: km.ratio,
      projectedOverage: km.projectedOverage,
      severity: km.status === "over" ? "danger" : "warning",
    });
  }

  // 6. ביטוח / טסט / רישיון שפג או פג בקרוב — המסמך העדכני ביותר לכל סוג
  const latestByVehicleType = new Map();
  for (const d of data.documents || []) {
    if (!EXPIRING_DOC_TYPES.includes(d.type) || !isDay(d.validUntil)) continue;
    const k = `${d.vehicleId}|${d.type}`;
    const cur = latestByVehicleType.get(k);
    if (!cur || d.validUntil > cur.validUntil) latestByVehicleType.set(k, d);
  }
  for (const d of latestByVehicleType.values()) {
    const vehicle = vehicles.find((v) => v.id === d.vehicleId);
    if (!vehicle || vehicle.status === "returned") continue;
    const left = daysUntil(d.validUntil, today);
    if (left === null || left > s.docExpiryAlertDays) continue;
    groups.documentsExpiring.push({
      key: `doc_${d.id}`,
      documentId: d.id,
      vehicleId: d.vehicleId,
      docType: d.type,
      date: d.validUntil,
      daysLeft: left,
      severity: left < 0 ? "danger" : "warning",
    });
  }

  // 7. טיפול שהגיע זמנו (לפי תאריך או לפי ק"מ)
  for (const v of activeVehicles) {
    const due = serviceDue(v, data.serviceRecords, data.odometerReadings, today, s);
    if (!due.due) continue;
    groups.serviceDue.push({
      key: `srv_${v.id}`,
      vehicleId: v.id,
      reason: due.reason,
      daysLeft: due.daysLeft ?? null,
      kmLeft: due.kmLeft ?? null,
      severity:
        (due.daysLeft !== null && due.daysLeft < 0) || (due.kmLeft !== null && due.kmLeft < 0)
          ? "danger"
          : "warning",
    });
  }

  const total = ALERT_GROUPS.reduce((n, g) => n + groups[g].length, 0);
  const danger = ALERT_GROUPS.reduce(
    (n, g) => n + groups[g].filter((a) => a.severity === "danger").length,
    0
  );
  return { groups, total, danger, today };
}
