import { useState, useEffect, useCallback } from "react";
import { isFirebaseConfigured, db, CONFIGURED_ORG_ID } from "../firebase.js";
import { resolveOrgAccess } from "../utils/orgMembers.js";

// ============================================================================
// useOrgAccess(user) — **גזירת ה-orgId**, ומי המסך שמוצג לפניו.
//
// עד 17.8 לא היה שלב כזה: `useData` פשוט הניח `orgId = user.uid`. זה עבד
// בדיוק למשתמש אחד — מי שיצר את הארגון — וכל uid אחר קיבל "אין ארגון" →
// **מסך הקמה ראשונית**, שאם הושלם היה יוצר ארגון שני נפרד. זה מה שקרה
// למנהלת הכספים בפרודקשן.
//
// status:
//   'loading'   → עוד לא יודעים. splash, לא שגיאה ולא onboarding.
//   'member'    → יש orgId קריא. מכאן והלאה מותר להירשם למאזינים.
//   'bootstrap' → אין מסמך ארגון וה-orgId הוא ה-uid שלנו ⇒ התקנה חדשה.
//                 **המסלול היחיד** ל-onboarding.
//   'none'      → אין הרשאה. מסך "פנה למנהל המערכת".
//   'error'     → שגיאת רשת/קונפיג אמיתית, עם "נסה שוב".
//
// ⚠️ הסדר `loading` → החלטה הוא הלב של באג 16.8: כל עוד לא ידוע מה ה-orgId
// **אין למה להירשם**, ומאזין onSnapshot שנדחה מסתיים ואינו מנסה שוב. לכן
// useData מקבל את ה-orgId מכאן, ורק כשהוא מוכן.
// ============================================================================
const LOCAL = { status: "member", orgId: "local", emailVerified: true, error: null };
const LOADING = { status: "loading", orgId: null, emailVerified: true, error: null };

export function useOrgAccess(user) {
  const [state, setState] = useState(() => (isFirebaseConfigured ? LOADING : LOCAL));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    if (!user?.uid) {
      setState(LOADING);
      return;
    }
    let cancelled = false;
    setState((s) => (s.status === "loading" ? s : { ...s, status: "loading" }));
    resolveOrgAccess(db, user, { configuredOrgId: CONFIGURED_ORG_ID })
      .then((res) => {
        if (!cancelled) setState(res);
      })
      // רשת ביטחון: כשל בטעינת מודול ה-SDK. בלי זה ה-splash נשאר לנצח.
      .catch((err) => {
        console.error("resolveOrgAccess failed", err);
        if (!cancelled) setState({ ...LOADING, status: "error", error: err });
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return {
    status: state.status,
    // ב-bootstrap ה-orgId כבר ידוע (הוא ה-uid), ו-useData יגלה שהמסמך חסר
    // ויציג את ה-onboarding — בדיוק הזרימה שעבדה עד היום למשתמש הראשון.
    orgId: state.status === "member" || state.status === "bootstrap" ? state.orgId : null,
    emailVerified: state.emailVerified,
    accessError: state.error,
    retry,
  };
}
