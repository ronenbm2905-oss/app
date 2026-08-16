// ============================================================================
// options.js — בוררי-נוחות (selectors) על המודל שבזיכרון. טהור.
// ============================================================================

import { formatPlate } from "./mot.js";

// ============================================================================
// vehicleLabel — **הערך שנכנס ל-`{vehicle}` בכל משפטי המנוע.**
//
// הכינוי אם קיים ("האוטו של אמא"), אחרת יצרן + דגם מסחרי.
// **לעולם לא מספר רישוי** — אחרת כל משפטי המנוע נשמעים כמו הודעה מהעירייה
// ("הטסט של 12-345-67 בעוד 5 ימים"), וזה ההפך הגמור מהטון שהמוצר צריך.
//
// ⚠️ כלל הכתיבה של שירה: אסור להצמיד ב'/ל'/ה' לערך הזה — הוא מגיע
// מהמשתמש, ו"בהאוטו של אמא" הוא ג'יבריש. כל המחרוזות כתובות "של {vehicle}".
// ============================================================================
export function vehicleLabel(vehicle, fallback = "") {
  if (!vehicle) return fallback;
  if (vehicle.nickname) return vehicle.nickname;
  const parts = [vehicle.manufacturer, vehicle.commercialName || vehicle.model].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return fallback;
}

// לוחית מפורמטת לתצוגה (תמיד בתוך `.num`).
export function vehiclePlate(vehicle) {
  return vehicle?.plate ? formatPlate(vehicle.plate) : "";
}

export function vehicleById(data, id) {
  return (data?.vehicles || []).find((v) => v.id === id) || null;
}

export function activeVehicles(data) {
  return (data?.vehicles || []).filter((v) => v.status !== "archived");
}

export function archivedVehicles(data) {
  return (data?.vehicles || []).filter((v) => v.status === "archived");
}

// משימות של רכב — משימות של רכב מארכב לא נכנסות לתצוגות החיות.
export function tasksForVehicle(data, vehicleId) {
  return (data?.tasks || []).filter((t) => t.vehicleId === vehicleId);
}

export function liveTasks(data) {
  const archived = new Set(archivedVehicles(data).map((v) => v.id));
  return (data?.tasks || []).filter((t) => !archived.has(t.vehicleId));
}

export function documentsForVehicle(data, vehicleId) {
  return (data?.documents || []).filter((d) => d.vehicleId === vehicleId);
}

export function personalDocsForUid(data, uid) {
  return (data?.personalDocs || []).filter((d) => d.driverUid === uid);
}

export function driverForUid(data, uid) {
  if (!uid) return null;
  return (data?.drivers || []).find((d) => d.userUid === uid && d.status !== "archived") || null;
}

export function vehiclePrivateFor(data, vehicleId) {
  return (data?.vehiclesPrivate || []).find((p) => p.vehicleId === vehicleId) || null;
}

// כותרת המשימה לתצוגה: לסוגים המובנים — שם הסוג; לתיקון/אחר — מה שהמשתמש כתב.
export function taskTitleKey(task) {
  if (task?.title) return null; // יש כותרת של המשתמש
  return `task.type.${task?.type || "other"}`;
}
