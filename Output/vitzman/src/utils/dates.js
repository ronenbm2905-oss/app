// ============================================================================
// dates.js — עבודה בתאריכי ISO ("YYYY-MM-DD") כמחרוזות.
//
// למה מחרוזות ולא `Date`: התאריכים כאן הם **ימי לוח**, לא רגעים בזמן. אובייקט
// `Date` נושא אזור זמן, ו-`new Date("2026-08-30")` נקרא כחצות UTC — מה שהופך
// אותו ל-29.8 בשעה 21:00 בישראל ומזיז תאריך יעד ביום שלם. השוואת מחרוזות ISO
// היא לקסיקוגרפית ולכן גם כרונולוגית, בלי אזורי זמן ובלי הפתעות.
// ============================================================================

export const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const isISODate = (s) => typeof s === "string" && ISO.test(s) && !Number.isNaN(Date.parse(s));

/** היום, בשעון המקומי של המשתמש (ולא ב-UTC). */
export function todayISO(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * הוספת חודשים.
 *
 * גלישת סוף-חודש נחתכת ליום האחרון של חודש היעד: 31.1 + חודש = 28.2, ולא 3.3.
 * ברירת המחדל של JS (`setMonth`) גולשת קדימה — ואז "בדיקה כל חודש" הופכת
 * בהדרגה ל"בדיקה כל 31 יום" ומזדחלת על פני השנה.
 */
export function addMonths(iso, months) {
  if (!isISODate(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const total = (y * 12 + (m - 1)) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  const p = (n) => String(n).padStart(2, "0");
  return `${ny}-${p(nm + 1)}-${p(nd)}`;
}

/** מספר הימים מ-`from` עד `to`. שלילי = `to` כבר עבר. */
export function daysBetween(from, to) {
  if (!isISODate(from) || !isISODate(to)) return null;
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
}

/** תצוגה בעברית: "2026-08-30" → "30.08.2026". */
export function fmtDate(iso) {
  if (!isISODate(iso)) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** "בעוד 3 חודשים" / "לפני 12 יום" — טקסט יחסי קצר. */
export function fmtRelative(days) {
  if (days == null) return "—";
  const abs = Math.abs(days);
  const unit = abs >= 60 ? `${Math.round(abs / 30)} חודשים` : `${abs} יום`;
  if (days === 0) return "היום";
  return days > 0 ? `בעוד ${unit}` : `לפני ${unit}`;
}
