// Reads one published week for the parent portal.
//
// This is the ONLY club data the portal ever touches. It deliberately does not use
// useClubData: that hook reads clubs/{id}, which holds players' personal data and the
// admin allowlists, and parents must never have permission to read it.

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../firebase";
import { PUBLISHED_STORAGE_KEY } from "../constants";

const readLocal = (weekOf) => {
  try {
    const all = JSON.parse(window.localStorage.getItem(PUBLISHED_STORAGE_KEY) || "{}");
    return all[weekOf] || null;
  } catch {
    return null;
  }
};

export function usePublishedWeek(clubId, weekOf) {
  const [week, setWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!weekOf) return;
    setLoading(true);
    setError(null);

    if (!isFirebaseConfigured) {
      setWeek(readLocal(weekOf));
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, "clubs", clubId, "published", weekOf),
      (snap) => {
        setWeek(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      (err) => {
        setError(
          err?.code === "permission-denied"
            ? "אין הרשאה לצפות בלו״ז של המועדון הזה. ודא שהצטרפת עם הקוד שקיבלת מהמאמן."
            : "טעינת הלו״ז נכשלה. בדוק את החיבור לאינטרנט."
        );
        setLoading(false);
      }
    );
    return unsub;
  }, [clubId, weekOf]);

  return { week, loading, error };
}
