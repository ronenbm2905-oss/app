// נוצר ע"י functions/build.mjs — אל תערוך. המקור: functions/src/ + src/utils/

// src/index.js
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getMessaging } from "firebase-admin/messaging";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

// ../src/utils/dates.js
function todayIso(now = /* @__PURE__ */ new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function isDay(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function toDayNumber(day) {
  const [y, m, d] = day.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 864e5);
}
function daysBetween(a, b) {
  if (!isDay(a) || !isDay(b)) return null;
  return toDayNumber(b) - toDayNumber(a);
}
function daysUntil(day, from = todayIso()) {
  return daysBetween(from, day);
}
function addDays(day, n) {
  if (!isDay(day)) return null;
  const dt = new Date(Date.UTC(...day.split("-").map((v, i) => i === 1 ? Number(v) - 1 : Number(v))));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
function daysInMonth(year, month) {
  const leap = year % 4 === 0 && year % 100 !== 0 || year % 400 === 0;
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
function addMonths(dayStr, months) {
  if (!isDay(dayStr)) return null;
  const n = Number(months);
  if (!Number.isFinite(n)) return null;
  const [y, m, d] = dayStr.split("-").map(Number);
  const totalMonths = y * 12 + (m - 1) + Math.trunc(n);
  const ny = Math.floor(totalMonths / 12);
  const nm = totalMonths % 12 + 1;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}
function todayInZone(timeZone = "Asia/Jerusalem", now = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  return isDay(parts) ? parts : todayIso(now);
}
function hourInZone(timeZone = "Asia/Jerusalem", now = /* @__PURE__ */ new Date()) {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false }).format(now);
  const n = Number(h);
  return Number.isFinite(n) ? n % 24 : now.getHours();
}
function hoursBetween(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (b - a) / 36e5;
}

// ../src/constants.js
var SCHEMA_VERSION = 1;
var POLICY_VERSION = "0.1-draft";
var ENTITY_COLLECTIONS = [
  "vehicles",
  "vehiclesPrivate",
  // בעלים בלבד **לתמיד** — rules לא יודעים להסתיר שדה
  "drivers",
  // פרוסה 2 (מסך), אבל הסכימה נכתבת מלאה היום
  "vehicleAccess",
  // מזהה מורכב `${driverUid}__${vehicleId}` — מכוון, ראו access.js
  "tasks",
  "documents",
  "personalDocs",
  // read = driverUid == auth.uid בלבד; גם הבעלים לא קורא
  "serviceRecords",
  "odometerReadings"
];
var SERVER_ONLY_COLLECTIONS = ["reminderLog", "accessLog"];
var TASK_PRIVATE_SUBCOLLECTION = "private";
var TASK_PRIVATE_DOC = "state";
var ALL_COLLECTIONS = [...ENTITY_COLLECTIONS, ...SERVER_ONLY_COLLECTIONS];
var STORAGE_DOMAINS = {
  shared: "shared",
  owner: "owner",
  photo: "photo",
  personal: "personal"
};
var STORAGE_DOMAIN_BY_VISIBILITY = {
  shared: STORAGE_DOMAINS.shared,
  owner: STORAGE_DOMAINS.owner
};
var REMINDER_LADDER = [30, 14, 7, 3, 1, 0];
var REMINDER_CHANNELS = ["push", "sms", "email"];
var ESCALATION_HOURS = { pushToSms: 6, smsToEmail: 12 };
var CRITICAL_TASK_TYPES = ["test", "insurance"];
var OWNER_LADDER = [7, 3, 1, 0];
var SIGNED_URL_TTL_MINUTES = 5;
var SEND_ENABLED_ENV = "NRCAR_SENDING_ENABLED";
var QUIET_HOURS = { startHour: 8, endHour: 21 };
var MAX_MESSAGES_PER_RECIPIENT_PER_DAY = 6;
var CHANNEL_FAILURE_LIMIT = 3;
var DEFAULTS = {
  leadDays: 30,
  // "כמה זמן מראש להזכיר לי" — ברירת המחדל
  leadDaysOptions: [30, 14, 7],
  testIntervalMonths: 12,
  insuranceIntervalMonths: 12,
  serviceIntervalMonths: 12,
  serviceIntervalKm: 15e3,
  // מינימום קריאות מד-אוץ' לחישוב קצב. מתחת לזה — נופלים לזמן בלבד, בשקט.
  minOdometerReadingsForRate: 2,
  docExpiryAlertDays: 30
};
var RETENTION_CLASSES = {
  vehicle: { months: null, note: "legal.retention.pending" },
  vehiclePrivate: { months: null, note: "legal.retention.pending" },
  driver: { months: null, note: "legal.retention.pending" },
  vehicleAccess: { months: null, note: "legal.retention.pending" },
  task: { months: null, note: "legal.retention.pending" },
  document: { months: null, note: "legal.retention.pending" },
  personalDoc: { months: null, note: "legal.retention.pending" },
  serviceRecord: { months: null, note: "legal.retention.pending" },
  odometerReading: { months: null, note: "legal.retention.pending" },
  user: { months: null, note: "legal.retention.pending" },
  // יומן התזכורות — נתון תפעולי קצר-טווח. ההמלצה 12 חודשים, **המספר ⚖️**.
  // הניקוי יתבצע ע"י אותו scheduler שמריץ את התזכורות בפרוסה 2.
  "operational-short": { months: null, recommendedMonths: 12, note: "legal.retention.pending" }
};
var LOCAL_FILE_MAX_BYTES = 1.5 * 1024 * 1024;
var CLOUD_FILE_MAX_BYTES = 10 * 1024 * 1024;
var DEFAULT_SETTINGS = {
  policyVersion: POLICY_VERSION,
  onboarded: false,
  leadDays: DEFAULTS.leadDays,
  // השעה (Asia/Jerusalem) שבה יוצאות התזכורות של משק הבית. ה-scheduler רץ
  // כל שעה ומטפל רק במשקי הבית שהשעה שלהם התאימה — כך אפשר לכבד העדפה
  // אישית בלי להריץ פונקציה נפרדת לכל משתמש.
  notificationHour: 8,
  emergencyAuth: "session",
  emergencyOffline: "text",
  language: "he",
  textSize: "default"
};
var EMPTY = {
  schemaVersion: SCHEMA_VERSION,
  household: {
    id: null,
    name: "",
    createdAt: null,
    // N4 — members: מיפוי uid→role. **זה** מקור התפקיד. אף כלל לא משווה
    // hid ל-request.auth.uid: העברת בעלות ובעלים שני (בני זוג) הם תרחישים
    // ודאיים במוצר לקהל מבוגר, ושוויון מחרוזות הופך אותם להגירה מלאה.
    members: {}
  },
  settings: { ...DEFAULT_SETTINGS },
  // פרופיל המשתמש הנוכחי (users/{uid}) — נכתב ע"י הנושא בלבד.
  profile: null,
  vehicles: [],
  vehiclesPrivate: [],
  drivers: [],
  vehicleAccess: [],
  tasks: [],
  documents: [],
  personalDocs: [],
  serviceRecords: [],
  odometerReadings: []
};

// ../src/utils/reminders.js
function ladderFor(task) {
  const lead = Number(task?.schedule?.leadDays ?? DEFAULTS.leadDays);
  const ladder = Array.isArray(task?.schedule?.ladder) && task.schedule.ladder.length ? task.schedule.ladder : REMINDER_LADDER;
  return ladder.filter((d) => Number.isFinite(d) && d <= lead).sort((a, b) => b - a);
}
function daysToDue(task, today = todayIso()) {
  if (!isDay(task?.dueDate)) return null;
  return daysUntil(task.dueDate, today);
}
function nextFireDate(task, today = todayIso()) {
  if (!task || task.completedAt) return null;
  const sched = task.schedule || {};
  if (sched.muted) return null;
  if (sched.acknowledged) return null;
  if (isDay(sched.snoozedUntil) && sched.snoozedUntil > today) return sched.snoozedUntil;
  if (!isDay(task.dueDate)) return null;
  const d = daysUntil(task.dueDate, today);
  if (d < 0) return today;
  const last = sched.lastFiredStep;
  const candidates = ladderFor(task).filter(
    (step) => last === null || last === void 0 ? true : step < last
  );
  for (const step of candidates) {
    const fireOn = addDays(task.dueDate, -step);
    if (fireOn >= today) return fireOn;
  }
  return candidates.includes(0) ? task.dueDate : null;
}
function withNextFire(task, today = todayIso()) {
  return { ...task, schedule: { ...task.schedule || {}, nextFireAt: nextFireDate(task, today) } };
}

// ../src/utils/escalation.js
function isCriticalTask(task) {
  return CRITICAL_TASK_TYPES.includes(task?.type);
}
function enabledChannels(serviceChannels = {}) {
  return REMINDER_CHANNELS.filter((c) => serviceChannels?.[c]);
}
function recipientsFor(task, { owners = [], driverUid = null } = {}) {
  const out = [];
  if (driverUid) {
    out.push({ uid: driverUid, role: "driver", ladder: ladderFor(task) });
    for (const uid of owners) {
      if (uid === driverUid) continue;
      out.push({ uid, role: "owner", ladder: ladderForOwner(task) });
    }
    return out;
  }
  for (const uid of owners) out.push({ uid, role: "owner", ladder: ladderFor(task) });
  return out;
}
function ladderForOwner(task) {
  const full = ladderFor(task);
  return OWNER_LADDER.filter((s) => full.includes(s));
}
function dueStepsForRecipient({ task, ladder, state = {}, today = todayIso() } = {}) {
  if (!task || task.completedAt) return [];
  const sched = task.schedule || {};
  if (sched.muted) return [];
  if (sched.snoozedUntil && sched.snoozedUntil > today) return [];
  if (state.acknowledgedAt) return [];
  const d = daysToDue(task, today);
  if (d === null) return [];
  const last = state.lastFiredStep;
  const steps = (ladder || []).filter((step) => {
    if (d > step) return false;
    if (last === null || last === void 0) return true;
    return step < last;
  });
  if (d < 0 && !steps.includes(0) && last !== 0) steps.push(0);
  return steps;
}
function nextChannel({
  channelsTried = [],
  serviceChannels = { push: true },
  isCritical = false,
  lastFiredAt = null,
  acknowledgedAt = null,
  disabledChannels = [],
  now = (/* @__PURE__ */ new Date()).toISOString()
} = {}) {
  if (acknowledgedAt) return null;
  const available = enabledChannels(serviceChannels).filter((c) => {
    if (c === "email" && !isCritical) return false;
    if (disabledChannels.includes(c)) return false;
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
function idempotencyKey({ taskId, step, channel, dueDate, recipientUid }) {
  return [taskId, dueDate || "nodate", `s${step}`, channel, recipientUid].join("__").replace(/[^\w-]/g, "_");
}
function isQuietHour(hour, { startHour, endHour } = QUIET_HOURS) {
  const h = Number(hour);
  if (!Number.isFinite(h)) return false;
  return h < startHour || h >= endHour;
}
function nextFireAfterSend(task, { hasMoreChannels, today = todayIso() } = {}) {
  if (hasMoreChannels) {
    return { ...task, schedule: { ...task.schedule || {}, nextFireAt: today } };
  }
  return withNextFire(task, today);
}

// ../src/utils/id.js
function newId(prefix = "") {
  const uuid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const short = uuid.replace(/-/g, "").slice(0, 16);
  return prefix ? `${prefix}_${short}` : short;
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}

// ../src/schema.js
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function vehicleAccessId(driverUid, vehicleId) {
  if (!driverUid || !vehicleId) return null;
  return `${driverUid}__${vehicleId}`;
}
function createRecipientState(p = {}) {
  return {
    lastFiredStep: p.lastFiredStep ?? null,
    lastFiredAt: p.lastFiredAt ?? null,
    channelsTried: Array.isArray(p.channelsTried) ? p.channelsTried : [],
    deliveryState: p.deliveryState || "pending",
    acknowledgedAt: p.acknowledgedAt ?? null,
    acknowledgedStep: p.acknowledgedStep ?? null,
    consecutiveFailures: num(p.consecutiveFailures) ?? 0
  };
}
function createReminderLogEntry(p = {}) {
  const channel = ["push", "email", "sms"].includes(p.channel) ? p.channel : null;
  return {
    id: p.id || newId("rlog"),
    householdId: p.householdId || null,
    taskId: p.taskId || null,
    vehicleId: p.vehicleId || null,
    // ★ מפתח ההרשאה: רק הנמען קורא את הרשומה הזאת.
    recipientUid: p.recipientUid || null,
    step: num(p.step),
    channel,
    // סוג בלבד
    deliveryState: p.deliveryState || "pending",
    errorCode: p.errorCode ? String(p.errorCode).slice(0, 40) : null,
    // קוד גס
    firedAt: p.firedAt || nowIso(),
    acknowledgedAt: p.acknowledgedAt || null,
    retentionClass: "operational-short",
    schemaVersion: SCHEMA_VERSION
  };
}

// src/sweep.js
var TZ = "Asia/Jerusalem";
async function sendingAllowed({ db: db2, env = process.env }) {
  if (String(env[SEND_ENABLED_ENV]).toLowerCase() !== "true") {
    return { allowed: false, reason: "env-flag-off" };
  }
  const snap = await db2.doc("config/runtime").get();
  if (snap.exists && snap.data().sendingEnabled === false) {
    return { allowed: false, reason: "kill-switch" };
  }
  return { allowed: true, reason: null };
}
async function recipientStillValid({ db: db2, hid, uid }) {
  const [hh, membership] = await Promise.all([
    db2.collection("households").doc(hid).get(),
    db2.collection("memberships").doc(uid).get()
  ]);
  if (!hh.exists) return { valid: false, reason: "household-deleted" };
  const members = hh.data().household?.members || {};
  if (!members[uid]) return { valid: false, reason: "no-longer-member" };
  if (membership.exists && membership.data().householdId !== hid) {
    return { valid: false, reason: "membership-moved" };
  }
  return { valid: true, reason: null };
}
var privateRef = (db2, hid, taskId) => db2.collection("households").doc(hid).collection("tasks").doc(taskId).collection(TASK_PRIVATE_SUBCOLLECTION).doc(TASK_PRIVATE_DOC);
async function runReminderSweep({
  db: db2,
  providers,
  now = /* @__PURE__ */ new Date(),
  today = null,
  hour = null,
  forceHour = false,
  ignoreQuietHours = false,
  env = process.env,
  logger: logger2 = console,
  limit = 500
} = {}) {
  const runToday = today || todayInZone(TZ, now);
  const runHour = hour === null ? hourInZone(TZ, now) : hour;
  const nowIso2 = now.toISOString();
  const stats = {
    scanned: 0,
    households: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    deferredQuiet: 0,
    blocked: 0,
    invalidRecipient: 0,
    duplicate: 0,
    capped: 0
  };
  const gate = await sendingAllowed({ db: db2, env });
  if (!gate.allowed) {
    stats.blocked = 1;
    stats.blockedReason = gate.reason;
    logger2.warn?.("sending disabled", gate);
    return stats;
  }
  if (!ignoreQuietHours && isQuietHour(runHour)) {
    stats.deferredQuiet = 1;
    return stats;
  }
  const snap = await db2.collectionGroup("tasks").where("schedule.nextFireAt", "<=", runToday).limit(limit).get();
  stats.scanned = snap.size;
  if (snap.empty) return stats;
  const byHousehold = /* @__PURE__ */ new Map();
  for (const d of snap.docs) {
    const hid = d.data().householdId;
    if (!hid) continue;
    if (!byHousehold.has(hid)) byHousehold.set(hid, []);
    byHousehold.get(hid).push(d);
  }
  const sentToday = /* @__PURE__ */ new Map();
  for (const [hid, docs] of byHousehold) {
    const hhSnap = await db2.collection("households").doc(hid).get();
    if (!hhSnap.exists) {
      stats.skipped += docs.length;
      continue;
    }
    const hh = hhSnap.data();
    const settings = { ...DEFAULT_SETTINGS, ...hh.settings || {} };
    if (!forceHour && Number(settings.notificationHour) !== Number(runHour)) {
      stats.skipped += docs.length;
      continue;
    }
    stats.households++;
    const owners = Object.entries(hh.household?.members || {}).filter(([, role]) => role === "owner").map(([uid]) => uid);
    for (const taskDoc of docs) {
      await processTask({
        db: db2,
        providers,
        hid,
        taskDoc,
        owners,
        today: runToday,
        nowIso: nowIso2,
        stats,
        sentToday,
        logger: logger2
      });
    }
  }
  return stats;
}
async function processTask({ db: db2, providers, hid, taskDoc, owners, today, nowIso: nowIso2, stats, sentToday, logger: logger2 }) {
  const task = taskDoc.data();
  const taskId = taskDoc.id;
  const stateSnap = await privateRef(db2, hid, taskId).get();
  const priv = stateSnap.exists ? stateSnap.data() : { recipients: {} };
  const recipients = recipientsFor(task, { owners, driverUid: task.assignedDriverUid || null });
  let taskLevelStep = task.schedule?.lastFiredStep ?? null;
  let anySent = false;
  let anyMoreChannels = false;
  for (const recipient of recipients) {
    const state = createRecipientState(priv.recipients?.[recipient.uid] || {});
    const isCritical = isCriticalTask(task);
    const steps = dueStepsForRecipient({ task, ladder: recipient.ladder, state, today });
    let step = steps.length ? Math.min(...steps) : state.lastFiredStep;
    if (step === null || step === void 0) {
      stats.skipped++;
      continue;
    }
    const isNewStep = steps.length > 0;
    const userSnap = await db2.collection("users").doc(recipient.uid).get();
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
      now: nowIso2
    });
    if (!channel) {
      stats.skipped++;
      continue;
    }
    const capKey = `${recipient.uid}:${today}`;
    const already = sentToday.get(capKey) || 0;
    if (already >= MAX_MESSAGES_PER_RECIPIENT_PER_DAY) {
      stats.capped++;
      continue;
    }
    const valid = await recipientStillValid({ db: db2, hid, uid: recipient.uid });
    if (!valid.valid) {
      stats.invalidRecipient++;
      logger2.warn?.("recipient no longer valid", { reason: valid.reason });
      continue;
    }
    const key = idempotencyKey({
      taskId,
      step,
      channel,
      dueDate: task.dueDate,
      recipientUid: recipient.uid
    });
    const logRef = db2.collection("households").doc(hid).collection("reminderLog").doc(key);
    const entry = createReminderLogEntry({
      id: key,
      householdId: hid,
      taskId,
      vehicleId: task.vehicleId,
      recipientUid: recipient.uid,
      step,
      channel,
      deliveryState: "sending",
      firedAt: nowIso2
    });
    try {
      await logRef.create(entry);
    } catch {
      stats.duplicate++;
      continue;
    }
    let result = { ok: false, errorCode: "provider-missing" };
    try {
      result = await providers.send(channel, { uid: recipient.uid }, {
        taskId,
        vehicleId: task.vehicleId,
        type: task.type,
        dueDate: task.dueDate,
        step,
        role: recipient.role
      });
    } catch (err) {
      result = { ok: false, errorCode: String(err?.code || "provider-error").slice(0, 40) };
    }
    await logRef.update({
      deliveryState: result.ok ? "sent" : "failed",
      errorCode: result.ok ? null : String(result.errorCode || "").slice(0, 40)
    });
    const failures = result.ok ? 0 : (state.consecutiveFailures || 0) + 1;
    const nextState = createRecipientState({
      ...state,
      lastFiredStep: step,
      lastFiredAt: nowIso2,
      channelsTried: isNewStep ? [channel] : [...state.channelsTried, channel],
      deliveryState: result.ok ? "sent" : "failed",
      consecutiveFailures: failures
    });
    await privateRef(db2, hid, taskId).set(
      { taskId, householdId: hid, recipients: { [recipient.uid]: nextState }, updatedAt: nowIso2 },
      { merge: true }
    );
    if (failures >= CHANNEL_FAILURE_LIMIT && !disabledChannels.includes(channel)) {
      await db2.collection("users").doc(recipient.uid).set(
        { disabledChannels: [...disabledChannels, channel] },
        { merge: true }
      );
      logger2.warn?.("channel auto-disabled", { channel, uid: recipient.uid });
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
        serviceChannels,
        isCritical,
        disabledChannels,
        lastFiredAt: nowIso2,
        acknowledgedAt: null,
        now: new Date(Date.parse(nowIso2) + 365 * 24 * 36e5).toISOString()
      })
    );
    if (more) anyMoreChannels = true;
  }
  if (anySent || taskLevelStep !== (task.schedule?.lastFiredStep ?? null)) {
    const publicTask = { ...task, schedule: { ...task.schedule, lastFiredStep: taskLevelStep } };
    const withFire = nextFireAfterSend(publicTask, { hasMoreChannels: anyMoreChannels, today });
    await taskDoc.ref.update({ schedule: withFire.schedule, updatedAt: nowIso2 });
  }
}

