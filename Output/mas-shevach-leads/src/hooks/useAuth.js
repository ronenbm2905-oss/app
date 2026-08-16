// ============================================================================
// useAuth.js — כניסת Google לקונסולה.
//
// 🔴 `user != null` **אינו** הרשאה (עדי R-4). כל בעל חשבון Google בעולם הוא
//    `request.auth != null`; במאגר הזה זה אומר שכולם קוראים את רשימת
//    הלידים. ההרשאה נקבעת ב-`firestore.rules` — claim `role == 'owner'`
//    או allowlist מיילים מפורש.
//
//    `isOwner` שמוחזר כאן הוא **UX בלבד** (מה להציג). מה שבאמת עוצר הוא
//    שהקריאה ל-Firestore תיכשל. הקונסולה מתרגמת את הכישלון הזה להודעה
//    ברורה במקום ל"טעינה נכשלה" סתמי.
// ============================================================================

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "../firebase";

// המשתמש המקומי — קיים רק כשאין ענן, כדי שהמסך ייבדק בלי פרויקט.
const LOCAL_USER = { uid: "local", displayName: "מצב מקומי", email: null, local: true };

export function useAuth() {
  const [user, setUser] = useState(isFirebaseConfigured ? null : LOCAL_USER);
  const [ready, setReady] = useState(!isFirebaseConfigured);
  const [claimOwner, setClaimOwner] = useState(!isFirebaseConfigured);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(
      auth,
      async (u) => {
        setUser(u);
        if (u) {
          try {
            // קריאת ה-claim משמשת **רק** להצגה. ההרשאה נאכפת בשרת.
            const res = await u.getIdTokenResult();
            setClaimOwner(res?.claims?.role === "owner");
          } catch {
            setClaimOwner(false);
          }
        } else {
          setClaimOwner(false);
        }
        setReady(true);
      },
      (err) => {
        console.error("[auth]", err);
        setError(err);
        setReady(true);
      }
    );
  }, []);

  const login = async () => {
    if (!isFirebaseConfigured) return;
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("[auth] login", err);
      setError(err);
    }
  };

  const logout = async () => {
    if (!isFirebaseConfigured) return;
    await signOut(auth);
  };

  return { user, ready, claimOwner, error, login, logout, isLocal: !isFirebaseConfigured };
}
