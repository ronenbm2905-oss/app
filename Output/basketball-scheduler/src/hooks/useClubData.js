import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, CLUB_ID, isFirebaseConfigured } from "../firebase";
import { EMPTY, STORAGE_KEY } from "../constants";
import { withScheduleChanges } from "../utils/scheduleChanges";

// Merge stored data over defaults so older/partial documents don't crash the UI.
function withDefaults(partial) {
  return { ...EMPTY, ...partial };
}

// ---- LOCAL MODE (localStorage) ----
function useLocalClubData() {
  const [data, setData] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      setData(raw ? withDefaults(JSON.parse(raw)) : EMPTY);
    } catch {
      setData(EMPTY);
    } finally {
      setLoaded(true);
    }
  }, []);

  const save = useCallback((next) => {
    setData(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setError(null);
    } catch {
      setError("השמירה נכשלה, נסה שוב.");
    }
  }, []);

  // In local mode there is no auth — the single local user has full control.
  return { data, save, loaded, error, isAdmin: true, mode: "local" };
}

// ---- CLOUD MODE (Firestore, real-time) ----
function useCloudClubData(user) {
  const [data, setData] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return; // local mode: this hook's effect is inert
    // Wait until the user is authenticated before subscribing — the security rules
    // require request.auth != null, so listening while signed-out would be denied.
    if (!user) {
      setLoaded(false);
      return;
    }
    setError(null);
    const ref = doc(db, "clubs", CLUB_ID);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setData(snap.exists() ? withDefaults(snap.data()) : EMPTY);
        setLoaded(true);
      },
      (err) => {
        if (err?.code === "permission-denied") {
          setError(
            'אין לך הרשאת גישה למועדון זה. כדי לצפות בלוח, בקש ממנהל המערכת להוסיף את כתובת הדוא"ל שלך לרשימת המורשים.'
          );
        } else {
          setError("טעינת הנתונים נכשלה. בדוק חיבור והרשאות.");
        }
        setLoaded(true);
      }
    );
    return unsub;
  }, [user?.uid]);

  const isAdmin = Boolean(
    user?.email &&
      (data.admins || []).some(
        (a) => a.toLowerCase() === user.email.toLowerCase()
      )
  );

  const save = useCallback(
    async (next) => {
      if (!isAdmin) {
        setError("רק מנהל יכול לשמור שינויים.");
        return;
      }
      try {
        await setDoc(doc(db, "clubs", CLUB_ID), next);
        setError(null);
      } catch {
        setError("השמירה נכשלה, נסה שוב.");
      }
    },
    [isAdmin]
  );

  return { data, save, loaded, error, isAdmin, mode: "cloud" };
}

// Single entry point — picks the implementation based on configuration.
//
// Every write goes through `withScheduleChanges`, and that is the whole reason it sits
// here rather than at the call sites. A session moves from the session form, from a drag on
// the board, from a delete, from "שכפל שבוע קודם", from the CSV import and from the
// fixed-teams strip — six places today and a seventh next month. Diffing once, where the
// old document and the new one are both in hand, is the only version of this that cannot
// be forgotten. A save that touches no session writes no log.
export function useClubData(user) {
  const local = useLocalClubData();
  const cloud = useCloudClubData(user);
  const base = isFirebaseConfigured ? cloud : local;

  const save = useCallback(
    (next) => base.save(withScheduleChanges(base.data, next)),
    [base.data, base.save]
  );

  return { ...base, save };
}
