import { useState, useEffect } from "react";
import { isFirebaseConfigured, auth, googleProvider } from "../firebase.js";

// במצב מקומי (אין Firebase) — משתמש בודד וירטואלי, תמיד "מחובר" כבעלים.
const LOCAL_USER = { uid: "local-owner", email: "local", displayName: "מקומי", local: true };

export function useAuth() {
  const [user, setUser] = useState(isFirebaseConfigured ? null : LOCAL_USER);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) return; // מצב מקומי — אין מאזין
    let unsub = () => {};
    (async () => {
      const { onAuthStateChanged, setPersistence, browserLocalPersistence } = await import(
        "firebase/auth"
      );
      try {
        await setPersistence(auth, browserLocalPersistence); // session שורד רענון
      } catch {
        /* ignore */
      }
      unsub = onAuthStateChanged(auth, (u) => {
        setUser(u || null);
        setAuthLoading(false);
      });
    })();
    return () => unsub();
  }, []);

  async function signIn() {
    if (!isFirebaseConfigured) return;
    setSigningIn(true);
    try {
      const { signInWithPopup } = await import("firebase/auth");
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Sign-in failed", err);
    } finally {
      setSigningIn(false);
    }
  }

  async function signOutUser() {
    if (!isFirebaseConfigured) return;
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
  }

  return { user, authLoading, signingIn, signIn, signOutUser, isLocal: !isFirebaseConfigured };
}