// src/providers.js
var ERROR_CODES = {
  notConfigured: "provider-not-configured",
  noTarget: "recipient-has-no-target",
  channelOff: "channel-disabled",
  unverified: "target-not-verified",
  sendFailed: "send-failed"
};
function createProviders({ messaging = null, db: db2 = null, logger: logger2 = console } = {}) {
  return {
    async send(channel, target, payload) {
      const uid = target?.uid;
      if (!uid) return { ok: false, errorCode: ERROR_CODES.noTarget };
      const userSnap = db2 ? await db2.collection("users").doc(uid).get() : null;
      const user = userSnap?.exists ? userSnap.data() : null;
      const channels = user?.serviceChannels || {};
      if (!channels[channel]) return { ok: false, errorCode: ERROR_CODES.channelOff };
      if (channel === "sms" || channel === "email") {
        if (!user?.channelVerified?.[channel]) {
          return { ok: false, errorCode: ERROR_CODES.unverified };
        }
      }
      if (channel === "push") {
        const token = user?.pushToken || null;
        if (!token || !messaging) return { ok: false, errorCode: ERROR_CODES.noTarget };
        try {
          await messaging.send({
            token,
            data: {
              taskId: String(payload?.taskId || ""),
              vehicleId: String(payload?.vehicleId || ""),
              type: String(payload?.type || ""),
              step: String(payload?.step ?? "")
            }
          });
          return { ok: true, errorCode: null };
        } catch (err) {
          logger2.warn?.("push send failed", { code: err?.code });
          return { ok: false, errorCode: String(err?.code || ERROR_CODES.sendFailed).slice(0, 40) };
        }
      }
      return { ok: false, errorCode: ERROR_CODES.notConfigured };
    }
  };
}

