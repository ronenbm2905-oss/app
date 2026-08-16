// ============================================================================
// index.js — נקודת הכניסה של Cloud Functions.
//
// ⚠️ **הקובץ הזה הוא עטיפה בלבד.** כל הלוגיקה יושבת ב-`sweep.js`,
// `signedUrls.js` ו-`retention.js` — פונקציות שמקבלות את התלויות בהזרקה,
// ולכן הבדיקות מריצות את **הקוד האמיתי** מול אמולטור ולא מדמות אותו.
// זה גם מה שמאפשר לבדוק scheduler בלי לחכות ל-cron.
//
// region: me-west1 — אותו אזור של Firestore ו-Storage (O5 של עדי).
// ============================================================================

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getMessaging } from "firebase-admin/messaging";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

import { runReminderSweep } from "./sweep.js";
import { createProviders } from "./providers.js";
import { handleSignedUrlRequest, AccessError } from "./signedUrls.js";
import { purgeReminderLogs, deleteHouseholdServerSide } from "./retention.js";

initializeApp();
const db = getFirestore();

const REGION = "me-west1";
const TZ = "Asia/Jerusalem";

// ============================================================================
// ★ הסריקה. רצה **כל שעה**, ומטפלת רק במשקי הבית שהשעה שלהם התאימה —
// כך `settings.notificationHour` מכובד בלי פונקציה נפרדת לכל משתמש.
// ============================================================================
export const reminderSweep = onSchedule(
  { schedule: "0 * * * *", timeZone: TZ, region: REGION, retryCount: 0 },
  async () => {
    // ⚠️ `retryCount: 0` במכוון: הסריקה **אידמפוטנטית מעצם התפיסה
    // הטרנזקציונית**, אבל retry אוטומטי של הפלטפורמה על ריצה שנכשלה
    // באמצע רק מוסיף רעש — הריצה הבאה (בעוד שעה) תטפל במה שנשאר.
    const providers = createProviders({ messaging: getMessaging(), db, logger });
    const stats = await runReminderSweep({ db, providers, logger });
    logger.log("reminderSweep", stats);
  }
);

// ============================================================================
// ניקוי retention. פעם ביום. המספר קונפיגורבילי — ⚖️ פתוח.
// ============================================================================
export const reminderLogRetention = onSchedule(
  { schedule: "30 3 * * *", timeZone: TZ, region: REGION, retryCount: 0 },
  async () => {
    const stats = await purgeReminderLogs({ db, logger });
    logger.log("reminderLogRetention", stats);
  }
);

// ============================================================================
// ★ V4 signed URL — מחליף את getDownloadURL עם הטוקן הקבוע.
// ההרשאה נבדקת בשרת באותה לוגיקה של firestore.rules (utils/access.js).
// ============================================================================
export const getSignedDocumentUrl = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid || null;
  const { householdId, docId, kind } = request.data || {};
  try {
    return await handleSignedUrlRequest({
      db,
      bucket: getStorage().bucket(),
      uid,
      householdId,
      docId,
      kind,
    });
  } catch (err) {
    if (err instanceof AccessError) throw new HttpsError(err.code, err.message);
    logger.error("signed url failed", { code: err?.code });
    throw new HttpsError("internal", "could not sign url");
  }
});

// ============================================================================
// מחיקת האוספים שהקליינט חסום מהם. נקראת מ-`deleteHousehold()` באפליקציה.
// ============================================================================
export const deleteHouseholdServerData = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "sign in required");
  try {
    return await deleteHouseholdServerSide({
      db,
      householdId: request.data?.householdId,
      uid,
      logger,
    });
  } catch (err) {
    throw new HttpsError(err?.code === "permission-denied" ? "permission-denied" : "internal", err.message);
  }
});
