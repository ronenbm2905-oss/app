// ============================================================================
// providers.js — ממשק ההובלה.
//
// **למשתמש אין ספק SMS ואין ספק מייל**, ולכן שום ספק לא מקובע בקוד. הממשק
// צר בכוונה:
//
//     send(channel, target, payload) → { ok, errorCode }
//
// חיבור ספק אמיתי הוא **קובץ אחד** — מימוש `send` והחלפת השורה ב-`index.js`.
// שום קוד אחר לא צריך להשתנות, ובוודאי לא `sweep.js`.
//
// ⚠️ שני כללים שנאכפים כאן ולא רק מוסברים:
//
// 1. **ה-target הוא uid, לא כתובת.** הספק פותר את היעד בעצמו מ-
//    `users/{uid}.serviceChannels`. כך מספר הטלפון והמייל **לעולם לא עוברים
//    דרך sweep.js** ולא יכולים להגיע ל-reminderLog בטעות.
//
// 2. **תגובת הספק לא מוחזרת גולמית.** רק `{ ok, errorCode }` עם קוד גס.
//    תגובות ספקים מכילות את היעד, ולעתים את גוף ההודעה.
// ============================================================================

// קודי שגיאה גסים. **לא** להוסיף כאן קוד שמכיל מידע על היעד.
export const ERROR_CODES = {
  notConfigured: "provider-not-configured",
  noTarget: "recipient-has-no-target",
  channelOff: "channel-disabled",
  unverified: "target-not-verified",
  sendFailed: "send-failed",
};

// ============================================================================
// O11 + O12 — גוף ההודעה.
//
// **O11: אפס תוכן מסחרי. אפס.** לא באנר, לא "שדרג", לא "powered by", לא
// לוגו מקושר. פריט מסחרי אחד הופך את ההודעה ל"דבר פרסומת" בטענה סבירה —
// ואז ההפרה אינה בהודעה אחת אלא בכל הודעה שנשלחה באותה תבנית
// (₪1,000 להודעה, ווקטור ייצוגי).
//
// **O12: שלושה דברים חייבים להיות בפנים:**
//   1. זיהוי השולח — הודעה אנונימית עם פרטי רכב נראית כמו הונאה.
//   2. הפניה למשימה שהמשתמש יצר — מה שמעגן את היותה שירות.
//   3. שליטה בערוץ — **"לניהול התזכורות", ולא "להסרה השב הסר".**
//      הנוסח ההוא מסמן שיווק, **ומזמין משתמש מבוגר לבטל ברפלקס תזכורת
//      בטיחות.** השליטה נמצאת באפליקציה, פר-ערוץ.
//
// **T2 + T4:** בגוף ההודעה — רכב, משימה, תאריך, סטטוס. **אסור כל פרדיקט על
// אדם אחר** ("לא הגיב", "טרם ראה", חותמות מסירה). ובערוצים חיצוניים (SMS/
// מייל) — **בלי לוחית ובלי מספר פוליסה.**
// ============================================================================
export const SETTINGS_LINK = "https://nrcar.app/#/settings";

export function buildMessage({ channel, vehicleLabel, taskType, dueDate, role }) {
  const external = channel === "sms" || channel === "email";
  const subject = vehicleLabel || "הרכב שלך";
  const lines = [
    `NRCAR — תזכורת`, // (1) זיהוי השולח
    `${taskType} של ${subject}${dueDate ? ` — עד ${dueDate}` : ""}`, // (2) המשימה
  ];
  // (3) שליטה — ולא הסרה.
  lines.push(`לניהול התזכורות: ${SETTINGS_LINK}`);
  return {
    // בערוץ חיצוני לא עוברים מזהים ישירים של הרכב.
    body: lines.join("\n"),
    includesPlate: false,
    includesPolicy: false,
    external,
    role,
  };
}

// ============================================================================
// createMockProviders — המימוש שרץ באמולטור ובבדיקות.
// שומר את מה שנשלח **בזיכרון בלבד**, כדי שהבדיקות יוכלו לאמת ערוץ ושלב.
// ============================================================================
export function createMockProviders({ failChannels = [], sent = [] } = {}) {
  return {
    sent,
    async send(channel, target, payload) {
      if (failChannels.includes(channel)) {
        return { ok: false, errorCode: ERROR_CODES.sendFailed };
      }
      sent.push({ channel, uid: target?.uid, step: payload?.step, taskId: payload?.taskId });
      return { ok: true, errorCode: null };
    },
  };
}

// ============================================================================
// createProviders — הצנרת האמיתית.
//
// FCM: הצנרת קיימת, אבל **טוקני מכשיר אמיתיים דורשים אפליקציה חיה** (ובפועל
// Capacitor, פרוסה 3; ב-Web PWA גם service worker ייעודי). עד אז אין טוקן
// ולכן מוחזר `recipient-has-no-target`, והסולם מסלים לערוץ הבא.
//
// SMS/מייל: **אין ספק מוגדר**. מוחזר `provider-not-configured` — וזה נכון:
// המצב נרשם, הסולם ממשיך, ושום דבר לא מתיימר להישלח.
// ============================================================================
export function createProviders({ messaging = null, db = null, logger = console } = {}) {
  return {
    async send(channel, target, payload) {
      const uid = target?.uid;
      if (!uid) return { ok: false, errorCode: ERROR_CODES.noTarget };

      const userSnap = db ? await db.collection("users").doc(uid).get() : null;
      const user = userSnap?.exists ? userSnap.data() : null;
      const channels = user?.serviceChannels || {};
      if (!channels[channel]) return { ok: false, errorCode: ERROR_CODES.channelOff };

      // ============================================================================
      // 🔴 O13 — אימות היעד לפני ההודעה הראשונה.
      //
      // **סעיף חובה, לא נימוס.** מספר טלפון שהוקלד בשגיאה פירושו הודעות
      // בטיחות עם כינוי הרכב לאדם זר — שוב ושוב, לנצח, בלי שאיש יידע.
      // **זה הכשל היחיד בפרוסה הזאת שאין לו מסלול תיקון עצמי:** הנמען הזר
      // אינו יכול לדווח, והמשתמש אינו יודע.
      //
      // Push פטור — הרשאת מערכת ההפעלה היא השער, והיעד הוא המכשיר עצמו.
      // ============================================================================
      if (channel === "sms" || channel === "email") {
        if (!user?.channelVerified?.[channel]) {
          return { ok: false, errorCode: ERROR_CODES.unverified };
        }
      }

      if (channel === "push") {
        const token = user?.pushToken || null;
        if (!token || !messaging) return { ok: false, errorCode: ERROR_CODES.noTarget };
        try {
          // ⚠️ גוף ההודעה נבנה כאן ו**לא נשמר בשום מקום**. הוא מכיל את שם
          // הרכב ואת התאריך — ולכן הוא לא נכנס ל-reminderLog.
          await messaging.send({
            token,
            data: {
              taskId: String(payload?.taskId || ""),
              vehicleId: String(payload?.vehicleId || ""),
              type: String(payload?.type || ""),
              step: String(payload?.step ?? ""),
            },
          });
          return { ok: true, errorCode: null };
        } catch (err) {
          logger.warn?.("push send failed", { code: err?.code });
          return { ok: false, errorCode: String(err?.code || ERROR_CODES.sendFailed).slice(0, 40) };
        }
      }

      // SMS ומייל — אין ספק. ראו functions/README.md.
      return { ok: false, errorCode: ERROR_CODES.notConfigured };
    },
  };
}