// ../src/utils/access.js
function roleOf(household, uid) {
  if (!household || !uid) return null;
  return household.members?.[uid] ?? null;
}
function isOwner(household, uid) {
  return roleOf(household, uid) === "owner";
}
function hasVehicleAccess(data, uid, vehicleId) {
  const id = vehicleAccessId(uid, vehicleId);
  if (!id) return false;
  return (data?.vehicleAccess || []).some((a) => a.id === id);
}
function canReadPersonalDoc(doc, uid) {
  if (!doc || !uid) return false;
  return doc.driverUid === uid;
}

// src/signedUrls.js
var AccessError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
};
function resolveDocumentAccess({ household, doc, kind, uid, vehicleAccess = [] }) {
  if (!doc) throw new AccessError("not-found", "document not found");
  if (kind === "personalDocs") {
    if (!canReadPersonalDoc(doc, uid)) throw new AccessError("permission-denied", "not the subject");
  } else {
    const owner = isOwner(household, uid);
    if (!owner) {
      if (doc.visibility !== "shared") throw new AccessError("permission-denied", "owner-only document");
      if (!hasVehicleAccess({ vehicleAccess }, uid, doc.vehicleId)) {
        throw new AccessError("permission-denied", "no access to vehicle");
      }
    }
  }
  const path = doc.fileRef?.storagePath;
  if (!path) throw new AccessError("not-found", "document has no file");
  return path;
}
async function createSignedUrl(bucket, storagePath, { ttlMinutes = SIGNED_URL_TTL_MINUTES, now = Date.now() } = {}) {
  const [url] = await bucket.file(storagePath).getSignedUrl({
    version: "v4",
    action: "read",
    expires: now + ttlMinutes * 60 * 1e3
  });
  return { url, expiresAt: new Date(now + ttlMinutes * 60 * 1e3).toISOString(), ttlMinutes };
}
async function handleSignedUrlRequest({ db: db2, bucket, uid, householdId, docId, kind }) {
  if (!uid) throw new AccessError("unauthenticated", "sign in required");
  if (!householdId || !docId) throw new AccessError("invalid-argument", "missing householdId or docId");
  if (kind !== "documents" && kind !== "personalDocs") {
    throw new AccessError("invalid-argument", "unknown document kind");
  }
  const hhSnap = await db2.collection("households").doc(householdId).get();
  if (!hhSnap.exists) throw new AccessError("not-found", "household not found");
  const household = hhSnap.data().household || {};
  const docSnap = await db2.collection("households").doc(householdId).collection(kind).doc(docId).get();
  if (!docSnap.exists) throw new AccessError("not-found", "document not found");
  let vehicleAccess = [];
  if (kind === "documents" && !isOwner(household, uid)) {
    const accessSnap = await db2.collection("households").doc(householdId).collection("vehicleAccess").where("driverUid", "==", uid).get();
    vehicleAccess = accessSnap.docs.map((d) => d.data());
  }
  let path = null;
  let granted = false;
  try {
    path = resolveDocumentAccess({ household, doc: docSnap.data(), kind, uid, vehicleAccess });
    granted = true;
  } finally {
    await db2.collection("households").doc(householdId).collection("accessLog").add({
      actorUid: uid,
      docId,
      docType: kind,
      at: (/* @__PURE__ */ new Date()).toISOString(),
      granted,
      householdId,
      retentionClass: "operational-short"
    }).catch(() => {
    });
  }
  return createSignedUrl(bucket, path);
}

