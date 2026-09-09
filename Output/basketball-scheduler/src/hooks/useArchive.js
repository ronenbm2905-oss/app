import { useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, CLUB_ID, isFirebaseConfigured } from "../firebase";
import { archiveDoc, splitForArchive, withArchived } from "../utils/archive";

// Finished months, at clubs/{id}/archive/{YYYY-MM}.
//
// Deliberately NOT a listen. Every other subcollection here subscribes with `onSnapshot`,
// and copying that habit would undo the feature: the archive holds exactly the bulk that
// was moved out of the club document, and streaming it into every session would put the
// weight back on the wire the moment anyone opened the app. It is read on demand — the
// hours report asking for one old month — and the club document carries a tiny
// `archivedMonths` index so the UI knows what exists without touching any of it.
//
// The write order is the whole safety story, and it is the same shape as the progress
// deletion: the archive document is written FIRST and the club document trimmed only after
// it lands. A failure halfway leaves sessions in both places — visible, duplicated,
// fixable. The reverse order would delete a month whose copy never arrived.

const LOCAL_KEY = "bball-archive-v1";

function readLocal() {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_KEY) || "{}");
  } catch {
    return {};
  }
}

export function useArchive(data, save) {
  // One month's archived sessions, or [] when there is no such document.
  const loadMonth = useCallback(async (month) => {
    if (!month) return [];
    if (!isFirebaseConfigured) return readLocal()[month] || [];
    try {
      const snap = await getDoc(doc(db, "clubs", CLUB_ID, "archive", month));
      return snap.exists() ? snap.data()?.sessions || [] : [];
    } catch {
      return [];
    }
  }, []);

  // Move the named months out of the club document. Returns how many sessions were moved,
  // or throws — the caller shows the failure rather than this swallowing it, because a
  // half-done archive is exactly the thing a manager must be told about.
  const archiveMonths = useCallback(
    async (months) => {
      const list = (months || []).filter(Boolean);
      if (list.length === 0) return 0;
      const { byMonth, kept } = splitForArchive(data.sessions, list);
      const written = Object.keys(byMonth);
      if (written.length === 0) return 0;

      if (isFirebaseConfigured) {
        // Sequential and awaited: the club document is trimmed only for months that are
        // already safely written. A batch would be tidier and would also make a partial
        // failure invisible, which is the opposite of what is wanted here.
        for (const month of written) {
          await setDoc(doc(db, "clubs", CLUB_ID, "archive", month), archiveDoc(month, byMonth[month]));
        }
      } else {
        const store = readLocal();
        written.forEach((month) => { store[month] = byMonth[month]; });
        window.localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
      }

      await save(withArchived(data, written, kept));
      return written.reduce((n, m) => n + byMonth[m].length, 0);
    },
    [data, save]
  );

  return { loadMonth, archiveMonths };
}
