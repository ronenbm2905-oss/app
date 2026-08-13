import { useState, useEffect, useCallback } from "react";
import { parseHash, hrefFor } from "../utils/routes.js";

export { parseHash, hrefFor };

// ראוטר hash קטן. הנימוק המלא ב-utils/routes.js — בקצרה: קונפיגורציה שאפשר
// לשתף בקישור, וכפתור "חזרה" של הדפדפן שעובד.
export function useRoute() {
  const [route, setRoute] = useState(() =>
    parseHash(typeof window === "undefined" ? "" : window.location.hash)
  );

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    if (!window.location.hash) window.location.replace("#/");
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((path, query, { replace = false } = {}) => {
    const target = hrefFor(path, query);
    if (replace) window.location.replace(target);
    else window.location.hash = target.slice(1);
  }, []);

  const back = useCallback(() => {
    if (window.history.length > 1) window.history.back();
    else navigate("/");
  }, [navigate]);

  // גלילה לראש בכל החלפת **מסך** (לא בכל שינוי query — אחרת בחירת אבן
  // בקונפיגורטור קופצת לראש הדף וזה מרגיש שבור).
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [route.name, route.params?.id]);

  return { route, navigate, back };
}
