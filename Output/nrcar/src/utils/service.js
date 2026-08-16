// ============================================================================
// service.js — מועד הטיפול הבא.
//
// **החלטת התכנון החשובה כאן: התזכורות תמיד מבוססות-תאריך.**
// צד הק"מ מייצר *תאריך מוערך* כשיש ≥2 קריאות מד-אוץ', ונופל בשקט לזמן בלבד
// כשאין. הסיבה: תזכורת שמופעלת מק"מ יכולה לרוץ רק אם המשתמש נזכר לדווח —
// וזה בדיוק הכישלון שהמוצר קיים כדי למנוע. אנחנו לא בונים פיצ'ר שדורש
// מהמשתמש משמעת כדי לעבוד.
//
// טהור: today מוזרק, בלי React ובלי Firebase.
// ============================================================================

import { isDay, daysBetween, addDays, addMonths, minDay, todayIso } from "./dates.js";
import { DEFAULTS } from "../constants.js";

// קריאות מד-אוץ' של רכב, ממוינות מהישן לחדש, בלי כפילויות תאריך.
export function readingsForVehicle(readings, vehicleId) {
  return (readings || [])
    .filter((r) => r.vehicleId === vehicleId && isDay(r.date) && Number.isFinite(Number(r.km)))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// ============================================================================
// kmPerDay — קצב הנסיעה. דורש ≥2 קריאות בתאריכים שונים.
// null = אין מספיק נתונים → נופלים לזמן בלבד, **בשקט** ובלי להטריד.
// ============================================================================
export function kmPerDay(readings) {
  const list = (readings || []).filter((r) => isDay(r.date) && Number.isFinite(Number(r.km)));
  if (list.length < DEFAULTS.minOdometerReadingsForRate) return null;
  const first = list[0];
  const last = list[list.length - 1];
  const days = daysBetween(first.date, last.date);
  const km = Number(last.km) - Number(first.km);
  if (!days || days <= 0 || km <= 0) return null;
  return km / days;
}

export function latestReading(readings) {
  const list = readings || [];
  return list.length ? list[list.length - 1] : null;
}

// ============================================================================
// estimateDateForKm — מתי, לפי הקצב, הרכב יגיע ל-targetKm.
// מחזיר null כשאין קצב — וזה בסדר גמור; החישוב פשוט נשען על התאריך.
// ============================================================================
export function estimateDateForKm(readings, targetKm, today = todayIso()) {
  const rate = kmPerDay(readings);
  const last = latestReading(readings);
  if (!rate || !last || !Number.isFinite(Number(targetKm))) return null;
  const remaining = Number(targetKm) - Number(last.km);
  if (remaining <= 0) return today; // כבר עבר את היעד
  const daysNeeded = Math.ceil(remaining / rate);
  return addDays(last.date, daysNeeded);
}

// ============================================================================
// nextServiceDue — המועד המחייב לטיפול הבא.
// מחזיר { dateDue, kmDue, estimatedKmDate, effectiveDate, basis, hasKmData }.
//   effectiveDate = **המוקדם** מבין תאריך והערכת ק"מ — "מה שיגיע קודם".
//   basis = "date" | "km" — קובע איזו שורת קופי מוצגת.
// ============================================================================
export function nextServiceDue(vehicle, readings, opts = {}, today = todayIso()) {
  const intervalMonths = opts.intervalMonths ?? DEFAULTS.serviceIntervalMonths;
  const intervalKm = opts.intervalKm ?? DEFAULTS.serviceIntervalKm;

  const lastDate = isDay(opts.lastServiceDate) ? opts.lastServiceDate : vehicle?.lastServiceDate || null;
  const lastKm = Number.isFinite(Number(opts.lastServiceKm))
    ? Number(opts.lastServiceKm)
    : Number.isFinite(Number(vehicle?.lastServiceKm))
      ? Number(vehicle.lastServiceKm)
      : null;

  const dateDue = isDay(lastDate) ? addMonths(lastDate, intervalMonths) : null;
  const kmDue = lastKm === null ? null : lastKm + intervalKm;

  const rows = readingsForVehicle(readings, vehicle?.id);
  const estimatedKmDate = kmDue === null ? null : estimateDateForKm(rows, kmDue, today);

  const effectiveDate = minDay(dateDue, estimatedKmDate);
  const basis =
    effectiveDate && estimatedKmDate && effectiveDate === estimatedKmDate && effectiveDate !== dateDue
      ? "km"
      : "date";

  return {
    dateDue,
    kmDue,
    estimatedKmDate,
    effectiveDate,
    basis,
    hasKmData: kmPerDay(rows) !== null,
    lastKm: latestReading(rows)?.km ?? null,
  };
}

// ============================================================================
// serviceKmLine — איזו שורת ק"מ מוצגת בכרטיס (שירה §2.3).
//   km.reached  — כבר עבר את הק"מ של הטיפול
//   km.estimate — יש קצב, אפשר לומר "בסביבות X ק"מ"
//   km.noData   — אין מספיק קריאות; מבקשים בעדינות לעדכן
// ============================================================================
export function serviceKmLine(due) {
  if (!due || due.kmDue === null) return { key: "engine.service.km.noData", vars: {} };
  if (!due.hasKmData) return { key: "engine.service.km.noData", vars: {} };
  if (due.lastKm !== null && Number(due.lastKm) >= Number(due.kmDue)) {
    return { key: "engine.service.km.reached", vars: { km: due.kmDue } };
  }
  return { key: "engine.service.km.estimate", vars: { km: due.kmDue } };
}
