import { useState, useEffect, useCallback, useRef } from "react";
import { isFirebaseConfigured, db } from "../firebase.js";
import { EMPTY } from "../constants.js";
import { startOrgSync, writeOrgDiff } from "../utils/firestoreSync.js";

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
// ⚠️ באג פרודקשן 16.8.2026 — login בלבד **אינו מספיק**. `isOrgAdmin` דורש
// `exists(orgs/{orgId})`, ולמשתמש חדש הארגון עוד לא נוצר, ולכן כל 14
// המאזינים נדחו מיד → "טעינת הנתונים נכשלה" על מסך ה-onboarding, ומאזין
// שנדחה מסתיים ואינו מנסה שוב → הבאנר נשאר גם אחרי יצירת הארגון.
//   התיקון (בקליינט; הכללים נכונים ולא נגענו בהם) — שלושה שלבים:
//     1. probeOrg לפני כל מאזין. "אין ארגון" = מצב תקין, לא שגיאה.
//     2. אין ארגון → EMPTY + onboarding, בלי מאזינים ובלי באנר.
//     3. אחרי שיצירת הארגון **הצליחה** → re-subscribe אוטומטי (attempt),
//        כי המאזין הקודם לא היה קיים ואין מי שינסה שוב.
//
// ⚠️ באג פרודקשן 17.8.2026 — **ה-orgId היה `user.uid` קשיח:**
//     const orgId = isFirebaseConfigured ? user?.uid || null : "local";
// זה עבד בדיוק למשתמש אחד — מי שיצר את הארגון. אדמין שני (מנהלת הכספים)
// נשלח ל-`orgs/{ה-uid שלה}`, שאינו קיים → onMissing → **מסך הקמה ראשונית**,
// ואילו השלימה אותו היה נוצר ארגון שני עם אפס רכבים. ולא הייתה שום עקיפה
// ידנית: גם הוספה של ה-uid שלה ל-`org.members` בקונסול לא הייתה עוזרת, כי
// הקליינט בכלל לא היה מבקש את הארגון הנכון.
//   התיקון: ה-orgId **מתקבל מבחוץ**, מ-useOrgAccess, שגוזר אותו מ-
//   `memberships/{uid}.orgId`. ליוצר הארגון זה יוצא אותו ערך (orgId === uid)
//   ולכן אין רגרסיה; לאדמין שני זה הארגון האמיתי.
//   וכל עוד ה-orgId עוד לא ידוע — **אף מאזין לא נפתח.** זה בדיוק הרצף
//   שנשבר ב-16.8, ואין ליצור אותו מחדש.
// ============================================================================
export function useData(user, orgId = null) {
  const [data, setData] = useState(() => {
    if (isFirebaseConfigured) return deepClone(EMPTY);
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? withDefaults(JSON.parse(raw)) : deepClone(EMPTY);
  });
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  // attempt — מדרבן re-subscribe אחרי שהארגון נוצר.
  const [attempt, setAttempt] = useState(0);
  // orgMissingRef — "מחובר, אבל מסמך הארגון עוד לא קיים". מצב תקין: זה
  // בדיוק המצב שבו ה-onboarding הוא המסך הנכון.
  const orgMissingRef = useRef(false);
  // hydratedOrgRef — לאיזה ארגון כבר סיימנו טעינה ראשונה. מונע ספלאש
  // ב-re-subscribe.
  const hydratedOrgRef = useRef(null);

  const activeOrgId = isFirebaseConfigured ? orgId || null : "local";

  // --- מצב מקומי: אין ענן, טעינה חד-פעמית ---
  useEffect(() => {
    if (isFirebaseConfigured) return;
    setLoading(false);
  }, []);

  // --- מצב ענן: סנכרון תת-אוספים, אחרי login **ואחרי שה-orgId ידוע** ---
  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;
    // אין orgId ⇒ עדיין לא יודעים לאיזה ארגון להאזין (useOrgAccess בעבודה,
    // או שאין גישה בכלל). **לא נרשמים** — מאזין שנדחה אינו מנסה שוב.
    if (!activeOrgId) return;
    let unsub = () => {};
    let cancelled = false;

    // ספלאש רק בטעינה הראשונה של הארגון הזה. ב-re-subscribe שאחרי
    // ה-onboarding כבר יש נתונים על המסך — אין סיבה להבהב.
    if (hydratedOrgRef.current !== activeOrgId) {
      setLoading(true);
      setData(deepClone(EMPTY));
    }

    startOrgSync(db, activeOrgId, {
      // selfUid — הרשומה שנכתבת היא **שלנו**, גם כשה-orgId אינו ה-uid שלנו.
      selfUid: user.uid,
      // אין ארגון — מצב תקין של משתמש חדש: EMPTY, בלי מאזינים ובלי באנר.
      onMissing: () => {
        if (cancelled) return;
        orgMissingRef.current = true;
        hydratedOrgRef.current = activeOrgId;
        setData(deepClone(EMPTY)); // settings.onboarded=false → מסך ההקמה
        setError(null);
        setLoading(false);
      },
      onData: (assembled) => {
        if (cancelled) return;
        orgMissingRef.current = false;
        hydratedOrgRef.current = activeOrgId;
        setData(assembled);
        setError(null);
        setLoading(false);
      },
      // כאן מגיעות רק שגיאות אמיתיות: רשת/קונפיג ב-probe, או דחייה
      // **אחרי** שהארגון כבר קיים (הרשאה נשללה, הארגון נמחק).
      onError: (err, phase) => {
        if (cancelled) return;
        console.error(`Firestore sync error (${phase})`, err);
        setError("auth.loadError");
        setLoading(false);
      },
    })
      .then((stop) => {
        if (cancelled) stop();
        else unsub = stop;
      })
      // רשת ביטחון: כשל בטעינת מודול ה-SDK עצמו. בלי זה ה-promise נדחה
      // בשקט וה-splash נשאר על המסך לנצח.
      .catch((err) => {
        if (cancelled) return;
        console.error("startOrgSync failed", err);
        setError("auth.loadError");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user?.uid, activeOrgId, attempt]);

  // persist מחזיר { ok } — כדי שה-onboarding לא יכריז "נוצר" על כתיבה שנדחתה.
  const persist = useCallback(
    async (next) => {
      const prev = dataRef.current;
      if (!isFirebaseConfigured) {
        setData(next);
        try {
          localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
        } catch (err) {
          console.error("localStorage write failed", err);
          setError("data.localFull");
          return { ok: false };
        }
        return { ok: true };
      }
      if (!user || !activeOrgId) return { ok: false };

      // creating — הכתיבה הזו היא **יצירת הארגון**. כאן לא כותבים אופטימית:
      // אם היצירה תידחה, משתמש שנשלח ללובי היה תקוע באפליקציה ריקה עם באנר
      // אדום ובלי דרך חזרה. במסלול הרגיל נשארים אופטימיים כמו קודם.
      const creating = orgMissingRef.current;
      if (!creating) setData(next);

      try {
        await writeOrgDiff(db, activeOrgId, prev, next, {
          selfUid: user.uid,
          ensureRoot: creating,
        });
        if (creating) {
          orgMissingRef.current = false;
          setData(next);
          setError(null);
          // הארגון קיים מעכשיו → מחברים את המאזינים. בלי זה הנתונים לא
          // חיים עד רענון ידני: מאזין שנדחה קודם אינו מנסה שוב, וכאן לא
          // היה מאזין בכלל.
          setAttempt((a) => a + 1);
        }
        return { ok: true };
      } catch (err) {
        console.error("Firestore write error", err);
        setError(creating ? "auth.orgCreateFailed" : "auth.loadError");
        return { ok: false, error: err };
      }
    },
    [user?.uid, activeOrgId]
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

  return {
    data,
    orgId: activeOrgId,
    persist,
    update,
    // כל עוד ה-orgId לא ידוע אנחנו **בטעינה**, לא ב"אין נתונים": בלי זה
    // המסך היה מציג לובי ריק לרגע בכל התחברות.
    loading: loading || (isFirebaseConfigured && Boolean(user) && !activeOrgId),
    error,
    setError,
    resetLocal,
    canEdit: true,
  };
}
