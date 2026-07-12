import { useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
} from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "../firebase";

// In LOCAL MODE (no Firebase config) there is no login — we return a synthetic
// "local" user so the whole app is usable immediately.
const LOCAL_USER = { uid: "local", email: null, displayName: "מצב מקומי", local: true };

export function useAuth() {
  const [user, setUser] = useState(isFirebaseConfigured ? null : LOCAL_USER);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const signIn = async () => {
    if (!isFirebaseConfigured) return;
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setAuthError("ההתחברות נכשלה. נסה שוב.");
    }
  };

  const signOut = async () => {
    if (!isFirebaseConfigured) return;
    await fbSignOut(auth);
  };

  return { user, authLoading, authError, signIn, signOut, isFirebaseConfigured };
}
