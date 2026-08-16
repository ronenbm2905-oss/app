// ============================================================================
// files.js — העלאה, פתיחה ומחיקה של קבצים.
//
// **הקובץ היחיד באפליקציה שמותר לו לגעת ב-getDownloadURL** (N2, נאכף בסריקה
// סטטית ב-smoke). הסיבה איננה סגנון:
// `getDownloadURL()` מחזיר כתובת עם **טוקן שאינו פג**, ומי שמחזיק בה קורא את
// הקובץ בלי אימות, לנצח. ה-PRD (§8.4) דורש "קישור חתום וזמני" — Firebase לא
// מספק כזה מהקליינט. הפער אינו חוסם deploy בפרוסה 1, אבל **רק** בכפוף
// לחמישה תנאים, וכולם ממומשים כאן:
//   1. הכתובת לעולם לא נכתבת ל-Firestore  → `fileRef` = נתיב בלבד (schema.js)
//   2. הכתובת לעולם לא נכנסת למטמון       → localCache שומר טקסט בלבד
//   3. הכתובת הגולמית לא מגיעה ל-DOM      → fetch→blob→createObjectURL כאן
//   4. אין "שתף מסמך"/"פתח בלשונית חדשה"  → אין פונקציה כזאת בקובץ
//   5. ביטול הטוקן במחיקה                  → deleteStorageObjects ב-cascade
//
// ⚠️ **ואסור לטעון אחרת:** המדיניות ותנאי השימוש של פרוסה 1 לא יאמרו
// "קישורים חתומים וזמניים". הפתרון האמיתי — V4 signed URLs דרך Cloud
// Function — נוחת בפרוסה 2, יחד עם הזמנות הנהגים. זה לא nice-to-have: רק אז
// נוצרים טוקנים על מסמכים של **אדם אחר**.
//
// D4 — **הפשטת EXIF לפני ההעלאה.** תמונה מסמארטפון נושאת GPS, חותמת זמן
// ומזהה מכשיר. ההפשטה נעשית ברי-אנקודינג ל-canvas, שמשמיט את כל המטא-דאטה.
// **אין `navigator.geolocation` בשום מקום בקוד** — גם לא כ"נוחות". ההחלטה
// הזאת נושאת משקל מעבר ל-EXIF: היא מה ששומר על התשובה "אין ניטור שיטתי"
// ומרחיק את חובת ה-DPO.
// ============================================================================

import {
  LOCAL_FILE_MAX_BYTES,
  CLOUD_FILE_MAX_BYTES,
  STORAGE_DOMAINS,
} from "../constants.js";
import { makeFileRef } from "../schema.js";

export const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp,application/pdf";
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function isAcceptedType(type) {
  return ACCEPTED_TYPES.split(",").includes(type);
}

export function isImageType(type) {
  return IMAGE_TYPES.includes(type);
}

// ============================================================================
// הכרעת מוצר: **מסמכים אישיים חסומים במצב fallback מקומי.**
// במצב מקומי הקובץ נשמר base64 ב-localStorage. עבור רישיון נהיגה זו תעודת
// זהות בטקסט גלוי על הדיסק, בלי rules ובלי מחיקה. תמונת רכב במצב מקומי —
// בסדר גמור. ההודעה למשתמש: "כדי לשמור מסמכים אישיים צריך להתחבר לחשבון."
// ============================================================================
export function personalDocsAllowed({ local }) {
  return !local;
}

// מחזיר { ok, errorKey } — אימות לפני העלאה.
export function validateFile(file, { local, domain } = {}) {
  if (!file) return { ok: false, errorKey: "error.upload.title" };
  if (!isAcceptedType(file.type)) return { ok: false, errorKey: "error.upload.type" };
  if (domain === STORAGE_DOMAINS.personal && !personalDocsAllowed({ local })) {
    return { ok: false, errorKey: "error.localMode.docs" };
  }
  const max = local ? LOCAL_FILE_MAX_BYTES : CLOUD_FILE_MAX_BYTES;
  if (file.size > max) return { ok: false, errorKey: "error.upload.tooLarge" };
  return { ok: true, errorKey: null };
}

