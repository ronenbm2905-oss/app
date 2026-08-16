// ============================================================================
// lead-intake.js — הקליינט היחיד שדף הנחיתה של עומר טוען.
//
// ┌────────────────────────────────────────────────────────────────────────┐
// │ 🔴 `leads` הוא **מאגר-ביניים, לא מאגר לקוחות** (עדי S8(1)).            │
// │                                                                        │
// │ ברגע שהוא הופך ל-CRM, כל תקופות השמירה של S8 מתפוצצות: מאגר-ביניים    │
// │ נמחק אחרי 6/12 חודשים, מאגר לקוחות לא. הלחץ להוסיף כאן "רק עוד שדה    │
// │ אחד" — סכום, תאריך מכירה, הערות מהשיחה — **יגיע, והוא יישמע הגיוני**.  │
// │ הוא לא. לקוח שהומר יוצא מ-`leads` ועובר למערכת התיקים של משה, ושם     │
// │ חלות חובות ניהול פנקסים — לא כאן.                                     │
// │                                                                        │
// │ הוספת שדה כלשהו = טריגר לסקירה חוזרת אצל עדי (S14(1)).                │
// └────────────────────────────────────────────────────────────────────────┘
//
// -- למה REST ולא ה-SDK של Firebase ---------------------------------------
// ה-SDK שוקל ~90KB gzip. זה דף נחיתה לקמפיין ממומן: כל קילובייט משולם
// בכסף אמיתי (נטישה במובייל סלולרי, Quality Score). הקובץ הזה מדבר ישירות
// מול Firestore REST ו-App Check REST ב-`fetch` נטו — ~4KB gzip, אפס
// תלויות, אפס בקשות רשת בטעינת הדף.
//
// reCAPTCHA נטען **עצלנית**, רק כשהמבקר נוגע בטופס בפועל. מי שגלל וירד לא
// שילם על כלום ולא נחשף לצד ג'.
//
// -- מה הקובץ הזה **לא** עושה, ובכוונה ------------------------------------
//   · לא שולח את תשובות בודק ההתאמה. בשום צורה. הבודק כולו client-side
//     והתשובות אינן עוזבות את הדפדפן (בריף ס' 5, עדי S2.1/S2.4).
//     מה שנשלח הוא בוליאני יחיד: `screened`.
//   · לא שולח `referrer`, לא `landingUrl`, לא `utm_term` (מילת החיפוש
//     שהמשתמש הקליד = טקסט חופשי מהמשתמש), ולא `gclid`/`fbclid`.
//   · לא קורא מהמאגר. אף פעם. ה-rules ממילא חוסמות.
//   · לא כותב ל-localStorage ולא ל-cookie.
// ============================================================================

import { POLICY_VERSION, LEAD_CREATE_FIELDS } from "../src/constants.js";
import { buildLead, validateLead, leadShapeIsValid } from "../src/utils/lead.js";

const FIRESTORE_HOST = "https://firestore.googleapis.com/v1";
const APPCHECK_HOST = "https://firebaseappcheck.googleapis.com/v1";
const RECAPTCHA_SRC = "https://www.google.com/recaptcha/api.js?render=";

let config = null;
let recaptchaPromise = null;
let cachedAppCheck = null; // { token, expiresAt } — בזיכרון בלבד, לא נשמר

// ---------------------------------------------------------------------------
// קונפיג
// ---------------------------------------------------------------------------

function resolveConfig(overrides) {
  const fromWindow = typeof window !== "undefined" ? window.MAS_SHEVACH_CONFIG : null;
  const cfg = { ...(fromWindow || {}), ...(overrides || {}) };

  if (!cfg.projectId) throw new Error("[lead-intake] חסר projectId");
  if (!cfg.apiKey) throw new Error("[lead-intake] חסר apiKey");

  // מספר הפרויקט מקודד בתוך appId: "1:<projectNumber>:web:<hash>".
  // חוסך שדה קונפיג נוסף ומקור נוסף לטעות.
  if (!cfg.projectNumber && typeof cfg.appId === "string") {
    const parts = cfg.appId.split(":");
    if (parts.length >= 2 && /^\d+$/.test(parts[1])) cfg.projectNumber = parts[1];
  }

  cfg.policyVersion = cfg.policyVersion || POLICY_VERSION;
  // 🔴 ברירת המחדל היא fail-closed: בלי App Check לא נשלח כלום.
  // כיבוי מפורש מותר רק לפיתוח מקומי, והוא צועק בקונסולה.
  cfg.requireAppCheck = cfg.requireAppCheck !== false;
  return cfg;
}

