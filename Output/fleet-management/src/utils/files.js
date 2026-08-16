// ============================================================================
// files.js — העלאת קבצים (סריקת קנס, צילום מד, מסמכי רכב, צילומי תאונה).
//
// D4 (חוסם-תכנון, עדי 2026-08-12) — **סטריפ EXIF לפני ההעלאה.**
// תמונה מסמארטפון נושאת קואורדינטות GPS, חותמת זמן ומזהה מכשיר. בלי טיפול,
// כל צילום מד-אוץ' הוא נקודת מיקום של עובד, והאפליקציה הופכת בשקט למערכת
// איכון סמויה. הסטריפ נעשה ע"י רי-אנקודינג ל-canvas, שמשמיט את כל המטא-דאטה.
// אוריינטציה נשמרת דרך createImageBitmap({imageOrientation:'from-image'}),
// כי canvas מאבד את תג ה-Orientation וההעתק היה יוצא מסובב.
// **אין `navigator.geolocation` בשום מקום בקוד** — גם לא כ"נוחות".
//
// D2 — נתיבי Storage מקודדים תחום מהיום הראשון:
//   orgs/{orgId}/fines/{fineId}/...              — סריקות קנס
//   orgs/{orgId}/drivers/{driverId}/odometer/... — צילומי מד
//   orgs/{orgId}/drivers/{driverId}/incidents/...— צילומי תקלה/תאונה
//   orgs/{orgId}/vehicles/{vehicleId}/docs/...   — מסמכי רכב
// הזזת קבצים בדיעבד היא ההגירה הכי כואבת, ולכן זה נקבע עכשיו.
// ============================================================================

import { LOCAL_FILE_MAX_BYTES, CLOUD_FILE_MAX_BYTES, STORAGE_DOMAINS } from "../constants.js";

export const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp,application/pdf";
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function isAcceptedType(type) {
  return ACCEPTED_TYPES.split(",").includes(type);
}

export function isImageType(type) {
  return IMAGE_TYPES.includes(type);
}

// מחזיר { ok, errorKey } — אימות לפני העלאה.
export function validateFile(file, { local }) {
  if (!file) return { ok: false, errorKey: "file.err.none" };
  if (!isAcceptedType(file.type)) return { ok: false, errorKey: "file.err.type" };
  const max = local ? LOCAL_FILE_MAX_BYTES : CLOUD_FILE_MAX_BYTES;
  if (file.size > max) return { ok: false, errorKey: local ? "file.err.tooBigLocal" : "file.err.tooBig" };
  return { ok: true, errorKey: null };
}

// ============================================================================
// stripImageMetadata — D4. מחזיר { blob, stripped }.
// תמונה → רי-אנקודינג ל-canvas (מסיר EXIF/GPS). PDF → מוחזר כמות שהוא,
// עם stripped=false, כי אין לנו כלי אמין לניקוי PDF בצד הלקוח — ה-PDF
// היחיד שמעלים כאן הוא מסמך רשמי סרוק, לא צילום טלפון.
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
    // PNG נשמר PNG (שקיפות); כל השאר → JPEG באיכות סבירה.
    const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise((res) => canvas.toBlob(res, outType, 0.9));
    if (!blob) return { blob: file, stripped: false };
    return { blob, stripped: true, contentType: outType };
  } catch (err) {
    console.error("EXIF strip failed", err);
    // כישלון סטריפ = לא מעלים. עדיף לחסום מאשר להעלות תמונה עם GPS.
    throw Object.assign(new Error("file.err.stripFailed"), { errorKey: "file.err.stripFailed" });
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
// storagePath — D2. הנתיב מקודד את התחום, ולכן storage.rules יכולים לכתוב
// כלל אמיתי לכל תחום. מחזיר null כשחסר מזהה — לא נופלים לנתיב שטוח.
// ============================================================================
export function storagePath({ domain, orgId, fineId, driverId, vehicleId, docId, fileName }) {
  const org = orgId || "local";
  const safe = String(fileName || "file").replace(/[^\w.\-]/g, "_");
  const leaf = `${docId || "item"}_${safe}`;
  switch (domain) {
    case STORAGE_DOMAINS.fine:
      if (!fineId) return null;
      return `orgs/${org}/fines/${fineId}/${leaf}`;
    case STORAGE_DOMAINS.odometer:
      if (!driverId) return null;
      return `orgs/${org}/drivers/${driverId}/odometer/${leaf}`;
    case STORAGE_DOMAINS.incident:
      if (!driverId) return null;
      return `orgs/${org}/drivers/${driverId}/incidents/${leaf}`;
    case STORAGE_DOMAINS.vehicleDoc:
      if (!vehicleId) return null;
      return `orgs/${org}/vehicles/${vehicleId}/docs/${leaf}`;
    default:
      return null;
  }
}

// ============================================================================
// uploadFile — מחזיר את שדות הקובץ. `storage` מוזרק (ולא מיובא) כדי שהמודול
// יישאר בדיק ב-Node. תמיד עובר קודם דרך stripImageMetadata.
// ============================================================================
export async function uploadFile(file, ctx) {
  const { storage } = ctx;
  const local = !storage;
  const check = validateFile(file, { local });
  if (!check.ok) throw Object.assign(new Error(check.errorKey), { errorKey: check.errorKey });

  const { blob, stripped, contentType } = await stripImageMetadata(file);
  const type = contentType || file.type;

  if (local) {
    const dataUrl = await readAsDataUrl(blob);
    return {
      fileRef: dataUrl,
      fileName: file.name,
      fileSize: blob.size ?? file.size,
      contentType: type,
      storageMode: "local",
      metadataStripped: stripped,
    };
  }

  const path = storagePath({ ...ctx, fileName: file.name });
  if (!path) throw Object.assign(new Error("file.err.path"), { errorKey: "file.err.path" });

  const { ref, uploadBytes } = await import("firebase/storage");
  await uploadBytes(ref(storage, path), blob, { contentType: type });
  return {
    fileRef: path,
    fileName: file.name,
    fileSize: blob.size ?? file.size,
    contentType: type,
    storageMode: "storage",
    metadataStripped: stripped,
  };
}

// כתובת לצפייה: במצב מקומי ה-dataURL עצמו; בענן — download URL חתום.
export async function resolveFileUrl(rec, storage) {
  if (!rec || !rec.fileRef) return null;
  if (rec.storageMode === "local") return rec.fileRef;
  if (!storage) return null;
  const { ref, getDownloadURL } = await import("firebase/storage");
  return getDownloadURL(ref(storage, rec.fileRef));
}

// ============================================================================
// deleteStorageObjects — D6. הלקח מ-property-management: המחיקה שם ניקתה
// מטא-דאטה מ-Firestore אבל השאירה אובייקטים ב-Storage. כאן זה נכלל מהתחלה.
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
