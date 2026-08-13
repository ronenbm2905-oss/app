// ============================================================================
// brand.js — 🟠 **המקום היחיד שבו שם המותג מופיע כטקסט.**
//
// 2026-08-13 — שלומי מסר שם חדש: **Amour Brillant**, ומתחתיו
// "Boutique Diamond Jewelry". השם הקודם ("Absolut") ירד: סקירת עדי 2026-07-26
// מצאה חשש דילול מול Absolut Vodka כסימן מוכר-היטב (ס' 46א לפקודת סימני
// מסחר), והמעבר מרחיק מהמילה — בדיוק כפי שהמליצה.
//
// ⚠️ **השם החדש אינו נעול.** כל שם מצריך clearance משלו: חיפוש ברשם הישראלי
// (סוג 14), חוות דעת עו"ד סימני מסחר, ואימות דומיין. שים לב ש-"Brillant" הוא
// מונח תיאורי בענף (ליטוש בריליאנט) — מה שמשפיע על אופי מבחין. לכן
// `isPlaceholder` נשאר `true` עד אישור.
//
// לכן: אין בקוד שום מחרוזת של שם המותג מלבד כאן. החלפת שם = עריכת הקובץ הזה,
// או — עדיף — עריכה במסך הניהול (settings.brand), בלי לגעת בקוד בכלל.
// ============================================================================

export const BRAND_PLACEHOLDER = {
  // הלוגו נשאר לטיני בשתי השפות — מותג יוקרה צרפתי אינו מתועתק.
  nameHe: "Amour Brillant",
  nameEn: "Amour Brillant",
  suffixHe: "Boutique Diamond Jewelry",
  suffixEn: "Boutique Diamond Jewelry",
  // ⚠️ true = השם עדיין לא עבר clearance. משאירים true עד אישור עדי.
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