export function init(overrides) {
  config = resolveConfig(overrides);
  if (!config.recaptchaSiteKey) {
    if (config.requireAppCheck) {
      // לא זורק — זורק היה שובר את הדף. אבל השליחה תיכשל, וזה מכוון:
      // עדיף טופס שלא עובד בבדיקה מאשר endpoint פתוח בפרודקשן.
      console.error(
        "[lead-intake] 🔴 App Check אינו מוגדר (חסר recaptchaSiteKey). " +
          "השליחה תיחסם. זהו חוסם go-live (עדי R-5). " +
          "לפיתוח מקומי בלבד: requireAppCheck: false."
      );
    } else {
      console.warn("[lead-intake] ⚠️ רץ ללא App Check — פיתוח מקומי בלבד.");
    }
  }
  return config;
}

function requireConfig() {
  if (!config) config = resolveConfig(null);
  return config;
}

// ---------------------------------------------------------------------------
// App Check — reCAPTCHA v3 → exchange → טוקן
// ---------------------------------------------------------------------------

function loadRecaptcha(siteKey) {
  if (recaptchaPromise) return recaptchaPromise;
  recaptchaPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("no-dom"));
      return;
    }
    if (window.grecaptcha && window.grecaptcha.execute) {
      resolve(window.grecaptcha);
      return;
    }
    const s = document.createElement("script");
    s.src = RECAPTCHA_SRC + encodeURIComponent(siteKey);
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("recaptcha-load-failed"));
    s.onload = () => {
      if (!window.grecaptcha) return reject(new Error("recaptcha-missing"));
      window.grecaptcha.ready(() => resolve(window.grecaptcha));
    };
    document.head.appendChild(s);
  });
  return recaptchaPromise;
}

/**
 * חימום. עומר קורא לזה ב-focus הראשון על שדה בטופס — כך שבזמן שהמבקר
 * מקליד, reCAPTCHA כבר נטען, והשליחה עצמה מיידית. אין כאן שום בקשה
 * שקשורה למבקר שרק גלל בדף.
 */
export function warmUp() {
  const cfg = requireConfig();
  if (!cfg.recaptchaSiteKey) return Promise.resolve(false);
  return loadRecaptcha(cfg.recaptchaSiteKey).then(
    () => true,
    () => false
  );
}

