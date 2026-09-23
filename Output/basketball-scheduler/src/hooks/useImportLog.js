import { useState, useEffect, useCallback } from "react";
import { collection, addDoc, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db, CLUB_ID, isFirebaseConfigured } from "../firebase";
import { sortEntries } from "../utils/importLog";

// The record of federation imports that were approved — one entry per approval, never
// updated and never deleted from the app. See `utils/importLog.js` for why the proposal
// itself cannot serve as this record.
//
// A coach has nothing to do with an import, exactly as with the proposal, so only admins
// listen and only admins write.

const LOCAL_KEY = "bball-import-log-v1";
const MAX = 200;

function useLocalImportLog(isAdmin) {
  const [entries, setEntries] = useState([]);

  const read = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    setEntries(sortEntries(read()));
  }, [isAdmin, read]);

  const appendEntry = useCallback(
    async (entry) => {
      const next = sortEntries([entry, ...read()]).slice(0, MAX);
      try {
        window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      } catch {
        /* quota */
      }
      setEntries(next);
    },
    [read]
  );

  return { entries, appendEntry, logFailed: false };
}

function useCloudImportLog(user, isAdmin) {
  const [entries, setEntries] = useState([]);
  // "The read failed" and "nothing has been imported yet" are the same empty list, and the
  // screen has to say something different for each — the lesson the sync indicator was
  // built on.
  const [logFailed, setLogFailed] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    if (!user || !isAdmin) {
      setEntries([]);
      return;
    }
    const q = query(
      collection(db, "clubs", CLUB_ID, "importLog"),
      orderBy("at", "desc"),
      limit(MAX)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLogFailed(false);
        setEntries(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
      },
      () => setLogFailed(true)
    );
    return unsub;
  }, [user?.uid, isAdmin]);

  const appendEntry = useCallback(async (entry) => {
    if (!isFirebaseConfigured) return;
    // `addDoc`, so every approval gets its own document and two of them on one evening
    // cannot overwrite each other — which is precisely what the proposal document does.
    await addDoc(collection(db, "clubs", CLUB_ID, "importLog"), entry);
  }, []);

  return { entries, appendEntry, logFailed };
}

export function useImportLog(user, isAdmin) {
  const local = useLocalImportLog(isAdmin);
  const cloud = useCloudImportLog(user, isAdmin);
  return isFirebaseConfigured ? cloud : local;
}
