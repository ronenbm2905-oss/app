import { useState, useEffect, useCallback, useRef } from "react";
import { isFirebaseConfigured, db } from "../firebase.js";
import { EMPTY, LOCAL_DATA_KEY } from "../constants.js";
import {
  subscribeHousehold,
  writeHouseholdDiff,
  ensureHousehold,
  ensureMembership,
} from "../utils/firestoreSync.js";
import { isOwner } from "../utils/access.js";
import { createStore } from "../utils/store.js";

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ממזג blob מקומי חלקי עם EMPTY כדי שנתונים ישנים לא יקרסו על שדות חסרים.
function withDefaults(raw) {
  if (!raw) return deepClone(EMPTY);
  return {
    ...deepClone(EMPTY),
    ...raw,
    household: { ...EMPTY.household, ...(raw.household || {}) },
    settings: { ...EMPTY.settings, ...(raw.settings || {}) },
  };
}

// ============================================================================
// useData(user) — בוחר מימוש לפי isFirebaseConfigured.
//   מצב מקומי: blob יחיד ב-localStorage. משתמש בודד שהוא הבעלים, כדי שאפשר
//              יהיה לבדוק את האפליקציה מיד בלי להקים פרויקט Firebase.
//   מצב ענן:   תת-אוספים דרך firestoreSync — households/{hid}/<collection>.
//
// 🔴 הבאג המתועד: ההרשמה ל-onSnapshot תלויה ב-**`[user?.uid]`** ונרשמת רק
// **אחרי** שההתחברות הושלמה (`if (!isFirebaseConfigured || !user) return;`).
// עם deps `[]` ה-effect רץ לפני שיש auth, ה-rules חוסמים (request.auth=null),
// והמשתמש מקבל "טעינה נכשלה" בלי re-subscribe. זה חזר בשני פרויקטים.
//
// hid בפרוסה 1 נזרע מה-uid של הבעלים — אבל הוא **מזהה אטום**: התפקיד נקרא
// ממפת ה-members ולא מהשוואת מזהים (N4). זה מה שיאפשר בעלים שני והעברת
// בעלות בלי הגירה.
// ============================================================================
export function useData(user) {
  const [data, setData] = useState(() => {
    if (isFirebaseConfigured) return deepClone(EMPTY);
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(LOCAL_DATA_KEY) : null;
    return raw ? withDefaults(JSON.parse(raw)) : deepClone(EMPTY);
  });
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState(null);

  // 🔴 המצב הנוכחי חי ב-store, ו**המצביע שלו מתקדם בכתיבה — לא ברינדור**.
  // זה מה שהיה שבור: `dataRef.current = data` בגוף הרכיב אומר שהמצביע מתעדכן
  // רק אחרי רינדור, ולכן שתי קריאות `update()` באותו handler שתיהן ראו את
  // אותו מצב-קדם והשנייה דרסה את הראשונה (ראו ההסבר המלא ב-utils/store.js).
  // הסמנטיקה יושבת בקובץ נפרד וטהור כדי שתהיה **בדיקה ב-Node, בלי React**.
  const storeRef = useRef(null);
  if (!storeRef.current) storeRef.current = createStore(data);
  const store = storeRef.current;

  const householdId = isFirebaseConfigured ? user?.uid || null : "local";

  // --- מצב מקומי: אין ענן, טעינה חד-פעמית ---
  useEffect(() => {
    if (isFirebaseConfigured) return;
    setLoading(false);
    // במצב מקומי המשתמש הבודד הוא הבעלים — נרשם במפת ה-members, כדי
    // שכל בדיקות ההרשאה יעברו דרך **אותו** מסלול בשני המצבים.
    // עובר דרך ה-store, כדי שגם הכתיבה הזאת תקדם את המצביע.
    const { next } = store.apply((draft) => {
      if (draft.household?.members?.["local-owner"] === "owner") return draft;
      draft.household = {
        ...draft.household,
        id: "local",
        members: { ...(draft.household?.members || {}), "local-owner": "owner" },
      };
      return draft;
    });
    setData(next);
  }, [store]);

  // --- מצב ענן: סנכרון תת-אוספים, אחרי login בלבד ---
  useEffect(() => {
    if (!isFirebaseConfigured || !user) return; // ← ה-early return המתועד
    let unsub = () => {};
    let cancelled = false;
    setLoading(true);

    const hid = user.uid;

    ensureHousehold(db, hid, user.uid, "")
      .then(() => ensureMembership(db, user.uid, hid, "owner"))
      .catch((err) => console.warn("household bootstrap skipped", err));

    subscribeHousehold(
      db,
      hid,
      user.uid,
      (assembled) => {
        if (cancelled) return;
        store.replace(assembled); // המצביע מתיישר עם הענן, לא ממתין לרינדור
        setData(assembled);
        setError(null);
        setLoading(false);
      },
      (err) => {
        if (cancelled) return;
        console.error("Firestore snapshot error", err);
        setError("error.load.title");
        setLoading(false);
      }
    )
      .then((fn) => {
        if (cancelled) fn();
        else unsub = fn;
      })
      .catch((err) => {
        console.error("subscribeHousehold failed", err);
        setError("error.load.title");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user?.uid]); // ← לעולם לא []

  // flush — צד הקלט/פלט בלבד. **הוא כבר מקבל prev ו-next מה-store**,
  // ולא קורא שוב את המצב, כדי שלא ייווצר מקור אמת שני.
  const flush = useCallback(
    async (prev, next) => {
      setData(next); // אופטימי — המאזין יאשר בהמשך
      if (!isFirebaseConfigured) {
        try {
          localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(next));
        } catch (err) {
          console.error("localStorage write failed", err);
          setError("error.save.title");
        }
        return;
      }
      if (!user) return;
      try {
        await writeHouseholdDiff(db, user.uid, prev, next);
      } catch (err) {
        console.error("Firestore write error", err);
        setError("error.save.title");
      }
    },
    [user?.uid]
  );

  // ============================================================================
  // update(mutator) — מקבל טיוטה של המצב הנוכחי, משנה אותה, ושומר.
  //
  // 🔴 **המצב-קדם נלקח מה-store, שמתקדם בכתיבה.** שתי קריאות רצופות באותו
  // handler רואות זו את התוצאה של זו. בלי זה — השנייה דורסת את הראשונה,
  // וזה בדיוק באג הרכב-שנעלם.
  // ============================================================================
  const update = useCallback(
    (mutator) => {
      const { prev, next } = store.apply(mutator);
      return flush(prev, next);
    },
    [store, flush]
  );

  // כתיבה של מצב שלם (נשמר לתאימות; אין לו קורא בקוד המסכים).
  const persist = useCallback(
    (next) => {
      const r = store.replace(next);
      return flush(r.prev, r.next);
    },
    [store, flush]
  );

  const resetLocal = useCallback(() => {
    if (isFirebaseConfigured) return;
    localStorage.removeItem(LOCAL_DATA_KEY);
    const empty = deepClone(EMPTY);
    store.replace(empty);
    setData(empty);
  }, [store]);

  // N4 — ההרשאה נקראת ממפת ה-members, גם בקליינט. אותו מסלול כמו ב-rules.
  const canEdit = isOwner(data.household, user?.uid);

  return { data, householdId, persist, update, loading, error, setError, resetLocal, canEdit };
}
