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

// ============================================================================
// תוספת NRCAR (מעבר לקובץ שהועתק מ-fleet): אריתמטיקה של חודשים.
// כל מנוע החידוש נשען עליה — "+12 חודשים" הוא הכלל של טסט וביטוח כאחד.
// נכתבת באותה משמעת: מחרוזות בלבד, בלי אובייקט Date ובלי אזורי זמן.
// ============================================================================

// מספר הימים בחודש (עם שנה מעוברת) — נדרש לקיטום 31 בחודש בן 30.
export function daysInMonth(year, month) {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

// הוספת חודשים ליום. יום שלא קיים בחודש היעד נקטם לסוף החודש:
// 31.01 + חודש = 28/29.02, ו-29.02 + 12 חודשים = 28.02. זה הכלל שמשתמש
// מבוגר מצפה לו ("אותו תאריך בשנה הבאה"), בלי לגלוש לחודש הבא.
export function addMonths(dayStr, months) {
  if (!isDay(dayStr)) return null;
  const n = Number(months);
  if (!Number.isFinite(n)) return null;
  const [y, m, d] = dayStr.split("-").map(Number);
  const totalMonths = y * 12 + (m - 1) + Math.trunc(n);
  const ny = Math.floor(totalMonths / 12);
  const nm = (totalMonths % 12) + 1;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

export function addYears(dayStr, years) {
  return addMonths(dayStr, Number(years) * 12);
}

// ============================================================================
// todayInZone — היום לפי אזור זמן נתון, כמחרוזת "YYYY-MM-DD".
// נדרש ל-scheduler: Cloud Function רצה ב-UTC, והמשתמש חי ב-Asia/Jerusalem.
// בלי זה, תזכורת של "היום" הייתה יוצאת ביום הלא נכון בקצוות היממה.
// משתמש ב-Intl ולא באריתמטיקת offset — שעון קיץ.
// ============================================================================
export function todayInZone(timeZone = "Asia/Jerusalem", now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return isDay(parts) ? parts : todayIso(now);
}

// השעה (0-23) באזור זמן נתון — הבורר של notificationHour.
export function hourInZone(timeZone = "Asia/Jerusalem", now = new Date()) {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false }).format(now);
  const n = Number(h);
  return Number.isFinite(n) ? n % 24 : now.getHours();
}

// הפרש שעות בין שתי חותמות ISO מלאות. null כשאחת מהן חסרה.
export function hoursBetween(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (b - a) / 3600000;
}

// המוקדם/המאוחר מבין ימים; ערכים לא-תקינים מסוננים. null כשאין אף אחד.
export function minDay(...days) {
  const valid = days.filter(isDay);
  return valid.length ? valid.reduce((a, b) => (a <= b ? a : b)) : null;
}

export function maxDay(...days) {
  const valid = days.filter(isDay);
  return valid.length ? valid.reduce((a, b) => (a >= b ? a : b)) : null;
}
