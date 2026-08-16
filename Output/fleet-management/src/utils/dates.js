// ============================================================================
// dates.js — עבודה עם תאריכי-יום כמחרוזות "YYYY-MM-DD".
// כל ההשוואות לקסיקוגרפיות (בטוח כי הפורמט קבוע-אורך) — בלי Date, בלי אזורי זמן.
// זו החלטה מכוונת: `new Date("2026-05-10")` הוא UTC ומזיז יום אחורה בישראל.
// ============================================================================

export function todayIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isDay(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// השוואת ימים: -1 / 0 / 1. ערכים לא-תקינים נחשבים שווים (0) — הקוראים מסננים.
export function cmpDay(a, b) {
  if (!isDay(a) || !isDay(b)) return 0;
  return a < b ? -1 : a > b ? 1 : 0;
}

// האם `day` נמצא בטווח [from, to] כולל. to=null → פתוח לעד.
export function inRange(day, from, to) {
  if (!isDay(day) || !isDay(from)) return false;
  if (day < from) return false;
  if (to === null || to === undefined || to === "") return true;
  if (!isDay(to)) return true;
  return day <= to;
}

// המרה למספר ימים מאז epoch — לחישובי הפרש בלבד (UTC בשני הצדדים = יציב).
function toDayNumber(day) {
  const [y, m, d] = day.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// הפרש ימים: b - a. null כשאחד מהם לא תקין.
export function daysBetween(a, b) {
  if (!isDay(a) || !isDay(b)) return null;
  return toDayNumber(b) - toDayNumber(a);
}

// כמה ימים נותרו עד `day` ביחס ל-from (ברירת מחדל: היום). שלילי = עבר.
export function daysUntil(day, from = todayIso()) {
  return daysBetween(from, day);
}

export function addDays(day, n) {
  if (!isDay(day)) return null;
  const dt = new Date(Date.UTC(...day.split("-").map((v, i) => (i === 1 ? Number(v) - 1 : Number(v)))));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// יום קודם — משמש לסגירת החזקה קודמת בהחלפת נהג "נקייה".
export function prevDay(day) {
  return addDays(day, -1);
}

// המרת חותמת ISO מלאה ליום, לצורך השוואות.
export function dayOf(isoLike) {
  if (!isoLike) return null;
  if (isDay(isoLike)) return isoLike;
  if (typeof isoLike === "string" && isoLike.length >= 10) {
    const head = isoLike.slice(0, 10);
    return isDay(head) ? head : null;
  }
  return null;
}
