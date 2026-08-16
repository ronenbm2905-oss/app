// ============================================================================
// reminders.js — מנוע התזכורות. **טהור**: בלי React, בלי Firebase, בלי
// גישה ל-Date הגלובלי — `today` תמיד מוזרק.
//
// מטרת התכנון היא ניידות: הקובץ הזה בדיוק ירוץ בתוך Cloud Function בפרוסה 2,
// שתריץ שאילתה אחת על `schedule.nextFireAt <= today` ותוסיף רק *הובלה*
// (FCM → SMS → מייל), לא לוגיקה. לכן אין כאן שום תלות בסביבה.
//
// ⚠️ אין להעתיק לכאן את property-management/src/utils/reminders.js — הוא
//    משתמש ב-new Date(iso)+setHours, בדיוק מלכודת אזור הזמן ש-dates.js נכתב
//    כדי למנוע. לקחנו ממנו רק את הרעיון של leadDays.
// ============================================================================

import { isDay, daysUntil, addDays, todayIso } from "./dates.js";
import { REMINDER_LADDER, REMINDER_BUCKETS, DEFAULTS } from "../constants.js";

// -- הסולם --------------------------------------------------------------
// [30,14,7,3,1,0] מסונן לפי leadDays. משתמש שביקש "שבוע מראש" לא מקבל
// תזכורת ב-30 יום — אבל כן מקבל את כל השלבים שמתחת.
export function ladderFor(task) {
  const lead = Number(task?.schedule?.leadDays ?? DEFAULTS.leadDays);
  const ladder = Array.isArray(task?.schedule?.ladder) && task.schedule.ladder.length
    ? task.schedule.ladder
    : REMINDER_LADDER;
  return ladder.filter((d) => Number.isFinite(d) && d <= lead).sort((a, b) => b - a);
}

export function leadDaysOf(task) {
  return Number(task?.schedule?.leadDays ?? DEFAULTS.leadDays);
}

// כמה ימים עד היעד. שלילי = עבר. null כשאין תאריך יעד.
export function daysToDue(task, today = todayIso()) {
  if (!isDay(task?.dueDate)) return null;
  return daysUntil(task.dueDate, today);
}

// ============================================================================
// computeStatus — גזירת הסטטוס. **הסדר הוא החלטת מוצר, לא נוחות מימוש:**
//
//   1. completedAt            → בוצע
//   2. dueDate < today        → באיחור   ← גובר על "בטיפול"
//   3. manualStatus           → בטיפול
//   4. daysUntil <= leadDays  → מתקרב
//   5. אחרת                   → פתוח
//
// כלל 2 גובר על כלל 3 **בכוונה**. "בטיפול" אומר שהמשתמש קבע תור; ברגע
// שהתאריך עבר, הרכב לא עבר טסט בפועל, ועקרון "אמינות לפני הכול" (PRD §1.5)
// מחייב לומר *באיחור*. זה נראה כמו באג — ולכן הוא מתועד כאן, נאכף ב-smoke,
// ומוסבר למשתמש במחרוזת `task.status.overdue.hintFromInProgress`.
// ============================================================================
export function computeStatus(task, today = todayIso()) {
  if (!task) return "open";
  if (task.completedAt) return "done";
  const d = daysToDue(task, today);
  if (d === null) return task.manualStatus === "inProgress" ? "inProgress" : "open";
  if (d < 0) return "overdue"; // ← לפני manualStatus. במתכוון.
  if (task.manualStatus === "inProgress") return "inProgress";
  if (d <= leadDaysOf(task)) return "upcoming";
  return "open";
}

// המחרוזת שמסבירה את הסטטוס — כולל המקרה שנראה כמו באג.
export function statusHintKey(task, today = todayIso()) {
  const status = computeStatus(task, today);
  if (status === "overdue" && task?.manualStatus === "inProgress") {
    return "task.status.overdue.hintFromInProgress";
  }
  return `task.status.${status}.hint`;
}

