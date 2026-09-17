import { useState } from "react";
import { useTeamBoards } from "../hooks/useTeamBoards";
import { boardPath, boardsIndex, tokenForTeam } from "../utils/teamBoard";
import { IconCopy, IconCheck, IconAlert } from "./ui/icons";

// Publishing a team's board to the people outside the club.
//
// The card says what leaves the building, in words, above the buttons. That sentence is not
// reassurance — it is the thing a manager has to be able to check against what they believe
// they are sharing, before they paste a link into a group of parents.
export function TeamBoardsCard({ data, save, canEdit }) {
  const { publish, refreshAll, unpublish, rotate, busy, msg } = useTeamBoards(data, save);
  const [copied, setCopied] = useState("");
  const [confirming, setConfirming] = useState("");

  if (!canEdit) return null;

  const index = boardsIndex(data);
  const published = Object.keys(index).length;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const linkFor = (token) => origin + boardPath(token);

  const copy = async (token) => {
    try {
      await navigator.clipboard.writeText(linkFor(token));
      setCopied(token);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      /* a browser that refuses the clipboard still shows the link below, to copy by hand */
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3" dir="rtl">
      <div>
        <h3 className="text-sm font-semibold text-stone-800">לוח הקבוצה להורים</h3>
        <p className="text-xs text-stone-600 mt-1">
          קישור אחד לכל קבוצה, לשליחה לקבוצת הוואטסאפ. נפתח בלי התחברות ומציג{" "}
          <span className="font-medium">את השבוע הזה והבא</span> — אימונים, משחקים ושעת התייצבות.
        </p>
        <p className="text-xs text-stone-600 mt-1">
          <span className="font-medium">לא נשלח לשם שום מידע על ילדים</span> — לא שמות, לא טלפונים,
          לא הערות שכתבתם על אימון. גם לא קבוצות אחרות.
        </p>
      </div>

      {published > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={refreshAll}
            disabled={Boolean(busy)}
            className="px-3 py-1.5 text-xs rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
          >
            {busy === "all" ? "מעדכן..." : "עדכן את כל הלוחות"}
          </button>
          {/* The one failure mode that matters: a board nobody refreshed is last week's times
              wearing this week's dates. */}
          <span className="text-xs text-stone-500">אחרי שינוי בלו״ז — לחצו כאן.</span>
        </div>
      )}

      <div className="space-y-1.5">
        {(data.teams || []).map((team) => {
          const token = tokenForTeam(data, team.id);
          return (
            <div
              key={team.id}
              className="flex items-center gap-2 flex-wrap border border-stone-200 rounded-lg p-2"
            >
              <span className="text-sm text-stone-800 flex-1 min-w-[8rem]">{team.name}</span>

              {!token ? (
                <button
                  onClick={() => publish(team.id)}
                  disabled={Boolean(busy)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-brand-500 text-brand-600 hover:bg-brand-50 disabled:opacity-40"
                >
                  {busy === team.id ? "מפרסם..." : "פרסם"}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => copy(token)}
                    className="px-2.5 py-1 text-xs rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 flex items-center gap-1"
                  >
                    {copied === token ? <IconCheck size={13} /> : <IconCopy size={13} />}
                    {copied === token ? "הועתק" : "העתק קישור"}
                  </button>
                  <button
                    onClick={() => rotate(team.id)}
                    disabled={Boolean(busy)}
                    title="הקישור הישן יפסיק לעבוד"
                    className="px-2.5 py-1 text-xs rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50 disabled:opacity-40"
                  >
                    קישור חדש
                  </button>
                  {confirming === team.id ? (
                    <>
                      <button
                        onClick={() => { setConfirming(""); unpublish(team.id); }}
                        className="px-2.5 py-1 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700"
                      >
                        אישור — בטל
                      </button>
                      <button
                        onClick={() => setConfirming("")}
                        className="px-2.5 py-1 text-xs rounded-lg border border-stone-300 text-stone-600"
                      >
                        השאר
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirming(team.id)}
                      className="px-2.5 py-1 text-xs rounded-lg border border-red-300 text-red-700 hover:bg-red-50"
                    >
                      בטל פרסום
                    </button>
                  )}
                  <div className="w-full text-[11px] text-stone-400 break-all">{linkFor(token)}</div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {published > 0 && (
        <div className="text-xs rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-2.5 flex items-start gap-1.5">
          <IconAlert size={13} className="mt-0.5 shrink-0" />
          <span>
            מי שמקבל את הקישור יכול להעביר אותו הלאה — אין בו התחברות. אם קישור הגיע למקום
            שלא התכוונתם אליו, "קישור חדש" מבטל את הישן מיד.
          </span>
        </div>
      )}

      <p role="status" aria-live="polite" className="text-xs text-stone-700 min-h-[1rem]">{msg}</p>
    </div>
  );
}
