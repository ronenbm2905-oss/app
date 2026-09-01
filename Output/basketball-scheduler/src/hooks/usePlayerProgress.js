import { useState, useEffect, useCallback } from "react";
import { collection, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { db, CLUB_ID, isFirebaseConfigured } from "../firebase";

// Half-season progress notes, one document per player per half, under
// clubs/{id}/playerProgress/{playerId}__{period}.
//
// Same reasoning as training plans and game notes: a note per player twice a season is
// bounded but real growth, and everything else already shares one 1 MB document. Separate
// documents are also what makes the privacy rule expressible at all — Firestore has no
// field-level permissions, so a note that lived inside the club document could not be kept
// from another coach by any rule.

const LOCAL_KEY = "bball-player-progress-v1";

function useLocalProgress() {
  const [progress, setProgress] = useState({});

  useEffect(() => {
    try {
      setProgress(JSON.parse(window.localStorage.getItem(LOCAL_KEY) || "{}"));
    } catch {
      setProgress({});
    }
  }, []);

  const saveProgress = useCallback((key, entry) => {
    setProgress((prev) => {
      const next = { ...prev, [key]: entry };
      try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, []);

  return { progress, saveProgress, progressReady: true };
}

function useCloudProgress(user, isAdmin, email) {
  const [progress, setProgress] = useState({});
  const [progressReady, setReady] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    // The rules require a signed-in reader, so subscribing before sign-in is a guaranteed
    // permission error rather than an empty result.
    if (!user) { setReady(false); return; }
    // A coach may only read their own records, so the query has to say so.
    //
    // Firestore does not filter a collection listen down to what you are allowed to see — it
    // refuses the whole listen unless the query itself is provably within the rule. So the
    // manager listens to the collection and a coach listens to `authorEmail == me`. Get this
    // wrong and the symptom is not a missing note, it is an empty screen with no error.
    // `rules-tests/player-progress.test.mjs` runs both halves of that against the emulator.
    const scoped = (ref) => (isAdmin ? ref : query(ref, where("authorEmail", "==", String(email || "").toLowerCase())));
    const unsub = onSnapshot(
      scoped(collection(db, "clubs", CLUB_ID, "playerProgress")),
      (snap) => {
        const next = {};
        snap.forEach((d) => { next[d.id] = d.data(); });
        setProgress(next);
        setReady(true);
      },
      () => {
        // A note that fails to load must not take the rest of the screen down with it.
        setProgress({});
        setReady(true);
      }
    );
    return unsub;
  }, [user?.uid, isAdmin, email]);

  const saveProgress = useCallback(async (key, entry) => {
    if (!key) return;
    await setDoc(doc(db, "clubs", CLUB_ID, "playerProgress", key), entry);
  }, []);

  return { progress, saveProgress, progressReady };
}

export function usePlayerProgress(user, isAdmin, email) {
  const local = useLocalProgress();
  const cloud = useCloudProgress(user, isAdmin, email);
  return isFirebaseConfigured ? cloud : local;
}
