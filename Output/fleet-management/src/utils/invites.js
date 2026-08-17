// ============================================================================
// invites.js — **הלוגיקה הטהורה** של אדמין שני: הזמנה לפי מייל מאומת.
//
// למה המנגנון הזה ולא הזמנה "רגילה": התוכנית על Spark. אין Cloud Functions,
// אין שליחת מייל מהשרת, ואין שום צד-שרת שיכול לכתוב את השיוך במקום המשתמש.
// לכן ההצטרפות היא **claim-by-verified-email**:
//   1. אדמין קיים כותב מייל ל-`orgs/{orgId}.org.invites[email]`.
//   2. מי שנכנס עם Google באותו מייל, ו-`email_verified == true`, רושם את
//      עצמו: `org.members[uid] = <התפקיד מההזמנה>` ומסיר את ההזמנה.
//   3. **הבידוד עצמו נשאר לפי uid בלבד** (F1 של עדי). המייל הוא מפתח
//      חד-פעמי לתביעת ההזמנה, ולא זהות מתמשכת.
//
// ⚠️ למה יש תוקף להזמנה (`expiresAt`) ולא סתם רשומה שממתינה לנצח:
// **מייל עבודה עובר בין עובדים.** `hildav@promall.co.il` הוא תיבה של תפקיד;
// אם הילדה תעזוב ומישהו אחר יקבל את התיבה, הזמנה שנשארה פתוחה הייתה מעניקה
// לו אדמין על כל הצי. חלון קצר (ברירת מחדל 14 יום) הוא מה שמגביל את זה
// **בזמן**, והוא נאכף ב-firestore.rules — לא כאן.
//
// ⚠️ זו אינה שכבת אכיפה. האכיפה היא ב-firestore.rules בלבד; זה הביטוי
// הבדיק שלה, בדיוק כמו access.js.
// ============================================================================

import { ROLES } from "../constants.js";

// ימי תוקף להזמנה. קצר בכוונה — ראה ההסבר על תיבת-תפקיד למעלה.
export const INVITE_TTL_DAYS = 14;

// התפקידים שאפשר להזמין אליהם. **המסך מציע 'admin' בלבד** בפרוסה הזו;
// 'driver' מותר במנגנון כדי שהתפקיד שנתבע יהיה תמיד **מה שבהזמנה** ולא
// מה שהתובע ביקש — וכדי שיהיה מה לבדוק מול ניסיון הענקת תפקיד גבוה.
export const INVITABLE_ROLES = ROLES;

// -- נרמול מייל -------------------------------------------------------------
// המפתח במפת ההזמנות הוא **תמיד lowercase, ללא רווחים**, כי זה מה שה-rules
// משוות אליו (`request.auth.token.email.lower()`). כל דרך אחרת לנרמל =
// הזמנה שלא ניתן לתבוע.
export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

// ולידציה מכוונת-מינימום: לא "כל RFC 5322", אלא מה שמונע טעויות הקלדה
// שייצרו הזמנה שאף אחד לא יוכל לתבוע.
export function isValidEmail(email) {
  const e = normalizeEmail(email);
  if (!e || e.length > 254) return false;
  if (/\s/.test(e)) return false;
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(e);
}

// -- תוקף ------------------------------------------------------------------
// millis ולא Timestamp ולא ISO: מספר שלם עובר JSON round-trip בלי לאבד
// זהות, ולכן ה-diff של writeOrgDiff לא "מגלה שינוי" בכל snapshot. ISO היה
// דורש השוואת מחרוזות ב-rules; Timestamp היה נקרא חזרה כאובייקט SDK
// ומייצר כתיבה אינסופית. `request.time.toMillis()` משווה לזה ישירות.
export function inviteExpiresAt(nowMs = Date.now(), ttlDays = INVITE_TTL_DAYS) {
  return Math.trunc(nowMs) + ttlDays * 24 * 60 * 60 * 1000;
}

