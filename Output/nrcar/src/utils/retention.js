// ============================================================================
// retention.js — 🔴 N6: תקופות שמירה, ייצוא ומחיקת חשבון — **על אותו cascade**.
//
// שני טעמים בלתי תלויים:
//   1. **פרטיות.** משתמש שנטש לפני שנתיים מותיר סריקות רישיון נהיגה בענן
//      בלי מטרה פעילה. זה כשל מזעור, וזו האחריות הכי גדולה במאגר.
//   2. **שער חנויות.** Apple 5.1.1(v) מחייבת מאז 30.6.2022 יזימת **מחיקת
//      חשבון מתוך האפליקציה**, בצורה שקל למצוא ("השבתה" אינה מספיקה);
//      Google Play מחייבת מסלול מחיקה גם באפליקציה וגם בכתובת אינטרנט
//      (אכיפה מלאה מ-31.5.2024). פרוסה 3 היא Capacitor וחנויות — לגלות את
//      זה בדחיית הגשה עולה פרוסה שלמה. לבנות עכשיו עולה ~40 שורות.
//
// ⚠️ תקופות השמירה עצמן (RETENTION_CLASSES.months) הן ⚖️ עו"ד (L5). כאן רק
// המבנה והפעולה הטכנית. אין scheduler בפרוסה 1 — הפעולה יזומה ע"י המשתמש.
//
// ⚠️ **ארכוב ≠ מחיקה.** רכב שנמכר עובר לארכיון (PRD §7) כדי לשמר היסטוריה
// ומסמכים. ההבחנה נשמרת בקוד ובנוסח, ולא מיטשטשת.
// ============================================================================

import { ENTITY_COLLECTIONS, SERVER_ONLY_COLLECTIONS, ALL_COLLECTIONS, RETENTION_CLASSES } from "../constants.js";

export function retentionClassOf(entity) {
  return entity?.retentionClass || null;
}

export function retentionPolicyFor(entity) {
  const cls = retentionClassOf(entity);
  return cls ? RETENTION_CLASSES[cls] || null : null;
}

// ============================================================================
// איסוף נתיבי Storage. **כל ישות שנושאת fileRef חייבת להיות מכוסה על ידי
// אחד מהאוספים כאן** — נאכף ב-smoke, כי קובץ יתום עם טוקן פעיל הוא בדיוק
// מה שהמחיקה אמורה לסגור.
// ============================================================================
function pathOf(entity, key = "fileRef") {
  const ref = entity?.[key];
  if (!ref) return null;
  if (typeof ref === "string") return ref.startsWith("data:") ? null : ref;
  return ref.storagePath || null;
}

export function collectVehicleStoragePaths(data, vehicleId) {
  const paths = [];
  const vehicle = (data?.vehicles || []).find((v) => v.id === vehicleId);
  const photo = pathOf(vehicle, "photoRef");
  if (photo) paths.push(photo);
  for (const d of data?.documents || []) {
    if (d.vehicleId !== vehicleId) continue;
    const p = pathOf(d);
    if (p) paths.push(p);
  }
  return paths;
}

// מסמכים אישיים של אדם — הרגישים ביותר במאגר.
export function collectDriverStoragePaths(data, driverId) {
  const paths = [];
  for (const d of data?.personalDocs || []) {
    if (d.driverId !== driverId) continue;
    const p = pathOf(d);
    if (p) paths.push(p);
  }
  return paths;
}

export function collectHouseholdStoragePaths(data) {
  const paths = [];
  for (const v of data?.vehicles || []) paths.push(...collectVehicleStoragePaths(data, v.id));
  for (const d of data?.drivers || []) paths.push(...collectDriverStoragePaths(data, d.id));
  // רשת ביטחון: כל ישות עם fileRef שלא נתפסה לעיל (למשל מסמך יתום).
  for (const d of data?.documents || []) {
    const p = pathOf(d);
    if (p && !paths.includes(p)) paths.push(p);
  }
  for (const d of data?.personalDocs || []) {
    const p = pathOf(d);
    if (p && !paths.includes(p)) paths.push(p);
  }
  return [...new Set(paths)];
}

