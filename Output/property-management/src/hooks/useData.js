import { useState, useEffect, useCallback, useRef } from "react";
import { isFirebaseConfigured, db } from "../firebase.js";
import { EMPTY } from "../constants.js";
import { subscribeOwner, writeOwnerDiff } from "../utils/firestoreSync.js";

const LOCAL_KEY = "pm_data";

// ממזג blob מקומי חלקי עם EMPTY כדי שנתונים ישנים לא יקרסו על שדות חסרים.
function withDefaults(raw) {
  if (!raw) return structuredCloneSafe(EMPTY);
  return {
    ...structuredCloneSafe(EMPTY),
    ...raw,
    settings: { ...EMPTY.settings, ...(raw.settings || {}) },
  };
}

function structuredCloneSafe(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// useData(user) — בוחר מימוש לפי isFirebaseConfigured.
// מצב מקומי: localStorage (blob יחיד) — לא השתנה, כדי לא לשבור את הדמו.
// מצב ענן: תת-אוספים דרך firestoreSync (owners/{uid}/<collection>/<id>).
// ההרשמה נרשמת רק אחרי login (תלוי ב-user?.uid), לא ב-mount עם [].
export function useData(user) {
  const [data, setData] = useState(() => {
    if (isFirebaseConfigured) return structuredCloneSafe(EMPTY);
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? withDefaults(JSON.parse(raw)) : structuredCloneSafe(EMPTY);
  });
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  // --- מצב מקומי: אין ענן, טוען פעם אחת ---
  useEffect(() => {
    if (isFirebaseConfigured) return;
    setLoading(false);
  }, []);

  // --- מצב ענן: סנכרון תת-אוספים ---
  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;
    let unsub = () => {};
    let cancelled = false;
    setLoading(true);
    subscribeOwner(
      db,
      user.uid,
      (assembled) => {
        if (cancelled) return;
        setData(assembled);
        setError(null);
        setLoading(false);
      },
      (err) => {
        if (cancelled) return;
        console.error("Firestore snapshot error", err);
        setError("auth.loadError");
        setLoading(false);
      }
    )
      .then((fn) => {
        if (cancelled) fn();
        else unsub = fn;
      })
      .catch((err) => {
        console.error("subscribeOwner failed", err);
        setError("auth.loadError");
        setLoading(false);
      });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [user?.uid]);

  // כותב את המצב: localStorage מקומי (blob), או diff לתת-אוספים בענן.
  const persist = useCallback(
    async (next) => {
      const prev = dataRef.current;
      setData(next); // אופטימי — המאזין יאשר בהמשך
      if (!isFirebaseConfigured) {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
        return;
      }
      if (!user) return;
      try {
        await writeOwnerDiff(db, user.uid, prev, next);
      } catch (err) {
        console.error("Firestore write error", err);
        setError("auth.loadError");
      }
    },
    [user?.uid]
  );

  // update(mutator) — מקבל טיוטה של המצב הנוכחי, משנה, ושומר.
  const update = useCallback(
    (mutator) => {
      const draft = structuredCloneSafe(dataRef.current);
      const result = mutator(draft);
      const next = result || draft;
      return persist(next);
    },
    [persist]
  );

  return { data, setData, persist, update, loading, error, canEdit: true };
}
