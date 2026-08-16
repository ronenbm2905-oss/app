// ============================================================================
// emergency.js — כרטיס החירום. **פונקציה טהורה אחת**, בלי כפילות PII
// ב-Firestore: הכרטיס נבנה מהנתונים שכבר קיימים, ולא נשמר כישות נוספת.
//
// ============================================================================
// 🔴 חוק הברזל של המסך הזה — הסעיף החשוב ביותר בכל התכנון:
//
//   **אין שום נתיב קריאה לא-מאומת. אין קישור ציבורי, אין QR עם signed URL,
//   ואין "מצב חירום" שעוקף Auth.**
//
// זו הדלת היחידה שיקר באמת לסגור בדיעבד. הלחץ להוסיף "QR למגן דוד אדום"
// יגיע, והוא יישמע הגיוני. הוא לא. השער היחיד הוא סשן מאומת קיים
// (`settings.emergencyAuth: "session"`), והוא נבדק ב-EmergencyScreen לפני
// שהמסך מרונדר בכלל.
// ============================================================================
//
// שלושה כללי מיזעור שנאכפים כאן ובבדיקות (O7 + הדרישה של עדי 1.1ב):
//   1. **פרטי הבעלים = שם + טלפון בלבד.** בלי כתובת, בלי מייל, בלי מזהים.
//      מה שלא על המסך לא דולף — וזה המסך שנפתח כשמישהו אחר עשוי להחזיק את
//      הטלפון הפתוח.
//   2. **המסך אינו דפדפן מסמכים.** הוא מציג את מסמכי החירום של הרכב הזה
//      (`shared` בלבד) ואת רישיון הנהיגה **של המשתמש עצמו**. לעולם לא
//      דומיין `owner/`, ולעולם לא `personalDocs` של אדם אחר.
//   3. **הכרטיס הוא טקסט בלבד** — ולכן הוא גם ניתן לשמירה במטמון וגם
//      **התשובה הנגישותית**: סריקה היא בלתי-נגישה במהותה לקורא מסך, אבל
//      לוחית, מבטח, מספר פוליסה ותאריכים קיימים כאן כטקסט.
// ============================================================================

import { STORAGE_DOMAINS } from "../constants.js";
import { ownerContactProjection } from "./access.js";
import { vehicleLabel } from "./options.js";
import { formatPlate } from "./mot.js";
import { emergencyCacheKey, readEmergencyCache, writeEmergencyCache } from "./localCache.js";

export { emergencyCacheKey };

// המסמכים שנחוצים בזירת תאונה — ורק הם. שניהם `shared` בברירת המחדל, כי
// נהג שנעצר חייב אותם. פוליסה וקבלות **אינן** כאן: הן `owner`, לתמיד.
export const EMERGENCY_DOC_TYPES = ["vehicleLicence", "compulsory"];

const DOC_LABEL_KEY = {
  vehicleLicence: "emergency.doc.vehicleLicence",
  compulsory: "emergency.doc.compulsory",
  drivingLicence: "emergency.doc.drivingLicence",
};

// ============================================================================
// buildEmergencyCard — טהורה, JSON-serializable, בלי תוכן קבצים.
// מחזירה null כשאין רכב.
// ============================================================================
export function buildEmergencyCard({ data, vehicleId, uid, profile } = {}) {
  const vehicle = (data?.vehicles || []).find((v) => v.id === vehicleId);
  if (!vehicle) return null;

  // (2) מסמכי רכב: הסוגים של זירת התאונה, ו-**רק** מדומיין shared.
  // הבדיקה על `storageDomain` היא החגורה; הבדיקה על `visibility` היא הכתפיות.
  const documents = (data?.documents || [])
    .filter(
      (d) =>
        d.vehicleId === vehicleId &&
        EMERGENCY_DOC_TYPES.includes(d.type) &&
        d.visibility === "shared" &&
        d.storageDomain === STORAGE_DOMAINS.shared
    )
    .map((d) => ({
      id: d.id,
      type: d.type,
      labelKey: DOC_LABEL_KEY[d.type] || "doc.type.other",
      storageDomain: d.storageDomain,
      available: Boolean(d.fileRef || d.localData),
    }));

  // (2) מסמך אישי: **של המשתמש עצמו בלבד.** גם הבעלים לא רואה של אחר.
  const personal = (data?.personalDocs || [])
    .filter((d) => d.driverUid && uid && d.driverUid === uid)
    .map((d) => ({
      id: d.id,
      type: d.type,
      labelKey: DOC_LABEL_KEY[d.type] || "doc.type.drivingLicence",
      storageDomain: STORAGE_DOMAINS.personal,
      driverUid: d.driverUid,
      available: Boolean(d.fileRef),
    }));

  return {
    vehicleId,
    label: vehicleLabel(vehicle),
    plate: vehicle.plate || "",
    plateFormatted: vehicle.plate ? formatPlate(vehicle.plate) : "",
    manufacturer: vehicle.manufacturer || "",
    commercialName: vehicle.commercialName || vehicle.model || "",
    year: vehicle.year ?? null,
    color: vehicle.color || "",
    insurer: {
      name: vehicle.insurerName || "",
      policyNumber: vehicle.policyNumber || "",
      phone: vehicle.insurerEmergencyPhone || "",
    },
    // (1) O7 — שם + טלפון. הפונקציה היא היחידה שמייצרת את הבלוק הזה.
    owner: ownerContactProjection(profile),
    documents,
    personal,
    builtAt: new Date().toISOString(),
  };
}

// ============================================================================
// המטמון — N1. הכרטיס **הטקסטואלי** בלבד (`emergencyOffline: "text"`).
// המפתח כולל uid, והניקוי הוא צלע שלישית ב-cascade (localCache.js).
// ⚠️ מה שלא נכנס לכאן, לעולם: כתובות הורדה. URL במטמון = מאגר טוקנים קבועים
// על המכשיר — בדיוק מה שניסינו למנוע.
// ============================================================================
export function cacheEmergencyCard(uid, card) {
  if (!uid || !card?.vehicleId) return false;
  return writeEmergencyCache(uid, card.vehicleId, card);
}

export function readCachedCard(uid, vehicleId) {
  const raw = readEmergencyCache(uid, vehicleId);
  if (!raw?.card) return null;
  return { card: raw.card, savedAt: raw.savedAt || null };
}

// בדיקת שפיות שנקראת גם מה-smoke: הכרטיס לא נושא שום הפניה לדומיין owner/
// ולא מסמך אישי של אדם אחר.
export function cardLeaks(card, uid) {
  const leaks = [];
  for (const d of card?.documents || []) {
    if (d.storageDomain === STORAGE_DOMAINS.owner) leaks.push(`owner-domain:${d.id}`);
  }
  for (const d of card?.personal || []) {
    if (d.driverUid !== uid) leaks.push(`foreign-personal:${d.id}`);
  }
  return leaks;
}