// ============================================================================
// dueSteps — אילו שלבי סולם "בשלים" היום ועדיין לא נורו.
// משימה שעברה את התאריך ממשיכה להחזיר את שלב 0 מדי יום, עד אישור או ביצוע —
// זו "התזכורת שלא נכשלת" של PRD §4.8, ולא באג.
// ============================================================================
export function dueSteps(task, today = todayIso(), { lastFiredStep, acknowledged } = {}) {
  if (!task || task.completedAt) return [];
  const sched = task.schedule || {};
  if (sched.muted) return [];
  if (isDay(sched.snoozedUntil) && sched.snoozedUntil > today) return [];
  // T3 — בוליאני, לא חותמת. `acknowledged` ניתן לדריסה כדי שהשרת יוכל
  // לחשב **פר-נמען** מתוך המצב הפרטי, בלי שהחותמת תעלה למסמך הציבורי.
  if (acknowledged ?? sched.acknowledged) return [];
  const d = daysToDue(task, today);
  if (d === null) return [];

  const last = lastFiredStep === undefined ? sched.lastFiredStep : lastFiredStep;
  const steps = ladderFor(task).filter((step) => {
    if (d > step) return false; // עוד לא הגיע הזמן של השלב הזה
    if (last === null || last === undefined) return true;
    return step < last; // הסולם יורד — שלב "קטן יותר" הוא מאוחר יותר
  });

  // משימה באיחור: שלב 0 הוא השלב שחוזר — הדה-דופליקציה היומית עברה למפתח
  // האידמפוטנטיות בצד השרת (O20: taskId+step+channel+dueDate), שהוא ממילא
  // נדרש ומדויק יותר מבדיקת "כבר נורה היום".
  if (d < 0 && !steps.includes(0) && last !== 0) steps.push(0);
  return steps;
}

// ============================================================================
// nextFireDate — התאריך שבו התזכורת הבאה צריכה לצאת.
// **זהו השדה שפרוסה 2 תשאיל אליו** (`nextFireAt <= today`), ולכן הוא נכתב
// כבר עכשיו על כל משימה.
//   muted / done  → null (אין תזכורת)
//   snoozed       → תאריך ה-snooze
//   באיחור        → today (ממשיך להציק יומית)
//   אחרת          → תאריך השלב הבא שטרם נורה
// ============================================================================
export function nextFireDate(task, today = todayIso()) {
  if (!task || task.completedAt) return null;
  const sched = task.schedule || {};
  if (sched.muted) return null;
  if (sched.acknowledged) return null;
  if (isDay(sched.snoozedUntil) && sched.snoozedUntil > today) return sched.snoozedUntil;
  if (!isDay(task.dueDate)) return null;

  const d = daysUntil(task.dueDate, today);
  if (d < 0) return today; // עבר — מזכירים היום, ומחר שוב

  const last = sched.lastFiredStep;
  const candidates = ladderFor(task).filter((step) =>
    last === null || last === undefined ? true : step < last
  );
  for (const step of candidates) {
    const fireOn = addDays(task.dueDate, -step);
    if (fireOn >= today) return fireOn;
  }
  // כל השלבים שמעל 0 כבר נורו והתאריך עוד לא עבר → יורים ביום היעד.
  return candidates.includes(0) ? task.dueDate : null;
}

// מחזיר עותק של המשימה עם nextFireAt מעודכן — הכותב היחיד לשדה הזה.
export function withNextFire(task, today = todayIso()) {
  return { ...task, schedule: { ...(task.schedule || {}), nextFireAt: nextFireDate(task, today) } };
}

// -- אישור, השהיה, השתקה -------------------------------------------------
// 🔴 T3 — האישור נרשם כ**עובדה בוליאנית** על המשימה. החותמת (`acknowledgedAt`)
// יורדת ל-`tasks/{id}/private/state` ונכתבת ע"י השרת. הסיבה: מסמך המשימה
// נקרא ע"י הבעלים, ו"מתי הנהג אישר" הוא בדיוק הדגימה ההתנהגותית שהוצאה
// מ-reminderLog — אין טעם להוציא אותה מהדלת ולהכניס מהחלון.
export function acknowledge(task, { step = null } = {}) {
  return {
    ...task,
    schedule: {
      ...(task.schedule || {}),
      acknowledged: true,
      acknowledgedStep: step,
      nextFireAt: null,
    },
  };
}

