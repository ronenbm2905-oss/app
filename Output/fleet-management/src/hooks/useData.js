import { useState, useEffect, useCallback, useRef } from "react";
import { isFirebaseConfigured, db } from "../firebase.js";
import { EMPTY } from "../constants.js";
import { subscribeOrg, writeOrgDiff, ensureMembership } from "../utils/firestoreSync.js";

const LOCAL_KEY = "fleet_data";

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ממזג blob מקומי חלקי עם EMPTY כדי שנתונים ישנים לא יקרסו על שדות חסרים.
function withDefaults(raw) {
  if (!raw) return deepClone(EMPTY);
  return {
    ...deepClone(EMPTY),
    ...raw,
    org: { ...EMPTY.org, ...(raw.org || {}) },
    settings: { ...EMPTY.settings, ...(raw.settings || {}) },
  };
}

// ============================================================================
// useData(user) — בוחר מימוש לפי isFirebaseConfigured.
//   מצב מקומי: blob יחיד ב-localStorage (הדמו; בכוונה לא תת-אוספים).
//   מצב ענן:   תת-אוספים דרך firestoreSync — orgs/{orgId}/<collection>/<id>.
//
// ההרשמה ל-onSnapshot תלויה ב-user?.uid ונרשמת **רק אחרי login** — אחרת
// ה-rules חוסמים (request.auth=null) ומקבלים "טעינה נכשלה" בלי re-subscribe.
//
// orgId בפרוסה 1 = uid של האדמין שיצר את הארגון. בפרוסה 2 נהג יגלה את ה-orgId
// שלו דרך memberships/{uid}, בלי שינוי מבנה.
// ============================================================================
export function useData(user) {
  const [data, setData] = useState(() => {
    if (isFirebaseConfigured) return deepClone(EMPTY);
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? withDefaults(JSON.parse(raw)) : deepClone(EMPTY);
  });
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const orgId = isFirebaseConfigured ? user?.uid || null : "local";

  // --- מצב מקומי: אין ענן, טעינה חד-פעמית ---
  useEffect(() => {
    if (isFirebaseConfigured) return;
    setLoading(false);
  }, []);

  // --- מצב ענן: סנכרון תת-אוספים, אחרי login בלבד ---
  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;
    let unsub = () => {};
    let cancelled = false;
    setLoading(true);

    ensureMembership(db, user.uid, user.uid, "admin").catch((err) =>
      console.warn("membership write skipped", err)
    );

    subscribeOrg(
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
        console.error("subscribeOrg failed", err);
        setError("auth.loadError");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user?.uid]);

  const persist = useCallback(
    async (next) => {
      const prev = dataRef.current;
      setData(next); // אופטימי — המאזין יאשר בהמשך
      if (!isFirebaseConfigured) {
        try {
          localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
        } catch (err) {
          console.error("localStorage write failed", err);
          setError("data.localFull");
        }
        return;
      }
      if (!user) return;
      try {
        await writeOrgDiff(db, user.uid, prev, next);
      } catch (err) {
        console.error("Firestore write error", err);
        setError("auth.loadError");
      }
    },
    [user?.uid]
  );

  // update(mutator) — מקבל טיוטה של המצב הנוכחי, משנה אותה, ושומר.
  const update = useCallback(
    (mutator) => {
      const draft = deepClone(dataRef.current);
      const result = mutator(draft);
      return persist(result || draft);
    },
    [persist]
  );

  const resetLocal = useCallback(() => {
    if (isFirebaseConfigured) return;
    localStorage.removeItem(LOCAL_KEY);
    setData(deepClone(EMPTY));
  }, []);

  return { data, orgId, persist, update, loading, error, setError, resetLocal, canEdit: true };
}
