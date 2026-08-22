// Reads one published week for the parent portal.
//
// This is the ONLY club data the portal ever touches. It deliberately does not use
// useClubData: that hook reads clubs/{id}, which holds players' personal data and the
// admin allowlists, and parents must never have permission to read it.
//
// A week is published as two documents rather than one:
//
//   published/{weekOf}                 — the club's name, legal details, holidays, team names
//   published/{weekOf}/teams/{teamId}  — that team's sessions and games
//
// The single-document version carried every team, and the rules could only ask whether
// the reader belonged to the club — so any parent could read the whole file and see
// every other team's week. The portal filtered it before rendering, which is a display
// choice and not a boundary. Splitting moves the boundary into the rules, where the team
// id is a path segment they can actually match on.

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../firebase";
import { PUBLISHED_STORAGE_KEY } from "../constants";

// Local mode keeps writing the whole projection under one key — there is no rules
// engine to satisfy and no second reader to protect from. Split it on read so the
// portal sees the same shape in both modes and cannot come to depend on the difference.
const readLocal = (weekOf, teamId) => {
  try {
    const all = JSON.parse(window.localStorage.getItem(PUBLISHED_STORAGE_KEY) || "{}");
    const full = all[weekOf];
    if (!full) return { shared: null, team: null };
    const { teams = {}, ...rest } = full;
    return {
      shared: {
        ...rest,
        teamNames: Object.fromEntries(Object.entries(teams).map(([id, t]) => [id, t.name])),
      },
      team: teamId && teams[teamId] ? { teamId, ...teams[teamId] } : null,
    };
  } catch {
    return { shared: null, team: null };
  }
};

const denialMessage = (code) =>
  code === "permission-denied"
    ? "אין הרשאה לצפות בלו״ז הזה. אם החלפתם קוד קבוצה, בקשו מהמאמן את הקוד החדש והצטרפו שוב."
    : "טעינת הלו״ז נכשלה. בדוק את החיבור לאינטרנט.";

export function usePublishedWeek(clubId, weekOf, teamId) {
  const [shared, setShared] = useState(null);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!weekOf) return;
    setLoading(true);
    setError(null);

    if (!isFirebaseConfigured) {
      const local = readLocal(weekOf, teamId);
      setShared(local.shared);
      setTeam(local.team);
      setLoading(false);
      return;
    }

    const weekRef = doc(db, "clubs", clubId, "published", weekOf);

    // Two listeners, and `loading` clears on the shared one. The team document is the
    // half that a revoked code makes unreadable, and waiting for it would leave a parent
    // whose access was withdrawn staring at a spinner instead of an explanation.
    const unsubShared = onSnapshot(
      weekRef,
      (snap) => {
        setShared(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      (err) => {
        setError(denialMessage(err?.code));
        setLoading(false);
      }
    );

    if (!teamId) {
      setTeam(null);
      return unsubShared;
    }

    const unsubTeam = onSnapshot(
      doc(weekRef, "teams", teamId),
      (snap) => setTeam(snap.exists() ? snap.data() : null),
      (err) => {
        setTeam(null);
        setError(denialMessage(err?.code));
      }
    );

    return () => {
      unsubShared();
      unsubTeam();
    };
  }, [clubId, weekOf, teamId]);

  return { shared, team, loading, error };
}
