import { useState, useEffect, useCallback } from "react";
import { collection, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { db, CLUB_ID, isFirebaseConfigured } from "../firebase";

// Game notes live one document per game, under clubs/{id}/gameNotes/{gameKey}.
//
// Everything else in this app shares a single club document, which is fine for names and
// times. Free text written after every game is the first thing that grows without limit,
// and that document has a hard 1 MB ceiling it already has to fit the whole season into.
// Separate documents also mean a coach writing a report cannot collide with a manager
// saving the schedule — the two no longer touch the same record.

const LOCAL_KEY = "bball-game-notes-v1";

function useLocalGameNotes() {
  const [notes, setNotes] = useState({});

  useEffect(() => {
    try {
      setNotes(JSON.parse(window.localStorage.getItem(LOCAL_KEY) || "{}"));
    } catch {
      setNotes({});
    }
  }, []);

  const saveNote = useCallback((key, note) => {
    setNotes((prev) => {
      const next = { ...prev, [key]: note };
      try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, []);

  return { notes, saveNote, notesReady: true };
}

function useCloudGameNotes(user, isAdmin, email) {
  const [notes, setNotes] = useState({});
  const [notesReady, setReady] = useState(false);

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
    // wrong and the symptom is not a missing note, it is an empty screen.
    const scoped = (ref) => (isAdmin ? ref : query(ref, where("authorEmail", "==", String(email || "").toLowerCase())));
    const unsub = onSnapshot(
      scoped(collection(db, "clubs", CLUB_ID, "gameNotes")),
      (snap) => {
        const next = {};
        snap.forEach((d) => { next[d.id] = d.data(); });
        setNotes(next);
        setReady(true);
      },
      () => {
        // A note that fails to load must not take the games screen down with it.
        setNotes({});
        setReady(true);
      }
    );
    return unsub;
  }, [user?.uid, isAdmin, email]);

  const saveNote = useCallback(async (key, note) => {
    if (!key) return;
    await setDoc(doc(db, "clubs", CLUB_ID, "gameNotes", key), note);
  }, []);

  return { notes, saveNote, notesReady };
}

export function useGameNotes(user, isAdmin, email) {
  const local = useLocalGameNotes();
  const cloud = useCloudGameNotes(user, isAdmin, email);
  return isFirebaseConfigured ? cloud : local;
}
