import he from "./he.js";
import en from "./en.js";

export const LANGS = ["he", "en"];
export const DEFAULT_LANG = "he";
export const DIR_BY_LANG = { he: "rtl", en: "ltr" };
export const LOCALE_BY_LANG = { he: "he-IL", en: "en-IL" };

const DICTS = { he, en };

function lookup(dict, key) {
  let node = dict;
  for (const part of key.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

// {name} → vars.name. חסר מתורגם למחרוזת ריקה ולא ל-"undefined" על המסך.
function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? "" : String(vars[k])));
}

export function translate(lang, key, vars) {
  const raw = lookup(DICTS[lang] || DICTS[DEFAULT_LANG], key) ?? lookup(DICTS[DEFAULT_LANG], key);
  if (raw == null) {
    // מפתח חסר — מדווח לקונסול ומחזיר את החלק האחרון, לא את הנתיב המלא,
    // כדי שמפתח שנשכח לא ייראה כמו "product.spec.carat" על המסך.
    if (typeof console !== "undefined") console.warn("[i18n] missing key:", lang, key);
    return key.split(".").pop();
  }
  return interpolate(raw, vars);
}
