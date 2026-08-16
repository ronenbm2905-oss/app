// ============================================================================
// escalation.js — סולם **הערוצים** ו**הנמענים**, טהור.
//
// שים לב לשלוש ההבחנות, כי הן כל המבנה:
//   · `reminders.js` — **מתי** להזכיר (הסולם [30,14,7,3,1,0]).
//   · כאן — **למי**, ו**באיזה ערוץ**, ומה עושים כשהערוץ לא הספיק.
//
// ============================================================================
// 🔴 T1 — הבעלים אינו "מוסלם אליו". הוא נמען בזכות עצמו.
//
// התכנון המקורי היה: הנהג מקבל, ואם **לא אישר** — מסלימים לבעלים. עדי
// פירקה אותו: אם ההסלמה נורית *כי הנהג לא אישר*, עצם קבלתה מלמדת את
// הבעלים שהנהג לא אישר. **ניקוי נוסח ההודעה לא מנקה את ההסקה.**
//
// לכן: לכל נמען **סולם משלו**, והפרדיקט הוא `!completedAt` — לעולם לא
// `!acknowledgedAt` של אדם אחר. אישור של נמען עוצר **את הסולם שלו בלבד**;
// זו התייחסות עצמית, ולכן אינה חושפת דבר על אחרים.
//
// וזו גם ההנדסה הנכונה: רשת הביטחון נועדה לתפוס טלפון כבוי או התראות
// חסומות — **הסלמה שמותנית באי-אישור לא תופסת מקרה שבו לא הייתה מסירה
// כלל**, כלומר בדיוק את התרחיש שבשבילו היא קיימת.
// ============================================================================
//
// טהור לגמרי — בלי React, בלי Firebase, בלי שעון. `now` תמיד מוזרק.
// **מיובא ע"י ה-Cloud Function**, ולא מועתק אליה.
// ============================================================================

import {
  ESCALATION_HOURS,
  CRITICAL_TASK_TYPES,
  REMINDER_CHANNELS,
  OWNER_LADDER,
  QUIET_HOURS,
} from "../constants.js";
import { hoursBetween, todayIso } from "./dates.js";
import { ladderFor, daysToDue, withNextFire } from "./reminders.js";

// טסט וביטוח בלבד. אלה השניים שאי-טיפול בהם הוא עבירה על החוק, ולכן רק הם
// מצדיקים ערוץ שלישי (מייל). טיפול/תיקון/אחר נעצרים ב-SMS.
export function isCriticalTask(task) {
  return CRITICAL_TASK_TYPES.includes(task?.type);
}

export function enabledChannels(serviceChannels = {}) {
  return REMINDER_CHANNELS.filter((c) => serviceChannels?.[c]);
}

// ============================================================================
// recipientsFor — מי מקבל, ובאיזה סולם.
//
// בפרוסה 2א יש בעלים אחד, ולכן זו רשימה בת איבר אחד עם הסולם המלא.
// בפרוסה 2ב הנהג מקבל את הסולם המלא והבעלים את `OWNER_LADDER` — **לא כהסלמה
// ממנו, אלא כזכות עצמאית על רכב שבבעלותו.**
// ============================================================================
export function recipientsFor(task, { owners = [], driverUid = null } = {}) {
  const out = [];
  if (driverUid) {
    out.push({ uid: driverUid, role: "driver", ladder: ladderFor(task) });
    for (const uid of owners) {
      if (uid === driverUid) continue;
      // ★ סולם משלו, מאוחר יותר. הפרדיקט הוא מצב המשימה בלבד.
      out.push({ uid, role: "owner", ladder: ladderForOwner(task) });
    }
    return out;
  }
  for (const uid of owners) out.push({ uid, role: "owner", ladder: ladderFor(task) });
  return out;
}

// כשאין נהג, הבעלים הוא הנמען היחיד ומקבל את הסולם המלא. כשיש נהג, הבעלים
// מקבל את הסולם המאוחר — חיתוך של OWNER_LADDER עם הסולם של המשימה.
export function ladderForOwner(task) {
  const full = ladderFor(task);
  return OWNER_LADDER.filter((s) => full.includes(s));
}

