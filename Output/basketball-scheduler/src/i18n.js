// Lightweight i18n scaffolding (spec §14: UI strings wrapped for future translation).
// Default language is Hebrew; strings are used as their own keys. To add a language,
// fill DICTS[lang] with { "עברית": "translation" } and call setLang(lang).
const DICTS = {
  he: {}, // Hebrew is the source language — passthrough
};

let currentLang = "he";

export function setLang(lang) {
  if (DICTS[lang]) currentLang = lang;
}

export function t(str) {
  const dict = DICTS[currentLang] || {};
  return dict[str] ?? str;
}
