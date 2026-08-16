// ============================================================================
// sweep.js — ★ מנוע הסריקה.
//
// **מייבא את הפונקציות הטהורות של האפליקציה ולא מממש אותן מחדש:**
// `daysToDue`, `withNextFire`, `dueStepsForRecipient`, `nextChannel`,
// `idempotencyKey`, `createReminderLogEntry`. אין כאן העתק של הסולם.
//
// ============================================================================
// 🔴 אידמפוטנטיות — שתי שכבות, ולמה שתיים
//
// **שכבה 1 — מפתח מפורש (O20).** מזהה המסמך ב-`reminderLog` הוא
// `taskId+dueDate+step+channel+recipientUid`, ו-`create()` נכשל אטומית אם
// הוא כבר קיים. זו ההגנה האמיתית: היא שורדת גם ריצה כפולה, גם retry של
// הפלטפורמה, וגם שני מופעים במקביל — בלי להסתמך על מצב שנכתב קודם.
//
// **שכבה 2 — תפיסה טרנזקציונית לפני השליחה.** מונעת מרוץ בין שני מופעים
// שקוראים את אותו מצב, וחוסכת קריאות ספק מיותרות.
//
// **הרצף שנבחר: create-log → send → update-state.** רשומת היומן נוצרת
// **לפני** השליחה, ומסומנת `sending`. אם השליחה נכשלה — הרשומה מתעדכנת
// ל-failed. אם הריצה מתה באמצע — הרשומה נשארת `sending`, וזה **מונע**
// שליחה חוזרת. כלומר **at-most-once לכל (משימה, תאריך, שלב, ערוץ, נמען)**.
//
// למה זה הצד הנכון לטעות בו: הסולם עצמו הוא ה-retry (שישה שלבים, שלושה
// ערוצים). אובדן שלב אחד בתקלה נדירה עולה תזכורת אחת מתוך רבות; הכיוון
// ההפוך עולה הצפה — ומשתמש שמכבה התראות לא יקבל אף תזכורת, כולל הקריטית.
// (R12: מתועדים גם ניסיונות שנכשלו. לוג שמתעד רק הצלחות אינו ראיה.)
// ============================================================================

import { withNextFire } from "../../src/utils/reminders.js";
import {
  recipientsFor,
  dueStepsForRecipient,
  nextChannel,
  isCriticalTask,
  nextFireAfterSend,
  idempotencyKey,
  isQuietHour,
} from "../../src/utils/escalation.js";
import { createReminderLogEntry, createRecipientState } from "../../src/schema.js";
import { todayInZone, hourInZone } from "../../src/utils/dates.js";
import {
  DEFAULT_SETTINGS,
  TASK_PRIVATE_SUBCOLLECTION,
  TASK_PRIVATE_DOC,
  MAX_MESSAGES_PER_RECIPIENT_PER_DAY,
  CHANNEL_FAILURE_LIMIT,
  SEND_ENABLED_ENV,
} from "../../src/constants.js";

const TZ = "Asia/Jerusalem";

// ============================================================================
// O19 + R13 — שתי בקרות שליחה, ושתיהן חייבות להיות דלוקות.
//
// R13: דגל סביבה מפורש. **ברירת המחדל: כבוי.** התקלה הקלאסית של פרוסה
//      ראשונה בשליחה היא בדיקה ששולחת אלפי הודעות אמיתיות.
// O19: ומתג עצירה ב-Firestore (`config/runtime.sendingEnabled`) שעוצר הכול
//      **בלי deploy** — כי באג בגזירת הסטטוס הוא כבר לא תצוגה שגויה לאחד.
// ============================================================================
export async function sendingAllowed({ db, env = process.env }) {
  if (String(env[SEND_ENABLED_ENV]).toLowerCase() !== "true") {
    return { allowed: false, reason: "env-flag-off" };
  }
  const snap = await db.doc("config/runtime").get();
  if (snap.exists && snap.data().sendingEnabled === false) {
    return { allowed: false, reason: "kill-switch" };
  }
  return { allowed: true, reason: null };
}

// ============================================================================
// 🔴 T5 — אימות הנמען **בזמן השליחה**, לא בזמן התזמון.
//
// `recipientUid` מתיישן: בין קביעת `nextFireAt` לשליחה בפועל האדם עלול
// להיות מוסר ממשק הבית, משק הבית עלול להתפרק, או החשבון להימחק.
// **אסור להסתמך על כך שהשאילתה לא תמצא את המשימה** — אצווה שנטענה בתחילת
// הריצה תשלח בכל מקרה. הבדיקה חייבת להיות **בנקודת השליחה**.
// ============================================================================
export async function recipientStillValid({ db, hid, uid }) {
  const [hh, membership] = await Promise.all([
    db.collection("households").doc(hid).get(),
    db.collection("memberships").doc(uid).get(),
  ]);
  if (!hh.exists) return { valid: false, reason: "household-deleted" };
  const members = hh.data().household?.members || {};
  if (!members[uid]) return { valid: false, reason: "no-longer-member" };
  if (membership.exists && membership.data().householdId !== hid) {
    return { valid: false, reason: "membership-moved" };
  }
  return { valid: true, reason: null };
}

