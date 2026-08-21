import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isFirebaseConfigured, db, CONFIGURED_ORG_ID } from "../firebase.js";
import { canonicalEmail } from "../utils/admins.js";
import { linkFields } from "../utils/driverLink.js";
import { createDriverReading, validateDriverReading } from "../utils/portal.js";
import { newId } from "../utils/id.js";
import { todayIso } from "../utils/dates.js";

// ============================================================================
// useDriverPortal — הזהות והנתונים של **הנהג**, בנפרד לחלוטין ממסלול האדמין.
//
// למה hook נפרד ולא הרחבה של useData: `useData` נרשם ל-14 מאזינים על **כל**
// תת-האוספים של הארגון. לנהג אין הרשאה לאף אחד מהם, ולכן הפעלתו הייתה
// מייצרת 14 דחיות — וכל אחת מהן מסיימת מאזין שאינו מנסה שוב. זה בדיוק
// המנגנון של באג 16.8. הנהג קורא שלוש שאילתות ממוקדות, וזהו.
//
// ============================================================================
// שלושת המצבים, ומדוע ההבחנה ביניהם חשובה
// ============================================================================
//   'loading' → עוד לא יודעים. splash.
//   'linked'  → יש רשומת נהג פעילה שקשורה ל-uid הזה. פורטל.
//   'none'    → אין. **מסך "אין הרשאה" — לעולם לא onboarding.**
//
// ⚠️ הזרימה מגיעה לכאן **רק** אחרי ש-useOrgAccess החזיר 'none', כלומר
// המשתמש אינו אדמין. אדמין שהוא גם נהג נשאר במסלול האדמין — הוא רואה שם
// ממילא הכל.
//
// ============================================================================
// הקישור — האירוע החד-פעמי
// ============================================================================
// 1. מחפשים רשומה שכבר קשורה ל-uid:  where('userId','==',uid)
// 2. אם אין — מחפשים רשומה **לא מקושרת** עם המייל שלנו, ותובעים אותה.
//
// שתי השאילתות נשענות על שני סעיפי ה-read השונים ב-firestore.rules, ולכן
// הסדר אינו שרירותי: (1) חייבת לרוץ ראשונה, כי אחרי הקישור התנאי של (2)
// (`userId == null`) כבר אינו מתקיים והשאילתה תידחה.
//
// ⚠️ **אין כאן שום הנחה על Google.** `user.email` ו-`user.emailVerified`
// מגיעים מ-`onAuthStateChanged` וקיימים זהים בכל ספק. החלפה ל-Microsoft היא
// הפעלת ספק בקונסולה + ניתוק/חיבור מחדש — לא שינוי בקובץ הזה.
// ============================================================================
const LOADING = { status: "loading", driver: null, error: null };