export function snooze(task, until, today = todayIso()) {
  const next = { ...task, schedule: { ...(task.schedule || {}), snoozedUntil: until } };
  return withNextFire(next, today);
}

export function mute(task, muted = true, today = todayIso()) {
  const next = { ...task, schedule: { ...(task.schedule || {}), muted: Boolean(muted) } };
  return withNextFire(next, today);
}

// רישום שליחה — נקרא ע"י ה-scheduler אחרי תפיסה מוצלחת.
// 🔴 T3 — מעדכן **רק** את השלב ברמת המשימה. החותמת, הערוץ ומצב המסירה הם
// פר-נמען ויורדים ל-`tasks/{id}/private/state`.
export function markFired(task, { step } = {}, today = todayIso()) {
  const sched = task.schedule || {};
  const next = { ...task, schedule: { ...sched, lastFiredStep: step } };
  return withNextFire(next, today);
}

// ============================================================================
// דלי הקופי — הכרטיס בדשבורד מציג טקסט לפי **הדלי שבו מספר הימים נמצא
// היום**, לא לפי היום שבו נשלחה התזכורת (שירה §2.0).
// מעל 30 יום → null: הכרטיס לא נחשב דחוף ואינו מוצג ככרטיס-גיבור.
// ============================================================================
export function bucketFor(days) {
  if (days === null || days === undefined) return null;
  if (days < 0) return "overdue";
  const hit = REMINDER_BUCKETS.find((b) => days >= b.min && days <= b.max);
  return hit ? hit.key : null;
}

export function bucketForTask(task, today = todayIso()) {
  return bucketFor(daysToDue(task, today));
}

// ============================================================================
// engineMessage — מיפוי משימה → מפתחות הקופי של שירה + המשתנים.
// מחזיר { titleKey, subKey, vars } או null כשהמשימה אינה בטווח הדלי.
//
// הכללים של שירה שמיושמים כאן:
//   `{days}` == 2 → ווריאנט `.two` ("יומיים", לא "2 ימים")
//   באיחור של יום אחד → ווריאנט `.one` ("אתמול")
//   ביטוח באיחור → **שתי** שורות תמיכה לפי סוג הכיסוי. "אסור לנסוע" נכון
//   לביטוח חובה בלבד; אסור להציג אותו על מקיף.
// ============================================================================
export function engineMessage(task, vehicleLabel, today = todayIso()) {
  if (!task) return null;
  const d = daysToDue(task, today);
  const bucket = bucketFor(d);
  if (!bucket) return null;

  const type = task.type || "other";
  const base = `engine.${type}.${bucket}`;
  const days = d === null ? null : Math.abs(d);

  let titleKey = `${base}.title`;
  if (bucket === "d3" && days === 2) titleKey = `${base}.title.two`;
  if (bucket === "overdue" && days === 1) titleKey = `${base}.title.one`;
  if (bucket === "overdue" && days === 2) titleKey = `${base}.title.two`;

  let subKey = `${base}.sub`;
  if (type === "insurance" && bucket === "overdue") {
    // ברירת המחדל היא comprehensive: משפט "אסור לנסוע" יוצא **רק** כשידוע
    // בוודאות שמדובר בביטוח חובה.
    subKey = task.coverage === "compulsory" ? `${base}.sub.compulsory` : `${base}.sub.comprehensive`;
  }

  return {
    bucket,
    days,
    titleKey,
    subKey,
    vars: {
      vehicle: vehicleLabel || "",
      days: days ?? "",
      title: task.title || "",
      coverageKey: task.coverage ? `insurance.coverage.${task.coverage}` : "insurance.coverage.generic",
      date: task.dueDate || "",
    },
  };
}

