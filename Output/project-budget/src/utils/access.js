// ============================================================================
// access.js — מודל התפקידים. פונקציות טהורות, ומקור אמת יחיד למה שכל תפקיד
// רשאי לעשות. הכללים ב-`firestore.rules` **חייבים להישאר תואמים** לקובץ הזה:
// כאן זה קובע מה הממשק מציג, שם זה קובע מה באמת נאכף.
//
// זיהוי לפי **כתובת מייל** ולא לפי uid, כי הבעלים מזמין אנשים לפי מייל ולא
// לפי מזהה שהוא לא מכיר. Firebase חושף את המייל ב-`request.auth.token.email`,
// ולכן אין צורך במנגנון הזמנה/claim — מי שנכנס עם המייל הנכון מקבל את התפקיד.
// ============================================================================

export const ROLE_OWNER = "owner";
export const ROLE_MANAGER = "manager";
export const ROLE_VIEWER = "viewer";

/** אוספים שחברת הניהול רשאית לכתוב אליהם — דיווח ביצוע, לא שינוי תקציב. */
export const MANAGER_WRITABLE = ["invoices", "payments", "vendors", "documents"];

/**
 * שדות הדרישה מול הרשות. חברת הניהול לא נוגעת בהם: היא מדווחת מה שולם,
 * לא מה נדרש מהרשות. ההגשה היא של הבעלים.
 */
export const CLAIM_FIELDS = ["claimBatchId", "claimStatus", "claimedAmount", "taxApprovedAmount"];

export const normalizeEmail = (e) => String(e || "").trim().toLowerCase();

/** התפקיד של משתמש בפרויקט, או null אם אינו חבר. */
export function roleOf(project, email) {
  if (!project || !email) return null;
  return project.memberRoles?.[normalizeEmail(email)] || null;
}

export const isMember = (project, email) => roleOf(project, email) != null;
export const isOwner = (project, email) => roleOf(project, email) === ROLE_OWNER;

/** האם התפקיד רשאי לכתוב לאוסף מסוים. */
export function canWriteCollection(role, collection) {
  if (role === ROLE_OWNER) return true;
  if (role === ROLE_MANAGER) return MANAGER_WRITABLE.includes(collection);
  return false;
}

/** האם התפקיד רשאי לשנות שדות דרישה על חשבונית. */
export const canEditClaimFields = (role) => role === ROLE_OWNER;

/** האם התפקיד רשאי לשנות את הגדרות הפרויקט ואת רשימת החברים. */
export const canManageProject = (role) => role === ROLE_OWNER;

/** האם התפקיד רשאי לערוך את התקציב עצמו (כתב כמויות / שורות עלות / מנות). */
export const canEditBudget = (role) => role === ROLE_OWNER;

/**
 * הבעלים האחרון לא יכול להסיר את עצמו — פרויקט בלי בעלים הוא פרויקט שאיש
 * לא יכול לתקן, כולל את ההרשאות עצמן.
 */
export function canRemoveMember(project, email) {
  const target = normalizeEmail(email);
  if (roleOf(project, target) !== ROLE_OWNER) return true;
  const owners = Object.values(project.memberRoles || {}).filter((r) => r === ROLE_OWNER);
  return owners.length > 1;
}

/** רשימת החברים כמערך ממוין — בעלים ראשון. */
const ORDER = { [ROLE_OWNER]: 0, [ROLE_MANAGER]: 1, [ROLE_VIEWER]: 2 };
export function memberList(project) {
  return Object.entries(project?.memberRoles || {})
    .map(([email, role]) => ({ email, role }))
    .sort((a, b) => (ORDER[a.role] ?? 9) - (ORDER[b.role] ?? 9) || a.email.localeCompare(b.email));
}

/**
 * הרשימה שנשמרת על מסמך הפרויקט לצורך **שאילתה**. בלעדיה אי אפשר לשאול
 * "אילו פרויקטים אני רואה" — ומלכודת "כללים אינם מסננים" אומרת שהשאילתה
 * חייבת לשאת `where` שהכללים יוכלו לאמת, ולא להסתמך על סינון בצד הכללים.
 */
export const memberEmailsOf = (project) => Object.keys(project?.memberRoles || {}).sort();
