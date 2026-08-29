import { useState, useEffect, useCallback } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, CLUB_ID, isFirebaseConfigured } from "../firebase";

// The club's shared library of drill videos, at clubs/{id}/videos/{videoId}.
//
// A subcollection rather than a field on the club document for the usual reason — the club
// document is metered against the 1 MiB ceiling and is admin-write-only, and here every
// coach writes.
//
// THE ONE THING THAT IS DIFFERENT FROM EVERY OTHER SUBCOLLECTION HOOK HERE:
// `useTrainingPlans` and `useGameNotes` scope their listen to `authorEmail == me` for a
// coach, because their rules grant read only to the owner. This listen is NOT scoped, and
// must never be — a shared library where each coach sees only their own entries is an empty
// screen with no error to explain it. The matching rule allows any club member to read.
// Copying the scoped pattern here out of habit is the mistake this comment exists to stop.

const LOCAL_KEY = "bball-videos-v1";

function useLocalVideos() {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      setVideos(raw ? JSON.parse(raw) : []);
    } catch {
      setVideos([]);
    }
  }, []);

  const saveVideo = useCallback((video) => {
    setVideos((prev) => {
      const next = prev.some((v) => v.id === video.id)
        ? prev.map((v) => (v.id === video.id ? video : v))
        : [...prev, video];
      try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, []);

  const removeVideo = useCallback((id) => {
    setVideos((prev) => {
      const next = prev.filter((v) => v.id !== id);
      try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, []);

  return { videos, saveVideo, removeVideo, videosReady: true };
}

function useCloudVideos(user) {
  const [videos, setVideos] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    // The rules require a signed-in reader, so listening before sign-in is a guaranteed
    // permission error rather than an empty result.
    if (!user) { setReady(false); return; }
    const unsub = onSnapshot(
      collection(db, "clubs", CLUB_ID, "videos"), // unscoped on purpose — see the note above
      (snap) => {
        setVideos(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        setReady(true);
      },
      () => {
        // A library that fails to load must not take the screen down with it.
        setVideos([]);
        setReady(true);
      }
    );
    return unsub;
  }, [user?.uid]);

  const saveVideo = useCallback(async (video) => {
    if (!video || !video.id) return;
    await setDoc(doc(db, "clubs", CLUB_ID, "videos", video.id), video);
  }, []);

  const removeVideo = useCallback(async (id) => {
    if (!id) return;
    await deleteDoc(doc(db, "clubs", CLUB_ID, "videos", id));
  }, []);

  return { videos, saveVideo, removeVideo, videosReady: ready };
}

export function useVideos(user) {
  const local = useLocalVideos();
  const cloud = useCloudVideos(user);
  return isFirebaseConfigured ? cloud : local;
}