const privateRef = (db, hid, taskId) =>
  db
    .collection("households")
    .doc(hid)
    .collection("tasks")
    .doc(taskId)
    .collection(TASK_PRIVATE_SUBCOLLECTION)
    .doc(TASK_PRIVATE_DOC);

// ============================================================================
export async function runReminderSweep({
  db,
  providers,
  now = new Date(),
  today = null,
  hour = null,
  forceHour = false,
  ignoreQuietHours = false,
  env = process.env,
  logger = console,
  limit = 500,
} = {}) {
  const runToday = today || todayInZone(TZ, now);
  const runHour = hour === null ? hourInZone(TZ, now) : hour;
  const nowIso = now.toISOString();

  const stats = {
    scanned: 0, households: 0, sent: 0, failed: 0, skipped: 0,
    deferredQuiet: 0, blocked: 0, invalidRecipient: 0, duplicate: 0, capped: 0,
  };

  const gate = await sendingAllowed({ db, env });
  if (!gate.allowed) {
    // ⚠️ יוצאים **לפני** כל שליחה — אבל אחרי שרשמנו למה. שקוף בלוגים.
    stats.blocked = 1;
    stats.blockedReason = gate.reason;
    logger.warn?.("sending disabled", gate);
    return stats;
  }

  // R11 — מחוץ לשעות השקטות: דוחים את הריצה כולה. השלב לא אובד, הוא ממתין.
  if (!ignoreQuietHours && isQuietHour(runHour)) {
    stats.deferredQuiet = 1;
    return stats;
  }

  const snap = await db
    .collectionGroup("tasks")
    .where("schedule.nextFireAt", "<=", runToday)
    .limit(limit)
    .get();
  stats.scanned = snap.size;
  if (snap.empty) return stats;

  const byHousehold = new Map();
  for (const d of snap.docs) {
    const hid = d.data().householdId;
    if (!hid) continue;
    if (!byHousehold.has(hid)) byHousehold.set(hid, []);
    byHousehold.get(hid).push(d);
  }

  // O20 — תקרה יומית לנמען, נספרת לאורך כל הריצה.
  const sentToday = new Map();

  for (const [hid, docs] of byHousehold) {
    const hhSnap = await db.collection("households").doc(hid).get();
    if (!hhSnap.exists) {
      stats.skipped += docs.length;
      continue;
    }
    const hh = hhSnap.data();
    const settings = { ...DEFAULT_SETTINGS, ...(hh.settings || {}) };
    if (!forceHour && Number(settings.notificationHour) !== Number(runHour)) {
      stats.skipped += docs.length;
      continue;
    }
    stats.households++;

    const owners = Object.entries(hh.household?.members || {})
      .filter(([, role]) => role === "owner")
      .map(([uid]) => uid);

    for (const taskDoc of docs) {
      await processTask({
        db, providers, hid, taskDoc, owners, today: runToday, nowIso, stats, sentToday, logger,
      });
    }
  }

  return stats;
}

