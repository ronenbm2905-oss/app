import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isFirebaseConfigured, db } from "../firebase.js";
import { EMPTY, ENTITY_COLLECTIONS } from "../constants.js";
import { normalize } from "../schema.js";
import { listMyProjects, saveProject, subscribeProject, writeProjectDiff } from "../utils/firestoreSync.js";

const LOCAL_KEY = "pb_data";
const SETTINGS_KEY = "pb_settings";

/**
 * ה-`settings` הופרד לְמַפְתח משלו כשנוסף הענן (הפרויקט הפעיל הוא העדפה מקומית
 * ולא נתון משותף). הנפילה-לאחור קוראת את ההגדרות מה-blob הישן — בלעדיה
 * משתמש קיים היה נוחת בלובי במקום בפרויקט שהיה פתוח, וזה נראה כמו איבוד נתונים.
 */
const readLocalSettings = () => {
  const empty = { activeProjectId: null };
  try {
    const own = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (own?.activeProjectId) return { ...empty, ...own };
    const legacy = JSON.parse(localStorage.getItem(LOCAL_KEY));
    return legacy?.settings ? { ...empty, ...legacy.settings } : empty;
  } catch {
    return empty;
  }
};

/**
 * useData — מקור הנתונים היחיד.
 *
 * מצב מקומי (אין `.env`): blob יחיד ב-localStorage.
 * מצב ענן: `projects/{id}/<collection>` דרך onSnapshot, כתיבת דלתא בלבד.
 *
 * שתי מלכודות שנצרבו בפרויקטים קודמים ונאכפות כאן:
 *   1. **נרשמים ל-onSnapshot רק אחרי login** — ה-effect תלוי ב-`user?.uid`,
 *      ולא רץ על mount עם משתמש לא ידוע.
 *   2. **`settings` נשאר מקומי תמיד.** הפרויקט הפעיל הוא העדפת תצוגה של
 *      המשתמש הזה בדפדפן הזה — שמירתו בענן הייתה גורמת לכך ששני משתמשים
 *      מזיזים זה לזה את המסך.
 */
export function useData(user) {
  const [data, setData] = useState(() => {
    const settings = readLocalSettings();
    if (isFirebaseConfigured) return { ...normalize(null), settings };
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return { ...normalize(raw ? JSON.parse(raw) : null), settings };
    } catch {
      return { ...normalize(null), settings };
    }
  });
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [syncError, setSyncError] = useState(null);

  // המצב האחרון שידוע כמסונכרן — הבסיס לחישוב הדלתא בכתיבה.
  const syncedRef = useRef(null);

  const persistLocal = useCallback((next) => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next.settings));
      if (!isFirebaseConfigured) localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("שמירה מקומית נכשלה", e);
    }
  }, []);

  // --- ענן: רשימת הפרויקטים שלי (אחרי login בלבד) ---------------------------
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    if (!user?.email) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    listMyProjects(db, user.email)
      .then((projects) => {
        if (!alive) return;
        setData((cur) => ({ ...cur, projects }));
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setSyncError(e.message || String(e));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user?.email]);

  // --- ענן: הרשמה לפרויקט הפעיל --------------------------------------------
  const activeId = data.settings.activeProjectId;
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    if (!user?.email || !activeId) return;
    let alive = true;
    let unsub = () => {};
    subscribeProject(
      db,
      activeId,
      (incoming) => {
        if (!alive) return;
        setData((cur) => {
          const next = normalize({ ...cur, ...incoming, settings: cur.settings });
          next.settings = cur.settings;
          syncedRef.current = next;
          return next;
        });
        setSyncError(null);
      },
      (e) => alive && setSyncError(e.message || String(e)),
    ).then((u) => {
      if (alive) unsub = u;
      else u();
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [user?.email, activeId]);

  const applyNext = useCallback(
    (next) => {
      persistLocal(next);
      if (isFirebaseConfigured && next.settings.activeProjectId) {
        writeProjectDiff(db, next.settings.activeProjectId, syncedRef.current, next)
          .then(() => {
            syncedRef.current = next;
          })
          .catch((e) => setSyncError(e.message || String(e)));
      }
      return next;
    },
    [persistLocal],
  );

  const update = useCallback(
    (fn) => setData((cur) => applyNext(fn(cur))),
    [applyNext],
  );

  const upsert = useCallback(
    (collection, row) =>
      update((cur) => {
        const list = cur[collection] || [];
        const idx = list.findIndex((x) => x.id === row.id);
        const nextList = idx >= 0 ? list.map((x, i) => (i === idx ? row : x)) : [...list, row];
        return { ...cur, [collection]: nextList };
      }),
    [update],
  );

  const remove = useCallback(
    (collection, id) =>
      update((cur) => ({ ...cur, [collection]: (cur[collection] || []).filter((x) => x.id !== id) })),
    [update],
  );

  /** `settings` לעולם לא נכתב לענן — ראה הערת המלכודת למעלה. */
  const setSettings = useCallback(
    (patch) =>
      setData((cur) => {
        const next = { ...cur, settings: { ...cur.settings, ...patch } };
        persistLocal(next);
        return next;
      }),
    [persistLocal],
  );

  /** יצירת פרויקט — בענן נכתב מיד למסמך הפרויקט כדי שהכללים יכירו בבעלות. */
  const createProject = useCallback(
    async (project) => {
      if (isFirebaseConfigured) await saveProject(db, project);
      setData((cur) => {
        const next = { ...cur, projects: [...cur.projects, project] };
        persistLocal(next);
        return next;
      });
    },
    [persistLocal],
  );

  const replaceAll = useCallback(
    (raw) =>
      setData((cur) => {
        const next = { ...normalize(raw), settings: raw.settings || cur.settings };
        return applyNext(next);
      }),
    [applyNext],
  );

  const reset = useCallback(() => setData(() => applyNext(normalize(EMPTY))), [applyNext]);

  return useMemo(
    () => ({
      data,
      loading,
      syncError,
      cloudMode: isFirebaseConfigured,
      update,
      upsert,
      remove,
      setSettings,
      createProject,
      replaceAll,
      reset,
    }),
    [data, loading, syncError, update, upsert, remove, setSettings, createProject, replaceAll, reset],
  );
}

export { ENTITY_COLLECTIONS };