// ============================================================================
// exportHousehold — **זכות העיון של תיקון 13, היום.**
// ~40 שורות מעל ENTITY_COLLECTIONS, אותו מעבר בדיוק של ה-cascade. הערך
// האמיתי הוא מניעת הרגע שבו יש 20,000 משתמשים ואין דרך לענות לפנייה.
// מחזיר { json, files } — הקבצים עצמם מורדים בנפרד (רשימת נתיבים).
// ============================================================================
export function exportHousehold(data, { profile } = {}) {
  const out = {
    exportedAt: new Date().toISOString(),
    schemaVersion: data?.schemaVersion ?? null,
    household: data?.household ?? null,
    settings: data?.settings ?? null,
    profile: profile ?? data?.profile ?? null,
  };
  // ★ עובר על **שתי** הרשימות. אוסף שהשרת בלבד כותב הוא עדיין מידע על נושא
  // המידע, ולכן הוא חלק מזכות העיון — גם אם הקליינט רואה ממנו רק את מה
  // שמופנה אליו (ה-rules מסננים; הייצוא לא מחליט במקומם).
  for (const c of ALL_COLLECTIONS) out[c] = data?.[c] || [];
  return { json: out, files: collectHouseholdStoragePaths(data) };
}

// ============================================================================
// deleteHouseholdPlan — "מה יימחק", לפני שמאשרים.
// המחיקה עצמה מתבצעת ב-cascade.js (Firestore) + files.js (Storage) +
// localCache.js (מכשיר). **שלוש צלעות, לא שתיים.**
// ============================================================================
export function deleteHouseholdPlan(data) {
  const counts = {};
  for (const c of ALL_COLLECTIONS) counts[c] = (data?.[c] || []).length;
  return {
    // מה שהקליינט באמת יכול למחוק בעצמו.
    collections: ENTITY_COLLECTIONS,
    // ⚠️ ומה שהוא **לא** יכול: `allow write: if false` חוסם גם מחיקה.
    // אוספים שהשרת בלבד כותב חייבים להימחק ע"י ה-Cloud Function (Admin SDK)
    // באותה פעולת מחיקת-חשבון. בלי הדגל הזה, `deleteHousehold()` היה משאיר
    // אותם מאחור **בשקט** — וזו בדיוק הצורה שבה "מחיקה" הופכת לתיאורטית.
    serverSideCollections: SERVER_ONLY_COLLECTIONS,
    requiresServerDeletion: SERVER_ONLY_COLLECTIONS.length > 0,
    counts,
    storagePaths: collectHouseholdStoragePaths(data),
    total: Object.values(counts).reduce((a, b) => a + b, 0),
  };
}

// ============================================================================
// anonymizeDriver — נהג שעזב את משק הבית (פרוסה 2 מפעילה; המבנה היום).
// שם וטלפון מוחלפים; המסמכים האישיים שלו **נמחקים** — אין להם מטרה אחרי
// שהוא איננו, ואיש לא רשאי לקרוא אותם ממילא.
// ============================================================================
export function anonymizeDriver(data, driverId) {
  const at = new Date().toISOString();
  const storagePaths = collectDriverStoragePaths(data, driverId);
  return {
    data: {
      ...data,
      drivers: (data.drivers || []).map((d) =>
        d.id === driverId
          ? {
              ...d,
              fullName: "",
              phone: "",
              userUid: null,
              inviteStatus: "revoked",
              status: "archived",
              anonymizedAt: at,
              updatedAt: at,
            }
          : d
      ),
      personalDocs: (data.personalDocs || []).filter((d) => d.driverId !== driverId),
      vehicleAccess: (data.vehicleAccess || []).filter((a) => a.driverId !== driverId),
    },
    storagePaths,
  };
}
