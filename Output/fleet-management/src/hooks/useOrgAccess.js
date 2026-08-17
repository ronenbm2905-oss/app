import { useState, useEffect, useCallback, useRef } from "react";
import { isFirebaseConfigured, db } from "../firebase.js";
import { resolveOrgAccess, claimInvite } from "../utils/orgMembers.js";

// ============================================================================
// useOrgAccess(user) — **גזירת ה-orgId**, ומי המסך שמוצג לפניו.
//
// עד 17.8 לא היה שלב כזה: `useData` פשוט הניח `orgId = user.uid`. זה עבד
// בדיוק למשתמש אחד — מי שיצר את הארגון — וכל uid אחר קיבל "אין ארגון" →
// **מסך הקמה ראשונית**, שאם הושלם היה יוצר ארגון שני נפרד. זה מה שקרה
// למנהלת הכספים בפרודקשן.
//
// status:
//   'loading' → עוד לא יודעים. splash, לא שגיאה ולא onboarding.
//   'member'  → יש orgId. מכאן והלאה מותר להירשם למאזינים.
//   'invited' → יש הזמנה ממתינה. מסך "צירוף לארגון".
//   'none'    → אין חברות ואין הזמנה. מסך "פנה למנהל המערכת".
//   'error'   → שגיאת רשת/קונפיג אמיתית. עם כפתור "נסה שוב".
//
// ⚠️ הסדר `loading` → החלטה הוא הלב של באג 16.8: כל עוד לא ידוע מה ה-orgId
// **אין למה להירשם**, ומאזין onSnapshot שנדחה מסתיים ואינו מנסה שוב. לכן
// useData מקבל את ה-orgId מכאן ורק כשהוא מוכן.
//
// `bootstrap` — הדרך היחידה להגיע ל-onboarding היא בחירה **מפורשת** של
// המשתמש במסך "אין גישה" ("אני מקים ארגון חדש"). אין דרך להיתקל בו בטעות.
// זה מה שמונע את הארגון השני, ובלי לחסום את המשתמש הראשון בהתקנה חדשה.
// ============================================================================
export function useOrgAccess(user) {
  const LOCAL = { status: "member", orgId: "local", invite: null, role: "admin", emailVerified: true, error: null };
  const [state, setState] = useState(() =>
    isFirebaseConfigured ? { status: "loading", orgId: null, invite: null, role: null, emailVerified: true, error: null } : LOCAL
  );
  const [attempt, setAttempt] = useState(0);
  const [bootstrap, setBootstrap] = useState(false);
  const [joining, setJoining] = useState(false);
  const claimedRef = useRef(false);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    if (!user?.uid) {
      setState({ status: "loading", orgId: null, invite: null, role: null, emailVerified: true, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => (s.status === "loading" ? s : { ...s, status: "loading" }));
    resolveOrgAccess(db, user)
      .then((res) => {
        if (!cancelled) setState(res);
      })
      .catch((err) => {
        // רשת ביטחון: כשל בטעינת מודול ה-SDK. בלי זה ה-splash נשאר לנצח.
        console.error("resolveOrgAccess failed", err);
        if (!cancelled) setState({ status: "error", orgId: null, invite: null, role: null, emailVerified: true, error: err });
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid, attempt]);

  // משתמש חדש ⇒ מתחילים תמיד מ"לא מקימים". מונע מצב שבו bootstrap שנבחר
  // בסשן קודם גורר משתמש אחר למסך הקמה.
  useEffect(() => {
    setBootstrap(false);
    claimedRef.current = false;
  }, [user?.uid]);

  // -- תביעת ההזמנה --------------------------------------------------------
  // מחזיר { ok, errorKey } — המסך לא מכריז "צורפת" על כתיבה שנדחתה.
  const join = useCallback(async () => {
    if (!isFirebaseConfigured || !user?.uid || !state.invite || claimedRef.current) {
      return { ok: false, errorKey: "join.err.noInvite" };
    }
    claimedRef.current = true;
    setJoining(true);
    const res = await claimInvite(db, user, state.invite);
    setJoining(false);
    if (!res.ok) {
      claimedRef.current = false;
      return res;
    }
    // לא קובעים 'member' מהזיכרון — מריצים את הגזירה מחדש, כדי שהמצב יגיע
    // מ-Firestore ולא מהנחה של הקליינט.
    setAttempt((a) => a + 1);
    return res;
  }, [user?.uid, user?.email, state.invite]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  // startBootstrap — "אני מקים ארגון חדש". ה-orgId הוא ה-uid, כמו תמיד
  // ליוצר ארגון; useData יגלה שהמסמך חסר ויציג את ה-onboarding.
  const startBootstrap = useCallback(() => {
    if (!user?.uid) return;
    setBootstrap(true);
  }, [user?.uid]);

  const bootstrapping = bootstrap && state.status === "none";
  return {
    status: bootstrapping ? "member" : state.status,
    orgId: bootstrapping ? user?.uid || null : state.orgId,
    role: bootstrapping ? "admin" : state.role,
    invite: state.invite,
    emailVerified: state.emailVerified,
    accessError: state.error,
    joining,
    join,
    retry,
    startBootstrap,
  };
}
