import { useState, useEffect, useCallback } from "react";
import { isFirebaseConfigured, isEmulator, auth, googleProvider } from "../firebase.js";

// LOCAL_USER — במצב מקומי אין התחברות: משתמש בודד שהוא admin.
const LOCAL_USER = {
  uid: "local-admin",
  displayName: "מנהל מקומי",
  email: "local@demo",
  emailVerified: true,
  isLocal: true,
};

export function useAuth() {
  const [user, setUser] = useState(isFirebaseConfigured ? null : LOCAL_USER);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured);
  const [authError, setAuthError] = useState(null);

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
            // emailVerified — **התנאי שהופך מייל למפתח** בתביעת הזמנה. ה-rules
            // דורשות `email_verified == true`, ולכן המסך חייב לדעת אותו כדי
            // להסביר "המייל שלך אינו מאומת" במקום להיכשל באדום. כניסת Google
            // תמיד מאומתת; כניסה אנונימית (אמולטור) — לא, וגם אין לה מייל.
            setUser(
              u
                ? {
                    uid: u.uid,
                    displayName: u.displayName,
                    email: u.email,
                    emailVerified: Boolean(u.emailVerified),
                  }
                : null
            );
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
      setAuthError("auth.signInFailed");
    }
  }, []);

  // signInFresh — **פיתוח מול אמולטור בלבד** (ראה firebase.js: הבלוק מת
  // בבנייה לפרודקשן). כניסה אנונימית נותנת uid חדש בכל פעם, וזה בדיוק
  // "משתמש חדש שאין לו עדיין ארגון" — התרחיש שהתפוצץ ב-16.8 ושאי אפשר
  // היה לשחזר בדפדפן בלי לגעת בפרויקט אמיתי.
  const signInFresh = useCallback(async () => {
    if (!isEmulator || !auth) return;
    setAuthError(null);
    try {
      const { signInAnonymously } = await import("firebase/auth");
      await signInAnonymously(auth);
    } catch (err) {
      console.error("anonymous signIn failed", err);
      setAuthError("auth.signInFailed");
    }
  }, []);

  const signOutUser = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) return;
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
  }, []);

  return {
    user,
    authLoading,
    authError,
    signIn,
    signInFresh,
    signOut: signOutUser,
    isLocal: !isFirebaseConfigured,
    isEmulator,
  };
}
