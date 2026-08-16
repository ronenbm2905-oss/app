import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createHmac } from "node:crypto";
import { HttpsError } from "firebase-functions/v2/https";

if (!getApps().length) initializeApp();

export const db = getFirestore();
export { FieldValue, HttpsError };

export const REGION = "europe-west1";

/**
 * 🔴 R-4 — הרשאה לפי זהות מפורשת, לא לפי "מחובר".
 *
 * שני מסלולים, במקביל ל-firestore.rules:
 *   1. custom claim `role == 'owner'` (מסלול מועדף);
 *   2. allowlist מיילים ב-`OWNER_EMAILS`, עם `email_verified`.
 *
 * ⚠️ ה-allowlist כאן חייב להישאר מסונכרן עם `ownerEmails()` ב-firestore.rules.
 *    `npm run check` מוודא ששניהם אינם ה-placeholder, אבל **אינו** יכול
 *    לוודא שהם זהים — הגדירו את ה-claim ותנו לו להיות מקור האמת.
 */
const OWNER_EMAILS = (process.env.OWNER_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function assertOwner(request) {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "נדרשת התחברות");

  const token = auth.token || {};
  if (token.role === "owner") return auth.uid;
  if (token.email_verified === true && OWNER_EMAILS.includes(String(token.email).toLowerCase())) {
    return auth.uid;
  }
  throw new HttpsError("permission-denied", "החשבון אינו מורשה");
}

/**
 * גיבוב טלפון לרשומת דיכוי.
 *
 * עדי S8(4) ביקשה "טלפון + optedOut + תאריך, בלי שם ובלי הקשר". כאן הטלפון
 * עצמו **אינו נשמר** — רק HMAC שלו. הסיבה נובעת ישירות מסעיף 0(1) של
 * הסקירה: "התוכן הרגיש הוא ההשתייכות למאגר, לא השדה". רשימת טלפונים של מי
 * שפנה לשירות החזרי מס שבח היא בעצמה בדיוק המידע שאנחנו מגינים עליו.
 * הגיבוב שומר על כל התפקוד (בדיקת "האם המספר הזה סירב") ומאפס את ערך הדליפה.
 *
 * ⚠️ `SUPPRESSION_SECRET` חייב להיות מוגדר ויציב. שינוי שלו מנתק את כל
 *    רשומות הדיכוי הקיימות — כלומר מי שסירב יקבל שוב שיחה.
 */
export function hashPhone(phone) {
  const secret = process.env.SUPPRESSION_SECRET;
  if (!secret) throw new HttpsError("failed-precondition", "SUPPRESSION_SECRET אינו מוגדר");
  return createHmac("sha256", secret).update(String(phone)).digest("hex");
}

/**
 * יומן פעולות — תקנות אבטחת מידע 2017, "תיעוד גישה" (עדי R-7).
 * 🔴 הרשומה נושאת מזהה ליד ופעולה, **לא PII**. יומן שמכיל שמות וטלפונים
 *    הוא עותק שני של המאגר, ואז יש שני דברים להגן עליהם במקום אחד.
 */
export async function logOp(actorUid, action, leadId, extra = {}) {
  try {
    await db.collection("opsLog").add({
      actorUid,
      action,
      leadId: leadId ?? null,
      at: FieldValue.serverTimestamp(),
      ...extra,
    });
  } catch (err) {
    console.error("[opsLog] כתיבה נכשלה", err);
  }
}
