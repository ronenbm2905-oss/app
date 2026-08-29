// ============================================================================
// useAuth.ts — זרימת ה**זהות**. `signInWithPopup`, ותו לא.
//
// ---------------------------------------------------------------------------
// ★★ מה שהקובץ הזה **לא** עושה, וזו הנקודה
// ---------------------------------------------------------------------------
// הוא לא מבקש שום הרשאה ל-Gmail. אין `addScope`, אין `gmail.readonly`, ואין
// `accessToken` שנשלף מהתוצאה. כניסה לכלי היא כניסה לכלי.
//
// ההרשאה לקרוא את התיבה היא **החלטה שנייה, במסך נפרד, אחרי מסך ההסבר**,
// והיא עוברת ב-`googleAuthStart` בצד השרת. מיזוג השתיים היה חוסך לחיצה
// ומייצר בדיוק את הכשל שסעיף 5.2 בסקירה מתאר: הסכמה שתועדה ולא הושגה.
//
// ---------------------------------------------------------------------------
// ★ המצב המקומי — משתמשת סינתטית
// ---------------------------------------------------------------------------
// בלי Firebase אין התחברות בכלל, ולכן מוחזר משתמש מקומי קבוע. `LOCAL_USER_ID`
// הוא אותו קבוע שכבר היה, כדי ששום מבנה נתונים לא ישתנה בין המצבים.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../firebase';
import { LOCAL_USER_ID } from '../constants';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  /** `true` במצב המקומי — כלומר אין חשבון ואין ענן. */
  local: boolean;
}

const LOCAL_USER: AppUser = {
  uid: LOCAL_USER_ID,
  email: null,
  displayName: 'מצב מקומי',
  local: true,
};

export interface UseAuth {
  user: AppUser | null;
  authLoading: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  isFirebaseConfigured: boolean;
}

export function useAuth(): UseAuth {
  const [user, setUser] = useState<AppUser | null>(isFirebaseConfigured ? null : LOCAL_USER);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(
        u ? { uid: u.uid, email: u.email, displayName: u.displayName, local: false } : null,
      );
      setAuthLoading(false);
    });
  }, []);

  const signIn = useCallback(async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) return;
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch {
      // ★ בלי פרטים טכניים ובלי `console` — הודעה שאפשר לפעול לפיה.
      setAuthError('ההתחברות לא הצליחה. אפשר לנסות שוב, ואם זה חוזר — רונן צריך להסתכל.');
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) return;
    await fbSignOut(auth);
  }, []);

  return { user, authLoading, authError, signIn, signOut, isFirebaseConfigured };
}
