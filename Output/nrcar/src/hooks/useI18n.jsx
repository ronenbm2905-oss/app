import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { translate, DIR_BY_LANG, DEFAULT_LANG, LANGS } from "../i18n/index.js";
import { LOCAL_LANG_KEY } from "../constants.js";

const I18nContext = createContext(null);

// initialLang — כפיית שפה מבחוץ, לבדיקות רינדור. באפליקציה לא מועבר.
export function I18nProvider({ children, initialLang = null }) {
  const [lang, setLang] = useState(() => {
    if (initialLang && LANGS.includes(initialLang)) return initialLang;
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(LOCAL_LANG_KEY) : null;
    return saved && LANGS.includes(saved) ? saved : DEFAULT_LANG;
  });

  // ⚠️ WCAG 3.1.1 — החלפת שפה **חייבת** לעדכן את <html lang> ואת dir.
  // זה טריוויאלי, וזה נופל תמיד.
  useEffect(() => {
    const dir = DIR_BY_LANG[lang] || "rtl";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    try {
      localStorage.setItem(LOCAL_LANG_KEY, lang);
    } catch {
      /* מצב פרטי — לא נורא */
    }
  }, [lang]);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);
  const toggleLang = useCallback(() => setLang((p) => (p === "he" ? "en" : "he")), []);
  const dir = DIR_BY_LANG[lang] || "rtl";

  return (
    <I18nContext.Provider value={{ lang, setLang, toggleLang, t, dir }}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
