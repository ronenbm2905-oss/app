import { useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../firebase";
import { useAuth } from "../hooks/useAuth";
import { STORAGE_KEY } from "../constants";
import {
  normalizeJoinCode,
  teamForJoinCode,
  JOIN_CODE_LENGTH,
  MAX_PORTAL_TEAMS,
} from "../utils/joinCode";
import { LegalFooter } from "../legal/LegalFooter";

// Joining a team.
//
// A parent attaches their account to ONE team using a code the coach hands out. The code
// is looked up in clubs/{id}/joinCodes/{CODE} — a tiny document holding just a team id,
// which parents may read by exact id but never list. The club document itself stays
// closed to them, so the team list and every player's details remain unreadable.
//
// What we store about a parent is deliberately minimal: club, team and their email.
// No child's name, no player record — the account is the adult's, and the link is to a
// TEAM, not to a person. That keeps minors' personal data out of the portal entirely.

const membershipKey = (clubId) => `bball-portal-${clubId}`;

export function loadMembership(clubId) {
  try {
    const raw = window.localStorage.getItem(membershipKey(clubId));
    const m = raw ? JSON.parse(raw) : null;
    return m && m.teamId ? m : null;
  } catch {
    return null;
  }
}

export function saveMembership(clubId, membership) {
  try {
    window.localStorage.setItem(membershipKey(clubId), JSON.stringify(membership));
  } catch {
    /* a full or blocked storage just means the code is re-entered next visit */
  }
}

export function clearMembership(clubId) {
  try {
    window.localStorage.removeItem(membershipKey(clubId));
  } catch {
    /* ignore */
  }
}

// Local mode has no Firestore: resolve the code straight from the local club data so the
// portal can be exercised end-to-end without a Firebase project.
function resolveLocally(code) {
  try {
    const data = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    const team = teamForJoinCode(data.teams || [], code);
    return team ? { teamId: team.id, teamName: team.name } : null;
  } catch {
    return null;
  }
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export function PortalJoin({ clubId, onJoined }) {
  const { user, authLoading, authError, signIn } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const normalized = normalizeJoinCode(code);
  const ready = normalized.length === JOIN_CODE_LENGTH;

  async function submit(e) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setMsg("");
    try {
      if (!isFirebaseConfigured) {
        const hit = resolveLocally(normalized);
        if (!hit) {
          setMsg("הקוד לא נמצא. בדוק מול המאמן שהקוד נכון ושייך למועדון הזה.");
        } else {
          saveMembership(clubId, hit);
          onJoined(hit);
        }
        return;
      }

      const snap = await getDoc(doc(db, "clubs", clubId, "joinCodes", normalized));
      if (!snap.exists()) {
        setMsg("הקוד לא נמצא. בדוק מול המאמן שהקוד נכון ושייך למועדון הזה.");
        return;
      }
      const { teamId, teamName } = snap.data();

      // Record the account↔team link so the security rules can grant this user read
      // access to the club's published weeks — and nothing else.
      //
      // A parent with two children joins twice. `teamIds` must GROW: writing
      // [teamId] would silently revoke access to the first child's team (merge
      // replaces arrays, it does not append). Joining a different club starts a
      // fresh list — one account is linked to one club at a time.
      const meRef = doc(db, "portalUsers", user.uid);
      const mine = await getDoc(meRef);
      const prev =
        mine.exists() && mine.data().clubId === clubId ? mine.data().teamIds || [] : [];
      const teamIds = prev.includes(teamId) ? prev : [...prev, teamId];
      if (teamIds.length > MAX_PORTAL_TEAMS) {
        setMsg(`אפשר לקשר עד ${MAX_PORTAL_TEAMS} קבוצות לחשבון אחד. פנה למאמן.`);
        return;
      }

      await setDoc(meRef, {
        clubId,
        teamIds,
        // The rules verify this code against clubs/{id}/joinCodes, which is what proves
        // this account is entitled to the team it just added.
        joinCode: normalized,
        email: user.email || "",
        joinedAt: mine.exists() ? mine.data().joinedAt || "" : new Date().toISOString(),
      });
      const membership = { teamId, teamName: teamName || "" };
      saveMembership(clubId, membership);
      onJoined(membership);
    } catch {
      setMsg("ההצטרפות נכשלה. נסה שוב, או פנה למאמן.");
    } finally {
      setBusy(false);
    }
  }

  const needsSignIn = isFirebaseConfigured && !user;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4 py-8" dir="rtl">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-7 max-w-sm w-full space-y-5">
        <div className="text-center">
          <h1 className="text-xl font-bold text-stone-900">לו״ז האימונים שלי</h1>
          <p className="text-sm text-stone-600 mt-1">
            {needsSignIn
              ? "התחבר, ואז הזן את קוד הקבוצה שקיבלת מהמאמן."
              : "הזן את קוד הקבוצה שקיבלת מהמאמן."}
          </p>
        </div>

        {authLoading ? (
          <p className="text-center text-sm text-stone-500">טוען...</p>
        ) : needsSignIn ? (
          <>
            <button
              onClick={signIn}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 font-medium text-sm"
            >
              <GoogleGlyph /> התחבר עם Google
            </button>
            {authError && <p className="text-xs text-red-600 text-center">{authError}</p>}
            <p className="text-xs text-stone-600 leading-relaxed">
              החשבון מיועד להורה. אנו שומרים את כתובת הדוא״ל שלך ואת שיוך הקבוצה בלבד — לא את שם
              הילד/ה ולא פרטים אישיים נוספים.
            </p>
            {/* Before joining there is no published week, and the portal cannot read the
                club document — so the club's own contact details are genuinely unavailable
                here. Saying who runs the software and where to write is the minimum a
                person is owed before they consent to anything. */}
            <p className="text-xs text-stone-500 leading-relaxed border-t border-stone-200 pt-3">
              הלו״ז מנוהל על ידי האגודה של הקבוצה שלך, והיא האחראית על המידע. את התוכנה מפעיל
              רונן בן מאיר. פרטי ההתקשרות המלאים של האגודה — כולל כתובת לפניות בנושא פרטיות —
              מופיעים במדיניות הפרטיות מיד לאחר ההצטרפות. לשאלה לפני כן, פנו לאגודה שמסרה לכם
              את הקוד.
            </p>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-xs text-stone-500 mb-1 block">קוד קבוצה</span>
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value); setMsg(""); }}
                dir="ltr"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="ABC-123"
                aria-describedby="join-help"
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-3 text-center text-xl font-mono tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </label>
            <p id="join-help" className="text-xs text-stone-500">
              קוד בן {JOIN_CODE_LENGTH} תווים. אפשר להקליד באותיות קטנות ועם מקף.
            </p>
            <button
              type="submit"
              disabled={!ready || busy}
              className="w-full px-4 py-2.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 font-medium text-sm disabled:opacity-40 disabled:hover:bg-brand-600"
            >
              {busy ? "מצטרף..." : "הצטרפות"}
            </button>
            {msg && <p className="text-xs text-red-600">{msg}</p>}
          </form>
        )}
      </div>

      <LegalFooter className="mt-6" />
    </div>
  );
}
