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
import { indexContracts } from "../utils/profitability.js";

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

  const reset = useCallback(() => setData(normalize(EMPTY)), []);

  // האינדקס נבנה פעם אחת לכל שינוי חוזים, לא בכל רינדור של כל שורה.
  const contractIndex = useMemo(() => indexContracts(data.contracts), [data.contracts]);

  return { data, contractIndex, replaceAll, update, add, reset, error };
}