export function isInviteExpired(invite, nowMs = Date.now()) {
  const exp = invite?.expiresAt;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return true;
  return exp <= nowMs;
}

// buildInvite — הרשומה שנכתבת ל-`org.invites[email]`.
// `email` **אינו** בתוך הערך: הוא המפתח. שמירה כפולה = שני מקורות אמת.
export function buildInvite({ role = "admin", invitedBy = null, nowMs = Date.now(), ttlDays = INVITE_TTL_DAYS } = {}) {
  return {
    role,
    invitedBy: invitedBy || null,
    invitedAt: new Date(Math.trunc(nowMs)).toISOString(),
    expiresAt: inviteExpiresAt(nowMs, ttlDays),
  };
}

// buildInvitePointer — מסמך ה**גילוי** `invites/{email}`.
//
// למה הוא נחוץ בכלל: מסמך הארגון קרוא לאדמינים בלבד, ולכן מוזמנת שעוד אינה
// חברה **אינה יכולה לקרוא אותו** — וגם אינה יודעת מה ה-orgId (בפרוסה 1 הוא
// ה-uid של מי שהקים). בלי מצביע ברמת-שורש, שכתובתו היא המייל שלה, אין שום
// דרך שהיא תגלה שיש לה הזמנה. אי אפשר לתשאל מסמך שאסור לקרוא.
//
// המצביע הוא **אינדקס גילוי בלבד ולא מקור סמכות**: התביעה נבדקת ב-rules מול
// `org.invites` שבמסמך הארגון. מצביע מיותר/מעודכן-בפיגור אינו מעניק כלום.
export function buildInvitePointer({ email, orgId, orgName = "", role = "admin", invitedBy = null, invite = null, nowMs = Date.now(), ttlDays = INVITE_TTL_DAYS } = {}) {
  const base = invite || buildInvite({ role, invitedBy, nowMs, ttlDays });
  return {
    email: normalizeEmail(email),
    orgId: orgId || null,
    orgName: orgName || "",
    role: base.role,
    invitedBy: base.invitedBy,
    invitedAt: base.invitedAt,
    expiresAt: base.expiresAt,
  };
}

// -- קריאת המצב מהמודל ------------------------------------------------------

// כל ההזמנות הפתוחות, ממוינות, עם דגל תוקף — כדי שהמסך יראה גם הזמנה
// שפג תוקפה (ולא "נעלמה בלי הסבר"), ויציע לשלוח אותה מחדש.
export function listInvites(org, nowMs = Date.now()) {
  const map = org?.invites || {};
  return Object.keys(map)
    .map((email) => ({ email, ...(map[email] || {}), expired: isInviteExpired(map[email], nowMs) }))
    .sort((a, b) => String(a.email).localeCompare(String(b.email)));
}

export function pendingInvites(org, nowMs = Date.now()) {
  return listInvites(org, nowMs).filter((i) => !i.expired);
}

// חברי הארגון כרשימה. ה-uid הוא הזהות; אין כאן מייל, בכוונה (F1).
export function listMembers(org) {
  const map = org?.members || {};
  return Object.keys(map)
    .map((uid) => ({ uid, role: map[uid] }))
    .sort((a, b) => (a.role === b.role ? a.uid.localeCompare(b.uid) : a.role === "admin" ? -1 : 1));
}

export function adminUids(org) {
  const map = org?.members || {};
  return Object.keys(map).filter((uid) => map[uid] === "admin");
}

export function isOrgAdminUid(org, uid) {
  return Boolean(uid) && (org?.members || {})[uid] === "admin";
}

