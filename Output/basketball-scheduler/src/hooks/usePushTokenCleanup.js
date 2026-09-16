import { useCallback } from "react";
import { collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import { db, CLUB_ID, isFirebaseConfigured } from "../firebase";
import { normalizeEmail } from "../utils/access";

// Removing someone's access has to remove their phone, too.
//
// The two live in different places: access is a list inside the club document, the phone
// is a row in `pushTokens`. Nothing links them automatically, and THE SENDING PROCESS
// BYPASSES THE SECURITY RULES ENTIRELY — it runs with a service account. So a coach who
// leaves keeps receiving the club's schedule on their lock screen forever, and no rule
// anywhere would stop it. That is Adi's M2, and it is the reason this file exists.
//
// Order is deliberate: the rows go FIRST, the club document second. If the save then
// fails, the person still has access and simply re-enables notifications — recoverable.
// The other order fails the other way: access gone, phone still ringing, and nothing on
// screen to say so. Same reasoning as deleting progress notes before players.
export function usePushTokenCleanup() {
  return useCallback(async (email) => {
    const e = normalizeEmail(email);
    if (!isFirebaseConfigured || !e) return { removed: 0, ok: true };
    try {
      // Only an admin reaches this, and the rules let an admin list the collection.
      const snap = await getDocs(
        query(collection(db, "clubs", CLUB_ID, "pushTokens"), where("authorEmail", "==", e))
      );
      await Promise.all(
        snap.docs.map((d) => deleteDoc(doc(db, "clubs", CLUB_ID, "pushTokens", d.id)))
      );
      return { removed: snap.size, ok: true };
    } catch {
      // Revoking access must not be blocked by this. But it must not be silent either —
      // the caller says so on screen, because the manager is the only one who can act.
      return { removed: 0, ok: false };
    }
  }, []);
}
