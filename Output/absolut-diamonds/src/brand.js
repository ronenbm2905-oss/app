// ============================================================================
// brand.js — 🟠 **המקום היחיד שבו שם המותג מופיע כטקסט.**
//
// למה: סקירת עדי 2026-07-26 — "Absolut" חשוד לדילול מול Absolut Vodka (סימן
// מוכר-היטב, סעיף 46א). מותר לבנות עם placeholder, **אסור להשיק** תחת השם עד
// clearance ברשם (סוג 14) + חוות דעת עו"ד. חלופות משירה: Keter / Tohar /
// AB Atelier.
//
// לכן: אין בקוד שום מחרוזת "Absolut" מלבד כאן. החלפת שם = עריכת הקובץ הזה,
// או — עדיף — עריכה במסך הניהול (settings.brand), בלי לגעת בקוד בכלל.
// ============================================================================

export const BRAND_PLACEHOLDER = {
  nameHe: "אבסולוט",
  nameEn: "Absolut",
  suffixHe: "יהלומים",
  suffixEn: "Diamonds",
  // ⚠️ true = השם עדיין placeholder. משאירים true עד אישור עדי.
  isPlaceholder: true,
};

// שם המותג בפועל: settings.brand גובר על ה-placeholder.
export function brandName(settings, lang = "he") {
  const b = { ...BRAND_PLACEHOLDER, ...(settings?.brand || {}) };
  return lang === "en" ? `${b.nameEn} ${b.suffixEn}`.trim() : `${b.nameHe} ${b.suffixHe}`.trim();
}

export function brandParts(settings, lang = "he") {
  const b = { ...BRAND_PLACEHOLDER, ...(settings?.brand || {}) };
  return lang === "en"
    ? { main: b.nameEn, suffix: b.suffixEn }
    : { main: b.nameHe, suffix: b.suffixHe };
}

export function brandIsPlaceholder(settings) {
  const b = { ...BRAND_PLACEHOLDER, ...(settings?.brand || {}) };
  return b.isPlaceholder !== false;
}