// ============================================================================
// dueStepsForRecipient — אילו שלבים בשלים **לנמען הזה**.
//
// 🔴 הפרדיקט: `!completedAt` + הסולם של הנמען + האישור **שלו עצמו**.
// לעולם לא מצבו של נמען אחר.
// ============================================================================
export function dueStepsForRecipient({ task, ladder, state = {}, today = todayIso() } = {}) {
  if (!task || task.completedAt) return [];
  const sched = task.schedule || {};
  if (sched.muted) return [];
  if (sched.snoozedUntil && sched.snoozedUntil > today) return [];
  if (state.acknowledgedAt) return []; // האישור **שלו**
  const d = daysToDue(task, today);
  if (d === null) return [];

  const last = state.lastFiredStep;
  const steps = (ladder || []).filter((step) => {
    if (d > step) return false;
    if (last === null || last === undefined) return true;
    return step < last;
  });
  if (d < 0 && !steps.includes(0) && last !== 0) steps.push(0);
  return steps;
}

// ============================================================================
// nextChannel — הערוץ הבא שיש לנסות **עכשיו**, או null.
//
// null בשלושה מצבים נכונים: הסולם מוצה · עוד בתוך חלון ההמתנה · הנמען אישר.
// ============================================================================
export function nextChannel({
  channelsTried = [],
  serviceChannels = { push: true },
  isCritical = false,
  lastFiredAt = null,
  acknowledgedAt = null,
  disabledChannels = [],
  now = new Date().toISOString(),
} = {}) {
  if (acknowledgedAt) return null;

  const available = enabledChannels(serviceChannels).filter((c) => {
    if (c === "email" && !isCritical) return false; // מייל = ערוץ שלישי, בקריטי בלבד
    if (disabledChannels.includes(c)) return false; // O21 — ערוץ שהושבת אוטומטית
    return true;
  });
  const remaining = available.filter((c) => !channelsTried.includes(c));
  if (!remaining.length) return null;
  if (!channelsTried.length) return remaining[0];

  const waited = hoursBetween(lastFiredAt, now);
  if (waited === null) return null;
  const last = channelsTried[channelsTried.length - 1];
  const windowHours = last === "push" ? ESCALATION_HOURS.pushToSms : ESCALATION_HOURS.smsToEmail;
  return waited >= windowHours ? remaining[0] : null;
}

// ============================================================================
// O20 — מפתח האידמפוטנטיות. `taskId + step + channel + dueDate`.
//
// משמש כ**מזהה המסמך** ב-`reminderLog`, ולכן `create()` נכשל אטומית על
// כפילות. `dueDate` בפנים כי משימה שתאריכה השתנה היא אירוע חדש לגיטימי.
// ============================================================================
export function idempotencyKey({ taskId, step, channel, dueDate, recipientUid }) {
  return [taskId, dueDate || "nodate", `s${step}`, channel, recipientUid].join("__").replace(/[^\w-]/g, "_");
}

// ============================================================================
// R11 — שעות שקטות. **דוחים את השלב, לא מדלגים עליו.**
// SMS קריטי ב-03:00 לקהל מבוגר הוא בדיוק התלונה שקל למנוע.
// ============================================================================
export function isQuietHour(hour, { startHour, endHour } = QUIET_HOURS) {
  const h = Number(hour);
  if (!Number.isFinite(h)) return false;
  return h < startHour || h >= endHour;
}

// ============================================================================
// nextFireAfterSend — מתי ה-scheduler יחזור למשימה.
// אם נשארו ערוצים להסלמה, חוזרים **היום** (הסריקה רצה כל שעה); אחרת חוזרים
// לחישוב הרגיל של reminders.js.
// ============================================================================
export function nextFireAfterSend(task, { hasMoreChannels, today = todayIso() } = {}) {
  if (hasMoreChannels) {
    return { ...task, schedule: { ...(task.schedule || {}), nextFireAt: today } };
  }
  return withNextFire(task, today);
}
