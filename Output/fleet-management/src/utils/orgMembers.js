// ============================================================================
// orgMembers.js — גזירת הארגון ופעולות ה-allowlist של האדמינים.
//
// ============================================================================
// הבאג שזה מתקן (פרודקשן, 2026-08-17)
// ============================================================================
// המשתמש שלח את הקישור למנהלת הכספים כדי שתהיה אדמין שנייה. היא התחברה
// וקיבלה **מסך הקמה ראשונית** במקום את הצי. השורש לא היה בכללים:
//
//   useData.js:63   const orgId = isFirebaseConfigured ? user?.uid || null : "local";
//
// מזהה הארגון היה **ה-uid של המשתמש המחובר, קשיח**. לכן גם הוספה ידנית שלה
// ל-`org.members` בקונסול לא הייתה עוזרת: הקליינט היה ממשיך לבקש
// `orgs/{ה-uid שלה}`, שאינו קיים → onboarding. ואם הייתה משלימה אותו — היה
// נוצר **ארגון שני נפרד**, עם אפס רכבים, שהאדמין המקורי בכלל לא רואה.
//
// התיקון, בדפוס שכבר חי בפרודקשן ב-Output/basketball-scheduler:
//   1. מזהה הארגון **קבוע בזמן build** (`CONFIGURED_ORG_ID`), ולא נגזר
//      מהמשתמש. כולם פותחים את אותו מסמך.
//   2. הגישה נקבעת ע"י **allowlist של מיילים** במסמך הארגון (`org.adminEmails`),
//      שנאכף ב-firestore.rules יחד עם `email_verified == true`.
//   3. מי שאינו ב-allowlist מקבל **"אין הרשאה, פנה למנהל המערכת"** — לא מסך
//      הקמה. זה החלק שנשלח בפועל למנהלת הכספים.
// ============================================================================

import { normalizeEmail, addToList, removeFromList, canRemoveAdmin } from "./admins.js";
import { probeOrg, ensureMembership } from "./firestoreSync.js";

// ============================================================================
// resolveOrgAccess — איזה ארגון, ואיזה מסך.
//
//   status: 'member'    → orgId מוכר וקריא. מותר להירשם למאזינים.
//   status: 'bootstrap' → אין מסמך ארגון, וה-orgId הוא ה-uid שלנו ⇒ באמת
//                         מותר להקים. זה **המסלול היחיד** ל-onboarding.
//   status: 'none'      → אין גישה. מסך "פנה למנהל המערכת".
//   status: 'error'     → שגיאת רשת/קונפיג אמיתית. עם "נסה שוב".
//
// ⚠️ ההבחנה שמונעת את הארגון השני: `probeOrg` מחזיר "missing" גם על
// permission-denied — הכלל דורש `exists()`, ולכן אי אפשר להבדיל בין "המסמך
// לא קיים" ל"קיים ואין לי גישה". ולכן ההכרעה **אינה** נשענת על ההבדל הזה
// אלא על שאלה שכן ידועה בוודאות: **האם ה-orgId הוא ה-uid שלי.**
//   • כן  ⇒ אין למי לפנות; זו התקנה חדשה ואני המקים.        → bootstrap
//   • לא  ⇒ הארגון של מישהו אחר, או דגל build שגוי.          → none
// בפרודקשן `VITE_FLEET_ORG_ID` הוא ה-uid של מי שהקים, ולכן עבורו זה יוצא
// bootstrap/member כרגיל, ועבור כל אדמין נוסף — none עד שהמייל שלו ברשימה.
// ============================================================================
export async function resolveOrgAccess(db, user, { configuredOrgId = null } = {}) {
  const base = {
    status: "none",
    orgId: null,
    emailVerified: Boolean(user?.emailVerified),
    email: normalizeEmail(user?.email),
    error: null,
  };
  if (!user?.uid) return base;

  // הדגל קובע; בהיעדרו — התקנה חדשה, וה-uid משמש כמזהה הארגון החדש.
  const orgId = configuredOrgId || user.uid;

  try {
    const probe = await probeOrg(db, orgId);
    if (probe.state === "error") return { ...base, status: "error", orgId, error: probe.error };
    if (probe.state === "exists") {
      // הקריאה עברה ⇒ אנחנו ב-allowlist (או במסלול ה-legacy). רשומת החברות
      // נשארת כמסמך תיעוד; היא אינה מקור סמכות ואף אחד לא נשען עליה לגישה.
      ensureMembership(db, user.uid, orgId, "admin").catch(() => {});
      return { ...base, status: "member", orgId };
    }
    // 'missing' — או שהמסמך אינו קיים, או שאין לנו גישה אליו.
    if (orgId === user.uid) return { ...base, status: "bootstrap", orgId };
    // ⚠️ `orgId: null` ולא ה-orgId שניסינו: מי שאינו member/bootstrap **אין לו
    // ארגון להאזין לו**, ומחזיר-ערך שנראה תקין הוא בדיוק מה שיגרום לקורא
    // עתידי לפתוח 14 מאזינים שיידחו (הבאג של 16.8). מצב אחד, ערך אחד.
    return { ...base, status: "none", orgId: null, attemptedOrgId: orgId };
  } catch (err) {
    return { ...base, status: "error", orgId: null, attemptedOrgId: orgId, error: err };
  }
}

// ============================================================================
// setAdminEmails — כתיבת ה-allowlist. **`updateDoc` על שדה אחד**, ולא
// `setDoc(merge)` על המודל שבזיכרון: מערך שנכתב דרך המודל היה נשלח יחד עם
// snapshot שלם ומיושן, וכל שינוי מקביל של אדמין אחר היה נדרס.
// ============================================================================
async function setAdminEmails(db, orgId, list) {
  const { doc, updateDoc } = await import("firebase/firestore");
  await updateDoc(doc(db, "orgs", orgId), { "org.adminEmails": list });
}

export async function addAdminEmail(db, { orgId, org, email } = {}) {
  const e = normalizeEmail(email);
  if (!orgId || !e) return { ok: false, errorKey: "team.err.email" };
  try {
    await setAdminEmails(db, orgId, addToList(org, e));
  } catch (err) {
    console.error("addAdminEmail failed", err);
    return { ok: false, errorKey: "team.err.failed", error: err };
  }
  return { ok: true, errorKey: null };
}

export async function removeAdminEmail(db, { orgId, org, email } = {}) {
  // ההגנה נבדקת גם כאן וגם ב-rules: אדמין אחרון לא מוסר.
  const check = canRemoveAdmin(org, email);
  if (!check.ok) return check;
  if (!orgId) return { ok: false, errorKey: "team.err.notFound" };
  try {
    await setAdminEmails(db, orgId, removeFromList(org, email));
  } catch (err) {
    console.error("removeAdminEmail failed", err);
    return { ok: false, errorKey: "team.err.failed", error: err };
  }
  return { ok: true, errorKey: null };
}
