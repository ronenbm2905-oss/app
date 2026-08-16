// ============================================================================
// notice.js — רישום מסירת היידוע לעובד (D8). טהור: `today`/`at`/`deliveryId`
// מוזרקים, ולכן בדיק.
//
// שער עדי 2026-08-16, סעיף 4.3. שלוש הבחנות שהמודול הזה מקבע בקוד:
//
// 1. **מסירה ≠ רישום.** המסירה היא אירוע בעולם (טופס חתום, מייל, ישיבה);
//    הרישום הוא מה שקורה במערכת אחר כך, לפעמים ימים אחר כך. עד היום
//    `acknowledgeNotice` כתב `acknowledgedAt: nowIso()` — כלומר את **רגע
//    הלחיצה**. בשדה שכל תכליתו ראיה, תאריך שגוי גרוע מהיעדר רשומה. לכן
//    `deliveredAt` הוא פרמטר **מפורש** (ברירת מחדל: היום), ו-`recordedAt`
//    מתעד בנפרד מתי נלחץ. שני התאריכים נשמרים — הם באמת שני דברים.
//
// 2. **תאריך עתידי חסום.** מה שאי אפשר לחסום בקוד — תאריך מוקדם מדי — הוא
//    האיסור המפורש היחיד של עדי (4.3ב): אין לרשום מסירה מוקדמת מיום המסירה
//    בפועל, גם לא כדי "לכסות" תקופה שבה המערכת כבר פעלה. הקוד אינו יכול
//    לדעת זאת, ולכן האזהרה מוצגת בממשק ולא מועמדת פנים שנאכפה.
//
// 3. **`method` הוא enum מדורג לפי חוזק הראיה**, לא מחרוזת חופשית.
//    `admin_recorded` = "מישהו לחץ" ולא "כך נמסר" → חיווי חלש, לא חסימה.
//
// שינוי שם שדה: הרשומה החדשה כותבת `deliveredAt` ולא `acknowledgedAt`.
// `acknowledgedAt` היה שם מטעה מלכתחילה — D8 כולו עומד על כך שמתעדים
// **מסירה ולא הסכמה** — והוא נקרא כאן כ**מורשת בלבד**, כדי שרשומות שנכתבו
// לפני השינוי ימשיכו להיחשב יידוע תקף ולא ייעלמו מהשער.
// ============================================================================

import { NOTICE_METHODS, NOTICE_METHOD_WEAK, NOTICE_METHOD_DEFAULT } from "../constants.js";
import { cmpDay, dayOf, isDay, todayIso } from "./dates.js";
import { newId, nowIso } from "./id.js";

export function isNoticeMethod(method) {
  return NOTICE_METHODS.includes(method);
}

// שיטה לא מוכרת אינה "כמעט נכונה" — היא נופלת לחלשה ביותר, לא לחזקה.
export function normalizeNoticeMethod(method) {
  return isNoticeMethod(method) ? method : NOTICE_METHOD_DEFAULT;
}

// מקבל נהג או אובייקט notice. מחזיר יום ("YYYY-MM-DD") או null.
export function noticeDeliveredAt(subject) {
  const n = subject?.notice ?? subject ?? null;
  if (!n || typeof n !== "object") return null;
  return dayOf(n.deliveredAt) || dayOf(n.acknowledgedAt) || null;
}

export function hasNoticeRecord(driver) {
  return Boolean(noticeDeliveredAt(driver));
}

export function noticeMethodOf(driver) {
  const m = driver?.notice?.method ?? null;
  return m && isNoticeMethod(m) ? m : null;
}

// 4.3ג — חיווי, לא חסימה: יש רישום, אבל אין מאחוריו ראיה חיצונית.
export function isWeakNoticeEvidence(driver) {
  return hasNoticeRecord(driver) && noticeMethodOf(driver) === NOTICE_METHOD_WEAK;
}

export function emptyNotice() {
  return {
    policyVersion: null,
    deliveredAt: null,
    method: null,
    evidenceRef: null,
    deliveryId: null,
    recordedAt: null,
    recordedBy: null,
  };
}

