// Whether the signed-in account operates the SERVICE, as opposed to any one club.
//
// The answer lives in config/global.superAdmins, which the rules let only a super-admin
// read. So the check is the read itself: it succeeds for an operator and is denied for
// everyone else. A permission-denied here is the expected answer "no", not a fault —
// reporting it as an error would put a red failure in front of every ordinary manager
// who happened to land on the URL.

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../firebase";

export function useSuperAdmin(user) {
  const [state, setState] = useState({ checking: true, isSuperAdmin: false, error: null });

  useEffect(() => {
    let cancelled = false;

    // Local mode has no accounts and no rules to enforce; there is nothing to gate.
    if (!isFirebaseConfigured) {
      setState({ checking: false, isSuperAdmin: true, error: null });
      return;
    }
    if (!user) {
      setState({ checking: true, isSuperAdmin: false, error: null });
      return;
    }

    setState({ checking: true, isSuperAdmin: false, error: null });
    getDoc(doc(db, "config", "global"))
      .then((snap) => {
        if (cancelled) return;
        const list = snap.exists() ? snap.data().superAdmins : null;
        // A misspelled key — `superadmins` for `superAdmins` — was one of the console
        // failures, and it reads exactly like "you are not an operator". Say which it is.
        if (snap.exists() && !Array.isArray(list)) {
          setState({
            checking: false,
            isSuperAdmin: false,
            error: 'המסמך config/global קיים אך אין בו מערך בשם superAdmins. בדוק את האיות ואת סוג השדה (list).',
          });
          return;
        }
        const email = String(user.email || "").toLowerCase();
        setState({
          checking: false,
          isSuperAdmin: Boolean(list && list.map((e) => String(e).toLowerCase()).includes(email)),
          error: null,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        const denied = e && (e.code === "permission-denied" || e.code === "firestore/permission-denied");
        setState({
          checking: false,
          isSuperAdmin: false,
          error: denied ? null : "בדיקת ההרשאה נכשלה. בדוק את החיבור ונסה שוב.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return state;
}
