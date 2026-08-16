// ============================================================================
// mot.js — משיכת פרטי רכב ממאגר משרד התחבורה (data.gov.il, CKAN).
//
// אומת בפועל (2026-08-13, לא הונח): התגובה נושאת
// `Access-Control-Allow-Origin: *`, ובקשת GET פשוטה אינה מפעילה preflight →
// **הדפדפן קורא ישירות. אין צורך ב-Cloud Function פרוקסי בפרוסה 1.**
//
// ⚠️ הערה שחייבת לשרוד רפקטור (עדי 1.4, תוספת 2 + R10):
// הקריאה הישירה מהדפדפן היא **ניצחון פרטיות**, לא רק נוחות. השאילתה יוצאת
// מהמכשיר של המשתמש ישירות למרשם ציבורי. אם מישהו יעביר אותה בפרוסה 2
// ל-Cloud Function "בשביל אמינות" — ייווצר לוג שרת של uid→לוחית, כלומר בדיוק
// ה-`lookupLog` שהוחלט **לא** לבנות, רק בלי שאיש החליט על כך.
// כל שינוי כזה הוא טריגר לסקירה מחדש של עדי.
//
// שלוש החלטות נוספות שאושרו ואסור להפוך:
//   1. **אין `lookupLog`** — לא בונים היסטוריית uid→מספר רישוי. המאגר ציבורי
//      ולא מאומת; כל אחד יכול לחפש כל לוחית.
//   2. משיכה **רק** בתוך זרימת הוספה/עריכת רכב, לפעולת משתמש מפורשת.
//      בלי לולאות רענון (מגבלות הקצב של data.gov.il אינן מתועדות).
//   3. התוצאה **אינה** מוצגת כהוכחת בעלות.
//
// ועוד אחת, טכנית וקריטית: **התגובה הגולמית לא נרשמת ללוג.** `console.log(json)`
// בבלוק catch הוא הדליפה הריאלית — הוא מכניס VIN ל-console ולכל כלי ניטור
// עתידי. לכן אין כאן שום לוג של גוף התגובה.
// ============================================================================

import { dayOf } from "./dates.js";

export const MOT = {
  BASE: "https://data.gov.il/api/3/action/datastore_search",
  // רכבים פעילים (פרטי + מסחרי) — ~4.16M רשומות
  ACTIVE: "053cea08-09bc-40ec-8f7a-156f0677aff3",
  // רכבים שהורדו מהכביש / בוטלו
  INACTIVE: "851ecab1-0622-4dbe-a6c7-f950cf82abf9",
};

// ============================================================================
// normalizePlate — **החוד של המודול.**
// `mispar_rechev` הוא עמודה מסוג numeric. מספר רישוי שמוצג "012-34-567"
// חייב להישאל כ-1234567, אחרת ההתאמה נכשלת והמשתמש רואה "לא נמצא" על רכב
// שקיים במאגר. String(Number(digits)) מסיר אפסים מובילים.
// ============================================================================
export function digitsOf(input) {
  return String(input ?? "").replace(/\D/g, "");
}

export function normalizePlate(input) {
  const digits = digitsOf(input);
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(n);
}

// לוחיות בישראל: 7-8 ספרות ברכב פרטי, 5-6 בלוחיות ישנות ובדו-גלגלי.
// מקבלים 5-8 כדי לא לחסום רכב ותיק; ההודעה למשתמש מדברת על 7-8, כי זה
// המקרה השכיח.
export function isValidPlate(input) {
  const len = digitsOf(input).length;
  return len >= 5 && len <= 8;
}

// תצוגה: 7 ספרות → 12-345-67 · 8 ספרות → 123-45-678.
export function formatPlate(input) {
  const d = digitsOf(input);
  if (d.length === 7) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  if (d.length === 8) return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
  return d;
}

// ============================================================================
// buildLookupUrl — משתמש ב-`filters` (התאמה מדויקת על עמודה), **לא** ב-`q`.
// `q` הוא חיפוש חופשי על כל העמודות ויכול להחזיר רכב אחר לגמרי — במוצר
// שמציג "מצאנו את הרכב שלך" זו טעות שהמשתמש לא יכול לזהות.
// ============================================================================
export function buildLookupUrl({ resourceId, plate, limit = 5 }) {
  const normalized = normalizePlate(plate);
  const filters = encodeURIComponent(JSON.stringify({ mispar_rechev: Number(normalized) }));
  return `${MOT.BASE}?resource_id=${encodeURIComponent(resourceId)}&limit=${limit}&filters=${filters}`;
}

// ============================================================================
// mapActiveRecord — **whitelist, לא spread.**
// המאגר מחזיר גם `misgeret` (מספר שלדה/VIN), שה-PRD הסיר במפורש מהמודל
// (§3.1). spread היה מכניס אותו — ואיתו שדות נוספים שאיש לא בחר לאחסן.
// ה-smoke מאמת שלפלט אין מפתח misgeret/vin.
// ============================================================================
export function mapActiveRecord(rec, plateInput) {
  if (!rec) return null;
  return {
    plate: normalizePlate(plateInput ?? rec.mispar_rechev),
    manufacturer: rec.tozeret_nm || "",
    commercialName: rec.kinuy_mishari || "",
    model: rec.degem_nm || "",
    trim: rec.ramat_gimur || "",
    year: Number.isFinite(Number(rec.shnat_yitzur)) ? Number(rec.shnat_yitzur) : null,
    fuelType: rec.sug_delek_nm || "",
    color: rec.tzeva_rechev || "",
    ownershipType: rec.baalut || "",
    lastTestDate: dayOf(rec.mivchan_acharon_dt),
    // ★ tokef_dt — התאריך שזורע את משימת הטסט.
    testValidUntil: dayOf(rec.tokef_dt),
    status: "active",
  };
}