// src/retention.js
var TZ2 = "Asia/Jerusalem";
function retentionMonths(env = process.env) {
  const n = Number(env.REMINDER_LOG_RETENTION_MONTHS);
  return Number.isFinite(n) && n > 0 ? n : RETENTION_CLASSES["operational-short"].recommendedMonths;
}
async function purgeReminderLogs({ db: db2, now = /* @__PURE__ */ new Date(), months = null, logger: logger2 = console } = {}) {
  const keepMonths = months ?? retentionMonths();
  const cutoff = addMonths(todayInZone(TZ2, now), -keepMonths);
  const stats = { households: 0, deleted: 0, cutoff, keepMonths };
  const households = await db2.collection("households").get();
  for (const hh of households.docs) {
    stats.households++;
    const old = await hh.ref.collection("reminderLog").where("firedAt", "<", `${cutoff}T00:00:00.000Z`).get();
    if (old.empty) continue;
    let batch = db2.batch();
    let n = 0;
    for (const d of old.docs) {
      batch.delete(d.ref);
      n++;
      stats.deleted++;
      if (n % 450 === 0) {
        await batch.commit();
        batch = db2.batch();
      }
    }
    await batch.commit();
  }
  logger2.log?.("reminderLog purge", stats);
  return stats;
}
async function deleteHouseholdServerSide({ db: db2, householdId, uid, purgeAll = false, logger: logger2 = console } = {}) {
  if (!householdId) throw Object.assign(new Error("missing householdId"), { code: "invalid-argument" });
  const hhRef = db2.collection("households").doc(householdId);
  const hhSnap = await hhRef.get();
  if (!hhSnap.exists) return { deleted: 0, collections: [] };
  const members = hhSnap.data().household?.members || {};
  if (uid && members[uid] !== "owner") {
    throw Object.assign(new Error("not an owner"), { code: "permission-denied" });
  }
  const targets = purgeAll ? ALL_COLLECTIONS : SERVER_ONLY_COLLECTIONS;
  const stats = { deleted: 0, collections: targets };
  for (const c of targets) {
    const snap = await hhRef.collection(c).get();
    if (snap.empty) continue;
    let batch = db2.batch();
    let n = 0;
    for (const d of snap.docs) {
      batch.delete(d.ref);
      n++;
      stats.deleted++;
      if (n % 450 === 0) {
        await batch.commit();
        batch = db2.batch();
      }
    }
    await batch.commit();
  }
  logger2.log?.("household server-side delete", { householdId, ...stats });
  return stats;
}

