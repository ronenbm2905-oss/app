import { useCallback, useEffect, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db, CLUB_ID, isFirebaseConfigured } from "../firebase";

// Proposals filed by scripts/scan-cups.mjs, under clubs/{id}/cupScans/{date}.
//
// The same arrangement as the nightly import and for the same reason: the scanner never
// writes to the club document, because every save there writes it whole and a background
// writer would erase a manager mid-edit with no error and no trace. It leaves what it found
// here; a person decides.
//
// A coach has nothing to decide about a fixture, so only admins ever listen.
export function useCupScan(user, isAdmin) {
  const [scan, setScan] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    if (!user || !isAdmin) { setScan(null); return; }
    const unsub = onSnapshot(
      collection(db, "clubs", CLUB_ID, "cupScans"),
      (snap) => {
        const open = snap.docs
          .map((d) => ({ ...d.data(), id: d.id }))
          .filter((s) => !s.resolved)
          .sort((a, b) => String(b.id).localeCompare(String(a.id)));
        setScan(open[0] || null);
      },
      () => setScan(null)
    );
    return unsub;
  }, [user?.uid, isAdmin]);

  // Marked, not deleted — so the next run can see yesterday's was dealt with, and so a
  // fixture dismissed by mistake leaves a trace instead of nothing. `resolvedBy` is the
  // point: the case for letting an automated job near this data is that a named person
  // approved every change, and without recording who, that is a claim and not a record.
  const resolveScan = useCallback(
    async (id, note) => {
      if (!isFirebaseConfigured || !id) return;
      try {
        await updateDoc(doc(db, "clubs", CLUB_ID, "cupScans", id), {
          resolved: true,
          resolvedAt: new Date().toISOString(),
          resolvedBy: user?.email || "",
          resolvedNote: note || "",
        });
      } catch {
        /* the banner closes either way; the next scan will file a fresh proposal */
      }
      setScan(null);
    },
    [user?.email]
  );

  return { scan, resolveScan };
}
