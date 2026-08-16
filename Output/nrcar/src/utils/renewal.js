// ============================================================================
// renewal.js — "בוצע" → המשימה הבאה. הפיצ'ר שמממש את עקרון האמינות
// (PRD §4.4): המשתמש לעולם לא נשאר בלי התזכורת הבאה.
//
// הפונקציה **טהורה** ומחזירה `{ completed, next }`. הכותב (useActions) שם
// את שניהם בעדכון אחד — כדי שלא ייווצר מצב ביניים שבו הישנה סומנה בוצע
// והחדשה לא נוצרה.
//
// חוק המוצר (PRD פרק 5, "מציע לא מבצע"): אף פעם לא שומרים משימה חדשה בלי
// להראות אותה קודם. מסך `CompleteTaskSheet` מציג את `next` לאישור **לפני**
// השמירה. הפונקציה כאן רק מחשבת.
//
// | סוג   | כלל                                                              |
// |-------|------------------------------------------------------------------|
// | טסט   | +12 חודשים מ**תאריך הביצוע**; אם נבחר "לעדכן מהמאגר" — tokef_dt   |
// | ביטוח | +12 חודשים מ**תאריך היעד הישן** — פוליסה מתחדשת ביום השנה,      |
// |       | לא ביום שנזכרת ללחוץ                                             |
// | טיפול | המוקדם מבין תאריך / הערכת ק"מ                                    |
// | תיקון | אין משימה הבאה                                                   |
// | אחר   | אין משימה הבאה                                                   |
// ============================================================================

import { isDay, addMonths, dayOf, todayIso } from "./dates.js";
import { createTask, resetSchedule } from "../schema.js";
import { nextServiceDue } from "./service.js";
import { withNextFire } from "./reminders.js";
import { nowIso } from "./id.js";
import { DEFAULTS } from "../constants.js";

// ============================================================================
// nextDueDate — התאריך של המשימה הבאה, לפי הכלל של הסוג.
// מחזיר null כשאין משימה הבאה (תיקון / אחר).
// ============================================================================
export function nextDueDate(task, ctx = {}) {
  const today = ctx.today || todayIso();
  const completedDate = dayOf(ctx.completedDate) || today;
  const months = task?.renewalRule?.months ?? null;

  switch (task?.renewalRule?.basis) {
    case "completionDate": {
      // טסט. אם המשתמש בחר לעדכן מהמאגר — tokef_dt **גובר** על החישוב,
      // כי הוא התאריך הרשמי ולא הערכה.
      const fromMot = dayOf(ctx.motDate);
      if (fromMot) return fromMot;
      return addMonths(completedDate, months ?? DEFAULTS.testIntervalMonths);
    }
    case "dueDate": {
      // ביטוח. **מתאריך היעד הישן**, לא מהיום — פוליסה מתחדשת ביום השנה
      // שלה. מי שמסמן "חידשתי" שבועיים באיחור לא מזיז את הפוליסה שבועיים.
      const anchor = isDay(task.dueDate) ? task.dueDate : completedDate;
      return addMonths(anchor, months ?? DEFAULTS.insuranceIntervalMonths);
    }
    case "earliestOfDateOrKm": {
      const due = nextServiceDue(
        ctx.vehicle || { id: task?.vehicleId },
        ctx.readings || [],
        {
          intervalMonths: months ?? DEFAULTS.serviceIntervalMonths,
          intervalKm: task?.renewalRule?.km ?? DEFAULTS.serviceIntervalKm,
          lastServiceDate: completedDate,
          lastServiceKm: ctx.completedKm ?? null,
        },
        today
      );
      return due.effectiveDate || addMonths(completedDate, months ?? DEFAULTS.serviceIntervalMonths);
    }
    default:
      return null; // תיקון, אחר — משימה חד-פעמית
  }
}

// ============================================================================
// completeTask — הפונקציה הראשית. מחזירה { completed, next }.
// `next` הוא **טיוטה** שמוצגת למשתמש לאישור; היא נשמרת רק אחרי שאישר.
// ============================================================================
export function completeTask(task, ctx = {}) {
  const today = ctx.today || todayIso();
  const completedDate = dayOf(ctx.completedDate) || today;

  const completed = {
    ...task,
    completedAt: ctx.completedAt || nowIso(),
    completedDate,
    completedKm: Number.isFinite(Number(ctx.completedKm)) ? Number(ctx.completedKm) : null,
    manualStatus: null,
    schedule: {
      ...(task.schedule || {}),
      nextFireAt: null, // בוצע → אין תזכורת. הכי חשוב מכל השדות כאן.
      acknowledged: true,
    },
    updatedAt: nowIso(),
  };

  const dueDate = nextDueDate(task, { ...ctx, today, completedDate });
  if (!dueDate) return { completed, next: null };

  const draft = createTask({
    householdId: task.householdId,
    vehicleId: task.vehicleId,
    type: task.type,
    title: task.title,
    tag: task.tag,
    important: task.important,
    coverage: task.coverage,
    dueDate,
    sourceTaskId: task.id, // שרשרת החידושים — נשמרת, כי היא ההיסטוריה
    renewalRule: task.renewalRule,
    // הלוח מאופס: אותה הגדרת leadDays, בלי היסטוריית שליחה של המשימה הישנה.
    schedule: resetSchedule(task.schedule),
  });

  return { completed, next: withNextFire(draft, today) };
}

// ביטול הסימון — "ביטול הסימון. המשימה חזרה לרשימה."
export function undoComplete(task, today = todayIso()) {
  const restored = {
    ...task,
    completedAt: null,
    completedDate: null,
    completedKm: null,
    schedule: { ...(task.schedule || {}), acknowledged: false, acknowledgedStep: null },
    updatedAt: nowIso(),
  };
  return withNextFire(restored, today);
}

// המפתח של שורת "מה יקרה עכשיו" — מוצגת **לפני** השמירה (שירה §4.2).
export function nextTaskNoticeKey(task, next) {
  if (!next) return `task.next.${task?.type === "repair" ? "repair" : "other"}`;
  if (task?.type === "service") {
    return next.__kmEstimate ? "task.next.service" : "task.next.service.noKm";
  }
  return `task.next.${task?.type || "other"}`;
}
