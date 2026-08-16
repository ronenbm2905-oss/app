// ============================================================================
// functions-tests.mjs — מריץ את ה-scheduler **בפועל** מול אמולטור Firestore.
//
// לא מדמה אותו: `runReminderSweep` היא הפונקציה שה-`onSchedule` עוטף, והיא
// מקבלת את `db` בהזרקה. כך אפשר להריץ "יום" שלם בשנייה, לזייף שעה, ולבדוק
// ריצה כפולה — בלי לחכות ל-cron.
//
// רץ בתוך `npm run emu:functions`.
// ============================================================================

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const { runReminderSweep, sendingAllowed, recipientStillValid } = await import("../src/sweep.js");
const { createMockProviders, buildMessage, ERROR_CODES, SETTINGS_LINK } = await import("../src/providers.js");
const { purgeReminderLogs, deleteHouseholdServerSide, retentionMonths } = await import("../src/retention.js");
const { resolveDocumentAccess, AccessError, createSignedUrl } = await import("../src/signedUrls.js");
const { createTask, createDocument, createPersonalDoc, createSchedule } = await import("../../src/schema.js");
const {
  REMINDER_LADDER, OWNER_LADDER, REMINDER_LOG_FORBIDDEN_FIELDS, REMINDER_LOG_FIELDS,
  ESCALATION_HOURS, MAX_MESSAGES_PER_RECIPIENT_PER_DAY, SIGNED_URL_MARKERS,
  TASK_PRIVATE_SUBCOLLECTION, TASK_PRIVATE_DOC,
} = await import("../../src/constants.js");
const { addDays, addMonths } = await import("../../src/utils/dates.js");
const {
  nextChannel, isCriticalTask, recipientsFor, ladderForOwner,
  dueStepsForRecipient, idempotencyKey, isQuietHour,
} = await import("../../src/utils/escalation.js");
const { cancelAllReminders } = await import("../../src/utils/cascade.js");

let pass = 0;
let failed = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) pass++;
  else {
    failed++;
    failures.push(name);
    console.error("  FAIL:", name, detail === undefined ? "" : `\n    got: ${JSON.stringify(detail)}`);
  }
}
function eq(name, a, b) {
  if (JSON.stringify(a) === JSON.stringify(b)) pass++;
  else {
    failed++;
    failures.push(name);
    console.error("  FAIL:", name, "\n    got:", JSON.stringify(a), "\n    want:", JSON.stringify(b));
  }
}
const section = (t) => console.log(`\n— ${t}`);

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "nrcar-emulator";
initializeApp({ projectId: "nrcar-emulator" });
const db = getFirestore();

const SEND_ON = { NRCAR_SENDING_ENABLED: "true" };
const TODAY = "2026-08-13";
const NOW = new Date(`${TODAY}T08:00:00.000Z`);
const HID = "hh_fn";
const OWNER = "uid_owner_fn";
const DRIVER = "uid_driver_fn";

const sweep = (opts = {}) =>
  runReminderSweep({ db, now: NOW, today: TODAY, hour: 8, env: SEND_ON, ignoreQuietHours: true, ...opts });