// ============================================================================
// validateNoticeDelivery — מחזיר מערך מפתחות שגיאה (ריק = תקין). טהור.
// ============================================================================
export function validateNoticeDelivery(input = {}, { today = todayIso() } = {}) {
  const errors = [];
  const ids = Array.isArray(input.driverIds) ? input.driverIds.filter(Boolean) : [];
  if (!ids.length) errors.push("notice.err.noDrivers");
  if (!input.policyVersion) errors.push("notice.err.noPolicyVersion");

  const day = dayOf(input.deliveredAt);
  if (!isDay(day)) errors.push("notice.err.badDate");
  else if (cmpDay(day, today) > 0) errors.push("notice.err.futureDate");

  if (input.method !== undefined && input.method !== null && !isNoticeMethod(input.method)) {
    errors.push("notice.err.badMethod");
  }
  return errors;
}

// ============================================================================
// partitionNoticeTargets — 4.5: לא מוסרים ולא רושמים לנהג בסטטוס `archived`.
// מי שעזב אינו צריך יידוע רטרואקטיבי, והאנונימיזציה ממילא מאפסת את הרשומה.
// הדילוג מדווח החוצה ולא נבלע — הקורא צריך לדעת שלא כל מי שנבחר נרשם.
// ============================================================================
export function partitionNoticeTargets(data, driverIds = []) {
  const byId = new Map((data?.drivers || []).map((d) => [d.id, d]));
  const seen = new Set();
  const targets = [];
  const skipped = [];
  for (const id of driverIds || []) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const d = byId.get(id);
    if (!d) skipped.push({ id, reason: "notice.skip.unknown" });
    else if (d.status === "archived") skipped.push({ id, reason: "notice.skip.archived" });
    else targets.push(d);
  }
  return { targets, skipped };
}

// מי מועמד למסירה: כל מי שאינו בארכיון וטרם נרשמה לו מסירה.
export function noticeCandidates(data) {
  return (data?.drivers || []).filter((d) => d.status !== "archived" && !hasNoticeRecord(d));
}

// ============================================================================
// buildNoticeRecord — האובייקט שנכתב ל-`Driver.notice`. **אותו אובייקט**
// נכתב לכל הנהגים שנבחרו, כי המסירה הייתה אירוע אחד.
// ============================================================================
export function buildNoticeRecord({
  policyVersion = null,
  deliveredAt = null,
  method = null,
  evidenceRef = null,
  deliveryId = null,
  recordedBy = null,
  recordedAt = null,
} = {}) {
  return {
    policyVersion: policyVersion || null,
    // תאריך המסירה בעולם — הראיה.
    deliveredAt: dayOf(deliveredAt),
    method: normalizeNoticeMethod(method),
    evidenceRef: evidenceRef || null,
    // הקישור לרשומת האירוע ב-settings; דרכו אפשר לשחזר מי נכלל באותה מסירה.
    deliveryId: deliveryId || null,
    // חותמת הלחיצה — נשמרת בנפרד, ולא מתחזה לתאריך המסירה.
    recordedAt: recordedAt || nowIso(),
    recordedBy: recordedBy || null,
  };
}

// ============================================================================
// buildNoticeDelivery — רשומת **אירוע המסירה** ל-`settings.noticeDelivery`,
// בדיוק בתבנית `settings.importAck` שנבנתה ב-M3: מי הצהיר, מתי, לפי איזו
// גרסה, ובאיזו שיטה — ובנוסף כאן: **לכמה עובדים ולמי בדיוק**.
//
// למה זה חזק יותר מ-29 לחיצות (עדי 4.3א): אם המסירה הייתה אירוע אחד, 29
// לחיצות נפרדות מייצרות 29 חותמות זמן שאף אחת מהן אינה תאריך המסירה האמיתי.
// רשומת אירוע אחת מתארת נכון את מה שקרה.
//
// כמו `importAck`, השדה מחזיק את **האירוע האחרון**. מה שלא הולך לאיבוד:
// כל רשומת `Driver.notice` נושאת את `deliveryId` שלה, ולכן אפשר לשחזר כל
// אירוע קודם מתוך הנהגים עצמם.
// ============================================================================
export function buildNoticeDelivery({
  driverIds = [],
  policyVersion = null,
  method = null,
  deliveredAt = null,
  evidenceRef = null,
  actor = null,
  deliveryId = null,
  at = null,
} = {}) {
  const ids = (driverIds || []).filter(Boolean);
  return {
    id: deliveryId || newId("ndl"),
    at: at || nowIso(), // מתי נרשם
    by: actor || null, // מי הצהיר
    deliveredAt: dayOf(deliveredAt), // מתי נמסר בפועל
    method: normalizeNoticeMethod(method),
    policyVersion: policyVersion || null,
    drivers: ids.length,
    driverIds: ids,
    evidenceRef: evidenceRef || null,
  };
}
