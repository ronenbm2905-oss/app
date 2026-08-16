// ============================================================================
// options.js — מיפוי enums → מפתחות i18n, ועזרי שליפה קצרים.
// אין כאן מחרוזות ממשק — רק מפתחות.
// ============================================================================

import {
  VEHICLE_STATUS,
  DRIVER_STATUS,
  PORTAL_STATUS,
  FINE_STATUS,
  ODOMETER_SOURCE,
  SERVICE_TYPE,
  DOCUMENT_TYPE,
  INCIDENT_STATUS,
} from "../constants.js";
import { parseAnonymizedName } from "./retention.js";

const opts = (values, prefix) => values.map((v) => ({ value: v, key: `${prefix}.${v}` }));

export const vehicleStatusOptions = opts(VEHICLE_STATUS, "vehicle.status");
export const driverStatusOptions = opts(DRIVER_STATUS, "driver.status");
export const portalStatusOptions = opts(PORTAL_STATUS, "driver.portal");
export const fineStatusOptions = opts(FINE_STATUS, "fine.status");
export const odometerSourceOptions = opts(ODOMETER_SOURCE, "odo.source");
export const serviceTypeOptions = opts(SERVICE_TYPE, "service.type");
export const documentTypeOptions = opts(DOCUMENT_TYPE, "doc.type");
export const incidentStatusOptions = opts(INCIDENT_STATUS, "incident.status");

// -- lookups -----------------------------------------------------------------
export function byId(list, id) {
  return (list || []).find((x) => x.id === id) || null;
}

// D3 — השם נשלף תמיד ב-join לפי driverId, לעולם לא מדונרמל על ישות אחרת.
// D6 — עובד מאונן מוצג כטוקן, דרך פונקציית התרגום t.
export function driverName(drivers, driverId, fallback = "—", t = null) {
  const d = byId(drivers, driverId);
  if (!d) return fallback;
  const anon = parseAnonymizedName(d.fullName);
  if (anon) return t ? `${t(anon.key)} ${anon.token}` : anon.token;
  return d.fullName || fallback;
}

export function vehicleLabel(vehicles, vehicleId, fallback = "—") {
  const v = byId(vehicles, vehicleId);
  if (!v) return fallback;
  return [v.plate, v.model].filter(Boolean).join(" · ") || fallback;
}

export function leaseCompanyName(companies, id, fallback = "—") {
  const c = byId(companies, id);
  return c ? c.name || fallback : fallback;
}

// D1 — העלות החודשית יושבת במסמך נפרד (vehiclesPrivate), אדמין-בלבד.
// כל קריאה עוברת דרך כאן, כדי שלא תתגנב חזרה למסמך שהנהג קורא.
export function monthlyCostOf(data, vehicleId) {
  const rec = (data.vehiclesPrivate || []).find((p) => p.vehicleId === vehicleId);
  return rec ? Number(rec.monthlyCost) || 0 : 0;
}

export function adminNotesOf(data, fineId) {
  const rec = (data.finesPrivate || []).find((p) => p.fineId === fineId);
  return rec ? rec.adminNotes || "" : "";
}

export function scanForFine(data, fineId) {
  return (data.fineScans || []).find((s) => s.fineId === fineId) || null;
}

// צבע Pill לפי סטטוס — API אחיד לרכיב Pill.
export const FINE_STATUS_TONE = {
  received: "amber",
  notified_driver: "blue",
  disputed: "red",
  transferred: "blue",
  paid: "green",
  appealed: "slate",
  cancelled: "slate",
};

export const VEHICLE_STATUS_TONE = {
  active: "green",
  pool: "blue",
  returned: "slate",
};

export const DRIVER_STATUS_TONE = {
  active: "green",
  inactive: "slate",
  archived: "slate",
};

export const KM_STATUS_TONE = {
  ok: "green",
  warning: "amber",
  over: "red",
  unknown: "slate",
};
