import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { translate, DIR_BY_LANG, DEFAULT_LANG, LANGS } from "../i18n.js";

const I18nContext = createContext(null);

const STORAGE_KEY = "pm_lang";

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
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
  const toggleLang = useCallback(
    () => setLang((prev) => (prev === "he" ? "en" : "he")),
    []
  );

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