// רכב מבוטל: פחות שדות, ותאריך הביטול הוא מה שמסביר למשתמש מה קרה.
export function mapInactiveRecord(rec, plateInput) {
  if (!rec) return null;
  return {
    plate: normalizePlate(plateInput ?? rec.mispar_rechev),
    manufacturer: rec.tozeret_nm || "",
    commercialName: rec.kinuy_mishari || "",
    model: rec.degem_nm || "",
    trim: rec.ramat_gimur || "",
    year: Number.isFinite(Number(rec.shnat_yitzur)) ? Number(rec.shnat_yitzur) : null,
    fuelType: rec.sug_delek_nm || "",
    color: rec.tzeva_rechev || "",
    ownershipType: rec.baalut || "",
    deregisteredAt: dayOf(rec.bitul_dt),
    status: "deregistered",
  };
}

export function firstRecord(json) {
  const records = json?.result?.records;
  return Array.isArray(records) && records.length ? records[0] : null;
}

// ============================================================================
// lookupVehicle — הזרימה: פעילים → מבוטלים → ידני.
// `fetchImpl` מוזרק כדי שה-smoke יבדוק את המיפוי מול fixtures **בלי רשת**.
// כל הגישה לרשת מאחורי הקובץ הזה → מעבר ל-CapacitorHttp בפרוסה 3 = שינוי
// בקובץ אחד.
//
// מחזיר תמיד אובייקט, לעולם לא זורק: המסך צריך להציג הודעה אנושית ולפתוח
// את הטופס הידני, לא לתפוס חריגה. **לעולם לא "Error 404"** (PRD §9.3).
// ============================================================================
export async function lookupVehicle(plate, { fetchImpl, signal } = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
  const normalized = normalizePlate(plate);

  if (!isValidPlate(plate)) {
    return { found: false, reason: "invalid", plate: normalized, resourceId: null };
  }
  if (!doFetch) {
    return { found: false, reason: "network", plate: normalized, resourceId: null };
  }

  const fetchedAt = new Date().toISOString();

  for (const [resourceId, mapper] of [
    [MOT.ACTIVE, mapActiveRecord],
    [MOT.INACTIVE, mapInactiveRecord],
  ]) {
    let json;
    try {
      const res = await doFetch(buildLookupUrl({ resourceId, plate: normalized }), { signal });
      if (!res || !res.ok) {
        // נפילה למסלול הידני על כל תשובה שאינה 200. בלי retry אוטומטי.
        return { found: false, reason: "network", plate: normalized, resourceId, fetchedAt };
      }
      json = await res.json();
    } catch {
      // ⚠️ בכוונה בלי לוג של השגיאה/הגוף — התגובה הגולמית מכילה VIN.
      return { found: false, reason: "network", plate: normalized, resourceId, fetchedAt };
    }

    const rec = firstRecord(json);
    if (rec) {
      return {
        found: true,
        source: resourceId === MOT.ACTIVE ? "active" : "inactive",
        vehicle: mapper(rec, normalized),
        plate: normalized,
        resourceId,
        fetchedAt,
      };
    }
  }

  return { found: false, reason: "notFound", plate: normalized, resourceId: MOT.ACTIVE, fetchedAt };
}

// מקור המשיכה כפי שהוא נשמר על הרכב — **מינימלי במפורש** (עדי 1.4, תוספת 1).
// בלי `raw`, גם לא "לצורך דיבוג".
export function motSourceFrom(result) {
  return {
    resourceId: result?.resourceId || null,
    fetchedAt: result?.fetchedAt || null,
    found: Boolean(result?.found),
  };
}

// ============================================================================
// mergeMotIntoVehicle — **לעולם לא לדרוס בשקט תאריך שהמשתמש הזין.**
// המאגר הוא snapshot תקופתי: מי שעבר טסט היום עלול לראות ערך ישן. לכן
// המאגר **ממלא שדות ריקים** ומחזיר רשימת התנגשויות להצגה מפורשת.
// מחזיר { vehicle, filled: [שדות שמולאו], conflicts: [{field, mine, mot}] }.
// ============================================================================
export const MOT_FIELDS = [
  "manufacturer",
  "commercialName",
  "model",
  "trim",
  "year",
  "fuelType",
  "color",
  "ownershipType",
  "lastTestDate",
  "testValidUntil",
];

export function mergeMotIntoVehicle(vehicle, motVehicle) {
  const filled = [];
  const conflicts = [];
  const next = { ...vehicle };

  for (const f of MOT_FIELDS) {
    const incoming = motVehicle?.[f];
    if (incoming === null || incoming === undefined || incoming === "") continue;
    const current = vehicle?.[f];
    const isEmpty = current === null || current === undefined || current === "";
    if (isEmpty) {
      next[f] = incoming;
      filled.push(f);
    } else if (String(current) !== String(incoming)) {
      conflicts.push({ field: f, mine: current, mot: incoming });
    }
  }

  return { vehicle: next, filled, conflicts };
}
