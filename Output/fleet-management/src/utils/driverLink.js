// ============================================================================
// driverLink.js — **קישור נהג לחשבון**, כלוגיקה טהורה.
//
// ============================================================================
// למה מייל, ולמה זה עדיין F1
// ============================================================================
// דרישת F1 של עדי: **הבידוד של הנהג לפי `uid` בלבד.** היא נשארת בתוקפה
// במלואה — כל סעיף קריאה ב-firestore.rules נשען על
// `drivers/{id}.userId == request.auth.uid`, ולא על מייל.
//
// המייל משמש **אך ורק לאירוע הקישור החד-פעמי**: האדמין מקליד את הכתובת
// בכרטיס הנהג, בעל הכתובת מתחבר, וה-uid שלו נצרב ברשומה. מרגע זה המייל
// אינו משתתף בשום החלטת הרשאה. זה ההבדל בין "מייל כמפתח גישה מתמשך" (מה
// ש-F1 אוסר אצל 27 נהגים) לבין "מייל כהוכחת זהות חד-פעמית".
//
// ============================================================================
// ⚠️ אין כאן שום הנחה על Google
// ============================================================================
// לפרומול אין חשבונות Google ארגוניים — אומת בפועל: `hildav@promall.co.il`
// לא התקבל בכניסה עם Google, והיא נכנסה מ-Gmail פרטי. החברה על Microsoft 365
// וה-IT חיצוני, ולכן הפעלת ספק Microsoft ב-Firebase תלויה בגורם שלישי ובזמן
// לא ידוע. **לא ממתינים.**
//
// הקישור נשען על `token.email` + `token.email_verified` — שני שדות שקיימים
// **זהים בכל ספק** ב-Firebase Auth. מעבר ל-Microsoft בעתיד הוא הפעלת ספק
// בקונסולה + ניתוק/חיבור מחדש של הנהגים (ה-uid משתנה), ולא שכתוב קוד.
// לכן גם כפתור הניתוק אינו "פיצ'ר לעובד שעוזב" בלבד — הוא כלי ההגירה.
// ============================================================================

import { normalizeEmail, isValidEmail, sameEmail } from "./admins.js";

// הסטטוסים שמהם מותר לתבוע רשומה. **'revoked' אינו כאן** — וזו הנקודה:
// אחרי ניתוק, `userId` חוזר ל-null, ובלי החסימה הזו העובד שעזב היה מקשר
// את עצמו מחדש בלחיצה אחת. חזרה לפורטל דורשת פעולה מפורשת של אדמין.
export const LINKABLE_PORTAL_STATUS = ["none", "invited"];

export function isLinkable(driver, { email, emailVerified } = {}) {
  if (!driver) return false;
  if (!emailVerified) return false;
  const mine = normalizeEmail(email);
  if (!mine || !isValidEmail(mine)) return false;
  // 3.2.4 — השוואה **קנונית**: אצל גימייל, נקודות ו-+alias אינן מבדילות
  // בין תיבות. אותה השוואה בדיוק מבוצעת ב-firestore.rules (canonEmail).
  if (!sameEmail(driver.email, mine)) return false;
  if (driver.userId) return false; // רשומה שכבר מקושרת אינה נתפסת מחדש
  if (!LINKABLE_PORTAL_STATUS.includes(driver.portalStatus || "none")) return false;
  if (driver.status === "archived") return false;
  return true;
}

// findLinkableDriver — הרשומה שהמשתמש הזה רשאי לתבוע. `null` = אין כזו,
// וזה מצב תקין לחלוטין (מישהו שאינו עובד נכנס לקישור).
export function findLinkableDriver(drivers, user) {
  return (drivers || []).find((d) => isLinkable(d, user)) || null;
}

// הנהג שכבר מקושר ל-uid הזה ופעיל. זו הבדיקה שכל שאר המערכת נשענת עליה.
export function linkedDriverForUid(drivers, uid) {
  if (!uid) return null;
  return (
    (drivers || []).find(
      (d) => d.userId === uid && d.portalStatus === "active" && d.status !== "archived"
    ) || null
  );
}

// ============================================================================
// linkFields / unlinkFields — **בדיוק** השדות שנכתבים, ולא אובייקט שלם.
//
// כלל ה-rules דורש `affectedKeys().hasOnly([...])`: הנהג רשאי לקבוע את
// ה-uid שלו ותו לא. אילו הקליינט היה שולח את הרשומה כולה (setDoc/merge על
// מודל שבזיכרון), הכתיבה הייתה נדחית — או גרוע מכך, הייתה עוברת בכלל
// רופף ומאפשרת לעובד לערוך את המחלקה, מספר העובד או ה-notes של עצמו.
// ============================================================================
export const LINK_WRITABLE_KEYS = ["userId", "portalStatus", "portalLinkedEmail", "updatedAt"];

// portalLinkedEmail — הכתובת שאיתה נכנס **בפועל**, לתיעוד בלבד (3.2.1).
// `email` הוא מה שהאדמין הקליד; זה מה ש-Google אימתה. בגימייל השניים
// נבדלים לגיטימית. הכלל אוכף שהערך הוא באמת המייל שבטוקן.
export function linkFields(uid, email, at) {
  return { userId: uid, portalStatus: "active", portalLinkedEmail: normalizeEmail(email), updatedAt: at };
}

// ניתוק: `userId` מתאפס ו-`portalStatus` נצרב 'revoked'. שני החלקים נחוצים —
// איפוס ה-uid לבדו היה מחזיר את הרשומה למצב שאפשר לתבוע מחדש.
export function unlinkFields(at) {
  return { userId: null, portalStatus: "revoked", portalLinkedEmail: null, updatedAt: at };
}

// הזמנה מחדש — הפעולה המפורשת שמחזירה רשומה מנותקת למצב שניתן לקישור.
export function inviteFields(at) {
  return { portalStatus: "invited", invitedAt: at, updatedAt: at };
}

// ============================================================================
// validateDriverLinkEmail — מה שהמסך חוסם לפני שה-rules ידחו.
// שתי כתובות זהות לשני נהגים = שני עובדים שנלחמים על אותה רשומה.
// ============================================================================
export function validateDriverLinkEmail(drivers, driverId, email) {
  const e = normalizeEmail(email);
  if (!e) return [];
  if (!isValidEmail(e)) return ["driverLink.err.email"];
  const clash = (drivers || []).some((d) => d.id !== driverId && d.email && sameEmail(d.email, e));
  return clash ? ["driverLink.err.duplicate"] : [];
}
