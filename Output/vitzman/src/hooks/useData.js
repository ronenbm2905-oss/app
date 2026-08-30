// ============================================================================
// useData — מקור הנתונים היחיד.
//
// פרוסה 1: blob יחיד ב-localStorage. שכבת הענן (Firestore, בידוד בנתיב
// `orgs/{id}/<collection>` כמו ב-project-budget) נכנסת בפרוסה הבאה —
// המבנה כאן כבר מוכן לה: כל מוטציה עוברת דרך `update`, נקודה אחת להחלפה.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { EMPTY } from "../constants.js";
import { normalize } from "../schema.js";
import { indexContracts, indexFees } from "../utils/profitability.js";

const LOCAL_KEY = "vitzman_data";

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? normalize(JSON.parse(raw)) : normalize(EMPTY);
  } catch {
    return normalize(EMPTY);
  }
}

export function useData() {
  const [data, setData] = useState(readLocal);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    } catch (e) {
      // מכסת localStorage היא ~5MB. עם 2,700 חוזים זה לא קרוב, אבל כישלון
      // שקט כאן פירושו איבוד נתונים — ולכן הוא מוצג במסך.
      setError(`שמירה מקומית נכשלה: ${e.message}`);
    }
  }, [data]);

  /** החלפת המצב כולו — הנתיב של הייבוא. */
  const replaceAll = useCallback((raw) => setData(normalize(raw)), []);

  /** עדכון ישות בודדת באוסף. */
  const update = useCallback((collection, id, patch) => {
    setData((d) => ({
      ...d,
      [collection]: (d[collection] || []).map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  }, []);

  const add = useCallback((collection, entity) => {
    setData((d) => ({ ...d, [collection]: [...(d[collection] || []), entity] }));
  }, []);

  /**
   * עדכון ויצירה בפעולה אחת ובעדכון-מצב אחד.
   *
   * הזנה מרוכזת נוגעת בעשרות רשומות; קריאה נפרדת ל-`update`/`add` לכל אחת
   * הייתה מייצרת עשרות רינדורים ועשרות כתיבות ל-localStorage. חשוב מזה —
   * `setData` הוא אסינכרוני, ולכן שרשרת קריאות נפרדות הייתה בונה כל אחת על
   * מצב ישן ומאבדת את קודמותיה.
   */
  const applyBatch = useCallback((collection, { updates = [], creates = [] }) => {
    setData((d) => {
      const byId = new Map(updates.map((u) => [u.id, u.patch]));
      const existing = (d[collection] || []).map((x) =>
        byId.has(x.id) ? { ...x, ...byId.get(x.id) } : x
      );
      return { ...d, [collection]: [...existing, ...creates] };
    });
  }, []);

  /**
   * מחיקת ישות. משמש למחיקת שורת היסטוריית מחיר שנוצרה בטעות — עריכה שיוצרת
   * שורות חייבת לאפשר גם לנקות אותן, אחרת ההיסטוריה נהיית זבל שאי אפשר לתקן.
   * חוקיות המחיקה (למשל "לא למחוק את השורה האחרונה") נבדקת ב-`canDeleteEntry`
   * לפני הקריאה — כאן זו פעולת מצב בלבד.
   */
  const remove = useCallback((collection, id) => {
    setData((d) => ({ ...d, [collection]: (d[collection] || []).filter((x) => x.id !== id) }));
  }, []);

  const reset = useCallback(() => setData(normalize(EMPTY)), []);

  // האינדקס נבנה פעם אחת לכל שינוי חוזים, לא בכל רינדור של כל שורה.
  const contractIndex = useMemo(() => indexContracts(data.contracts), [data.contracts]);
  const feeIndex = useMemo(() => indexFees(data.feeAgreements), [data.feeAgreements]);

  return { data, contractIndex, feeIndex, replaceAll, update, add, applyBatch, remove, reset, error };
}
