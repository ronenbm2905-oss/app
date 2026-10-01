import { useState, useEffect, useCallback } from "react";
import { collection, doc, getDocs, onSnapshot, setDoc, runTransaction } from "firebase/firestore";
import { boardsToRefresh } from "../utils/boardSync";
import { db, CLUB_ID, isFirebaseConfigured } from "../firebase";
import { EMPTY, STORAGE_KEY } from "../constants";
import { DOC_FULL_MESSAGE, isTooLarge } from "../utils/access";
import { withScheduleChanges } from "../utils/scheduleChanges";
import { sweepStaleDrivers } from "../utils/transport";
import { isNotifyPaused } from "../utils/notifyPause";
import {
  revOf, commitWithVersion, isConflict, CONFLICT_MESSAGE,
} from "../utils/docVersion";

// Merge stored data over defaults so older/partial documents don't crash the UI.
function withDefaults(partial) {
  return { ...EMPTY, ...partial };
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

  // In local mode there is no auth — the single local user has full control.
  return { data, save, loaded, error, isAdmin: true, mode: "local" };
}

// ---- CLOUD MODE (Firestore, real-time) ----
function useCloudClubData(user) {
  const [data, setData] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!isFirebaseConfigured) return; // local mode: this hook's effect is inert
    // Wait until the user is authenticated before subscribing — the security rules
    // require request.auth != null, so listening while signed-out would be denied.
    if (!user) {
      setLoaded(false);
      return;
    }
    setError(null);
    const ref = doc(db, "clubs", CLUB_ID);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setData(snap.exists() ? withDefaults(snap.data()) : EMPTY);
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
  }, [user?.uid]);

  const isAdmin = Boolean(
    user?.email &&
      (data.admins || []).some(
        (a) => a.toLowerCase() === user.email.toLowerCase()
      )
  );

  // Only boards that actually changed are written — not to save writes, but because every
  // write wakes the notification function, and an alert about nothing is how a family
  // learns to ignore the next one.
  const refreshBoards = useCallback(async (next) => {
    if (!next?.boards || Object.keys(next.boards).length === 0) return;
    const snap = await getDocs(collection(db, "clubs", CLUB_ID, "boards"));
    const current = {};
    snap.docs.forEach((d) => { current[d.id] = d.data(); });
    // The same pause that silences the coaches silences the parents. A manager building a
    // fortnight moves the boards as much as he moves the coaches' weeks, and a family being
    // told six times in ten minutes that "the schedule changed" learns to ignore the seventh.
    //
    // Written as a boolean on EVERY refresh, never only when true: with `merge: true` a flag
    // set once and then omitted would stay set for ever, and every future board change would
    // be silent with nothing on any screen to explain it.
    const silent = isNotifyPaused(next);
    for (const { token, board } of boardsToRefresh(next, current)) {
      // `merge` so the coach's message, which lives on the same document and is written by
      // a different person, survives every refresh.
      await setDoc(doc(db, "clubs", CLUB_ID, "boards", token), { ...board, notifySilent: silent }, { merge: true });
    }
  }, []);

  const save = useCallback(
    async (next) => {
      if (!isAdmin) {
        setError("רק מנהל יכול לשמור שינויים.");
        return;
      }
      try {
        // A TRANSACTION, not a plain write — see utils/docVersion.js for the morning this
        // cost twelve records. The document is read and written as one step, and a save
        // built on a copy older than the server's is refused instead of applied.
        //
        // `expectedRev` IS `data.rev`, and that is the whole invariant: the rev must come
        // from the very document the payload was built from. All 53 call sites build
        // `save({ ...data, <field>: ... })`, so `data` is that document by construction.
        //
        // The first version of this tracked the last rev THIS device wrote and took the
        // higher of the two, to stop two quick saves conflicting with each other. That was
        // wrong in a way the tests did not see: `data` is not updated when a save succeeds —
        // only when the snapshot comes back — so the second payload is still built on the
        // PRE-save document, missing the first save's field. Raising the expected rev did
        // not make that safe, it made it ACCEPTED. One device, silently overwriting itself,
        // through the very mechanism added to stop overwrites. Found in gate #25.
        const ref = doc(db, "clubs", CLUB_ID);
        const written = await commitWithVersion({
          runTransaction, db, ref, next, expectedRev: revOf(data),
        });

        // Adopt what was just written as the local truth, immediately. This is what closes
        // the window above: the next payload is built on a document that already contains
        // this save. It is not optimism — the transaction has returned, the server holds
        // exactly this.
        setData(withDefaults({ ...next, rev: written }));
        setError(null);
        // The boards the families read are a projection of what was just saved, so they are
        // rebuilt here rather than left to a button someone has to remember. See
        // utils/boardSync.js for why this is not done in the Cloud Function.
        //
        // Deliberately after the save and deliberately unable to fail it: a board that did
        // not refresh is a stale page, and a save that did not happen is lost work.
        refreshBoards(next).catch(() => {});
      } catch (err) {
        // A conflict is not a failure to retry — retrying with the same screen would
        // overwrite the other device, which is the whole bug. It gets its own sentence and
        // its own instruction.
        if (isConflict(err)) {
          setError(CONFLICT_MESSAGE);
          return;
        }
        // The 1 MiB ceiling deserves its own sentence.
        //
        // Firestore refuses an oversized document rather than truncating it, and because
        // the whole club is one document that refusal takes EVERY save with it — the app
        // goes read-only. Reported as "try again" it is indistinguishable from a dropped
        // connection, so the manager retries for a day before anyone works out why. There
        // is nothing to retry: the fix is to archive a finished month.
        setError(isTooLarge(err) ? DOC_FULL_MESSAGE : "השמירה נכשלה, נסה שוב.");
      }
    },
    // `data.rev` belongs here: without it this closure keeps the rev from the render it was
    // created in, every save after the first looks stale to itself, and the guard that is
    // supposed to protect the document locks it instead.
    // `data` in full, not only its rev: the transaction now compares against `revOf(data)`
    // and the payloads are built from this same object.
    [isAdmin, data]
  );

  return { data, save, loaded, error, isAdmin, mode: "cloud" };
}

// Single entry point — picks the implementation based on configuration.
//
// Every write goes through `withScheduleChanges`, and that is the whole reason it sits
// here rather than at the call sites. A session moves from the session form, from a drag on
// the board, from a delete, from "שכפל שבוע קודם", from the CSV import and from the
// fixed-teams strip — six places today and a seventh next month. Diffing once, where the
// old document and the new one are both in hand, is the only version of this that cannot
// be forgotten. A save that touches no session writes no log.
export function useClubData(user) {
  const local = useLocalClubData();
  const cloud = useCloudClubData(user);
  const base = isFirebaseConfigured ? cloud : local;

  // And the driver sweep rides in the same place, for the same reason — see
  // `sweepStaleDrivers`. The fourteen-day rule has been written in the deletion procedure
  // since the field was added and had no caller until 1.10.2026; a live club document was
  // still holding a driver's name and phone from a trip on 17.9.
  //
  // Before `withScheduleChanges` and not after, so the log diffs the document that is
  // actually about to be written. The order is invisible today — the log reads `sessions`
  // and the sweep touches `games` — and relying on that would be a trap for whoever makes
  // the log read games.
  const save = useCallback(
    (next) => base.save(withScheduleChanges(base.data, sweepStaleDrivers(next))),
    [base.data, base.save]
  );

  return { ...base, save };
}
