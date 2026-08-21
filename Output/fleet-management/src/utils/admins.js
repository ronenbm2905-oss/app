// ============================================================================
// admins.js — **allowlist של מיילים** כמודל הגישה של האדמינים.
//
// הדפוס מ-Output/basketball-scheduler, שחי בפרודקשן אצל אותו משתמש:
//   • מזהה הארגון קבוע בזמן build (VITE_FLEET_ORG_ID / שם VITE_CLUB_ID);
//   • הגישה נקבעת ע"י מערך מיילים **בתוך מסמך הארגון**;
//   • מוסיפים מייל → הבעלים של המייל מתחבר → הוא בפנים. זה הכל.
// אין מיפוי uid→ארגון, אין הזמנות, אין תביעה ואין מצב-ביניים. פחות מצבים =
// פחות מה שיכול להישבר.
//
// ============================================================================
// ⚠️ הגבול: allowlist לפי מייל הוא **לאדמינים בלבד**
// ============================================================================
// דרישת F1 של עדי נשארת בתוקפה: **הבידוד של הנהגים בפרוסה 2 יהיה לפי `uid`,
// לא לפי מייל.** אדמינים הם קבוצה קטנה ומוכרת (כאן: שניים), ושם הסיכון
// ש"מייל עבודה עובר לעובד אחר" הוא מידתי ומנוהל. אצל 27 נהגים, שם יושב
// ה-PII הפרטני — קנסות בשם עובד, סריקות, דיווחי ק"מ — זה לא מקובל, ולכן
// `access.js:driverForUid` ממשיך להשוות `d.userId === uid` ולא מייל.
//
// ⚠️ זו אינה שכבת אכיפה. האכיפה היא ב-firestore.rules בלבד; זה הביטוי הבדיק
// שלה, בדיוק כמו access.js.
// ============================================================================

// -- נרמול -----------------------------------------------------------------
// המערך מוחזק **תמיד lowercase ומקוצץ**, כי זה מה שה-rules משוות אליו
// (`request.auth.token.email.lower()`). כל נרמול אחר = אדמין שלא נכנס.
export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

// ולידציה מכוונת-מינימום: לא "כל RFC 5322", אלא מה שמונע טעות הקלדה שתייצר
// רשומה שאף אחד לא יוכל להיכנס איתה.
export function isValidEmail(email) {
  const e = normalizeEmail(email);
  if (!e || e.length > 254) return false;
  if (/\s/.test(e)) return false;
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(e);
}

// -- קריאת המצב מהמודל ------------------------------------------------------

// adminEmails — הרשימה המנורמלת, ללא כפילויות, ממוינת.
export function adminEmails(org) {
  const raw = Array.isArray(org?.adminEmails) ? org.adminEmails : [];
  return [...new Set(raw.map(normalizeEmail).filter(Boolean))].sort();
}

// isOrgAdminEmail — הביטוי הבדיק של `isOrgAdmin` ב-rules.
// ⚠️ `emailVerified` הוא חלק מהתנאי ולא קוסמטיקה: בלעדיו כל אחד היה נרשם
// ב-Firebase Auth עם כתובת שאינה שלו ונכנס לצי.
export function isOrgAdminEmail(org, user) {
  if (!user?.emailVerified) return false;
  const e = normalizeEmail(user?.email);
  if (!e) return false;
  return adminEmails(org).includes(e);
}

// ============================================================================
// legacy — מפת `org.members` (uid→role) נשארת בסכימה לתאימות לאחור, ו-rules
// מכירות בה כמסלול חלופי. **אנחנו לא נשענים עליה**, אבל היא חייבת להישאר
// חיה בגלל דבר אחד קונקרטי: מסמך הארגון **שכבר בענן** לא מכיל `adminEmails`.
// לו הכללים היו דורשים מייל בלבד, ה-deploy היה **נועל את המשתמש מחוץ לצי
// שלו** — ואף אחד לא היה יכול להוסיף את המייל הראשון, כי לכך צריך גישה.
// המסלול הזה הוא גשר ההגירה, והוא נסגר מעצמו ברגע שהרשימה מאוכלסת.
// ============================================================================
export function isLegacyMemberAdmin(org, uid) {
  return Boolean(uid) && (org?.members || {})[uid] === "admin";
}

export function hasAdminAccess(org, user) {
  return isOrgAdminEmail(org, user) || isLegacyMemberAdmin(org, user?.uid);
}

