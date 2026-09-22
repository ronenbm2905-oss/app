import { useState, useEffect, useCallback } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, CLUB_ID, isFirebaseConfigured } from "../firebase";
import { toDoc, fromDoc } from "../utils/sheetGrid";

// The manager's own spreadsheets, at clubs/{id}/sheets/{sheetId} — one document per sheet.
//
// MANAGERS ONLY, AND IN THE RULES. Unlike the video library (every coach reads and writes)
// and unlike the training plans (each coach owns their own), this collection has exactly
// one audience. That is enforced by `isClubAdmin` in firestore.rules; the hidden tab is a
// convenience on top of it and nothing more. `App.jsx:62` has said so since the beginning.
//
// So the listener is opened only for a manager. A coach opening it would not see an empty
// list — they would get a permission error, which is noise in the console for a collection
// they were never meant to ask about.
//
// A subcollection rather than a field on the club document, for the reason that is now
// routine here: that document is metered against the 1 MiB ceiling, stands at roughly 78 KB
// and its `sessions` array alone is on course for ~900 KB by the end of the season. A
// spreadsheet is exactly the kind of thing that must never land in it.

const LOCAL_KEY = "bball-sheets-v1";

function useLocalSheets() {
  const [sheets, setSheets] = useState([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      setSheets(raw ? JSON.parse(raw) : []);
    } catch {
      setSheets([]);
    }
  }, []);

  const write = (next) => {
    try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); } catch { /* quota */ }
    return next;
  };

  const saveSheet = useCallback((sheet) => {
    setSheets((prev) => write(
      prev.some((s) => s.id === sheet.id)
        ? prev.map((s) => (s.id === sheet.id ? sheet : s))
        : [...prev, sheet]
    ));
  }, []);

  const removeSheet = useCallback((id) => {
    setSheets((prev) => write(prev.filter((s) => s.id !== id)));
  }, []);

  return { sheets, saveSheet, removeSheet, sheetsReady: true, sheetsFailed: false };
}

function useCloudSheets(user, isAdmin) {
  const [sheets, setSheets] = useState([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    if (!user || !isAdmin) { setSheets([]); setFailed(false); setReady(Boolean(user)); return; }
    const unsub = onSnapshot(
      collection(db, "clubs", CLUB_ID, "sheets"),
      (snap) => {
        setSheets(snap.docs.map((d) => fromDoc({ ...d.data(), id: d.id })));
        setFailed(false);
        setReady(true);
      },
      () => {
        // A failed listen must not take the screen down — but it must not come out looking
        // like "you have no sheets" either. That is the pattern this project has now hit
        // three times: the empty state and the error state rendered identically, and the
        // manager's reasonable next move is to upload again over something that is still
        // there. The flag is what keeps the two apart.
        setSheets([]);
        setFailed(true);
        setReady(true);
      }
    );
    return unsub;
  }, [user?.uid, isAdmin]);

  const saveSheet = useCallback(async (sheet) => {
    if (!sheet || !sheet.id) return;
    // `toDoc` is not optional: a grid is an array of arrays and Firestore cannot hold one.
    await setDoc(doc(db, "clubs", CLUB_ID, "sheets", sheet.id), toDoc(sheet));
  }, []);

  const removeSheet = useCallback(async (id) => {
    if (!id) return;
    await deleteDoc(doc(db, "clubs", CLUB_ID, "sheets", id));
  }, []);

  return { sheets, saveSheet, removeSheet, sheetsReady: ready, sheetsFailed: failed };
}

export function useSheets(user, isAdmin) {
  const local = useLocalSheets();
  const cloud = useCloudSheets(user, isAdmin);
  return isFirebaseConfigured ? cloud : local;
}
