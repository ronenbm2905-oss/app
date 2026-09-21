import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, CLUB_ID, isFirebaseConfigured } from "../firebase";

// The heartbeat written by scripts/record-sync.mjs, at clubs/{id}/sync/nightly.
//
// `onSnapshot` rather than a one-off read, for one case: the manager whose sync has been
// dead for days reads the warning, runs the job by hand, and watches the line go green
// without touching anything. A `getDoc` would leave the warning on screen after the problem
// was fixed, and a warning that lies once is a warning that gets ignored.
//
// Only admins listen. A coach has nothing to do about a sync, and the rules say the same.
//
// `missing` is distinct from `null` on purpose. "No document" means no run has ever been
// recorded — true for everyone until the first 03:00 after this ships — and that is a
// different sentence from "we could not read it", which is what an error gives.
export function useSyncHealth(user, isAdmin) {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    if (!user || !isAdmin) { setHealth(null); return; }
    const unsub = onSnapshot(
      doc(db, "clubs", CLUB_ID, "sync", "nightly"),
      (snap) => setHealth(snap.exists() ? snap.data() : { missing: true }),
      // A read that fails must not be dressed up as a healthy sync.
      () => setHealth(null)
    );
    return unsub;
  }, [user?.uid, isAdmin]);

  return health;
}
