import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { db, DEFAULT_CLUB_ID, isFirebaseConfigured } from "../firebase";
import { EMPTY, STORAGE_KEY, DEFAULT_SETTINGS, PUBLISHED_STORAGE_KEY } from "../constants";
import { buildPublicWeek, findLeakedKeys } from "../utils/publish";

// Merge stored data over defaults so older/partial documents don't crash the UI.
// `settings` is merged one level deeper (and `legal` one deeper still), because a
// club document may hold only the few settings its admin actually changed — a plain
// shallow spread would drop every other default and leave the app unbranded.
function withDefaults(partial) {
  const stored = partial?.settings || {};
  return {
    ...EMPTY,
    ...partial,
    settings: {
      ...DEFAULT_SETTINGS,
      ...stored,
      legal: { ...DEFAULT_SETTINGS.legal, ...(stored.legal || {}) },
      subscription: { ...DEFAULT_SETTINGS.subscription, ...(stored.subscription || {}) },
    },
  };
}

// ---- LOCAL MODE (localStorage) ----
function useLocalClubData() {
  const [data, setData] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      setData(raw ? withDefaults(JSON.parse(raw)) : EMPTY);
    } catch {
      setData(EMPTY);
    } finally {
      setLoaded(true);
    }
  }, []);

  const save = useCallback((next) => {
    setData(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setError(null);
    } catch {
      setError("השמירה נכשלה, נסה שוב.");
    }
  }, []);

  // Local mode mirrors the cloud's published subcollection in localStorage, so the
  // parent portal can be exercised end-to-end without a Firebase project.
  const publish = useCallback(
    (weekStart) => {
      const doc = buildPublicWeek(data, weekStart, new Date().toISOString());
      const leaks = findLeakedKeys(doc);
      if (leaks.length) {
        setError(`הפרסום נחסם: נמצאו שדות שאסור לפרסם (${leaks.join(", ")}).`);
        return false;
      }
      try {
        const all = JSON.parse(window.localStorage.getItem(PUBLISHED_STORAGE_KEY) || "{}");
        all[weekStart] = doc;
        window.localStorage.setItem(PUBLISHED_STORAGE_KEY, JSON.stringify(all));
        return true;
      } catch {
        setError("הפרסום נכשל, נסה שוב.");
        return false;
      }
    },
    [data]
  );

  // In local mode there is no auth — the single local user has full control.
  // syncJoinCode is a no-op: the portal resolves codes straight from the club data.
  const syncJoinCode = useCallback(async () => true, []);

  return { data, save, publish, syncJoinCode, loaded, error, isAdmin: true, mode: "local", missing: false };
}

// ---- CLOUD MODE (Firestore, real-time) ----
function useCloudClubData(user, clubId) {
  const [data, setData] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [missing, setMissing] = useState(false); // the club document does not exist

  useEffect(() => {
    if (!isFirebaseConfigured) return; // local mode: this hook's effect is inert
    // Wait until the user is authenticated before subscribing — the security rules
    // require request.auth != null, so listening while signed-out would be denied.
    if (!user) {
      setLoaded(false);
      return;
    }
    setError(null);
    setLoaded(false); // switching clubs must not show the previous club's data as loaded
    const ref = doc(db, "clubs", clubId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setData(snap.exists() ? withDefaults(snap.data()) : EMPTY);
        setMissing(!snap.exists());
        setLoaded(true);
      },
      (err) => {
        if (err?.code === "permission-denied") {
          setError(
            'אין לך הרשאת גישה למועדון זה. כדי לצפות בלוח, בקש ממנהל המערכת להוסיף את כתובת הדוא"ל שלך לרשימת המורשים.'
          );
        } else {
          setError("טעינת הנתונים נכשלה. בדוק חיבור והרשאות.");
        }
        setLoaded(true);
      }
    );
    return unsub;
  }, [user?.uid, clubId]);

  const isAdmin = Boolean(
    user?.email &&
      (data.admins || []).some(
        (a) => a.toLowerCase() === user.email.toLowerCase()
      )
  );

  const save = useCallback(
    async (next) => {
      if (!isAdmin) {
        setError("רק מנהל יכול לשמור שינויים.");
        return;
      }
      try {
        await setDoc(doc(db, "clubs", clubId), next);
        setError(null);
      } catch {
        setError("השמירה נכשלה, נסה שוב.");
      }
    },
    [isAdmin, clubId]
  );

  // Publishing writes the parent-facing projection to a SEPARATE document
  // (clubs/{id}/published/{weekOf}). The leak check runs immediately before the write:
  // the club document holds minors' personal data, so a regression that let a field
  // through must stop here rather than reach a document parents can read.
  const publish = useCallback(
    async (weekStart) => {
      if (!isAdmin) {
        setError("רק מנהל יכול לפרסם לו״ז.");
        return false;
      }
      const publicDoc = buildPublicWeek(data, weekStart, new Date().toISOString());
      const leaks = findLeakedKeys(publicDoc);
      if (leaks.length) {
        setError(`הפרסום נחסם: נמצאו שדות שאסור לפרסם (${leaks.join(", ")}).`);
        return false;
      }
      try {
        await setDoc(doc(db, "clubs", clubId, "published", weekStart), publicDoc);
        setError(null);
        return true;
      } catch {
        setError("הפרסום נכשל, נסה שוב.");
        return false;
      }
    },
    [isAdmin, clubId, data]
  );

  // A team's join code is mirrored into clubs/{id}/joinCodes/{CODE}. Parents cannot read
  // the club document, so this tiny document — holding only a team id and name — is how
  // a typed code resolves to a team. The old code's document is removed so a code that
  // was rotated (say, after it leaked) stops working.
  const syncJoinCode = useCallback(
    async ({ oldCode, newCode, teamId, teamName }) => {
      if (!isFirebaseConfigured || !isAdmin) return true; // local mode resolves from club data
      try {
        if (oldCode && oldCode !== newCode) {
          await deleteDoc(doc(db, "clubs", clubId, "joinCodes", oldCode));
        }
        if (newCode) {
          await setDoc(doc(db, "clubs", clubId, "joinCodes", newCode), { teamId, teamName: teamName || "" });
        }
        return true;
      } catch {
        setError("עדכון קוד ההצטרפות נכשל. נסה שוב.");
        return false;
      }
    },
    [isAdmin, clubId]
  );

  return { data, save, publish, syncJoinCode, loaded, error, isAdmin, mode: "cloud", missing, clubId };
}

// Single entry point — picks the implementation based on configuration.
// `clubId` comes from the URL (see utils/clubId.js); it falls back to the build-time
// default so the bare "/" route keeps working exactly as before.
export function useClubData(user, clubId = DEFAULT_CLUB_ID) {
  const local = useLocalClubData();
  const cloud = useCloudClubData(user, clubId);
  return isFirebaseConfigured ? cloud : local;
}
