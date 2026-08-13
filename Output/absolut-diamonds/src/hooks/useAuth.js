import { useState, useEffect, useCallback } from "react";
import { isFirebaseConfigured, auth, googleProvider, db } from "../firebase.js";

// ============================================================================
// useAuth — התחברות **לאדמין בלבד.**
//
// 🔴 קו אדום מהאפיון: אין הרשמה ואין חשבונות לקוח. שום מסך ציבורי לא קורא
// ל-signIn ולא מציג כפתור התחברות. ה-hook הזה חי רק מתחת ל-#/admin.
//
// במצב מקומי אין התחברות בכלל: משתמש בודד שהוא אדמין (זה מה שמאפשר לבדוק את
// מסך הניהול בלי להקים Firebase).
// ============================================================================

const LOCAL_ADMIN = {
  uid: "local-admin",
  displayName: "מנהל מקומי",
  email: "local@demo",
  isLocal: true,
};

export function useAuth() {
  const [user, setUser] = useState(isFirebaseConfigured ? null : LOCAL_ADMIN);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured);
  const [authError, setAuthError] = useState(null);
  // null = עוד לא ידוע. במצב מקומי — אדמין תמיד.
  const [isAdmin, setIsAdmin] = useState(isFirebaseConfigured ? null : true);

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
            if (!u) setIsAdmin(null);
          },
          (err) => {
            console.error("auth error", err);
            setAuthError("common.error");
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

  // 🔴 A6.6 — הרשאה **לפי תפקיד, לא לפי קיום סשן**: קיום מסמך `admins/{uid}`.
  // `request.auth != null` אינו מספיק — ביום שבו יופעל ספק הרשמה כלשהו או
  // Anonymous Auth, כל מבקר היה הופך לאדמין.
  // ⚠️ זו בדיקת **UX** בלבד — היא רק מחליטה אם להראות את המסך. האכיפה
  // האמיתית ב-firestore.rules, שמריצות בדיוק את אותה בדיקה בצד השרת.
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        const snap = await getDoc(doc(db, "admins", user.uid));
        if (cancelled) return;
        setIsAdmin(snap.exists());
      } catch (err) {
        console.error("admin check failed", err);
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const signIn = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) return;
    setAuthError(null);
    try {
      const { signInWithPopup } = await import("firebase/auth");
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("signIn failed", err);
      setAuthError("common.error");
    }
  }, []);

  const signOutUser = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) return;
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
    setIsAdmin(null);
  }, []);

  return {
    user,
    isAdmin,
    authLoading,
    authError,
    signIn,
    signOut: signOutUser,
    isLocal: !isFirebaseConfigured,
  };
}
