// ============================================================================
// i18n/index.js — עברית + אנגלית מהיום הראשון, key-based (אין מחרוזות ממשק
// קשיחות בקוד הרכיבים). מפוצל לקבצים לפי שפה **מהיום הראשון**: i18n.js של
// fleet הגיע ל-809 שורות בקובץ אחד, וזה בדיוק הרגע שבו parity נשבר בלי
// שאיש שם לב.
//
// מפתח חסר מוחזר כפי שהוא (fail-visible), ובדיקת ה-smoke אוכפת parity מלא.
// ============================================================================

import he from "./he.js";
import en from "./en.js";

export const LANGS = ["he", "en"];
export const DIR_BY_LANG = { he: "rtl", en: "ltr" };
export const DEFAULT_LANG = "he";

const dict = { he, en };

// ============================================================================
// translate — עם **נסיגת ווריאנט**: מפתח שנגמר ב-`.one`/`.two` ולא קיים
// נופל למפתח הבסיס. זה מה שמאפשר לשירה לספק `.two` רק היכן שהמספר 2 באמת
// מופיע ("יומיים" במקום "2 ימים"), בלי לחייב אותה לכתוב ווריאנט לכל דלי.
// ============================================================================
export function translate(lang, key, vars) {
  const table = dict[lang] || dict[DEFAULT_LANG];
  let s = table[key];

  if (s === undefined && /\.(one|two)$/.test(key)) {
    const baseKey = key.replace(/\.(one|two)$/, "");
    s = table[baseKey];
    if (s === undefined) s = dict[DEFAULT_LANG][baseKey];
  }

  if (s === undefined) s = dict[DEFAULT_LANG][key];
  if (s === undefined) return key; // fail-visible

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

export default dict;
