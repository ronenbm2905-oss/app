import { LOCALE_BY_LANG } from "../i18n/index.js";

// ============================================================================
// עיצוב מספרים ותאריכים. שתי מלכודות שנתקלנו בהן קודם:
//   1. מחיר בשקלים ב-RTL — Intl מסדר את הסימן נכון, קונקטנציה ידנית לא.
//   2. `null` מחיר ≠ מחיר 0. חייבים להבחין, אחרת "מחיר בפנייה" הופך ל-"₪0".
// ============================================================================

export function formatPrice(value, lang = "he", { decimals = 0 } = {}) {
  if (value == null || Number.isNaN(Number(value))) return null;
  try {
    return new Intl.NumberFormat(LOCALE_BY_LANG[lang] || "he-IL", {
      style: "currency",
      currency: "ILS",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Number(value));
  } catch {
    return `₪${Math.round(Number(value)).toLocaleString("he-IL")}`;
  }
}

// קראט תמיד בשתי ספרות — "1.00 ct" ולא "1 ct". ככה זה בתעודה.
export function formatCarat(value) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(value).toFixed(2);
}

export function formatDate(iso, lang = "he") {
  if (!iso) return "";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(LOCALE_BY_LANG[lang] || "he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

export function formatBytes(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// מספר טלפון ישראלי → פורמט wa.me (ספרות בלבד, קידומת 972).
export function toWhatsappDigits(raw) {
  if (!raw) return "";
  let s = String(raw).replace(/[^\d+]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("00")) s = s.slice(2);
  if (s.startsWith("0")) s = `972${s.slice(1)}`;
  return s.replace(/\D/g, "");
}
