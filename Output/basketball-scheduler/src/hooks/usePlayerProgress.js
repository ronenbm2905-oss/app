import { useState, useEffect, useCallback } from "react";
import { collection, doc, onSnapshot, query, setDoc, where, writeBatch } from "firebase/firestore";
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

  // Deleting a player has to be able to take their notes with it. Until it could, the only
  // way out was the Firebase console — so the guard on the roster screen was, in practice,
  // "you cannot delete this child at all".
  const removeProgress = useCallback((keys) => {
    setProgress((prev) => {
      const next = { ...prev };
      (Array.isArray(keys) ? keys : [keys]).forEach((k) => { delete next[k]; });
      try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, []);

  return { progress, saveProgress, removeProgress, progressReady: true };
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
        // A note that fails to load must not take the rest of the screen down with it —
        // so the map is emptied and the screens that only DISPLAY notes carry on.
        //
        // Readiness, though, stays false, and that is the whole point. This map is also the
        // guard on deleting a player: an empty map meaning "the listen failed" is
        // indistinguishable from one meaning "nothing was ever written", and a delete taken
        // on that reading severs the only link between a note and the child it is about.
        // Showing nothing is recoverable; deleting on a guess is not.
        setProgress({});
        setReady(false);
      }
    );
    return unsub;
  }, [user?.uid, isAdmin, email]);

  const saveProgress = useCallback(async (key, entry) => {
    if (!key) return;
    await setDoc(doc(db, "clubs", CLUB_ID, "playerProgress", key), entry);
  }, []);

  // One batch, all or nothing — and that is not a performance choice.
  //
  // Deleting the notes one at a time meant a failure halfway through left three of five
  // notes gone, the player still on the roster, and the caller telling the manager "so
  // nothing was deleted" — which by then was false. A batch makes that sentence true
  // again instead of making it longer. The 500-write limit is far above the ceiling here
  // (a squad of thirty holds at most sixty notes, two per player per season).
  //
  // The rule allows a club admin to delete any note and a coach only their own; the roster
  // screen is admin-only either way.
  const removeProgress = useCallback(async (keys) => {
    const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
    if (list.length === 0) return;
    const batch = writeBatch(db);
    list.forEach((k) => batch.delete(doc(db, "clubs", CLUB_ID, "playerProgress", k)));
    await batch.commit();
  }, []);

  return { progress, saveProgress, removeProgress, progressReady };
}

export function usePlayerProgress(user, isAdmin, email) {
  const local = useLocalProgress();
  const cloud = useCloudProgress(user, isAdmin, email);
  return isFirebaseConfigured ? cloud : local;
}