// src/index.js
initializeApp();
var db = getFirestore();
var REGION = "me-west1";
var TZ3 = "Asia/Jerusalem";
var reminderSweep = onSchedule(
  { schedule: "0 * * * *", timeZone: TZ3, region: REGION, retryCount: 0 },
  async () => {
    const providers = createProviders({ messaging: getMessaging(), db, logger });
    const stats = await runReminderSweep({ db, providers, logger });
    logger.log("reminderSweep", stats);
  }
);
var reminderLogRetention = onSchedule(
  { schedule: "30 3 * * *", timeZone: TZ3, region: REGION, retryCount: 0 },
  async () => {
    const stats = await purgeReminderLogs({ db, logger });
    logger.log("reminderLogRetention", stats);
  }
);
var getSignedDocumentUrl = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid || null;
  const { householdId, docId, kind } = request.data || {};
  try {
    return await handleSignedUrlRequest({
      db,
      bucket: getStorage().bucket(),
      uid,
      householdId,
      docId,
      kind
    });
  } catch (err) {
    if (err instanceof AccessError) throw new HttpsError(err.code, err.message);
    logger.error("signed url failed", { code: err?.code });
    throw new HttpsError("internal", "could not sign url");
  }
});
var deleteHouseholdServerData = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "sign in required");
  try {
    return await deleteHouseholdServerSide({
      db,
      householdId: request.data?.householdId,
      uid,
      logger
    });
  } catch (err) {
    throw new HttpsError(err?.code === "permission-denied" ? "permission-denied" : "internal", err.message);
  }
});
export {
  deleteHouseholdServerData,
  getSignedDocumentUrl,
  reminderLogRetention,
  reminderSweep
};