// ============================================================================
async function processTask({ db, providers, hid, taskDoc, owners, today, nowIso, stats, sentToday, logger }) {
  const task = taskDoc.data();
  const taskId = taskDoc.id;

  const stateSnap = await privateRef(db, hid, taskId).get();
  const priv = stateSnap.exists ? stateSnap.data() : { recipients: {} };

  // ★ T1 — כל נמען והסולם שלו. הבעלים אינו "מוסלם אליו".
  const recipients = recipientsFor(task, { owners, driverUid: task.assignedDriverUid || null });
  let taskLevelStep = task.schedule?.lastFiredStep ?? null;
  let anySent = false;
  let anyMoreChannels = false;

  for (const recipient of recipients) {
    const state = createRecipientState(priv.recipients?.[recipient.uid] || {});
    const isCritical = isCriticalTask(task);

    // איזה שלב בשל **לנמען הזה** — לפי הסולם שלו ולפי האישור שלו עצמו.
    const steps = dueStepsForRecipient({ task, ladder: recipient.ladder, state, today });
    let step = steps.length ? Math.min(...steps) : state.lastFiredStep;
    if (step === null || step === undefined) {
      stats.skipped++;
      continue;
    }
    const isNewStep = steps.length > 0;

    const userSnap = await db.collection("users").doc(recipient.uid).get();
    const user = userSnap.exists ? userSnap.data() : null;
    const serviceChannels = user?.serviceChannels || { push: true };
    const disabledChannels = user?.disabledChannels || [];

    const channel = nextChannel({
      channelsTried: isNewStep ? [] : state.channelsTried,
      serviceChannels,
      isCritical,
      lastFiredAt: isNewStep ? null : state.lastFiredAt,
      acknowledgedAt: state.acknowledgedAt,
      disabledChannels,
      now: nowIso,
    });
    if (!channel) {
      stats.skipped++;
      continue;
    }

    // -- O20: תקרה יומית --------------------------------------------------
    const capKey = `${recipient.uid}:${today}`;
    const already = sentToday.get(capKey) || 0;
    if (already >= MAX_MESSAGES_PER_RECIPIENT_PER_DAY) {
      stats.capped++;
      continue;
    }

    // -- 🔴 T5: אימות הנמען **עכשיו**, לא בזמן התזמון ---------------------
    const valid = await recipientStillValid({ db, hid, uid: recipient.uid });
    if (!valid.valid) {
      stats.invalidRecipient++;
      logger.warn?.("recipient no longer valid", { reason: valid.reason });
      continue;
    }

    // -- 🔴 O20: מפתח האידמפוטנטיות כמזהה המסמך --------------------------
    const key = idempotencyKey({
      taskId, step, channel, dueDate: task.dueDate, recipientUid: recipient.uid,
    });
    const logRef = db.collection("households").doc(hid).collection("reminderLog").doc(key);

    const entry = createReminderLogEntry({
      id: key,
      householdId: hid,
      taskId,
      vehicleId: task.vehicleId,
      recipientUid: recipient.uid,
      step,
      channel,
      deliveryState: "sending",
      firedAt: nowIso,
    });
    try {
      // `create` נכשל אטומית אם המפתח כבר קיים — זו ההגנה מפני שליחה כפולה.
      await logRef.create(entry);
    } catch {
      stats.duplicate++;
      continue;
    }

    // -- השליחה. מכאן והלאה, כשל **אינו** גורם לשליחה חוזרת. -------------
    let result = { ok: false, errorCode: "provider-missing" };
    try {
      result = await providers.send(channel, { uid: recipient.uid }, {
        taskId, vehicleId: task.vehicleId, type: task.type, dueDate: task.dueDate, step,
        role: recipient.role,
      });
    } catch (err) {
      // ⚠️ בלי לוג של השגיאה המלאה — תגובות ספק מכילות את היעד.
      result = { ok: false, errorCode: String(err?.code || "provider-error").slice(0, 40) };
    }

    await logRef.update({
      deliveryState: result.ok ? "sent" : "failed",
      errorCode: result.ok ? null : String(result.errorCode || "").slice(0, 40),
    });

    // -- מצב פר-נמען → תת-המסמך הפרטי (T3) -------------------------------
    const failures = result.ok ? 0 : (state.consecutiveFailures || 0) + 1;
    const nextState = createRecipientState({
      ...state,
      lastFiredStep: step,
      lastFiredAt: nowIso,
      channelsTried: isNewStep ? [channel] : [...state.channelsTried, channel],
      deliveryState: result.ok ? "sent" : "failed",
      consecutiveFailures: failures,
    });
    await privateRef(db, hid, taskId).set(
      { taskId, householdId: hid, recipients: { [recipient.uid]: nextState }, updatedAt: nowIso },
      { merge: true }
    );

    // -- O21: כיבוי אוטומטי של ערוץ כושל ---------------------------------
    if (failures >= CHANNEL_FAILURE_LIMIT && !disabledChannels.includes(channel)) {
      await db.collection("users").doc(recipient.uid).set(
        { disabledChannels: [...disabledChannels, channel] },
        { merge: true }
      );
      logger.warn?.("channel auto-disabled", { channel, uid: recipient.uid });
    }

    if (result.ok) {
      stats.sent++;
      anySent = true;
      sentToday.set(capKey, already + 1);
    } else {
      stats.failed++;
    }

    if (taskLevelStep === null || step < taskLevelStep) taskLevelStep = step;
    const more = Boolean(
      nextChannel({
        channelsTried: nextState.channelsTried,
        serviceChannels, isCritical, disabledChannels,
        lastFiredAt: nowIso, acknowledgedAt: null,
        now: new Date(Date.parse(nowIso) + 365 * 24 * 3600000).toISOString(),
      })
    );
    if (more) anyMoreChannels = true;
  }

  // -- המסמך הציבורי: **רק** השלב ברמת המשימה ו-nextFireAt (T3) ----------
  if (anySent || taskLevelStep !== (task.schedule?.lastFiredStep ?? null)) {
    const publicTask = { ...task, schedule: { ...task.schedule, lastFiredStep: taskLevelStep } };
    const withFire = nextFireAfterSend(publicTask, { hasMoreChannels: anyMoreChannels, today });
    await taskDoc.ref.update({ schedule: withFire.schedule, updatedAt: nowIso });
  }
}

export { withNextFire };
