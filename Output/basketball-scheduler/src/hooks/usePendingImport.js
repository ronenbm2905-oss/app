import { useState, useEffect, useCallback } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db, CLUB_ID, isFirebaseConfigured } from "../firebase";

// Proposals filed by the nightly federation sync, under clubs/{id}/pendingImports/{date}.
//
// The nightly job never writes to the club document. It reads it, works out what a new
// federation file would change, and leaves the answer here for a manager to accept — which
// is the whole reason a background job is safe in this app at all: useClubData writes the
// entire club document with setDoc, so anything automated writing there would erase a
// manager who happened to be editing at the time.
//
// A coach has nothing to do with an import proposal, so only admins ever listen.

const LOCAL_KEY = "bball-pending-import-v1";

function useLocalPendingImport(isAdmin) {
  const [pending, setPending] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      const doc_ = raw ? JSON.parse(raw) : null;
      setPending(doc_ && doc_.status === "pending" ? doc_ : null);
    } catch {
      setPending(null);
    }
  }, [isAdmin]);

  const resolvePending = useCallback((_id, status) => {
    setPending(null);
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      if (raw) window.localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...JSON.parse(raw), status }));
    } catch {
      /* quota */
    }
  }, []);

  // The same shape offline, so the review screen never has to ask which mode it is in.
  const narrowPending = useCallback((_id, next) => {
    setPending(next && !next.empty ? { ...next, status: "pending" } : null);
  }, []);

  return { pending, resolvePending, narrowPending };
}

function useCloudPendingImport(user, isAdmin) {
  const [pending, setPending] = useState(null);

  useEffect(() => {
    // Both halves of this hook run on every render, so the cloud half has to survive local
    // mode — where `db` was never created and `collection(db, …)` throws hard enough to
    // take the whole app down with it.
    if (!isFirebaseConfigured) return;
    if (!user || !isAdmin) {
      setPending(null);
      return;
    }
    // The whole collection is read rather than queried: it holds one small document per
    // day at most, and a `where("status","==","pending")` listen would need its own index
    // for no gain at this size.
    const unsub = onSnapshot(
      collection(db, "clubs", CLUB_ID, "pendingImports"),
      (snap) => {
        const open = snap.docs
          .map((d) => ({ ...d.data(), id: d.id }))
          .filter((p) => p.status === "pending")
          .sort((a, b) => String(b.id).localeCompare(String(a.id)));
        setPending(open[0] || null);
      },
      () => setPending(null)
    );
    return unsub;
  }, [user?.uid, isAdmin]);

  // The proposal is marked rather than deleted, so tomorrow's run can see that yesterday's
  // was dealt with, and so a mistaken rejection leaves a trace instead of nothing.
  //
  // `resolvedBy` is the point of the whole design. The case for letting a background job
  // near this data at all is that a named person approved every change; without recording
  // who, that is a claim rather than a record.
  const resolvePending = useCallback(
    async (id, status) => {
      if (!isFirebaseConfigured || !id) return;
      await updateDoc(doc(db, "clubs", CLUB_ID, "pendingImports", id), {
        status,
        resolvedAt: new Date().toISOString(),
        resolvedBy: user?.email || "",
      });
    },
    [user?.email]
  );

  // Part of a proposal approved, the rest still waiting.
  //
  // The document SHRINKS rather than being marked up. Anything still listed is still open,
  // so a proposal half-approved this morning and reopened tonight cannot offer the same
  // fixtures a second time — and the count on the banner stays true without a second field
  // to keep in step with the first.
  const narrowPending = useCallback(
    async (id, next) => {
      if (!isFirebaseConfigured || !id) return;
      await updateDoc(doc(db, "clubs", CLUB_ID, "pendingImports", id), {
        added: next.added || [],
        updated: next.updated || [],
        cancelled: next.cancelled || [],
        restored: next.restored || [],
        summary: next.summary || {},
        partiallyApprovedAt: new Date().toISOString(),
        partiallyApprovedBy: user?.email || "",
      });
    },
    [user?.email]
  );

  return { pending, resolvePending, narrowPending };
}

export function usePendingImport(user, isAdmin) {
  const local = useLocalPendingImport(isAdmin);
  const cloud = useCloudPendingImport(user, isAdmin);
  return isFirebaseConfigured ? cloud : local;
}
