import { useState, useEffect, useCallback } from "react";
import { parseHash, hrefFor } from "../utils/routes.js";

// ============================================================================
// useRoute — ראוטר hash קטן. **לא `useState` של מסך, ולא react-router.**
//
// שלוש סיבות, וכל אחת מהן לבדה מספיקה:
//   1. ה-shortcut ב-manifest מצביע ל-`#/emergency` — עמוד הערך השני של
//      המוצר. יעד של קיצור מערכת ההפעלה לא יכול להיות React state.
//   2. כפתור ה-back של אנדרואיד: בלי היסטוריה אמיתית, כל מסך יוצא
//      מהאפליקציה. משתמש מבוגר שלוחץ "חזרה" ומוצא את עצמו בחוץ לא חוזר.
//   3. deep-link מ-push בפרוסה 2.
//
// טבלת המסלולים והפרסור יושבים ב-`utils/routes.js` (טהורים, נבדקים ב-smoke).
// ============================================================================

export { parseHash, hrefFor };

export function useRoute() {
  const [route, setRoute] = useState(() =>
    parseHash(typeof window === "undefined" ? "" : window.location.hash)
  );

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    // כניסה ראשונה בלי hash — מקבעים "#/" כדי שה-back יעבוד מהמסך הראשון.
    if (!window.location.hash) window.location.replace("#/");
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((path, { replace = false } = {}) => {
    const href = hrefFor(path);
    if (replace) window.location.replace(href);
    else window.location.hash = href.slice(1);
  }, []);

  const back = useCallback(() => {
    if (window.history.length > 1) window.history.back();
    else navigate("/");
  }, [navigate]);

  return { route, navigate, back };
}
