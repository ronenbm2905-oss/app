// ============================================================================
// retention.js — מדיניות השמירה והמחיקה של עדי (S8), **כקוד**.
//
// "🟠 המחיקה היא ג'וב מתוזמן, לא משפט במדיניות. מדיניות שאומרת '12 חודשים'
//  ומאגר שמכיל לידים מ-2026 היא **הצהרה כוזבת** על אמצעי הגנה — בדיוק הכשל
//  שחסמתי ב-NRCAR (סעיף המצג)."
//
// הקובץ הזה הוא **פונקציות טהורות בלבד** ומיובא בשני מקומות:
//   · הקונסולה — כדי להציג "נמחק בעוד X ימים" ליד כל ליד;
//   · `functions/src/retention.js` — הג'וב המתוזמן שמוחק בפועל.
// מקור אמת אחד, ולכן מה שהמסך מבטיח הוא מה שהשרת עושה. בדוק ב-smoke.
// ============================================================================

import {
  LEAD_STATUS,
  RETENTION_CLASS,
  RETENTION_DAYS,
  LEAD_PII_FIELDS,
  UNANSWERED_ATTEMPTS_THRESHOLD,
} from "../constants.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * מסווג ליד למחלקת שמירה לפי הסטטוס שלו.
 * המיפוי הוא בדיוק הטבלה ב-S8.
 */
export function retentionClassFor(lead) {
  const status = lead?.status ?? LEAD_STATUS.NEW;
  switch (status) {
    // סירוב והמרה — מחיקת PII מיידית.
    // המרה: הליד עובר למערכת התיקים של משה; חובות ניהול פנקסים חלות שם,
    // לא ב-`leads`. `leads` הוא מאגר-ביניים (S8(1)).
    case LEAD_STATUS.REFUSED:
    case LEAD_STATUS.CONVERTED:
      return RETENTION_CLASS.IMMEDIATE;
    // נוצר קשר בפועל ולא התקדם — 12 חודשים מהמגע האחרון.
    case LEAD_STATUS.CONTACTED:
      return RETENTION_CLASS.CONTACTED;
    // ניסיונות ללא מענה — 6 חודשים מיצירת הליד.
    case LEAD_STATUS.ATTEMPTED:
    case LEAD_STATUS.NEW:
    default:
      return RETENTION_CLASS.UNANSWERED;
  }
}

/**
 * הזמן שממנו מתחיל השעון.
 * ⚠️ ההבחנה חשובה ואינה קוסמטית: "לא נענה" נמדד מ**יצירת** הליד, ו"נוצר
 * קשר" מ**המגע האחרון**. אם שניהם היו נמדדים מהמגע האחרון, כל שיחה נכשלת
 * הייתה מאריכה את חיי הליד — כלומר מי שלא עונה נשמר הכי הרבה זמן. זה בדיוק
 * ההפך מהכוונה.
 */
export function retentionAnchor(lead) {
  const cls = retentionClassFor(lead);
  if (cls === RETENTION_CLASS.CONTACTED) {
    return toMillis(lead.lastContactAt) ?? toMillis(lead.createdAt);
  }
  return toMillis(lead.createdAt);
}

/** מחזיר את מועד המחיקה (ms) או null אם אין מספיק נתונים. */
export function purgeAfterMillis(lead) {
  const cls = retentionClassFor(lead);
  const anchor = retentionAnchor(lead);
  if (anchor == null) return null;
  if (cls === RETENTION_CLASS.IMMEDIATE) return anchor; // עבר כבר — נמחק בסבב הקרוב
  return anchor + RETENTION_DAYS[cls] * DAY_MS;
}

/** האם הליד חייב מחיקה נכון ל-`now`. */
export function isDueForPurge(lead, now = Date.now()) {
  if (lead?.purgedAt) return false; // כבר נמחק
  const due = purgeAfterMillis(lead);
  return due != null && due <= now;
}

/** ימים שנותרו עד המחיקה. שלילי = חורג. null = לא ניתן לחישוב. */
export function daysUntilPurge(lead, now = Date.now()) {
  const due = purgeAfterMillis(lead);
  if (due == null) return null;
  return Math.ceil((due - now) / DAY_MS);
}

/**
 * ליד שנכשלו בו מספיק ניסיונות נחשב "לא נענה" לצורך המדרג —
 * גם אם מישהו סימן אותו כ"נוצר קשר" בטעות.
 */
export function isUnanswered(lead) {
  return (
    (lead?.contactAttempts ?? 0) >= UNANSWERED_ATTEMPTS_THRESHOLD &&
    lead?.status !== LEAD_STATUS.CONTACTED
  );
}

/**
 * הפעולה עצמה: מחיקת ה-PII, בהשארת שלד לספירה בלבד.
 *
 * 🔴 למה לא מחיקת המסמך כולו: כדי שיישאר תיעוד מספרי ("כמה לידים נמחקו
 *    ומתי") בלי שיישאר אדם. השלד אינו מזהה איש — אין בו שם, טלפון או
 *    אימייל. זה גם מה שמאפשר להוכיח בביקורת שהמחיקה בוצעה (R-7).
 *
 * ⚠️ מה שהפונקציה הזאת **לא** מכסה: גיבויים וייצואים (S8(5)). אם מישהו
 *    ייצא גיליון, "מחקנו את הליד" אינו נכון. לכן אין בפרויקט הזה כפתור
 *    ייצוא — ראה R-9 וההערה ב-LeadsView.
 */
export function purgedShape(lead) {
  const out = { ...lead };
  for (const f of LEAD_PII_FIELDS) delete out[f];
  out.purgedAt = null; // ממולא ע"י השרת ב-serverTimestamp
  return out;
}

/** מוודא שאחרי purge לא נשאר שום שדה מזהה. משמש כאסרשן ב-smoke. */
export function purgeLeftovers(purged) {
  return LEAD_PII_FIELDS.filter((f) =>
    Object.prototype.hasOwnProperty.call(purged, f)
  );
}

function toMillis(v) {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  // Firestore Timestamp (קליינט או Admin SDK)
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.toDate === "function") return v.toDate().getTime();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  if (typeof v._seconds === "number") return v._seconds * 1000;
  return null;
}

export { toMillis };
