import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, CLUB_ID, isFirebaseConfigured } from "../firebase";
import { tokenForTeam } from "../utils/teamBoard";
import { IconCheck } from "./ui/icons";

// The line at the top of the parents' board — written by the coach, for their own team.
//
// It writes ONLY `message` and `updatedAt`, and the security rules allow a club member
// nothing else on that document. That is deliberate: the board itself is built by the
// manager from the club's data, and a coach editing it by hand would create a second,
// untraceable version of the schedule.
//
// It is not private, and the text says so. A message from an adult to a team of minors is
// something the club has to be able to see — so it sits on a document the manager reads,
// carries the author's name, and replaces rather than accumulates.
export function CoachTeamMessage({ data, coachId, authorName }) {
  const teams = (data.teams || []).filter((t) => t && t.coachId === coachId);
  const published = teams.filter((t) => tokenForTeam(data, t.id));
  const [teamId, setTeamId] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const active = teamId || published[0]?.id || "";
  const token = tokenForTeam(data, active);

  // What is on the board right now, so the coach edits their own words instead of typing
  // over a message they cannot see.
  useEffect(() => {
    let cancelled = false;
    setText("");
    setStatus("");
    if (!isFirebaseConfigured || !token) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "clubs", CLUB_ID, "boards", token));
        if (!cancelled && snap.exists()) setText(snap.data()?.message?.text || "");
      } catch {
        /* an unreadable board is left blank; saving still works */
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (!isFirebaseConfigured || teams.length === 0) return null;

  const save = async (value) => {
    if (!token || busy) return;
    setBusy(true);
    setStatus("");
    try {
      await updateDoc(doc(db, "clubs", CLUB_ID, "boards", token), {
        message: value.trim()
          ? { text: value.trim(), author: authorName || "", updatedAt: new Date().toISOString() }
          : { text: "", author: "", updatedAt: new Date().toISOString() },
        updatedAt: new Date().toISOString(),
      });
      setStatus(value.trim() ? "ההודעה פורסמה להורי הקבוצה." : "ההודעה הוסרה מהלוח.");
    } catch {
      setStatus("לא הצלחנו לשמור. נסה/י שוב.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-2" dir="rtl">
      <h3 className="text-sm font-semibold text-stone-800">הודעה להורי הקבוצה</h3>

      {published.length === 0 ? (
        <p className="text-xs text-stone-600">
          הלוח של הקבוצה שלך עדיין לא פורסם להורים. בקש/י מהמנהל לפרסם אותו, ואז תוכל/י לכתוב כאן.
        </p>
      ) : (
        <>
          {published.length > 1 && (
            <select
              value={active}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full text-sm rounded-lg border border-stone-300 p-2"
            >
              {published.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="מחר מביאים בקבוק ונעליים שחורות."
            className="w-full text-sm rounded-lg border border-stone-300 p-2"
          />
          <p className="text-xs text-stone-500">
            מופיע בראש הלוח של הקבוצה, עם שמך. <span className="font-medium">אינו פרטי</span> —
            כל מי שיש לו את הקישור רואה אותו, וגם המנהל. הודעה חדשה מחליפה את הקודמת.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => save(text)}
              disabled={busy}
              className="px-3 py-1.5 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 flex items-center gap-1.5"
            >
              <IconCheck size={15} /> {busy ? "שומר..." : "פרסם הודעה"}
            </button>
            {text.trim() && (
              <button
                onClick={() => { setText(""); save(""); }}
                disabled={busy}
                className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50 disabled:opacity-40"
              >
                הסר הודעה
              </button>
            )}
          </div>
        </>
      )}

      <p role="status" aria-live="polite" className="text-xs text-stone-700 min-h-[1rem]">{status}</p>
    </div>
  );
}
