// ============================================================================
// format.js — עיצוב מספרים/מטבע/תאריכים לפי שפה. בלי מחרוזות ממשק (i18n בנפרד).
// ============================================================================

import { LOCALE_BY_LANG, CURRENCY } from "../constants.js";

export function localeOf(lang) {
  return LOCALE_BY_LANG[lang] || "he-IL";
}

export function formatCurrency(value, lang = "he", currency = CURRENCY) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat(localeOf(lang), {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${Math.round(n)} ${currency}`;
  }
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

// תאריך-יום "YYYY-MM-DD" → תצוגה מקומית. מחזיר "—" לערך חסר.
export function formatDate(day, lang = "he") {
  if (!day) return "—";
  const head = String(day).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return String(day);
  const [y, m, d] = head.split("-");
  return lang === "he" ? `${Number(d)}.${Number(m)}.${y}` : `${d}/${m}/${y}`;
}

export function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// קישור חיוג ו-WhatsApp לאיש קשר של חברת הליסינג.
export function telLink(phone) {
  const clean = String(phone || "").replace(/[^\d+]/g, "");
  return clean ? `tel:${clean}` : null;
}

export function whatsappLink(phone) {
  let clean = String(phone || "").replace(/[^\d]/g, "");
  if (!clean) return null;
  if (clean.startsWith("0")) clean = `972${clean.slice(1)}`;
  return `https://wa.me/${clean}`;
}