// ============================================================================
// validateInviteInput — מה שהמסך חייב לחסום **לפני** שהכתיבה נדחית ב-rules.
// מחזיר מערך מפתחות שגיאה (i18n), ריק = תקין.
//
// המקרים כאן הם בדיוק מצבי הקצה שנשאלנו עליהם:
//   • מייל לא תקין                      → err.email
//   • מייל שכבר מוזמן ובתוקף            → err.duplicate (לא יוצרים שתי הזמנות)
//   • **מייל של מי שכבר חבר**           → err.alreadyMember. אין דרך לדעת
//     מה-uid מהו המייל שלו (וזה נכון — F1), ולכן ההשוואה היא מול המיילים
//     שהאדמין הזין; המקרה המובהק הוא האדמין שמזמין את עצמו.
//   • תפקיד לא מוכר                     → err.role
// ============================================================================
export function validateInviteInput(
  { email, role = "admin", selfEmail = null } = {},
  { org = null, nowMs = Date.now() } = {}
) {
  const errors = [];
  const e = normalizeEmail(email);
  if (!isValidEmail(e)) errors.push("team.err.email");
  if (!INVITABLE_ROLES.includes(role)) errors.push("team.err.role");
  if (e && normalizeEmail(selfEmail) === e) errors.push("team.err.self");
  const existing = (org?.invites || {})[e];
  if (existing && !isInviteExpired(existing, nowMs)) errors.push("team.err.duplicate");
  return errors;
}

// ============================================================================
// canRemoveMember — האם מותר להסיר חבר.
//
// **אדמין אינו מסיר את עצמו.** לא מנומסות, אלא כדי שהמצב "ארגון בלי אף
// אדמין" יהיה בלתי-אפשרי מבנית: ב-firestore.rules התנאי לכל עדכון של מסמך
// הארגון הוא שהכותב **נשאר** admin אחריו. ספירת אדמינים במפה אינה ניתנת
// לביטוי ב-rules; "הכותב נשאר אדמין" כן — והיא מספיקה, כי כל כתיבה מגיעה
// מאדמין. המחיר: כדי לצאת מהארגון צריך אדמין אחר שיסיר אותך. מחיר סביר
// לעומת צי של 36 רכבים שאיש אינו יכול לנהל.
// ============================================================================
export function canRemoveMember(org, selfUid, targetUid) {
  if (!selfUid || !targetUid) return { ok: false, errorKey: "team.err.notFound" };
  if (!isOrgAdminUid(org, selfUid)) return { ok: false, errorKey: "team.err.notAdmin" };
  if (selfUid === targetUid) return { ok: false, errorKey: "team.err.selfRemove" };
  if (!(org?.members || {})[targetUid]) return { ok: false, errorKey: "team.err.notFound" };
  return { ok: true, errorKey: null };
}

// ============================================================================
// claimOutcome — האם ההזמנה הזו ניתנת לתביעה, ומאיזו סיבה לא.
// אותם תנאים בדיוק שה-rules אוכפות, כדי שהמסך יסביר במקום להיכשל באדום:
//   מייל לא מאומת · אין הזמנה · פג תוקף · כבר חבר · תפקיד לא מוכר.
// ============================================================================
export function claimOutcome({ user, invite, org = null, nowMs = Date.now() } = {}) {
  if (!user?.uid) return { ok: false, errorKey: "join.err.signedOut" };
  if (!user.emailVerified) return { ok: false, errorKey: "join.err.unverified" };
  const email = normalizeEmail(user.email);
  if (!email) return { ok: false, errorKey: "join.err.noEmail" };
  if (!invite) return { ok: false, errorKey: "join.err.noInvite" };
  if (normalizeEmail(invite.email) && normalizeEmail(invite.email) !== email)
    return { ok: false, errorKey: "join.err.noInvite" };
  if (!invite.orgId) return { ok: false, errorKey: "join.err.noInvite" };
  if (!INVITABLE_ROLES.includes(invite.role)) return { ok: false, errorKey: "join.err.role" };
  if (isInviteExpired(invite, nowMs)) return { ok: false, errorKey: "join.err.expired" };
  if (org && (org.members || {})[user.uid]) return { ok: false, errorKey: "join.err.alreadyMember" };
  return { ok: true, errorKey: null };
}
