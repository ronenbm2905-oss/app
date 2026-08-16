// ============================================================================
// signedUrls.js — ★ V4 signed URLs. **סוגר את N2 ואת דרישת PRD §8.4.**
//
// ============================================================================
// מה בדיוק היה שבור בפרוסה 1, ומה נסגר כאן:
//
// `getDownloadURL()` של ה-SDK מחזיר כתובת עם **טוקן קבוע שאינו פג**. מי
// שמחזיק בה קורא את הקובץ לנצח, בלי אימות ובלי קשר ל-rules. ה-PRD דרש
// "קישור חתום וזמני" — ופרוסה 1 **לא עמדה בזה**, והצהירה על כך במפורש.
//
// V4 signed URL הוא הדבר האמיתי: חתום ע"י חשבון השירות, **פג אחרי 5 דקות**,
// ואינו ניתן לביטול-לאחר-מעשה כי הוא ממילא מת מעצמו.
//
// ⚠️ וזו גם הסיבה שהפרצה שנמצאה ב-storage.rules הייתה כה חמורה: היא איפשרה
// **הנפקת טוקן קבוע** על מסמך הזהות של אדם אחר. כאן אין טוקן קבוע להנפיק.
//
// עדי קבעה שזה **תנאי לשחרור הזמנות נהגים** — כי רק אז נוצרים טוקנים על
// מסמכים של אדם אחר.
// ============================================================================
//
// ההרשאה נבדקת **כאן, בשרת**, באותה לוגיקה בדיוק של `firestore.rules`:
// `utils/access.js` מיובא ולא משוכפל. Admin SDK עוקף rules, ולכן הבדיקה
// הזאת היא ההגנה היחידה — בדיוק כמו ב-reminderLog.
// ============================================================================

import { canReadPersonalDoc, isOwner, hasVehicleAccess } from "../../src/utils/access.js";
import { SIGNED_URL_TTL_MINUTES } from "../../src/constants.js";

export class AccessError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// ============================================================================
// resolveDocumentAccess — טהורה: האם ה-uid רשאי לקרוא את המסמך.
// מחזירה את נתיב ה-Storage, או זורקת.
// ============================================================================
export function resolveDocumentAccess({ household, doc, kind, uid, vehicleAccess = [] }) {
  if (!doc) throw new AccessError("not-found", "document not found");

  if (kind === "personalDocs") {
    // 🔴 נושא המידע בלבד. **גם לא הבעלים** — זו ההכרעה של עדי (§1.3(6)),
    // והיא נאכפת כאן שוב כי Admin SDK לא עובר דרך rules.
    if (!canReadPersonalDoc(doc, uid)) throw new AccessError("permission-denied", "not the subject");
  } else {
    const owner = isOwner(household, uid);
    if (!owner) {
      // נהג: רק מסמך `shared` של רכב שהוקצה לו.
      if (doc.visibility !== "shared") throw new AccessError("permission-denied", "owner-only document");
      if (!hasVehicleAccess({ vehicleAccess }, uid, doc.vehicleId)) {
        throw new AccessError("permission-denied", "no access to vehicle");
      }
    }
  }

  const path = doc.fileRef?.storagePath;
  if (!path) throw new AccessError("not-found", "document has no file");
  return path;
}

// ============================================================================
// createSignedUrl — הכתובת עצמה. `bucket` מוזרק כדי שהבדיקות יוכלו לרוץ בלי
// חשבון שירות (האמולטור אינו חותם V4 — ראו README).
// ============================================================================
export async function createSignedUrl(bucket, storagePath, { ttlMinutes = SIGNED_URL_TTL_MINUTES, now = Date.now() } = {}) {
  const [url] = await bucket.file(storagePath).getSignedUrl({
    version: "v4",
    action: "read",
    expires: now + ttlMinutes * 60 * 1000,
  });
  return { url, expiresAt: new Date(now + ttlMinutes * 60 * 1000).toISOString(), ttlMinutes };
}

// ============================================================================
// handleSignedUrlRequest — התזמור: קריאת ההקשר, בדיקת ההרשאה, חתימה.
//
// זו גם **נקודת ה-seam ללוג הגישה** (O9): כשתידרש רמת אבטחה בינונית (מעל
// 10,000 נושאי מידע → תיעוד גישה אוטומטי לפי תק' 10), ההוספה היא כאן —
// קובץ אחד, לא פרויקט. בפרוסה 1 הקורא היחיד היה נושא המידע, ולכן הלוג לא
// נדרש; ברגע שיש נהגים, הוא כן.
// ============================================================================
export async function handleSignedUrlRequest({ db, bucket, uid, householdId, docId, kind }) {
  if (!uid) throw new AccessError("unauthenticated", "sign in required");
  if (!householdId || !docId) throw new AccessError("invalid-argument", "missing householdId or docId");
  if (kind !== "documents" && kind !== "personalDocs") {
    throw new AccessError("invalid-argument", "unknown document kind");
  }

  const hhSnap = await db.collection("households").doc(householdId).get();
  if (!hhSnap.exists) throw new AccessError("not-found", "household not found");
  const household = hhSnap.data().household || {};

  const docSnap = await db.collection("households").doc(householdId).collection(kind).doc(docId).get();
  if (!docSnap.exists) throw new AccessError("not-found", "document not found");

  let vehicleAccess = [];
  if (kind === "documents" && !isOwner(household, uid)) {
    const accessSnap = await db
      .collection("households")
      .doc(householdId)
      .collection("vehicleAccess")
      .where("driverUid", "==", uid)
      .get();
    vehicleAccess = accessSnap.docs.map((d) => d.data());
  }

  let path = null;
  let granted = false;
  try {
    path = resolveDocumentAccess({ household, doc: docSnap.data(), kind, uid, vehicleAccess });
    granted = true;
  } finally {
    // ============================================================================
    // ★ O18 — **לוג הגישה, ממומש עכשיו ולא רק כ"סדק".**
    //
    // הנפקת V4 מחייבת חשבון שירות, ולכן היא קורית בשרת — נקודת מעבר יחידה
    // לכל גישה למסמך. זה בדיוק ה-seam של O9, והוא מגיע כאן כמעט בחינם.
    // סף רמת האבטחה הבינונית (10,000 נושאי מידע) דורש תיעוד גישה אוטומטי.
    //
    // ⚠️ מה שנרשם: מי, איזה מסמך, מתי, והאם אושר. **לא הקישור עצמו, ולא IP.**
    // נרשמות גם דחיות — לוג שמתעד רק הצלחות אינו ראיה.
    // ============================================================================
    await db
      .collection("households")
      .doc(householdId)
      .collection("accessLog")
      .add({
        actorUid: uid,
        docId,
        docType: kind,
        at: new Date().toISOString(),
        granted,
        householdId,
        retentionClass: "operational-short",
      })
      .catch(() => {});
  }
  return createSignedUrl(bucket, path);
}
