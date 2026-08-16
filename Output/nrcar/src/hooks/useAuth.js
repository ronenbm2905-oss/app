import { useState, useEffect, useCallback, useRef } from "react";
import { isFirebaseConfigured, auth, googleProvider } from "../firebase.js";
import { purgeLocalCache, purgeOtherUsersCache } from "../utils/localCache.js";

// ============================================================================
// useAuth — הועתק מ-fleet, עם תוספת אחת מחייבת:
//
// 🔴 N1 — `purgeLocalCache` נקראת בשלושה מסלולים, ושניים מהם כאן:
//   (א) יציאה מהחשבון — ההבטחה למשתמש ב-opt-in היא "יימחק כשתתנתק",
//       והיא חייבת להיות אמת;
//   (ב) החלפת משתמש (onAuthStateChanged ל-uid אחר) — טאבלט משפחתי משותף.
// המסלול השלישי (מחיקת/ארכוב מסמך או רכב) יושב ב-useActions.
// ============================================================================

// LOCAL_USER — במצב מקומי אין התחברות: משתמש בודד שהוא הבעלים.
// ⚠️ במצב הזה **מסמכים אישיים חסומים** (utils/files.js): base64 של רישיון
// נהיגה ב-localStorage הוא תעודת זהות בטקסט גלוי על הדיסק.
const LOCAL_USER = {
  uid: "local-owner",
  displayName: "משתמש מקומי",
  email: "local@demo",
  isLocal: true,
};

export function useAuth() {
  const [user, setUser] = useState(isFirebaseConfigured ? null : LOCAL_USER);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured);
  const [authError, setAuthError] = useState(null);
  const lastUid = useRef(isFirebaseConfigured ? null : LOCAL_USER.uid);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;
    let cancelled = false;
    let unsub = () => {};
    import("firebase/auth")
      .then(({ onAuthStateChanged }) => {
        if (cancelled) return;
        unsub = onAuthStateChanged(
          auth,
          (u) => {
            const uid = u?.uid || null;
            // N1(ב) — המשתמש התחלף על אותו מכשיר: המטמון של הקודם יורד.
            if (uid !== lastUid.current) {
              purgeOtherUsersCache(uid);
              lastUid.current = uid;
            }
            setUser(u ? { uid: u.uid, displayName: u.displayName, email: u.email } : null);
            setAuthLoading(false);
          },
          (err) => {
            console.error("auth error", err);
            setAuthError("auth.error");
            setAuthLoading(false);
          }
        );
      })
      .catch((err) => {
        console.error("auth import failed", err);
        setAuthLoading(false);
      });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const signIn = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) return;
    setAuthError(null);
    try {
      const { signInWithPopup } = await import("firebase/auth");
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("signIn failed", err);
      setAuthError("auth.error");
    }
  }, []);

  // ⚠️ N1(א) — היציאה מנקה את המטמון **לפני** שהיא מנתקת.
  // "התנתקות" חייבת גם להיות פעולה גלויה בלחיצה אחת במסך ההגדרות: אצל קהל
  // מבוגר, פעולה קבורה שווה לפעולה שלא קיימת.
  const signOutUser = useCallback(async () => {
    purgeLocalCache();
    if (!isFirebaseConfigured || !auth) return;
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
  }, []);

  return {
    user,
    authLoading,
    authError,
    signIn,
    signOut: signOutUser,
    isLocal: !isFirebaseConfigured,
  };
}
