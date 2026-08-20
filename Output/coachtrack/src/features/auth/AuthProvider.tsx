/**
 * ספק האימות של האפליקציה.
 *
 * שני מאזינים, בסדר הזה בדיוק:
 *   1. `onAuthStateChanged` — מי מחובר ל-Firebase Auth.
 *   2. `onSnapshot` על `users/{uid}` — מה התפקיד שלו. **נרשם רק אחרי שיש uid.**
 *
 * הסדר הוא לא קוסמטיקה: כלל האבטחה על `users` קורא את `request.auth.uid`, ולכן
 * מאזין שנרשם לפני שההתחברות הושלמה מקבל `PERMISSION_DENIED` והמסך היה מציג
 * "טעינה נכשלה" בלי סיבה נראית לעין.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword,
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, firebaseAuth } from '../../lib/firebase';
import { usernameToEmail } from '../../lib/auth';
import type { User, UserDoc } from '../../types/types';
import { AuthContext } from './authContext';
import type { AuthContextValue, AuthState } from './authContext';

const INITIAL_STATE: AuthState = {
  status: 'initializing',
  user: null,
  profile: null,
  errorKey: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  /* ---- 1. מי מחובר ---- */
  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        // מצב הביניים: יש משתמש, אין עדיין פרופיל. המאזין למטה ייקח מכאן.
        setState({ status: 'loadingProfile', user: nextUser, profile: null, errorKey: null });
      } else {
        setState({ status: 'signedOut', user: null, profile: null, errorKey: null });
      }
    });
  }, []);

  /* ---- 2. מה התפקיד שלו — תלוי ב-uid, לא רץ לפניו ---- */
  const uid = user?.uid;

  useEffect(() => {
    if (!uid) return;

    const unsubscribe = onSnapshot(
      doc(db, 'users', uid),
      (snapshot) => {
        if (!snapshot.exists()) {
          // מלכודת #5: בלי מסמך users כל כלל אבטחה ייכשל. עדיף מסך מפורש
          // מאשר משתמש שרואה "אין הרשאה" בכל מסך.
          setState((prev) => ({ ...prev, status: 'noProfile', profile: null, errorKey: null }));
          return;
        }

        const data = snapshot.data() as User;
        const profile: UserDoc = { ...data, uid: snapshot.id };

        setState((prev) => ({
          ...prev,
          status: data.active === false ? 'inactive' : 'ready',
          profile,
          errorKey: null,
        }));
      },
      () => {
        setState((prev) => ({
          ...prev,
          status: 'profileError',
          profile: null,
          errorKey: 'auth.profile.errorBody',
        }));
      },
    );

    return unsubscribe;
  }, [uid]);

  const signIn = useCallback(async (username: string, password: string) => {
    // המרה לאימייל הסינתטי במקום אחד בלבד — lib/auth.ts.
    await signInWithEmailAndPassword(firebaseAuth, usernameToEmail(username), password);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(firebaseAuth);
  }, []);

  const changePassword = useCallback(async (newPassword: string) => {
    const current = firebaseAuth.currentUser;
    if (!current) throw new Error('אין משתמש מחובר');

    await updatePassword(current, newPassword);

    // הכיבוי של הדגל הוא עדכון-עצמי של שדה לא-רגיש, ולכן ה-rules מתירים אותו.
    // ה-onSnapshot למעלה יעדכן את המצב לבד — אין setState ידני כאן.
    await updateDoc(doc(db, 'users', current.uid), { mustChangePassword: false });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, signOut, changePassword }),
    [state, signIn, signOut, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