async function wipe() {
  for (const c of ["reminderLog", "accessLog", "vehicles", "documents", "personalDocs", "vehicleAccess"]) {
    const s = await db.collection("households").doc(HID).collection(c).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
  const tasks = await db.collection("households").doc(HID).collection("tasks").get();
  for (const t of tasks.docs) {
    const p = await t.ref.collection(TASK_PRIVATE_SUBCOLLECTION).get();
    await Promise.all(p.docs.map((d) => d.ref.delete()));
    await t.ref.delete();
  }
}

async function seed({ tasks = [], channels = { push: true }, members = null, verified = { sms: true, email: true } } = {}) {
  await wipe();
  await db.collection("households").doc(HID).set({
    household: { id: HID, name: "", members: members || { [OWNER]: "owner" } },
    settings: { onboarded: true, notificationHour: 8, leadDays: 30 },
    schemaVersion: 1,
  });
  for (const uid of Object.keys(members || { [OWNER]: "owner" })) {
    await db.collection("users").doc(uid).set({
      uid, serviceChannels: channels, channelVerified: verified, disabledChannels: [], pushToken: null,
    });
    await db.collection("memberships").doc(uid).set({ uid, householdId: HID, role: "owner" });
  }
  await db.doc("config/runtime").set({ sendingEnabled: true });
  for (const t of tasks) await db.collection("households").doc(HID).collection("tasks").doc(t.id).set(t);
}

const mkTask = (p = {}) => {
  const t = createTask({ householdId: HID, vehicleId: "v1", type: "test", ...p });
  return { ...t, id: p.id || t.id, schedule: { ...t.schedule, nextFireAt: p.nextFireAt ?? TODAY, ...(p.schedule || {}) } };
};
const readTask = async (id) => (await db.collection("households").doc(HID).collection("tasks").doc(id).get()).data();
const readPrivate = async (id) =>
  (await db.collection("households").doc(HID).collection("tasks").doc(id)
    .collection(TASK_PRIVATE_SUBCOLLECTION).doc(TASK_PRIVATE_DOC).get()).data();
const readLog = async () => (await db.collection("households").doc(HID).collection("reminderLog").get()).docs.map((d) => d.data());

try {
  // ==========================================================================
  section("1. ★ מקור אמת אחד — ה-Function מייבאת את המנוע, לא מעתיקה");
  // ==========================================================================
  const sweepSrc = readFileSync(join(ROOT, "functions", "src", "sweep.js"), "utf8");
  ok("★ מייבא את reminders.js של האפליקציה", sweepSrc.includes('from "../../src/utils/reminders.js"'));
  ok("★ ואת escalation.js", sweepSrc.includes('from "../../src/utils/escalation.js"'));
  ok("★ ואת הסכימה המשותפת", sweepSrc.includes('} from "../../src/schema.js"'));
  ok("★ ואינו מגדיר סולם משלו", !/REMINDER_LADDER\s*=/.test(sweepSrc) && !/\[\s*30\s*,\s*14\s*,\s*7\s*,\s*3\s*,\s*1\s*,\s*0\s*\]/.test(sweepSrc));
  eq("★ הסולם שה-Function רואה זהה לזה שבאפליקציה", REMINDER_LADDER, [30, 14, 7, 3, 1, 0]);
  const bundle = readFileSync(join(ROOT, "functions", "lib", "index.js"), "utf8");
  ok("★★ והבנדל הנפרס מכיל את המנוע עצמו", bundle.includes("30") && bundle.includes("dueStepsForRecipient"));

  // ==========================================================================
  section("2. 🔴 R13 + O19 — ברירת המחדל היא לא לשלוח");
  // ==========================================================================
  await seed({ tasks: [mkTask({ id: "gate", dueDate: addDays(TODAY, 30) })] });
  let stats = await runReminderSweep({ db, providers: createMockProviders(), now: NOW, today: TODAY, hour: 8, env: {}, ignoreQuietHours: true });
  eq("★★ בלי דגל סביבה — לא נשלח כלום", stats.sent, 0);
  eq("★ והסיבה מדווחת", stats.blockedReason, "env-flag-off");
  eq("★ ואין רשומות יומן", (await readLog()).length, 0);

  await db.doc("config/runtime").set({ sendingEnabled: false });
  stats = await sweep({ providers: createMockProviders() });
  eq("★★ מתג העצירה ב-Firestore עוצר גם עם דגל דלוק", stats.sent, 0);
  eq("★ והסיבה: kill-switch (בלי deploy)", stats.blockedReason, "kill-switch");
  await db.doc("config/runtime").set({ sendingEnabled: true });
  const gate = await sendingAllowed({ db, env: SEND_ON });
  ok("★ ועם שניהם דלוקים — מותר", gate.allowed);

  // ==========================================================================
  section("3. R11 — שעות שקטות: דוחים את השלב, לא מדלגים");
  // ==========================================================================
  ok("03:00 הוא שעה שקטה", isQuietHour(3) && isQuietHour(22) && !isQuietHour(9));
  stats = await runReminderSweep({ db, providers: createMockProviders(), now: NOW, today: TODAY, hour: 3, env: SEND_ON });
  eq("★ בשעה שקטה — לא נשלח", stats.sent, 0);
  eq("★ ומסומן כנדחה, לא כמדולג", stats.deferredQuiet, 1);
  const t0 = await readTask("gate");
  eq("★★ והשלב עדיין ממתין — nextFireAt לא זז", t0.schedule.nextFireAt, TODAY);

  // ==========================================================================
  section("4. 🔴 T3 — השדות הרגישים לא על מסמך המשימה");
  // ==========================================================================
  const sched = createSchedule({});
  eq("★★ אין acknowledgedAt על ה-schedule הציבורי", sched.acknowledgedAt, undefined);
  eq("★★ אין lastFiredAt", sched.lastFiredAt, undefined);
  eq("★★ אין channelsTried", sched.channelsTried, undefined);
  eq("★★ ואין deliveryState", sched.deliveryState, undefined);
  eq("★ יש acknowledged בוליאני", sched.acknowledged, false);
  ok("★ ויש lastFiredStep (תכונה של המשימה, נגזרת מהתאריך)", "lastFiredStep" in sched);
  ok("★ escalateToOwner הוסר (T1)", !("escalateToOwner" in sched));

  await seed({ tasks: [mkTask({ id: "t30", dueDate: addDays(TODAY, 30) })] });
  const p1 = createMockProviders();
  stats = await sweep({ providers: p1 });
  eq("שלב 30 נשלח", stats.sent, 1);
  eq("★ ונרשם כשלב 30", p1.sent[0].step, 30);
  const pubTask = await readTask("t30");
  eq("★ lastFiredStep על המשימה", pubTask.schedule.lastFiredStep, 30);
  const pubJson = JSON.stringify(pubTask);
  ok("★★ ואין על המשימה שום חותמת מסירה", !pubJson.includes("lastFiredAt") && !pubJson.includes("channelsTried"));
  const priv = await readPrivate("t30");
  eq("★★ החותמות יושבות בתת-המסמך הפרטי", priv.recipients[OWNER].channelsTried, ["push"]);
  ok("★ עם חותמת זמן מלאה", Boolean(priv.recipients[OWNER].lastFiredAt));
  eq("★ ומצב המסירה", priv.recipients[OWNER].deliveryState, "sent");

  // ==========================================================================
  section("5. 🔴 O20 — אידמפוטנטיות: ריצה כפולה ומקבילה");
  // ==========================================================================
  const key = idempotencyKey({ taskId: "t", step: 7, channel: "sms", dueDate: "2026-09-01", recipientUid: "u" });
  ok("★ המפתח כולל את כל חמשת הרכיבים", key.includes("t__") && key.includes("2026-09-01") && key.includes("s7") && key.includes("sms") && key.includes("u"));

  await seed({ tasks: [mkTask({ id: "dup", dueDate: addDays(TODAY, 30) })] });
  const pDup = createMockProviders();
  await sweep({ providers: pDup });
  await sweep({ providers: pDup });
  await sweep({ providers: pDup });
  eq("★★ שלוש ריצות — הודעה אחת", pDup.sent.length, 1);
  eq("★★ ורשומת יומן אחת", (await readLog()).length, 1);

  await seed({ tasks: [mkTask({ id: "par", dueDate: addDays(TODAY, 30) })] });
  const pPar = createMockProviders();
  await Promise.all([sweep({ providers: pPar }), sweep({ providers: pPar }), sweep({ providers: pPar })]);
  eq("★★ שלוש ריצות **מקבילות** — הודעה אחת", pPar.sent.length, 1);
  eq("★★ ורשומת יומן אחת", (await readLog()).length, 1);
  eq("★ מזהה הרשומה הוא מפתח האידמפוטנטיות", (await readLog())[0].id.includes("s30__push"), true);

  // ==========================================================================
  section("6. 🔴 T1 — הבעלים נמען בזכות עצמו, לא 'מוסלם אליו'");
  // ==========================================================================
  eq("★ סולם הבעלים מאוחר יותר", OWNER_LADDER, [7, 3, 1, 0]);
  const task30 = mkTask({ id: "x", dueDate: addDays(TODAY, 30) });
  eq("★ ladderForOwner הוא חיתוך", ladderForOwner(task30), [7, 3, 1, 0]);
  const recs = recipientsFor(task30, { owners: [OWNER], driverUid: DRIVER });
  eq("★ הנהג ראשון, עם הסולם המלא", [recs[0].uid, recs[0].ladder], [DRIVER, [30, 14, 7, 3, 1, 0]]);
  eq("★★ והבעלים נמען בפני עצמו, עם סולם משלו", [recs[1].uid, recs[1].role, recs[1].ladder], [OWNER, "owner", [7, 3, 1, 0]]);
  ok("★ בלי נהג — הבעלים מקבל את הסולם המלא", recipientsFor(task30, { owners: [OWNER] })[0].ladder.length === 6);

  // ★★ הפרדיקט: מצב המשימה, לעולם לא אי-אישור של אדם אחר.
  const ownerSteps = dueStepsForRecipient({
    task: mkTask({ id: "y", dueDate: addDays(TODAY, 7) }),
    ladder: OWNER_LADDER,
    state: {},
    today: TODAY,
  });
  ok("★★ הבעלים מקבל בשלב 7 — בלי קשר למצב הנהג", ownerSteps.includes(7));
  const ackedOther = dueStepsForRecipient({
    task: mkTask({ id: "z", dueDate: addDays(TODAY, 7) }),
    ladder: OWNER_LADDER,
    state: { acknowledgedAt: `${TODAY}T00:00:00Z` },
    today: TODAY,
  });
  eq("★ ואישור **שלו עצמו** כן עוצר אותו", ackedOther, []);
  eq(
    "★★ אבל משימה שבוצעה עוצרת הכול — הפרדיקט הוא !completedAt",
    dueStepsForRecipient({ task: { ...mkTask({ id: "w", dueDate: TODAY }), completedAt: "x" }, ladder: OWNER_LADDER, state: {}, today: TODAY }),
    []
  );

  // ==========================================================================
  section("7. אישור, ביצוע והשתקה עוצרים");
  // ==========================================================================
  await seed({ tasks: [mkTask({ id: "ack", dueDate: addDays(TODAY, 30) })] });
  await sweep({ providers: createMockProviders() });
  await db.collection("households").doc(HID).collection("tasks").doc("ack")
    .update({ "schedule.acknowledged": true, "schedule.acknowledgedStep": 30 });
  await db.collection("households").doc(HID).collection("tasks").doc("ack")
    .collection(TASK_PRIVATE_SUBCOLLECTION).doc(TASK_PRIVATE_DOC)
    .set({ recipients: { [OWNER]: { acknowledgedAt: `${TODAY}T09:00:00Z` } } }, { merge: true });
  const pAck = createMockProviders();
  await sweep({ providers: pAck, now: new Date(`${TODAY}T20:00:00Z`) });
  eq("★★ אחרי אישור — לא נשלח דבר", pAck.sent.length, 0);

  await seed({
    tasks: [
      mkTask({ id: "done", dueDate: addDays(TODAY, 30), completedAt: `${TODAY}T00:00:00Z` }),
      mkTask({ id: "muted", dueDate: addDays(TODAY, 30), schedule: { muted: true } }),
      mkTask({ id: "snoozed", dueDate: addDays(TODAY, 30), schedule: { snoozedUntil: addDays(TODAY, 5) } }),
    ],
  });
  const pSkip = createMockProviders();
  await sweep({ providers: pSkip });
  eq("★ בוצע/מושתק/נדחה — אף אחד לא נשלח", pSkip.sent.length, 0);

  // ==========================================================================
  section("8. ★ סולם הערוצים — Push → SMS → מייל");
  // ==========================================================================
  await seed({
    tasks: [mkTask({ id: "esc", dueDate: addDays(TODAY, 30) })],
    channels: { push: true, sms: true, email: true },
  });
  const pEsc = createMockProviders({ failChannels: ["push"] });
  stats = await sweep({ providers: pEsc });
  eq("★ ניסיון ה-push נכשל ונרשם", stats.failed, 1);
  eq("★ ורשומת היומן מסמנת failed (R12 — גם כשלונות)", (await readLog())[0].deliveryState, "failed");
  eq("★ nextFireAt נשאר היום כדי לאפשר הסלמה", (await readTask("esc")).schedule.nextFireAt, TODAY);

  const pSoon = createMockProviders();
  await sweep({ providers: pSoon, now: new Date(`${TODAY}T10:00:00Z`) });
  eq("★★ בתוך חלון ההמתנה — לא מסלימים", pSoon.sent.length, 0);

  const afterWindow = new Date(NOW.getTime() + (ESCALATION_HOURS.pushToSms + 1) * 3600000);
  const pSms = createMockProviders();
  await sweep({ providers: pSms, now: afterWindow });
  eq("★★ אחרי החלון — SMS", pSms.sent[0]?.channel, "sms");
  eq("★ channelsTried מצטבר בפרטי", (await readPrivate("esc")).recipients[OWNER].channelsTried, ["push", "sms"]);

  const afterSecond = new Date(afterWindow.getTime() + (ESCALATION_HOURS.smsToEmail + 1) * 3600000);
  const pMail = createMockProviders();
  await sweep({ providers: pMail, now: afterSecond });
  eq("★★ ובקריטי — גם מייל", pMail.sent[0]?.channel, "email");

  await seed({
    tasks: [mkTask({ id: "repair", type: "repair", title: "צמיגים", dueDate: addDays(TODAY, 30) })],
    channels: { push: true, sms: true, email: true },
  });
  await sweep({ providers: createMockProviders() });
  await sweep({ providers: createMockProviders(), now: afterWindow });
  const pNoMail = createMockProviders();
  await sweep({ providers: pNoMail, now: afterSecond });
  eq("★★ תיקון אינו קריטי — נעצר ב-SMS", pNoMail.sent.length, 0);
  ok("isCriticalTask: טסט וביטוח בלבד", isCriticalTask({ type: "test" }) && !isCriticalTask({ type: "repair" }));

  // ==========================================================================
  section("9. 🔴 T5 — אימות הנמען בזמן השליחה");
  // ==========================================================================
  await seed({ tasks: [mkTask({ id: "gone", dueDate: addDays(TODAY, 30) })] });
  // האדם הוסר ממשק הבית **אחרי** שהמשימה תוזמנה.
  await db.collection("households").doc(HID).set(
    { household: { id: HID, members: {} } }, { merge: true }
  );
  const pGone = createMockProviders();
  stats = await sweep({ providers: pGone });
  eq("★★ מי שאינו חבר יותר — לא מקבל הודעה", pGone.sent.length, 0);
  const valid = await recipientStillValid({ db, hid: HID, uid: OWNER });
  eq("★ והסיבה מפורשת", valid.reason, "no-longer-member");
  eq("★ משק בית שנמחק", (await recipientStillValid({ db, hid: "nope", uid: OWNER })).reason, "household-deleted");

  // ★★ הנגזרת ל-N6: מחיקת חשבון מאפסת nextFireAt לפני שהמשימות נמחקות.
  const cancelled = cancelAllReminders({ tasks: [mkTask({ id: "c", dueDate: TODAY })] });
  eq("★★ cancelAllReminders מאפס nextFireAt", cancelled.tasks[0].schedule.nextFireAt, null);
  ok("★ ומשתיק", cancelled.tasks[0].schedule.muted);

  // ==========================================================================
  section("10. O20 תקרה · O21 כיבוי ערוץ · O13 אימות יעד");
  // ==========================================================================
  ok("★ תקרה יומית מוגדרת", MAX_MESSAGES_PER_RECIPIENT_PER_DAY === 6);

  // O13 — ערוץ לא מאומת נחסם בספק האמיתי.
  const { createProviders } = await import("../src/providers.js");
  await db.collection("users").doc(OWNER).set(
    { uid: OWNER, serviceChannels: { sms: true }, channelVerified: {} }, { merge: true }
  );
  const realProviders = createProviders({ db, logger: { warn() {} } });
  const smsRes = await realProviders.send("sms", { uid: OWNER }, {});
  eq("★★ O13 — SMS לא נשלח ליעד לא מאומת", smsRes.errorCode, ERROR_CODES.unverified);
  await db.collection("users").doc(OWNER).set({ channelVerified: { sms: true } }, { merge: true });
  eq("★ ואחרי אימות — נחסם רק בהיעדר ספק", (await realProviders.send("sms", { uid: OWNER }, {})).errorCode, ERROR_CODES.notConfigured);

  // O21 — ערוץ מושבת אחרי כשלים רצופים.
  // ⚠️ נדרשים שלושה **שלבי סולם** שנכשלים — לא שלוש ריצות על אותו שלב:
  // הסולם לא חוזר על שלב שכבר יצא, וזה בדיוק מה שמונע הצפה.
  const due = addDays(TODAY, 30);
  await seed({ tasks: [mkTask({ id: "fail", dueDate: due })], channels: { push: true } });
  const pFail = createMockProviders({ failChannels: ["push"] });
  for (const step of [30, 14, 7]) {
    const day = addDays(due, -step);
    await sweep({ providers: pFail, now: new Date(`${day}T08:00:00Z`), today: day });
  }
  const userAfter = (await db.collection("users").doc(OWNER).get()).data();
  ok("★★ O21 — ערוץ כושל הושבת אוטומטית", (userAfter.disabledChannels || []).includes("push"), userAfter.disabledChannels);

  // ==========================================================================
  section("11. 🔴 reminderLog — הברחת שדות דרך מסלול ה-Function");
  // ==========================================================================
  await seed({ tasks: [mkTask({ id: "log", dueDate: addDays(TODAY, 30) })] });
  const evilProvider = {
    sent: [],
    async send() {
      return {
        ok: true, errorCode: null,
        phone: "0500000000", email: "x@y.z", fcmToken: "tok",
        rawResponse: { to: "0500000000", body: "הטסט של המאזדה" },
        body: "הטסט של המאזדה בעוד 30 ימים", ip: "1.2.3.4", userAgent: "Mozilla",
      };
    },
  };
  await sweep({ providers: evilProvider });
  const entry = (await readLog())[0];
  eq("★★ אין שדה אסור ברשומה שנכתבה ע\"י ה-Function", Object.keys(entry).filter((k) => REMINDER_LOG_FORBIDDEN_FIELDS.includes(k)), []);
  eq("★★ וכל שדה שקיים — מותר במפורש", Object.keys(entry).filter((k) => !REMINDER_LOG_FIELDS.includes(k)), []);
  const raw = JSON.stringify(entry);
  ok("★★ אין טלפון", !raw.includes("0500000000"));
  ok("★★ אין מייל", !raw.includes("x@y.z"));
  ok("★★ אין טוקן", !raw.includes("tok"));
  ok("★★ ואין גוף הודעה מרונדר", !raw.includes("המאזדה"));
  eq("★ recipientUid הוא מפתח ההרשאה", entry.recipientUid, OWNER);

  // ==========================================================================
  section("12. O11/O12 — גוף ההודעה");
  // ==========================================================================
  const msg = buildMessage({ channel: "sms", vehicleLabel: "האוטו של אמא", taskType: "טסט", dueDate: "18.09.2026" });
  ok("★ זיהוי השולח בתחילת ההודעה", msg.body.startsWith("NRCAR"));
  ok("★ הפניה למשימה", msg.body.includes("טסט") && msg.body.includes("האוטו של אמא"));
  ok("★★ שליטה בערוץ — 'לניהול התזכורות'", msg.body.includes("לניהול התזכורות") && msg.body.includes(SETTINGS_LINK));
  ok("★★ ואין 'להסרה השב הסר'", !/השב\s*הסר|להסרה/.test(msg.body));
  ok("★★ O11 — אפס תוכן מסחרי", !/(שדרג|Pro|מנוי|powered by|בחינם)/i.test(msg.body));
  ok("★★ T4 — בערוץ חיצוני אין לוחית ואין מספר פוליסה", !msg.includesPlate && !msg.includesPolicy);
  // ⚠️ מסירים הערות לפני הסריקה — אחרת ההסבר **למה** הניסוח אסור נחשב
  // בעצמו להפרה, והתוצאה היא שמפסיקים לתעד.
  const stripComments = (t) =>
    t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:'"`\\])\/\/.*$/gm, "$1");
  const provSrc = stripComments(readFileSync(join(ROOT, "functions", "src", "providers.js"), "utf8"));
  ok("★★ T2 — אין בשום נוסח פרדיקט על אדם אחר", !/לא הגיב|לא אישר|לא פתח|טרם ראה/.test(provSrc));
  ok("★ ואין ענף isMinor בקוד ההסלמה", !readFileSync(join(ROOT, "src", "utils", "escalation.js"), "utf8").includes("isMinor"));

  // ==========================================================================
  section("13. retention + מחיקה בצד השרת");
  // ==========================================================================
  ok("★ תקופת השמירה קונפיגורבילית", retentionMonths({ REMINDER_LOG_RETENTION_MONTHS: "3" }) === 3);
  eq("וברירת המחדל היא ההמלצה (⚖️ פתוח)", retentionMonths({}), 12);
  await db.collection("households").doc(HID).collection("reminderLog").doc("old").set({
    id: "old", householdId: HID, recipientUid: OWNER,
    firedAt: `${addMonths(TODAY, -18)}T00:00:00.000Z`, retentionClass: "operational-short",
  });
  const purge = await purgeReminderLogs({ db, now: NOW, months: 12, logger: { log() {} } });
  ok("★ רשומה ישנה נמחקה", purge.deleted >= 1, purge);
  const del = await deleteHouseholdServerSide({ db, householdId: HID, uid: OWNER, logger: { log() {} } });
  eq("★★ מחיקת השרת מכסה גם reminderLog וגם accessLog", del.collections, ["reminderLog", "accessLog"]);
  let denied = false;
  try {
    await deleteHouseholdServerSide({ db, householdId: HID, uid: "someone_else", logger: { log() {} } });
  } catch (err) {
    denied = err.code === "permission-denied";
  }
  ok("★★ ומי שאינו בעלים נדחה — Admin SDK עוקף rules", denied);

  // ==========================================================================
  section("14. ★ V4 signed URLs + O18 לוג הגישה");
  // ==========================================================================
  const household = { id: HID, members: { [OWNER]: "owner" } };
  const shared = createDocument({ householdId: HID, vehicleId: "v1", type: "vehicleLicence", fileRef: { storagePath: "p/shared.jpg" } });
  const ownerDoc = createDocument({ householdId: HID, vehicleId: "v1", type: "receipt", fileRef: { storagePath: "p/owner.jpg" } });
  const otherPersonal = createPersonalDoc({ householdId: HID, driverId: "d2", driverUid: "uid_other", fileRef: { storagePath: "p/other.jpg" } });
  eq("הבעלים מקבל נתיב", resolveDocumentAccess({ household, doc: shared, kind: "documents", uid: OWNER }), "p/shared.jpg");
  const expectDenied = (name, fn) => {
    try { fn(); ok(name, false, "לא נדחה"); }
    catch (err) { ok(name, err instanceof AccessError && err.code === "permission-denied", err.code); }
  };
  expectDenied("★ נהג בלי הקצאה לא מקבל shared", () => resolveDocumentAccess({ household, doc: shared, kind: "documents", uid: DRIVER, vehicleAccess: [] }));
  expectDenied("★★ ונהג לעולם לא מקבל owner", () =>
    resolveDocumentAccess({ household, doc: ownerDoc, kind: "documents", uid: DRIVER, vehicleAccess: [{ driverUid: DRIVER, vehicleId: "v1", id: `${DRIVER}__v1` }] }));
  expectDenied("★★ והבעלים לא מקבל מסמך אישי של אחר — גם בשרת", () =>
    resolveDocumentAccess({ household, doc: otherPersonal, kind: "personalDocs", uid: OWNER }));

  const fakeBucket = { file: (p) => ({ getSignedUrl: async (o) => [`https://storage.example/${p}?X-Goog-Signature=abc&Expires=${o.expires}`] }) };
  const signed = await createSignedUrl(fakeBucket, "p/me.jpg", { now: Date.parse(`${TODAY}T08:00:00Z`) });
  eq("★★ TTL של 5 דקות — לא טוקן קבוע", signed.ttlMinutes, 5);
  ok("★ ותאריך תפוגה מפורש", signed.expiresAt === new Date(Date.parse(`${TODAY}T08:00:00Z`) + 5 * 60000).toISOString());

  // ★★ המטמון שומר blob, לעולם לא קישור.
  // ⚠️ הסריקה מתעלמת מהערות — אחרת התיעוד **למה** אסור לשמור קישור נחשב
  // בעצמו להפרה. (זו הפעם השלישית שהמלכודת הזאת עולה בפרויקט.)
  const stripC = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:'"`\\])\/\/.*$/gm, "$1");
  const filesSrc = stripC(readFileSync(join(ROOT, "src", "utils", "files.js"), "utf8"));
  const cacheRaw = readFileSync(join(ROOT, "src", "utils", "localCache.js"), "utf8");
  const cacheSrc = stripC(cacheRaw);
  ok("★★ אין חתימת signed URL בקוד המטמון", SIGNED_URL_MARKERS.every((m) => !cacheSrc.includes(m)));
  ok("★ והמטמון מתועד ככזה ששומר טקסט/blob בלבד", cacheRaw.includes("לעולם לא קישור חתום"));
  ok("★ openSensitiveDocument נשארה נקודת המעבר היחידה", filesSrc.includes("export async function openSensitiveDocument"));

  // O18 — לוג הגישה נכתב, כולל דחיות, ובלי הקישור.
  await seed({ tasks: [] });
  await db.collection("households").doc(HID).collection("documents").doc("d1").set({ ...shared, id: "d1" });
  const { handleSignedUrlRequest } = await import("../src/signedUrls.js");
  await handleSignedUrlRequest({ db, bucket: fakeBucket, uid: OWNER, householdId: HID, docId: "d1", kind: "documents" });
  let accessLog = (await db.collection("households").doc(HID).collection("accessLog").get()).docs.map((d) => d.data());
  eq("★★ O18 — נרשמה רשומת גישה", accessLog.length, 1);
  eq("★ עם הפועל, המסמך והתוצאה", [accessLog[0].actorUid, accessLog[0].docId, accessLog[0].granted], [OWNER, "d1", true]);
  const logRaw = JSON.stringify(accessLog[0]);
  ok("★★ ובלי הקישור עצמו", !logRaw.includes("storage.example") && SIGNED_URL_MARKERS.every((m) => !logRaw.includes(m)));
  ok("★★ ובלי IP", !logRaw.includes("ip"));

  await db.collection("households").doc(HID).collection("personalDocs").doc("pd").set({ ...otherPersonal, id: "pd" });
  try {
    await handleSignedUrlRequest({ db, bucket: fakeBucket, uid: OWNER, householdId: HID, docId: "pd", kind: "personalDocs" });
  } catch { /* צפוי */ }
  accessLog = (await db.collection("households").doc(HID).collection("accessLog").get()).docs.map((d) => d.data());
  ok("★★ R12 — גם דחייה נרשמת (לוג שמתעד רק הצלחות אינו ראיה)", accessLog.some((l) => l.granted === false));
} catch (err) {
  failed++;
  failures.push(String(err?.message));
  console.error("  FAIL:", err?.stack || err?.message);
}

console.log("\n" + "=".repeat(60));
if (failed) {
  console.error(`נכשלו ${failed} בדיקות מתוך ${pass + failed}`);
  for (const f of failures) console.error("  ✗", f);
  process.exit(1);
}
console.log(`✓ כל ${pass} בדיקות ה-Functions עברו מול אמולטור אמיתי`);
process.exit(0);