// ============================================================================
// attributionFor — 🔴 שורת **ייחוס-העובדה** על כרטיס ה-overdue.
//
// זו לא הבהרה משפטית ולא disclaimer. היא עושה דבר אחד: מפרידה בין ה**כלל**
// — שהוא של החוק, ולכן מנוסח בשמו — לבין ה**עובדה** שעליה אנחנו מסתמכים,
// שהיא שלנו וניתנת לבדיקה. בלעדיה, משפט כמו "החוק אוסר לנהוג ברכב שאין לו
// ביטוח חובה בתוקף" נשמע כאילו אנחנו יודעים בוודאות שאין לו — ואנחנו לא.
//
// היא גם מכסה את דרישת הטריות של `tokef_dt`: המאגר הוא snapshot תקופתי,
// ומי שעבר טסט היום עלול לראות ערך ישן.
//
// מחזירה null כשהמשימה אינה באיחור — אין מה לייחס.
// ============================================================================
export function attributionFor(task, vehicle, today = todayIso()) {
  if (!task || computeStatus(task, today) !== "overdue") return null;
  if (task.type === "insurance") return { key: "engine.attribution.insurance", vars: {} };
  if (task.type === "test") {
    const fetchedAt = vehicle?.motSource?.fetchedAt;
    if (fetchedAt) return { key: "engine.attribution.test", vars: { date: String(fetchedAt).slice(0, 10) } };
    return { key: "engine.attribution.manual", vars: {} };
  }
  return { key: "engine.attribution.manual", vars: {} };
}

// ============================================================================
// fixActionKey — התווית של **פעולת התיקון בלחיצה אחת** על כרטיס ה-overdue.
// כשהאפליקציה אומרת משהו בשם החוק והיא טועה, למשתמש חייבת להיות יציאה
// מיידית — מהכרטיס עצמו, לא רק ממסך המשימה.
// ============================================================================
export function fixActionKey(task) {
  if (task?.type === "insurance") return "task.fix.insurance";
  if (task?.type === "test") return "task.fix.test";
  return "task.fix.generic";
}

// ============================================================================
// דירוג ומיון.
// הסדר: סטטוס → תאריך יעד → "חשוב" → מזהה (יציבות).
// התאריך גובר על "חשוב" בכוונה: משתמש מבוגר מצפה שהדבר הקרוב יהיה למעלה.
// "חשוב" שובר שוויון בתוך אותו יום.
// ============================================================================
export const URGENCY_ORDER = ["overdue", "upcoming", "inProgress", "open", "done"];

export function urgencyRank(statusOrTask, today = todayIso()) {
  const status = typeof statusOrTask === "string" ? statusOrTask : computeStatus(statusOrTask, today);
  const i = URGENCY_ORDER.indexOf(status);
  return i < 0 ? URGENCY_ORDER.length : i;
}

export function sortTasks(tasks, today = todayIso()) {
  return [...(tasks || [])].sort((a, b) => {
    const ra = urgencyRank(a, today);
    const rb = urgencyRank(b, today);
    if (ra !== rb) return ra - rb;
    const da = a?.dueDate || "9999-12-31";
    const db = b?.dueDate || "9999-12-31";
    if (da !== db) return da < db ? -1 : 1;
    if (Boolean(a?.important) !== Boolean(b?.important)) return a?.important ? -1 : 1;
    return String(a?.id) < String(b?.id) ? -1 : 1;
  });
}

// המשימה שמופיעה בכרטיס-הגיבור. **משימה אחת בדיוק** — שתי דחיפויות בכרטיס
// אחד הן בלבול (מפרט איתי §6.1). משימות שבוצעו לא נספרות.
export function mostUrgent(tasks, today = todayIso()) {
  const live = (tasks || []).filter((t) => computeStatus(t, today) !== "done");
  return sortTasks(live, today)[0] || null;
}

// האם יש כאן משהו שדורש טיפול **עכשיו** — בקרה של כרטיס-הגיבור מול
// מצב "הכול מסודר". מעל 30 יום = לא דחוף.
export function isUrgent(task, today = todayIso()) {
  return bucketForTask(task, today) !== null && computeStatus(task, today) !== "done";
}

export function heroTask(tasks, today = todayIso()) {
  const t = mostUrgent(tasks, today);
  return t && isUrgent(t, today) ? t : null;
}

// המשימה הקרובה של רכב מסוים — לשורה בכרטיס הרכב בדשבורד.
export function nextTaskForVehicle(tasks, vehicleId, today = todayIso()) {
  const list = (tasks || []).filter(
    (t) => t.vehicleId === vehicleId && computeStatus(t, today) !== "done"
  );
  return sortTasks(list, today)[0] || null;
}