// ============================================================================
// validateAddAdmin — מה שהמסך חוסם **לפני** שה-rules ידחו.
// מחזיר מערך מפתחות שגיאה (i18n); ריק = תקין.
// ============================================================================
export function validateAddAdmin({ email } = {}, { org = null } = {}) {
  const errors = [];
  const e = normalizeEmail(email);
  if (!isValidEmail(e)) errors.push("team.err.email");
  else if (adminEmails(org).includes(e)) errors.push("team.err.duplicate");
  return errors;
}

// ============================================================================
// canRemoveAdmin — ההגנה שהכדורסל לא צריך ואנחנו כן.
//
// **ארגון בלי אף אדמין הוא ארגון אבוד**: אין ממנו דרך חזרה בלי גישת קונסולה
// ל-Firestore, וכאן מדובר בצי של 36 רכבים. ולכן: אי אפשר להסיר את האדמין
// **האחרון**. מערך (בשונה ממפה) כן ניתן לספירה ב-rules, ולכן זה נאכף גם שם
// (`adminEmails.size() >= 1`) ולא רק ב-UI.
//
// הסרת אדמין **אחר** מותרת, וגם הסרה עצמית כשיש עוד אדמין — זו החלטה
// שהאדמין רשאי לקבל.
// ============================================================================
export function canRemoveAdmin(org, email) {
  const list = adminEmails(org);
  const e = normalizeEmail(email);
  if (!e || !list.includes(e)) return { ok: false, errorKey: "team.err.notFound" };
  if (list.length <= 1) return { ok: false, errorKey: "team.err.lastAdmin" };
  return { ok: true, errorKey: null };
}

// removeFromList / addToList — הרשימה החדשה, מנורמלת. פונקציות טהורות, כדי
// שהחישוב שנשלח ל-Firestore יהיה בדיוק מה שנבדק ב-smoke.
export function addToList(org, email) {
  return [...new Set([...adminEmails(org), normalizeEmail(email)])].filter(Boolean).sort();
}

export function removeFromList(org, email) {
  const e = normalizeEmail(email);
  return adminEmails(org).filter((x) => x !== e);
}

// ============================================================================
// canonicalEmail — נרמול **ייחודי לגימייל**, מעבר ל-lowercase.
//
// דרישת 3.2.4 בהכוונה של עדי (2026-08-17): אצל Google, `a.b@gmail.com`,
// `ab@gmail.com` ו-`ab+work@gmail.com` הם **אותו חשבון**, אבל שלוש מחרוזות
// שונות. השוואה מחמירה מייצרת "הרשאה שלא עובדת" שנראית כמו באג; השוואה
// רופפת מייצרת הרשאת יתר. הפתרון הוא צורה קנונית אחת, בשני הצדדים.
//
// ⚠️ מוחל **רק על gmail.com / googlemail.com.** בדומיינים אחרים נקודה בשם
// המשתמש היא תו משמעותי (`hilda.vazana@promall.co.il` אינו
// `hildavazana@promall.co.il`), והסרתה הייתה מאחדת שני אנשים שונים.
//
// ⚠️ הפונקציה הזו **משוכפלת ב-firestore.rules** (`canonEmail`), כי הכלל חייב
// להגיע לאותה תשובה בלי לסמוך על הקליינט. כל שינוי כאן = שינוי שם, ובדיקות
// מקטע (ז) באמולטור נופלות אם השניים נפרדים.
//
// ⚠️ **אינה מוחלת על allowlist האדמינים.** הרשימה בפרודקשן כבר מאוכלסת
// בכתובות גולמיות, ונרמול חד-צדדי היה מנתק את מי שכבר בפנים. שם זה תיקון
// נפרד שדורש הגירה, ולא חלק מהפרוסה הזו.
// ============================================================================
const GMAIL_DOMAINS = ["gmail.com", "googlemail.com"];

export function canonicalEmail(email) {
  const e = normalizeEmail(email);
  const at = e.indexOf("@");
  if (at < 1) return e;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (!GMAIL_DOMAINS.includes(domain)) return e;
  return `${local.split("+")[0].replace(/\./g, "")}@gmail.com`;
}

export function sameEmail(a, b) {
  const x = canonicalEmail(a);
  return Boolean(x) && x === canonicalEmail(b);
}
