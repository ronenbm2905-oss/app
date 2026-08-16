// ============================================================================
// odometer.js — קריאות מד-אוץ' וחישוב חריגת ק"מ מול המכסה השנתית.
//
// המודל: המכסה `annualKmAllowance` היא מכסה שנתית לפי חוזה הליסינג. בכל נקודת
// זמן קיימת "מכסה יחסית" — כמה ק"מ *מותר* היה לצבור עד היום, מתחילת החוזה:
//
//     allowedToDate = annualKmAllowance * (ימים מתחילת החוזה / 365)
//     actualToDate  = הקריאה האחרונה − startKm
//
// בנוסף עושים extrapolation: קצב יומי מהקריאות הקיימות → תחזית לסוף החוזה.
// הכול טהור; `today` מוזרק כפרמטר כדי שהבדיקות יהיו דטרמיניסטיות.
// ============================================================================

import { cmpDay, daysBetween, todayIso, isDay } from "./dates.js";
import { DEFAULTS } from "../constants.js";

export function readingsForVehicle(readings, vehicleId) {
  return (readings || [])
    .filter((r) => r.vehicleId === vehicleId && isDay(r.date))
    .sort((a, b) => cmpDay(a.date, b.date));
}

export function latestReading(readings, vehicleId) {
  const list = readingsForVehicle(readings, vehicleId);
  return list.length ? list[list.length - 1] : null;
}

// currentKm הוא שדה נגזר — לא מוזן ידנית.
export function currentKm(readings, vehicleId) {
  const r = latestReading(readings, vehicleId);
  return r ? r.km : null;
}

// ============================================================================
// kmStatus — התמונה המלאה של הק"מ לרכב אחד.
//
// status:
//   'unknown'  — אין קריאות או אין מכסה/תאריך חוזה → אי אפשר לחשב
//   'ok'       — בתוך המכסה היחסית
//   'warning'  — מעל kmWarnRatio (95%) מהמכסה היחסית, עדיין לא חריגה
//   'over'     — חריגה בפועל מהמכסה היחסית
// ============================================================================
export function kmStatus(vehicle, readings, today = todayIso(), opts = {}) {
  const warnRatio = opts.warnRatio ?? DEFAULTS.kmWarnRatio;
  const out = {
    status: "unknown",
    latestKm: null,
    latestDate: null,
    readingCount: 0,
    allowedToDate: null,
    actualToDate: null,
    deltaKm: null, // חיובי = חריגה
    ratio: null, // actual / allowed
    kmPerDay: null,
    projectedAtContractEnd: null,
    allowanceAtContractEnd: null,
    projectedOverage: null,
    elapsedDays: null,
  };
  if (!vehicle) return out;

  const list = readingsForVehicle(readings, vehicle.id);
  out.readingCount = list.length;
  if (list.length === 0) return out;

  const last = list[list.length - 1];
  out.latestKm = last.km;
  out.latestDate = last.date;

  const start = vehicle.contractStart;
  const allowance = Number(vehicle.annualKmAllowance) || 0;
  const startKm = Number(vehicle.startKm) || 0;

  // קצב יומי: מהקריאה הראשונה לאחרונה. אם יש רק קריאה אחת — מתחילת החוזה.
  const first = list[0];
  if (list.length >= 2) {
    const d = daysBetween(first.date, last.date);
    if (d && d > 0) out.kmPerDay = (last.km - first.km) / d;
  } else if (isDay(start)) {
    const d = daysBetween(start, last.date);
    if (d && d > 0) out.kmPerDay = (last.km - startKm) / d;
  }

  if (!isDay(start) || allowance <= 0) return out;

  const elapsed = daysBetween(start, today);
  out.elapsedDays = elapsed;
  if (elapsed === null || elapsed <= 0) return out;

  out.allowedToDate = (allowance * elapsed) / 365;
  out.actualToDate = last.km - startKm;
  out.deltaKm = out.actualToDate - out.allowedToDate;
  out.ratio = out.allowedToDate > 0 ? out.actualToDate / out.allowedToDate : null;

  if (out.ratio === null) out.status = "unknown";
  else if (out.ratio > 1) out.status = "over";
  else if (out.ratio >= warnRatio) out.status = "warning";
  else out.status = "ok";

  // תחזית לסוף החוזה — extrapolation לפי הקצב היומי מהקריאה האחרונה.
  if (isDay(vehicle.contractEnd) && out.kmPerDay !== null) {
    const remain = daysBetween(last.date, vehicle.contractEnd);
    if (remain !== null) {
      out.projectedAtContractEnd = last.km + out.kmPerDay * Math.max(0, remain);
      const contractDays = daysBetween(start, vehicle.contractEnd);
      if (contractDays !== null && contractDays > 0) {
        out.allowanceAtContractEnd = startKm + (allowance * contractDays) / 365;
        out.projectedOverage = out.projectedAtContractEnd - out.allowanceAtContractEnd;
      }
    }
  }
  return out;
}

// האם הטיפול הבא הגיע — לפי תאריך או לפי ק"מ.
export function serviceDue(vehicle, serviceRecords, readings, today = todayIso(), opts = {}) {
  const dueDays = opts.serviceDueDays ?? DEFAULTS.serviceDueDays;
  const dueKm = opts.serviceDueKm ?? DEFAULTS.serviceDueKm;
  const list = (serviceRecords || [])
    .filter((s) => s.vehicleId === vehicle.id && isDay(s.date))
    .sort((a, b) => cmpDay(a.date, b.date));
  if (!list.length) return { due: false, reason: null, last: null };

  const last = list[list.length - 1];
  const km = currentKm(readings, vehicle.id);

  if (isDay(last.nextServiceDate)) {
    const left = daysBetween(today, last.nextServiceDate);
    if (left !== null && left <= dueDays) {
      return { due: true, reason: "date", daysLeft: left, last, kmLeft: null };
    }
  }
  if (last.nextServiceKm && km !== null) {
    const kmLeft = last.nextServiceKm - km;
    if (kmLeft <= dueKm) return { due: true, reason: "km", kmLeft, last, daysLeft: null };
  }
  return { due: false, reason: null, last };
}