// ============================================================================
// stripImageMetadata — מחזיר { blob, stripped }.
// תמונה → רי-אנקודינג ל-canvas (מסיר EXIF/GPS). PDF → מוחזר כמות שהוא, עם
// stripped=false: אין כלי אמין לניקוי PDF בצד הלקוח, וה-PDF היחיד שמעלים
// כאן הוא מסמך רשמי סרוק ולא צילום טלפון.
// אוריינטציה נשמרת דרך createImageBitmap({imageOrientation:'from-image'}) —
// canvas מאבד את תג ה-Orientation, וההעתק היה יוצא מסובב.
// ============================================================================
export async function stripImageMetadata(file) {
  if (!isImageType(file.type)) return { blob: file, stripped: false };
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return { blob: file, stripped: false };
  }
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise((res) => canvas.toBlob(res, outType, 0.9));
    if (!blob) return { blob: file, stripped: false };
    return { blob, stripped: true, contentType: outType };
  } catch (err) {
    console.error("EXIF strip failed", err);
    // כישלון הפשטה = לא מעלים. עדיף לחסום מאשר להעלות תמונה עם GPS.
    throw Object.assign(new Error("error.upload.title"), { errorKey: "error.upload.title" });
  }
}

export function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// ============================================================================
// storagePath — ארבעת הדומיינים, מקודדים בנתיב עצמו.
// מחזיר **null** כשחסר מזהה — לא נופלים לנתיב שטוח שכל הכללים מפספסים.
// ============================================================================
export function storagePath({ domain, hid, vehicleId, driverId, docId, fileName }) {
  const household = hid || "local";
  const safe = String(fileName || "file").replace(/[^\w.\-]/g, "_");
  const leaf = `${docId || "item"}_${safe}`;
  switch (domain) {
    case STORAGE_DOMAINS.shared:
      if (!vehicleId) return null;
      return `households/${household}/vehicles/${vehicleId}/shared/${leaf}`;
    case STORAGE_DOMAINS.owner:
      if (!vehicleId) return null;
      return `households/${household}/vehicles/${vehicleId}/owner/${leaf}`;
    case STORAGE_DOMAINS.photo:
      if (!vehicleId) return null;
      return `households/${household}/vehicles/${vehicleId}/photo/${leaf}`;
    case STORAGE_DOMAINS.personal:
      if (!driverId) return null;
      return `households/${household}/people/${driverId}/docs/${leaf}`;
    default:
      return null;
  }
}

// ============================================================================
// uploadFile — מחזיר את שדות הקובץ. `storage` מוזרק (ולא מיובא) כדי שהמודול
// יישאר בדיק ב-Node. תמיד עובר קודם דרך stripImageMetadata.
// **הפלט אינו מכיל כתובת** — רק נתיב, סוג, גודל וחותמת (N2).
// ============================================================================
export async function uploadFile(file, ctx) {
  const { storage } = ctx;
  const local = !storage;
  const check = validateFile(file, { local, domain: ctx.domain });
  if (!check.ok) throw Object.assign(new Error(check.errorKey), { errorKey: check.errorKey });

  const { blob, stripped, contentType } = await stripImageMetadata(file);
  const type = contentType || file.type;

  if (local) {
    // מצב מקומי: base64. מותר לתמונת רכב ולמסמכי רכב, **לא** למסמכים אישיים
    // (נחסם למעלה ב-validateFile).
    const dataUrl = await readAsDataUrl(blob);
    return {
      fileRef: null,
      localData: dataUrl,
      fileName: file.name,
      fileSize: blob.size ?? file.size,
      contentType: type,
      storageMode: "local",
      metadataStripped: stripped,
    };
  }

  const path = storagePath({ ...ctx, fileName: file.name });
  if (!path) throw Object.assign(new Error("error.upload.title"), { errorKey: "error.upload.title" });

  const { ref, uploadBytes } = await import("firebase/storage");
  await uploadBytes(ref(storage, path), blob, { contentType: type });
  return {
    fileRef: makeFileRef({ storagePath: path, contentType: type, size: blob.size ?? file.size }),
    localData: null,
    fileName: file.name,
    fileSize: blob.size ?? file.size,
    contentType: type,
    storageMode: "storage",
    metadataStripped: stripped,
  };
}

