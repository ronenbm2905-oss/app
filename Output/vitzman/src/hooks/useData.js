// ============================================================================
// useData — מקור הנתונים היחיד. שני מצבים, ממשק אחד.
//
//   · **מקומי** (אין `.env`): blob יחיד ב-localStorage. אדם אחד, מחשב אחד.
//   · **ענן** (יש `.env` + משתמש מורשה): Firestore ב-`orgs/{ORG_ID}/<collection>`,
//     עם `onSnapshot` — שינוי אצל רונן מופיע אצל אנדריי בלי לרענן.
//
// ⚠ **הצורה בזיכרון זהה בשני המצבים** — `{ buildings: [], contracts: [], … }`.
// זו ההכרעה שמאפשרת למיגרציה לא לגעת באף רכיב: כל 12 המסכים ממשיכים לקבל את
// אותו `data` ואת אותן פונקציות כתיבה, ולא יודעים אם הם בענן או לא.
//
// ⚠ **מסמך לכל ישות, לא blob אחד.** שתי סיבות, ושתיהן מכריעות: הנתונים שוקלים
// 1.08MB והמגבלה למסמך היא 1MB; וחשוב מזה — שני אנשים שעורכים blob אחד דורסים
// זה את זה, בעוד ששני מסמכים נפרדים פשוט נכתבים.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection as coll, doc, onSnapshot, writeBatch } from "firebase/firestore";
import { EMPTY, ENTITY_COLLECTIONS } from "../constants.js";
import { normalize } from "../schema.js";
import { indexContracts, indexFees } from "../utils/profitability.js";
import { db, isFirebaseConfigured, ORG_ID } from "../firebase.js";
import {
  chunkOps, planUpdate, planAdd, planApplyBatch,
  planRemove, planRemoveMany, planReplaceAll,
} from "../utils/cloudWrites.js";

const LOCAL_KEY = "vitzman_data";

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? normalize(JSON.parse(raw)) : normalize(EMPTY);
  } catch {
    return normalize(EMPTY);
  }
}

/**
 * @param {object} auth  תוצאת `useAuth`. במצב מקומי אפשר לא להעביר כלום.
 */
