import { useCallback, useEffect, useState } from "react";
import { isFirebaseConfigured, auth, googleProvider } from "../firebase.js";

/**
 * useAuth — התחברות Google.
 *
 * במצב מקומי (בלי `.env`) אין התחברות בכלל: מחזיר משתמש-מקומי סינתטי כדי
 * שהממשק ייראה זהה, בלי לדמות זהות אמיתית. `isLocal` מאפשר למסכים לדעת
 * שאין כאן באמת אימות ולהימנע מהצגת הבטחות שקריות על הרשאות.
 */
const LOCAL_USER = { uid: "local", email: null, displayName: "מצב מקומי", isLocal: true };

export function useAuth() {
  const [user, setUser] = useState(isFirebaseConfigured ? undefined : LOCAL_USER);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let alive = true;
    let unsub = () => {};
    (async () => {
      const { onAuthStateChanged } = await import("firebase/auth");
      unsub = onAuthStateChanged(auth, (u) => {
        if (!alive) return;
        setUser(u ? { uid: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL } : null);
      });
    })();
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      const { signInWithPopup } = await import("firebase/auth");
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      // סגירת החלון ע"י המשתמש היא ביטול, לא תקלה — אין טעם להבהיל.
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return;
      setError(e.message || String(e));
    }
  }, []);

  const signOut = useCallback(async () => {
    const { signOut: fbSignOut } = await import("firebase/auth");
    await fbSignOut(auth);
  }, []);

  return {
    user,
    error,
    signIn,
    signOut,
    isLocal: !isFirebaseConfigured,
    loading: isFirebaseConfigured && user === undefined,
  };
}
