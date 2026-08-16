import { useState, useCallback, useRef } from "react";
import { lookupVehicle, motSourceFrom } from "../utils/mot.js";

// ============================================================================
// useMotLookup — משיכה **אחת לפעולת משתמש מפורשת**. בלי לולאות רענון ובלי
// retry אוטומטי: מגבלות הקצב של data.gov.il אינן מתועדות, וה-CDN מוזיל
// חזרות רק כשהן מעטות.
//
// state: "idle" | "loading" | "found" | "deregistered" | "notFound"
//        | "network" | "invalid"
//
// ⚠️ אין כאן `lookupLog` ולא יהיה: לא בונים היסטוריית uid→לוחית. המאגר
// ציבורי ולא מאומת, כל אחד יכול לחפש כל מספר — ורישום שלנו היה יוצר בדיוק
// את המאגר שהחלטנו לא לבנות.
// ============================================================================
export function useMotLookup() {
  const [state, setState] = useState("idle");
  const [result, setResult] = useState(null);
  const [slow, setSlow] = useState(false);
  const slowTimer = useRef(null);

  const reset = useCallback(() => {
    clearTimeout(slowTimer.current);
    setState("idle");
    setResult(null);
    setSlow(false);
  }, []);

  const lookup = useCallback(async (plate) => {
    clearTimeout(slowTimer.current);
    setSlow(false);
    setState("loading");
    setResult(null);
    // אחרי 4 שניות אומרים "עוד רגע — המאגר קצת איטי", כדי שמשתמש מבוגר
    // לא יחשוב שנתקע. **הקישור להזנה ידנית נשאר פעיל כל הזמן.**
    slowTimer.current = setTimeout(() => setSlow(true), 4000);

    const res = await lookupVehicle(plate);
    clearTimeout(slowTimer.current);
    setResult(res);

    if (res.found && res.source === "active") setState("found");
    else if (res.found) setState("deregistered");
    else setState(res.reason); // notFound | network | invalid
    return res;
  }, []);

  return { state, result, slow, lookup, reset, motSource: result ? motSourceFrom(result) : null };
}