export function useData(auth = {}) {
  const cloud = isFirebaseConfigured && Boolean(auth.allowed);
  const [data, setData] = useState(readLocal);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(cloud);
  const [pending, setPending] = useState(0);

  // המצב האחרון, לקריאה בתוך callbacks בלי להוסיף אותו כתלות ולבנות אותם מחדש.
  const dataRef = useRef(data);
  dataRef.current = data;

  // --------------------------------------------------------------- מצב מקומי
  useEffect(() => {
    if (cloud) return;
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    } catch (e) {
      // מכסת localStorage היא ~5MB. עם 2,700 חוזים זה לא קרוב, אבל כישלון
      // שקט כאן פירושו איבוד נתונים — ולכן הוא מוצג במסך.
      setError(`שמירה מקומית נכשלה: ${e.message}`);
    }
  }, [data, cloud]);

  // ----------------------------------------------------------------- מצב ענן
  /**
   * ⚠ ה-effect תלוי ב-`auth.user?.uid` ולא ב-`[]`.
   *
   * זה הבאג שנצרב ב-basketball-scheduler: מנוי שנרשם ב-mount רץ **לפני**
   * שההתחברות הושלמה, `request.auth` הוא null, הכללים חוסמים — ואין
   * re-subscribe אחרי ה-login. התוצאה היא "טעינת הנתונים נכשלה" שלא מתאושש.
   */
  useEffect(() => {
    if (!cloud) return;
    setLoading(true);
    let alive = true;
    const arrived = new Set();

    const unsubs = ENTITY_COLLECTIONS.map((name) =>
      onSnapshot(
        coll(db, "orgs", ORG_ID, name),
        (snap) => {
          if (!alive) return;
          const rows = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
          // `normalize` על כל עדכון: הוא זול, והוא מה שמבטיח שרשומה שנכתבה
          // בגרסה ישנה של הסכימה נטענת עם השדות החדשים במקום להפיל מסך.
          setData((prev) => normalize({ ...prev, [name]: rows }));
          arrived.add(name);
          if (arrived.size === ENTITY_COLLECTIONS.length) setLoading(false);
        },
        (err) => {
          if (!alive) return;
          setError(`טעינת ${name} נכשלה: ${err.message}`);
          setLoading(false);
        }
      )
    );
    return () => { alive = false; unsubs.forEach((u) => u()); };
  }, [cloud, auth.user?.uid]);

  /**
   * ביצוע תוכנית כתיבה. **אופטימיות מקומית לא נדרשת** — `onSnapshot` מחזיר
   * את השינוי מיידית מהמטמון המקומי, עוד לפני שהשרת אישר. ולכן אין כאן
   * `setData`: מקור אמת אחד, בלי מצב מקומי שיכול להיפרד ממנו.
   */
  const runOps = useCallback(async (ops) => {
    if (!ops.length) return;
    setPending((n) => n + 1);
    try {
      for (const group of chunkOps(ops)) {
        const batch = writeBatch(db);
        for (const op of group) {
          const ref = doc(db, "orgs", ORG_ID, op.collection, op.id);
          if (op.op === "delete") batch.delete(ref);
          else batch.set(ref, op.data, { merge: op.op === "merge" });
        }
        await batch.commit();
      }
      setError("");
    } catch (e) {
      setError(`השמירה בענן נכשלה: ${e.message}`);
    } finally {
      setPending((n) => n - 1);
    }
  }, []);

  // ------------------------------------------------------- מוטציות: ממשק אחד
  const replaceAll = useCallback((raw) => {
    const next = normalize(raw);
    if (cloud) return runOps(planReplaceAll(next, dataRef.current));
    setData(next);
  }, [cloud, runOps]);

  const update = useCallback((collection, id, patch) => {
    if (cloud) return runOps(planUpdate(collection, id, patch));
    setData((d) => ({
      ...d,
      [collection]: (d[collection] || []).map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  }, [cloud, runOps]);

  const add = useCallback((collection, entity) => {
    if (cloud) return runOps(planAdd(collection, entity));
    setData((d) => ({ ...d, [collection]: [...(d[collection] || []), entity] }));
  }, [cloud, runOps]);

  /**
   * עדכון ויצירה בפעולה אחת ובעדכון-מצב אחד.
   *
   * הזנה מרוכזת נוגעת בעשרות רשומות; קריאה נפרדת ל-`update`/`add` לכל אחת
   * הייתה מייצרת עשרות רינדורים ועשרות כתיבות ל-localStorage. חשוב מזה —
   * `setData` הוא אסינכרוני, ולכן שרשרת קריאות נפרדות הייתה בונה כל אחת על
   * מצב ישן ומאבדת את קודמותיה. בענן זה גם `writeBatch` אחד במקום עשרות
   * הלוך-ושוב לשרת.
   */
  const applyBatch = useCallback((collection, { updates = [], creates = [] }) => {
    if (cloud) return runOps(planApplyBatch(collection, { updates, creates }));
    setData((d) => {
      const byId = new Map(updates.map((u) => [u.id, u.patch]));
      const existing = (d[collection] || []).map((x) =>
        byId.has(x.id) ? { ...x, ...byId.get(x.id) } : x
      );
      return { ...d, [collection]: [...existing, ...creates] };
    });
  }, [cloud, runOps]);

  /**
   * מחיקת ישות. משמש למחיקת שורת היסטוריית מחיר שנוצרה בטעות — עריכה שיוצרת
   * שורות חייבת לאפשר גם לנקות אותן, אחרת ההיסטוריה נהיית זבל שאי אפשר לתקן.
   * חוקיות המחיקה (למשל "לא למחוק את השורה האחרונה") נבדקת ב-`canDeleteEntry`
   * לפני הקריאה — כאן זו פעולת מצב בלבד.
   */
  const remove = useCallback((collection, id) => {
    if (cloud) return runOps(planRemove(collection, id));
    setData((d) => ({ ...d, [collection]: (d[collection] || []).filter((x) => x.id !== id) }));
  }, [cloud, runOps]);

  /**
   * מחיקה חוצת-אוספים בעדכון אחד. מחיקת בניין חייבת להוריד איתו את החוזים,
   * הסכמי הניהול, הביקורות וההערות שלו — קריאות `remove` נפרדות היו בונות כל
   * אחת על מצב ישן (`setData` אסינכרוני) ומשאירות שורות יתומות שמצביעות על
   * `buildingId` שכבר לא קיים.
   */
  const removeMany = useCallback((byCollection) => {
    if (cloud) return runOps(planRemoveMany(byCollection));
    setData((d) => {
      const next = { ...d };
      for (const [collection, ids] of Object.entries(byCollection || {})) {
        const drop = new Set(ids || []);
        if (!drop.size) continue;
        next[collection] = (d[collection] || []).filter((x) => !drop.has(x.id));
      }
      return next;
    });
  }, [cloud, runOps]);

  const reset = useCallback(() => {
    if (cloud) return runOps(planReplaceAll(normalize(EMPTY), dataRef.current));
    setData(normalize(EMPTY));
  }, [cloud, runOps]);

  /** העלאת מה שיושב כרגע ב-localStorage לענן — נתיב ההגירה החד-פעמי. */
  const uploadLocalToCloud = useCallback(() => {
    if (!cloud) return;
    return runOps(planReplaceAll(readLocal(), dataRef.current));
  }, [cloud, runOps]);

  // האינדקס נבנה פעם אחת לכל שינוי חוזים, לא בכל רינדור של כל שורה.
  const contractIndex = useMemo(() => indexContracts(data.contracts), [data.contracts]);
  const feeIndex = useMemo(() => indexFees(data.feeAgreements), [data.feeAgreements]);

  return {
    data, contractIndex, feeIndex,
    replaceAll, update, add, applyBatch, remove, removeMany, reset,
    uploadLocalToCloud, localSnapshot: readLocal,
    cloud, loading, saving: pending > 0, error,
  };
}
