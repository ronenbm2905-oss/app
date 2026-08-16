// ============================================================================
// format.js — עיצוב מספרים/תאריכים לפי שפה. בלי מחרוזות ממשק (i18n בנפרד).
//
// ⚠️ כל ערך שיוצא מכאן חייב להיות מוצג בתוך אלמנט עם המחלקה `.num`
// (direction:ltr; unicode-bidi:isolate; tabular-nums). בלי זה, בעמוד RTL
// המקפים והספרות של לוחית רישוי, תאריך ומספר טלפון מתהפכים.
// ============================================================================

import { LOCALE_BY_LANG } from "../constants.js";

export function localeOf(lang) {
  return LOCALE_BY_LANG[lang] || "he-IL";
}

export function formatNumber(value, lang = "he", digits = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(localeOf(lang), {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(n);
}

export function formatKm(value, lang = "he") {
  if (value === null || value === undefined || value === "") return "—";
  return `${formatNumber(value, lang)} ${lang === "he" ? 'ק"מ' : "km"}`;
}

// תאריך-יום "YYYY-MM-DD" → תצוגה מקומית. שירה קבעה `דד.חח.שששש` לעברית.
export function formatDate(day, lang = "he") {
  if (!day) return "—";
  const head = String(day).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return String(day);
  const [y, m, d] = head.split("-");
  return lang === "he" ? `${d}.${m}.${y}` : `${d}/${m}/${y}`;
}

export function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// telLink — קישור חיוג. **קישורי tel: בלבד, לעולם לא חיוג תכנותי.**
// זו הכרעה מהתכנון: אפליקציה שמחייגת בעצמה בזירת תאונה היא אפליקציה
// שמחייגת בטעות. המשתמש לוחץ, מערכת ההפעלה שואלת, הוא מאשר.
// ============================================================================
export function telLink(phone) {
  const clean = String(phone || "").replace(/[^\d+]/g, "");
  return clean ? `tel:${clean}` : null;
}

// תצוגת טלפון ישראלי: 050-0000000.
export function formatPhone(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("0")) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length === 9 && d.startsWith("0")) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return String(phone || "");
}
