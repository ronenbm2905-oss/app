import { useState, useEffect, useCallback } from "react";
import { isFirebaseConfigured, auth, googleProvider } from "../firebase.js";

// LOCAL_USER — במצב מקומי אין התחברות: משתמש בודד שהוא admin.
const LOCAL_USER = {
  uid: "local-admin",
  displayName: "מנהל מקומי",
  email: "local@demo",
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
      setAuthError("auth.signInFailed");
    }
  }, []);

  const signOutUser = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) return;
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
  }, []);

  return { user, authLoading, authError, signIn, signOut: signOutUser, isLocal: !isFirebaseConfigured };
}
