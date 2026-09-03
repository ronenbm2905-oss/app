// ============================================================================
// useAuth — התחברות Google, ובדיקה שהמשתמש ברשימת המורשים.
//
// שתי שאלות נפרדות, ובלבול ביניהן הוא חור אבטחה:
//   · **מי אתה** — Google עונה (`user`).
//   · **מותר לך להיכנס** — `orgs/{ORG_ID}` עונה (`members`).
//
// משתמש מחובר שאינו ברשימה מקבל מסך "אין לך גישה", ולא מסך ריק שנראה כמו תקלה.
// ⚠ ההגנה עצמה יושבת ב-`firestore.rules`; מה שכאן הוא **UX בלבד**. קליינט לא
// מגן על כלום — הוא רק מסביר.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, googleProvider, isFirebaseConfigured, ORG_ID } from "../firebase.js";

const normalizeEmail = (e) => String(e || "").trim().toLowerCase();

/**
 * ⚠ `members` **חייב להיות מערך** ב-Firestore, ולא מחרוזת.
 *
 * בקונסולה קל מאוד לבחור type=string במקום type=array — הערך נראה זהה, והשדה
 * נשמר. אבל `.map()` על מחרוזת זורק, כלומר **מסך לבן**, וב-rules `x in y` על
 * מחרוזת נכשל, כלומר **חסימה של הבעלים מהמערכת שלו**.
 *
 * הפונקציה מחזירה `{ list, wrongType }` — ולא זורקת ולא מתקנת בשקט. מחרוזת
 * אינה מקובלת כרשימה בעלת איש אחד: זו טעות קונפיגורציה שעדיף לומר עליה
 * במסך, כי הכללים בשרת ידחו אותה בכל מקרה והמשתמש היה נשאר בלי הסבר.
 */
function readMembers(raw) {
  if (Array.isArray(raw)) return { list: raw.map(normalizeEmail).filter(Boolean), wrongType: false };
  if (raw === undefined || raw === null) return { list: [], wrongType: false };
  return { list: [], wrongType: true };
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [members, setMembers] = useState(null);   // null = טרם נטען
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(auth, (u) => { setUser(u); setAuthReady(true); });
  }, []);

  /**
   * רשימת המורשים נקראת **רק אחרי login** — ה-effect תלוי ב-`user?.uid`.
   * זה הבאג שנצרב ב-basketball-scheduler: מנוי שנרשם ב-mount עם deps `[]` רץ
   * לפני שההתחברות הושלמה, `request.auth` הוא null, הכללים חוסמים, ואין
   * re-subscribe אחרי ה-login.
   */
  useEffect(() => {
    if (!isFirebaseConfigured || !user) { setMembers(null); return; }
    return onSnapshot(
      doc(db, "orgs", ORG_ID),
      (snap) => {
        const { list, wrongType } = readMembers(snap.exists() ? snap.data().members : []);
        setMembers(list);
        setError(wrongType
          ? "השדה members במסמך הארגון אינו מערך. בקונסולת Firebase: מחק אותו " +
            "והוסף מחדש עם type=array (לא string), עם כתובת אחת בכל שורה."
          : "");
      },
      (err) => {
        // כשל קריאה כאן פירושו כמעט תמיד "אינך ברשימה" — הכללים חסמו.
        setMembers([]);
        setError(err.code === "permission-denied" ? "" : `קריאת ההרשאות נכשלה: ${err.message}`);
      }
    );
  }, [user?.uid]);

  const signIn = useCallback(async () => {
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return;
      setError(`ההתחברות נכשלה: ${e.message}`);
    }
  }, []);

  const signOutNow = useCallback(() => signOut(auth).catch(() => {}), []);

  const email = normalizeEmail(user?.email);
  // ⚠ `members === null` פירושו **טרם נטען**, ולא "אין הרשאה". בלי ההבחנה הזו
  // המשתמש רואה "אין לך גישה" למשך רגע בכל טעינה.
  const allowed = Boolean(user) && Array.isArray(members) && members.includes(email);

  return {
    cloud: isFirebaseConfigured,
    user,
    email,
    authReady,
    membersLoaded: Array.isArray(members),
    members: members || [],
    allowed,
    signIn,
    signOut: signOutNow,
    error,
  };
}
