// ============================================================================
// format.js — פורמט מטבע ותאריך לפי locale ומטבע-הנכס.
// המטבע נגזר מהנכס (שדה נפרד), ה-locale נגזר משפת הממשק.
// ============================================================================

const LOCALE_BY_LANG = { he: "he-IL", en: "en-US" };

// מטבע מוצג לפי מטבע-הנכס, אך עם ה-locale של שפת הממשק (הפרדת אלפים/סימן).
export function formatCurrency(amount, currency = "ILS", lang = "he") {
  if (amount === null || amount === undefined || amount === "" || isNaN(amount)) {
    return "—";
  }
  const locale = LOCALE_BY_LANG[lang] || "he-IL";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(amount));
  } catch {
    return `${Number(amount).toLocaleString(locale)} ${currency}`;
  }
}

// מספר בלבד (לתשואה/אחוזים/שטח)
export function formatNumber(value, lang = "he", digits = 0) {
  if (value === null || value === undefined || value === "" || isNaN(value)) return "—";
  const locale = LOCALE_BY_LANG[lang] || "he-IL";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value));
}

export function formatPercent(value, lang = "he", digits = 1) {
  if (value === null || value === undefined || value === "" || isNaN(value)) return "—";
  const locale = LOCALE_BY_LANG[lang] || "he-IL";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value)) + "%";
}

// תאריך לפי locale של שפת הממשק. קלט: ISO (YYYY-MM-DD) או Date.
export function formatDate(iso, lang = "he") {
  if (!iso) return "—";
  const locale = LOCALE_BY_LANG[lang] || "he-IL";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// מספר ימים בין היום לתאריך יעד (חיובי = בעתיד). null אם אין תאריך.
export function daysUntil(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / (1000 * 60 * 60 * 24));
}

// קישור וואטסאפ מטלפון (מסיר תווים לא-ספרתיים; מוסיף קידומת ישראל אם מקומי).
// text אופציונלי → הודעה מוכנה מראש שנפתחת בוואטסאפ (הבעלים יכול לערוך לפני שליחה).
export function whatsappLink(phone, text) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "972" + digits.slice(1);
  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function telLink(phone) {
  if (!phone) return null;
  return `tel:${String(phone).replace(/[^\d+]/g, "")}`;
}
