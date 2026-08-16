// ============================================================================
// lead.js — בניית ליד וולידציה. **פונקציות טהורות בלבד** (אין fetch, אין
// firebase, אין DOM) — כדי ש-`npm run smoke` יוכל לבדוק אותן בלי דפדפן,
// ו-`lead-intake.js` יוכל לייבא אותן בלי לגרור תלויות.
//
// ⚠️ הוולידציה כאן היא **מראה של `firestore.rules`, לא תחליף לה.**
// הקליינט מסנן כדי לתת שגיאה ידידותית; ה-rules הן מה שעוצר תוקף. כל שינוי
// כאן מחייב שינוי מקביל ב-firestore.rules ואסרשן ב-rules-tests.mjs.
// ============================================================================

import {
  LEAD_CREATE_FIELDS,
  LEAD_REQUIRED_FIELDS,
  LEAD_SOURCE_FIELDS,
  LEAD_SOURCE_MAX_LEN,
  FORBIDDEN_FIELDS,
  POLICY_VERSION,
} from "../constants.js";

// זהה ל-validName ב-firestore.rules.
//
// 🔴 **denylist של ספרות, לא allowlist של תווים.** הגרסה הראשונה כאן הייתה
//    allowlist (עברית + לטינית) — והיא דחתה `محمد`, `سارة` ו-`Дмитрий`,
//    כלומר חסמה בשקט חלק ניכר מהאוכלוסייה בישראל. **שם תקין שנדחה = ליד
//    אבוד**, וכאן גם הפליה בתוצאה. ה-denylist משיג את אותה מטרה בדיוק —
//    אי אפשר להסתיר ת.ז. בלי ספרות — בלי להניח הנחות על האלפבית של אף אחד.
//    כולל ספרות ערביות-הודיות (٠-٩) ומורחבות (۰-۹).
export const NAME_RE = /^[^0-9٠-٩۰-۹\n\r\t]{2,40}$/;
export const PHONE_RE = /^0[2-9][0-9]{7,8}$/;
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * מנרמל טלפון לפורמט שה-rules מקבלים: ספרות בלבד, בלי מקפים/רווחים/+972.
 * המבקר מקליד "052-123-4567" או "+972521234567"; שניהם צריכים לעבור.
 */
export function normalizePhone(raw) {
  if (typeof raw !== "string") return "";
  let s = raw.replace(/[\s\-().‎‏]/g, "");
  if (s.startsWith("+972")) s = "0" + s.slice(4);
  else if (s.startsWith("972") && s.length >= 11) s = "0" + s.slice(3);
  return s;
}