// ============================================================================
// openSensitiveDocument — 🔴 **נקודת המעבר היחידה** לכל מסמך.
//
// N2(5) + O9: כל גישה למסמך רגיש עוברת דרך הפונקציה הזאת, בקובץ הזה. מכאן
// שתי תוצאות:
//   · הכתובת הגולמית לעולם לא מגיעה ל-DOM, ל-href, ל-window.open או
//     ל-console. ההבדל המעשי הוא בין "בהיסטוריית הדפדפן, בסימניות ובתפריט
//     השיתוף" לבין "רק ב-devtools".
//   · כשתידרש רמת אבטחה בינונית (מעל 10,000 נושאי מידע → תיעוד גישה
//     אוטומטי לפי תק' 10), הוספת הלוג היא **קובץ אחד ולא פרויקט**.
//     זה ה-seam; הלוג עצמו לא נדרש בפרוסה 1.
//
// מחזיר { url, revoke } — הקורא **חייב** לקרוא ל-revoke() ב-unmount.
// ============================================================================
export async function openSensitiveDocument(doc, { storage, localData, callSignedUrl = null, kind = "documents" } = {}) {
  // מצב מקומי: ה-dataURL עצמו, בלי רשת.
  if (doc?.storageMode === "local") {
    const url = localData || doc.localData || null;
    return url ? { url, revoke: () => {} } : null;
  }

  const path = doc?.fileRef?.storagePath;
  if (!path || !storage) return null;

  // ============================================================================
  // ★ פרוסה 2: **V4 signed URL** מה-Cloud Function — סוגר את N2 ואת PRD §8.4.
  //
  // `getDownloadURL` מחזיר טוקן **קבוע שאינו פג**; ה-signed URL פג אחרי 5
  // דקות. ההנפקה בשרת היא גם נקודת לוג הגישה (O18).
  //
  // אם ה-Function אינה זמינה (תוכנית Spark, או אמולטור בלי Functions) —
  // נופלים חזרה ל-getDownloadURL. **הנפילה הזאת היא הפער הידוע של פרוסה 1**,
  // ולכן היא מסומנת ולא שקטה.
  // ============================================================================
  let signed = null;
  if (callSignedUrl) {
    try {
      const res = await callSignedUrl({ householdId: doc.householdId, docId: doc.id, kind });
      signed = res?.url || null;
    } catch {
      signed = null; // ניפול ל-getDownloadURL למטה
    }
  }
  if (!signed) {
    const { ref, getDownloadURL } = await import("firebase/storage");
    // ⚠️ התוצאה חיה **בזיכרון בלבד**, לא נשמרת בשום מקום ולא נרשמת ללוג.
    signed = await getDownloadURL(ref(storage, path));
  }
  const res = await fetch(signed);
  if (!res.ok) return null;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

// ============================================================================
// deleteStorageObjects — מחיקה שמפלסת גם ל-Storage.
// זה הפער הפתוח מ-property-management: המחיקה שם ניקתה מטא-דאטה מ-Firestore
// והשאירה אובייקטים. כאן זה חלק מה-cascade מהתחלה — וגם מה שמבטל את הטוקן
// הקבוע של הקובץ.
// מחזיר { deleted, failed } — כישלון על אובייקט בודד לא מפיל את השאר.
// ============================================================================
export async function deleteStorageObjects(paths, storage) {
  const list = (paths || []).filter((p) => typeof p === "string" && p && !p.startsWith("data:"));
  if (!list.length || !storage) return { deleted: 0, failed: [] };
  const { ref, deleteObject } = await import("firebase/storage");
  let deleted = 0;
  const failed = [];
  for (const p of list) {
    try {
      await deleteObject(ref(storage, p));
      deleted++;
    } catch (err) {
      if (err?.code === "storage/object-not-found") continue;
      console.error("storage delete failed", p, err);
      failed.push(p);
    }
  }
  return { deleted, failed };
}
