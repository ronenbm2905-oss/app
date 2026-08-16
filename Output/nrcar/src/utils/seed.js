// ============================================================================
// seed.js — ★ **הניצחון האמיתי של המוצר**, בקובץ אחד.
//
// מספר רישוי → `tokef_dt` אמיתי ממשרד התחבורה → **משימת טסט אמיתית**, בלי
// שהמשתמש הקליד תאריך אחד. זה מה שמפריד בין "עוד אפליקציית פתקים" לבין
// "היא זוכרת במקומי", וזה כל ההבדל במבחן הסבתא.
//
// טהור: `today` מוזרק, בלי React ובלי Firebase.
//
// ⚠️ **לא יוצרים כפילות.** אם כבר יש משימה פעילה מאותו סוג לאותו רכב —
// לא נוגעים בה. משתמש שערך תאריך ביטוח לא אמור לקבל שתי תזכורות.
// ============================================================================

import { createTask, DEFAULT_TAG_BY_TYPE } from "../schema.js";
import { withNextFire } from "./reminders.js";
import { nextServiceDue } from "./service.js";
import { isDay, todayIso } from "./dates.js";
import { DEFAULTS } from "../constants.js";

// האם כבר קיימת משימה פעילה מהסוג הזה לרכב הזה.
function hasLiveTask(tasks, vehicleId, type, coverage = null) {
  return (tasks || []).some(
    (t) =>
      t.vehicleId === vehicleId &&
      t.type === type &&
      !t.completedAt &&
      (coverage === null || t.coverage === coverage)
  );
}

// ============================================================================
// seedTasksForVehicle — מחזירה **מערך של משימות חדשות** (ייתכן ריק).
// הקורא מוסיף אותן; הפונקציה לא כותבת כלום.
// ============================================================================
export function seedTasksForVehicle(vehicle, existingTasks = [], opts = {}) {
  const today = opts.today || todayIso();
  const leadDays = opts.leadDays ?? DEFAULTS.leadDays;
  const out = [];

  const add = (type, dueDate, extra = {}) => {
    const task = createTask({
      householdId: vehicle.householdId,
      vehicleId: vehicle.id,
      type,
      dueDate,
      tag: DEFAULT_TAG_BY_TYPE[type] || "other",
      leadDays,
      ...extra,
    });
    out.push(withNextFire(task, today));
  };

  // ★ טסט — מ-tokef_dt, אם הוא הגיע מהמאגר או הוזן ידנית.
  if (isDay(vehicle.testValidUntil) && !hasLiveTask(existingTasks, vehicle.id, "test")) {
    add("test", vehicle.testValidUntil);
  }

  // ביטוח חובה ומקיף — **שתי משימות נפרדות.** הן נגמרות בתאריכים שונים,
  // והמשמעות של איחור בכל אחת מהן שונה לחלוטין.
  if (
    isDay(vehicle.compulsoryInsuranceUntil) &&
    !hasLiveTask(existingTasks, vehicle.id, "insurance", "compulsory")
  ) {
    add("insurance", vehicle.compulsoryInsuranceUntil, { coverage: "compulsory" });
  }
  if (
    isDay(vehicle.comprehensiveInsuranceUntil) &&
    !hasLiveTask(existingTasks, vehicle.id, "insurance", "comprehensive")
  ) {
    add("insurance", vehicle.comprehensiveInsuranceUntil, { coverage: "comprehensive" });
  }

  // טיפול — לפי הטיפול האחרון. התאריך תמיד קובע; הק"מ רק מקדים אותו.
  if (isDay(vehicle.lastServiceDate) && !hasLiveTask(existingTasks, vehicle.id, "service")) {
    const due = nextServiceDue(
      vehicle,
      opts.readings || [],
      { lastServiceDate: vehicle.lastServiceDate, lastServiceKm: vehicle.lastServiceKm },
      today
    );
    if (isDay(due.effectiveDate)) add("service", due.effectiveDate);
  }

  return out;
}