export function normalizeName(raw) {
  if (typeof raw !== "string") return "";
  // רווחים כפולים ורווחי קצה — מקור נפוץ לדחייה מיותרת של שם תקין.
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * ולידציה. מחזיר מפת שגיאות לפי שדה; מפה ריקה = תקין.
 * ההודעות בעברית ומיועדות להצגה ישירה למבקר.
 */
export function validateLead(input) {
  const errors = {};
  const name = normalizeName(input.firstName);
  const phone = normalizePhone(input.phone);
  const email = typeof input.email === "string" ? input.email.trim() : "";

  if (!name) errors.firstName = "נא למלא שם פרטי";
  else if (name.length < 2) errors.firstName = "השם קצר מדי";
  else if (name.length > 40) errors.firstName = "השם ארוך מדי";
  else if (!NAME_RE.test(name)) {
    // הניסוח מכוון: הוא מסביר מה מותר במקום להאשים. שדה שדוחה בלי להסביר
    // הוא ליד אבוד בקמפיין ממומן.
    errors.firstName = "שם פרטי בלי ספרות";
  }

  if (!phone) errors.phone = "נא למלא מספר טלפון";
  else if (!PHONE_RE.test(phone)) errors.phone = "מספר טלפון לא תקין";

  // אימייל אופציונלי (עדי S3). ריק = תקין.
  if (email && !EMAIL_RE.test(email)) errors.email = "כתובת אימייל לא תקינה";
  else if (email.length > 100) errors.email = "כתובת האימייל ארוכה מדי";

  return errors;
}

/**
 * מסנן את מפת ה-source ל-allowlist בלבד.
 *
 * 🔴 נופלים כאן בשקט ובכוונה, וכולם מאותה סיבה — טקסט/מזהה שמקורו במשתמש
 *    או בפלטפורמה, שנכנס דרך שכבת האנליטיקס ועוקף את S3 בדלת צדדית:
 *    `utm_term` (מילת החיפוש שהוקלדה) · `referrer` · `landingUrl` ·
 *    `gclid`/`fbclid` (מזהי קליק — ראה ההנמקה ב-constants.js).
 *    הפונקציה בונה **רק** מהרשימה הלבנה, ולכן שדה חדש לא נכנס בטעות.
 */
export function buildSource(params = {}) {
  const out = {};
  const map = {
    utmSource: params.utm_source ?? params.utmSource,
    utmMedium: params.utm_medium ?? params.utmMedium,
    utmCampaign: params.utm_campaign ?? params.utmCampaign,
    utmContent: params.utm_content ?? params.utmContent,
  };
  for (const [key, value] of Object.entries(map)) {
    if (!LEAD_SOURCE_FIELDS.includes(key)) continue;
    if (typeof value !== "string" || !value.trim()) continue;
    out[key] = value.trim().slice(0, LEAD_SOURCE_MAX_LEN);
  }
  return out;
}

/**
 * בונה את מסמך הליד. **מחזיר אך ורק מפתחות מ-LEAD_CREATE_FIELDS.**
 * `createdAt` אינו נקבע כאן — הוא נכתב כ-serverTimestamp בשכבת השליחה,
 * כי ה-rules דורשות `createdAt == request.time` (R-3).
 */
export function buildLead(input, { source = {}, policyVersion = POLICY_VERSION } = {}) {
  const doc = {
    firstName: normalizeName(input.firstName),
    phone: normalizePhone(input.phone),
    // 🔴 M4 — אין כאן `marketingOptIn`. ההסכמה לדיוור ירדה לגמרי; ראה
    //    ההנמקה ב-FORBIDDEN_FIELDS. `sanitizeLead` למטה משליך אותו גם אם
    //    טופס עתידי ינסה לשלוח אותו.
    screened: input.screened === true,
    source: buildSource(source),
    // 🔴 שדה **עליון**, לא בתוך `source`. `source` הוא ייחוס שיווקי;
    //    זו ראיה להסכמה. ניקוי עתידי של ייחוס שיווקי לא יימחק אותה איתו.
    policyVersion: String(policyVersion).slice(0, 32),
  };

  const email = typeof input.email === "string" ? input.email.trim() : "";
  // 🔴 שדה ריק **מושמט**, לא נשלח כמחרוזת ריקה: ה-rules דורשות שאם `email`
  // קיים הוא תקין, ומחרוזת ריקה הייתה נדחית ומפילה ליד תקין.
  if (email) doc.email = email;

  return sanitizeLead(doc);
}

/**
 * שכבת הגנה אחרונה בקליינט: משליך כל מפתח שאינו ב-allowlist.
 * זו **לא** ההגנה האמיתית (זו `hasOnly` ב-rules) — זו הגנה מפני באג שלנו,
 * למשל פיצ'ר עתידי שיוסיף שדה לטופס בלי לעבור דרך עדי (S14(1)).
 */
export function sanitizeLead(doc) {
  const out = {};
  for (const key of LEAD_CREATE_FIELDS) {
    if (key === "createdAt") continue;
    if (Object.prototype.hasOwnProperty.call(doc, key)) out[key] = doc[key];
  }
  return out;
}

/** מחזיר את השדות האסורים שנמצאו במסמך. תקין = מערך ריק. */
export function forbiddenFieldsIn(doc) {
  if (!doc || typeof doc !== "object") return [];
  return FORBIDDEN_FIELDS.filter((f) => Object.prototype.hasOwnProperty.call(doc, f));
}

/** האם המסמך מכיל בדיוק את מה שמותר, ותו לא. */
export function leadShapeIsValid(doc) {
  const keys = Object.keys(doc);
  const extra = keys.filter((k) => !LEAD_CREATE_FIELDS.includes(k));
  const missing = LEAD_REQUIRED_FIELDS.filter(
    (k) => k !== "createdAt" && !keys.includes(k)
  );
  return { ok: extra.length === 0 && missing.length === 0, extra, missing };
}