export function useDriverPortal(user, { enabled = true } = {}) {
  const [state, setState] = useState(LOADING);
  const [entry, setEntry] = useState(null);
  const [readings, setReadings] = useState([]);
  const [attempt, setAttempt] = useState(0);
  const orgId = CONFIGURED_ORG_ID;
  // linkAttemptedRef — תביעת הרשומה מתבצעת פעם אחת לכל התחברות. בלי זה,
  // כישלון כתיבה (למשל מירוץ בין שני מכשירים) היה מייצר ניסיונות חוזרים.
  const linkAttemptedRef = useRef(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !enabled || !user?.uid || !orgId) {
      setState((s) => (s.status === "loading" ? s : LOADING));
      return;
    }
    let cancelled = false;
    setState(LOADING);

    (async () => {
      const { collection, query, where, getDocs, doc, updateDoc } = await import(
        "firebase/firestore"
      );
      const col = collection(db, "orgs", orgId, "drivers");

      const first = async (q) => {
        const snap = await getDocs(q);
        return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
      };

      // (1) כבר מקושר?
      let driver = await first(query(col, where("userId", "==", user.uid)));

      // (2) לא — רשומה לא מקושרת עם המייל שלי.
      if (!driver && user.email && user.emailVerified) {
        // שתי צורות: מה שהאדמין הקליד, ומה שגימייל מתקנן אליו. השאילתה היא
        // התאמה מדויקת, ולכן צורה אחת אינה מספיקה (3.2.4 בהכוונת עדי).
        const forms = [...new Set([String(user.email).trim().toLowerCase(), canonicalEmail(user.email)])];
        for (const form of forms) {
          const candidate = await first(query(col, where("email", "==", form)));
          if (!candidate) continue;
          if (candidate.userId) continue; // מקושרת למישהו אחר — לא נוגעים
          if (linkAttemptedRef.current === user.uid) break;
          linkAttemptedRef.current = user.uid;
          try {
            await updateDoc(
              doc(db, "orgs", orgId, "drivers", candidate.id),
              linkFields(user.uid, user.email, todayIso())
            );
            driver = { ...candidate, ...linkFields(user.uid, user.email, todayIso()) };
          } catch (err) {
            // הכלל דחה — סטטוס 'revoked', מייל לא מאומת, או מירוץ. זה מצב
            // תקין שמסתיים ב"אין הרשאה", לא שגיאה שצריך להציג באדום.
            console.warn("driver link rejected", err?.code || err);
          }
          break;
        }
      }

      if (cancelled) return;
      if (!driver || driver.portalStatus !== "active" || driver.status === "archived") {
        setState({ status: "none", driver: null, error: null });
        return;
      }
      setState({ status: "linked", driver, error: null });
    })().catch((err) => {
      if (cancelled) return;
      console.error("driver portal resolve failed", err);
      setState({ status: "none", driver: null, error: err });
    });

    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.email, enabled, orgId, attempt]);

  // -- ההיטל והדיווחים: מאזינים **רק** אחרי שהקישור אומת -------------------
  const driverId = state.status === "linked" ? state.driver.id : null;

  useEffect(() => {
    if (!isFirebaseConfigured || !driverId || !orgId) {
      setEntry(null);
      setReadings([]);
      return;
    }
    let stop = () => {};
    let cancelled = false;
    (async () => {
      const { doc, onSnapshot, collection, query, where } = await import("firebase/firestore");
      const unsubs = [];
      unsubs.push(
        onSnapshot(
          doc(db, "orgs", orgId, "driverPortal", driverId),
          (snap) => !cancelled && setEntry(snap.exists() ? snap.data() : null),
          (err) => console.warn("portal entry listener", err?.code || err)
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, "orgs", orgId, "odometerReadings"), where("driverId", "==", driverId)),
          (qs) => !cancelled && setReadings(qs.docs.map((d) => d.data())),
          (err) => console.warn("readings listener", err?.code || err)
        )
      );
      if (cancelled) unsubs.forEach((u) => u());
      else stop = () => unsubs.forEach((u) => u());
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [driverId, orgId]);

  const sorted = useMemo(
    () => [...readings].sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [readings]
  );

  // ==========================================================================
  // submitReading — הכתיבה היחידה של הנהג. מחזירה { ok, errorKey } ולעולם
  // לא זורקת: מסך שנופל על exception באמצע דיווח הוא מסך שהעובד לא ידווח בו
  // שוב. הכלל בצד השרת הוא האכיפה; הבדיקות כאן הן ההסבר.
  // ==========================================================================
  const submitReading = useCallback(
    async (km) => {
      if (!driverId || !orgId) return { ok: false, errorKey: "odoReport.err.noVehicle" };
      const vehicleId = entry?.vehicleId || null;
      const check = validateDriverReading({ km, vehicleId });
      if (!check.ok) return { ok: false, errorKey: check.errors[0] };

      const reading = createDriverReading({
        id: newId("odo"),
        orgId,
        driverId,
        driverUid: user.uid,
        vehicleId,
        km: Number(km),
        date: todayIso(),
      });
      try {
        const { doc, setDoc } = await import("firebase/firestore");
        await setDoc(doc(db, "orgs", orgId, "odometerReadings", reading.id), reading);
        return { ok: true, errorKey: null };
      } catch (err) {
        console.error("reading write failed", err);
        return { ok: false, errorKey: "odoReport.err.failed" };
      }
    },
    [driverId, orgId, entry?.vehicleId, user?.uid]
  );

  return {
    status: state.status,
    driver: state.driver,
    entry,
    readings: sorted,
    submitReading,
    retry: useCallback(() => setAttempt((a) => a + 1), []),
  };
}