async function getAppCheckToken() {
  const cfg = requireConfig();
  if (!cfg.recaptchaSiteKey) return null;

  if (cachedAppCheck && cachedAppCheck.expiresAt > Date.now() + 30_000) {
    return cachedAppCheck.token;
  }

  const grecaptcha = await loadRecaptcha(cfg.recaptchaSiteKey);
  const rcToken = await grecaptcha.execute(cfg.recaptchaSiteKey, { action: "lead_submit" });

  const projectRef = cfg.projectNumber || cfg.projectId;
  const url =
    `${APPCHECK_HOST}/projects/${encodeURIComponent(projectRef)}` +
    `/apps/${encodeURIComponent(cfg.appId)}:exchangeRecaptchaV3Token` +
    `?key=${encodeURIComponent(cfg.apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recaptcha_v3_token: rcToken }),
  });
  if (!res.ok) throw new Error("appcheck-exchange-failed:" + res.status);

  const data = await res.json();
  const token = data?.token?.token || data?.attestationToken;
  if (!token) throw new Error("appcheck-no-token");

  const ttlSec = parseInt(String(data?.token?.ttl || "3600s"), 10) || 3600;
  cachedAppCheck = { token, expiresAt: Date.now() + ttlSec * 1000 };
  return token;
}

/**
 * בדיקה עצמית: מאמתת שנתיב ה-App Check עובד מקצה לקצה — **בלי לכתוב ליד.**
 * זה הכלי שמאפשר לאמת את R-5 בפרודקשן בלי להזין נתון של אדם אמיתי
 * (עדי: "אין ליד אמיתי עד ששער עדי נפתח").
 *
 * שימוש בקונסולת הדפדפן:  await MasShevachLeads.selfTest()
 */
export async function selfTest() {
  const cfg = requireConfig();
  const out = { config: true, recaptcha: false, appCheck: false, error: null };
  try {
    if (!cfg.recaptchaSiteKey) throw new Error("no-site-key");
    await loadRecaptcha(cfg.recaptchaSiteKey);
    out.recaptcha = true;
    const token = await getAppCheckToken();
    out.appCheck = Boolean(token);
  } catch (err) {
    out.error = String(err && err.message ? err.message : err);
  }
  console[out.appCheck ? "log" : "error"]("[lead-intake] selfTest:", out);
  return out;
}

// ---------------------------------------------------------------------------
// קידוד ל-Firestore REST
// ---------------------------------------------------------------------------

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function autoId() {
  const bytes = new Uint8Array(20);
  (globalThis.crypto || globalThis.msCrypto).getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 20; i++) out += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  return out;
}

function encodeValue(v) {
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return { integerValue: String(v) };
  if (v && typeof v === "object") {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = encodeValue(val);
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

function encodeFields(doc) {
  const fields = {};
  for (const [k, v] of Object.entries(doc)) fields[k] = encodeValue(v);
  return fields;
}

// ---------------------------------------------------------------------------
// השליחה
// ---------------------------------------------------------------------------

/**
 * שולח ליד. מחזיר { ok, id } או { ok: false, errors } / { ok: false, error }.
 *
 * `input`: { firstName, phone, email?, screened? }
 * `opts`:  { source? }  — פרמטרי utm; אם לא סופקו, נקראים מה-URL.
 */
export async function submitLead(input, opts = {}) {
  const cfg = requireConfig();

  const errors = validateLead(input);
  if (Object.keys(errors).length) return { ok: false, errors };

  const source = opts.source || readUtmParams();
  const doc = buildLead(input, { source, policyVersion: cfg.policyVersion });

  // אסרשן בזמן ריצה: אם משהו בכל זאת החדיר שדה, נעצור כאן ולא נשלח.
  // ה-rules היו דוחות ממילא — אבל שגיאה מקומית מובנת עדיפה על 403 אטום.
  const shape = leadShapeIsValid(doc);
  if (!shape.ok) {
    console.error("[lead-intake] 🔴 מסמך חורג מה-allowlist:", shape);
    return { ok: false, error: "invalid-shape" };
  }

  let appCheckToken = null;
  try {
    appCheckToken = await getAppCheckToken();
  } catch (err) {
    if (cfg.requireAppCheck) {
      console.error("[lead-intake] App Check נכשל:", err);
      return { ok: false, error: "appcheck-failed" };
    }
  }
  if (!appCheckToken && cfg.requireAppCheck) {
    return { ok: false, error: "appcheck-required" };
  }

  const id = autoId();
  const name =
    `projects/${cfg.projectId}/databases/(default)/documents/` +
    `${cfg.collection || "leads"}/${id}`;

  const body = {
    writes: [
      {
        update: { name, fields: encodeFields(doc) },
        // 🔴 createdAt נקבע ע"י השרת. ה-rules דורשות
        //    `createdAt == request.time` (R-3): חותמת שנשלטת ע"י הקליינט
        //    מאפשרת להזיז ליד אל מחוץ לחלון המחיקה של S8.
        updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }],
        // יצירה בלבד — לא דריסה של מסמך קיים.
        currentDocument: { exists: false },
      },
    ],
  };

  const headers = { "Content-Type": "application/json" };
  if (appCheckToken) headers["X-Firebase-AppCheck"] = appCheckToken;

  const base = cfg.firestoreHost || FIRESTORE_HOST;
  const url =
    `${base}/projects/${encodeURIComponent(cfg.projectId)}` +
    `/databases/(default)/documents:commit` +
    (cfg.apiKey ? `?key=${encodeURIComponent(cfg.apiKey)}` : "");

  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.json())?.error?.status || "";
      } catch {
        /* גוף שאינו JSON — לא מעניין */
      }
      console.error("[lead-intake] כתיבה נכשלה:", res.status, detail);
      return { ok: false, error: "write-failed", status: res.status, detail };
    }
    return { ok: true, id };
  } catch (err) {
    console.error("[lead-intake] שגיאת רשת:", err);
    return { ok: false, error: "network" };
  }
}

/**
 * קורא פרמטרי utm מה-URL. **קורא רק את ארבעת המותרים, בשמם.**
 *
 * 🔴 הדפוס: שדה טקסט חופשי **מהמשתמש** שנכנס דרך שכבת האנליטיקס עוקף את
 *    S3 בדלת צדדית — בלי ששום שדה טופס נפתח. ארבעה מופעים אינם נקראים:
 *
 *    ❌ `utm_term` — מילת החיפוש שהמשתמש הקליד. כאן זה עלול להיות
 *       "מכרתי דירה ושילמתי 240 אלף מס".
 *    ❌ `document.referrer` — נושא את שאילתת מנוע החיפוש המפנה.
 *       **המחרוזת `document.referrer` אינה מופיעה בקובץ הזה בכלל**, ויש
 *       על כך אסרשן ב-`npm run check`.
 *    ❌ ה-URL המלא / ה-query string כמחרוזת. הלולאה קוראת מפתחות בשמם
 *       ולעולם לא מעתיקה את `location.search` כמו שהוא.
 *    ❌ `gclid`/`fbclid`/`msclkid` — מזהי קליק שמקשרים את הליד לפרופיל שלו
 *       אצל Google/Meta. הצידוק היחיד להחזיק בהם הוא ייבוא המרות אופליין,
 *       **שנחסם ב-S11(1)**. סיכון קישור בלי שום שימוש מותר —
 *       **ומה שאין לו שימוש מותר, לא נאסף.**
 */
export function readUtmParams() {
  if (typeof window === "undefined") return {};
  try {
    const p = new URLSearchParams(window.location.search);
    const out = {};
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
      const v = p.get(key);
      if (v) out[key] = v;
    }
    return out;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// חיבור לטופס — הממשק שעומר משתמש בו
// ---------------------------------------------------------------------------

/**
 * חיבור אוטומטי לטופס. עומר נותן שמות שדות סטנדרטיים; אנחנו לא נוגעים
 * בעיצוב, בהודעות או ב-DOM מעבר להצגת מצב.
 *
 *   MasShevachLeads.attach({
 *     form: "#lead-form",
 *     onSuccess: () => { ... },   // עומר מציג את הודעת התודה שלו
 *     onError: (errors) => { ... },
 *     screened: () => window.__checkerPassed === true,
 *   });
 *
 * שדות הטופס הצפויים (name=): firstName, phone, email.
 * 🔴 M4 — **אין שדה דיוור.** תיבת ה-opt-in ירדה לגמרי מהמערכת.
 */
export function attach(options = {}) {
  const form =
    typeof options.form === "string" ? document.querySelector(options.form) : options.form;
  if (!form) {
    console.error("[lead-intake] לא נמצא טופס:", options.form);
    return null;
  }

  // חימום בנגיעה הראשונה — לא בטעינת הדף.
  let warmed = false;
  const warm = () => {
    if (warmed) return;
    warmed = true;
    warmUp();
  };
  form.addEventListener("focusin", warm, { once: true });
  form.addEventListener("pointerdown", warm, { once: true });

  let busy = false;

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (busy) return;
    busy = true;

    const fd = new FormData(form);
    const input = {
      firstName: fd.get("firstName") || "",
      phone: fd.get("phone") || "",
      email: fd.get("email") || "",
      // 🔴 M4 — **אין כאן תיבת דיוור.** היא ירדה לגמרי בשער של עדי:
      //    הבטיחה מסרונים בזמן שנשמר אימייל בלבד, האימייל אופציונלי ולכן
      //    הסכמות נפלו בשקט, ולא היה מנגנון הסרה בקוד. עדיף לא לאסוף
      //    מאשר לאסוף חלקית. גם אם הדף ישלח `marketingOptIn` — הוא נופל
      //    ב-`buildLead`, וה-rules דוחות אותו.
      // 🔴 בוליאני יחיד. התשובות עצמן לא עוזבות את הדפדפן.
      screened: typeof options.screened === "function" ? options.screened() === true : false,
    };

    let result;
    try {
      result = await submitLead(input);
    } finally {
      busy = false;
    }

    if (result.ok) {
      // אירוע לעומר/טל. 🔴 נושא **דגל בלבד** — בלי תשובות הבודק ובלי PII.
      // אחרת התשובות דולפות ל-Meta דרך פרמטרי האירוע, בדלת האחורית, אחרי
      // שסגרנו את הדלת הראשית (עדי S11(4)).
      form.dispatchEvent(
        new CustomEvent("mas-shevach:lead-submit", {
          bubbles: true,
          detail: { ok: true, screened: input.screened },
        })
      );
      if (typeof options.onSuccess === "function") options.onSuccess();
      else form.reset();
    } else if (typeof options.onError === "function") {
      options.onError(result.errors || { _: result.error });
    }
  });

  return form;
}

export const FIELDS = LEAD_CREATE_FIELDS;
export const policyVersion = POLICY_VERSION;
