import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { translate, DIR_BY_LANG, DEFAULT_LANG, LANGS } from "../i18n.js";

const I18nContext = createContext(null);
const STORAGE_KEY = "fleet_lang";

// initialLang — כפיית שפה מבחוץ. משמש בבדיקות הרינדור (node, בלי localStorage)
// כדי לרנדר את אותו מסך בשתי השפות; באפליקציה עצמה הוא לא מועבר.
export function I18nProvider({ children, initialLang = null }) {
  const [lang, setLang] = useState(() => {
    if (initialLang && LANGS.includes(initialLang)) return initialLang;
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return saved && LANGS.includes(saved) ? saved : DEFAULT_LANG;
  });

  // מסנכרן dir/lang על <html> בכל שינוי שפה — RTL לעברית, LTR לאנגלית.
  useEffect(() => {
    const dir = DIR_BY_LANG[lang] || "rtl";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);
  const toggleLang = useCallback(() => setLang((p) => (p === "he" ? "en" : "he")), []);
  const dir = DIR_BY_LANG[lang] || "rtl";

  return (
    <I18nContext.Provider value={{ lang, setLang, toggleLang, t, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
