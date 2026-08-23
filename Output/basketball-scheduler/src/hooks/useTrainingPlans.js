import { useState, useEffect, useCallback } from "react";
import { collection, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { db, CLUB_ID, isFirebaseConfigured } from "../firebase";

// Training plans live one document per session, under clubs/{id}/trainingPlans/{sessionId}.
//
// Same reason as game notes: a filled form per training, several times a week, all season,
// is exactly the kind of writing that would eat the club document's 1 MB ceiling. Separate
// documents also mean a coach filling a form cannot collide with a manager saving the
// schedule.

const LOCAL_KEY = "bball-training-plans-v1";

function useLocalPlans() {
  const [plans, setPlans] = useState({});

  useEffect(() => {
    try {
      setPlans(JSON.parse(window.localStorage.getItem(LOCAL_KEY) || "{}"));
    } catch {
      setPlans({});
    }
  }, []);

  const savePlan = useCallback((key, plan) => {
    setPlans((prev) => {
      const next = { ...prev, [key]: plan };
      try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, []);

  return { plans, savePlan, plansReady: true };
}

function useCloudPlans(user, isAdmin, email) {
  const [plans, setPlans] = useState({});
  const [plansReady, setReady] = useState(false);

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
      scoped(collection(db, "clubs", CLUB_ID, "trainingPlans")),
      (snap) => {
        const next = {};
        snap.forEach((d) => { next[d.id] = d.data(); });
        setPlans(next);
        setReady(true);
      },
      () => {
        // A plan that fails to load must not take the coach's schedule down with it.
        setPlans({});
        setReady(true);
      }
    );
    return unsub;
  }, [user?.uid, isAdmin, email]);

  const savePlan = useCallback(async (key, plan) => {
    if (!key) return;
    await setDoc(doc(db, "clubs", CLUB_ID, "trainingPlans", key), plan);
  }, []);

  return { plans, savePlan, plansReady };
}

export function useTrainingPlans(user, isAdmin, email) {
  const local = useLocalPlans();
  const cloud = useCloudPlans(user, isAdmin, email);
  return isFirebaseConfigured ? cloud : local;
}
