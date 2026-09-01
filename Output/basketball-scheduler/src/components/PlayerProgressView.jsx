import { useState, useMemo } from "react";
import {
  periodOf, periodsOfSeason, seasonOfPeriod, periodLabel, progressKey,
  progressFor, rosterFor, missingFor, writtenCount, markRead, staleSeasons,
} from "../utils/playerProgress";
import { teamsOfCoach, teamsWithCoach } from "../utils/teams";
import { sortByName } from "../utils/names";
import { toISODate } from "../utils/dates";
import { PlayerProgressCard } from "./PlayerProgressCard";
import { Select } from "./ui/Select";
import { IconUsers, IconPencil } from "./ui/icons";

// Half-season progress notes: the coach writes one per player, the professional manager
// reads them, and the two of them talk.
//
// A screen of its own rather than a panel inside the coach's board, for three reasons that
// all point the same way. The coach's board is keyed to a WEEK — every part of it hangs off
// `weekStart` — and this is the only thing in the app that is neither weekly nor monthly.
// Its tree is day → session, while this needs squad → player. And it is a screen any viewer
// can open and pick a coach in, which is precisely the wrong place to put a list of
// children's names.
//
// **There is no export, share or image button here, and that omission is deliberate.** The
// banner below tells the coach the club does not pass this note to the player or the
// parents of its own motion. One share button turns that sentence into a lie, and the
// privacy policy with it. (What the banner does NOT claim is secrecy from a parent who
// asks — that right exists in law and the coach is told so before they write.)
export function PlayerProgressView({ data, canEdit, myCoachId, progress, saveProgress, authorName, authorEmail }) {
  // Pinned once, on mount. Recomputing it per save would file a note written at 23:59 on
  // 31 January into the second half if the coach pressed save a minute later.
  const [today] = useState(() => toISODate(new Date()));
  const currentPeriod = periodOf(today);
  const season = seasonOfPeriod(currentPeriod);
  const [period, setPeriod] = useState(currentPeriod);
  const [teamId, setTeamId] = useState("");

  const myTeams = useMemo(() => teamsOfCoach(data, myCoachId), [data, myCoachId]);
  // A manager picks from every squad, and needs the coach's name to tell "נערים א" from
  // "נערים ב". A coach picks only from their own.
  const teamOptions = canEdit ? teamsWithCoach(data.teams, data.coaches) : myTeams;

  const activeTeamId = teamId || (teamOptions.length === 1 ? teamOptions[0].id : "");
  const roster = useMemo(
    () => sortByName(rosterFor(data.players, activeTeamId ? [activeTeamId] : [])),
    [data.players, activeTeamId]
  );
  // playerLabel needs the shirt number to tell two identically-named players apart, and the
  // projection deliberately drops it. Looked up here, for display only, never stored.
  const fullRoster = useMemo(
    () => (data.players || []).filter((p) => p && p.teamId === activeTeamId),
    [data.players, activeTeamId]
  );
  const numbered = (p) => fullRoster.find((f) => f.id === p.id) || p;

  const stale = canEdit ? staleSeasons(progress, season) : [];
  const missing = missingFor(roster, progress, period);
  const done = writtenCount(roster, progress, period);
  const readOnly = period !== currentPeriod; // an earlier half is history, not a form

  const save = (entry) => saveProgress(progressKey(entry.playerId, entry.period), entry);
  const onMarkRead = (entry) =>
    saveProgress(progressKey(entry.playerId, entry.period), markRead(entry, new Date().toISOString()));

  // A viewer the club cannot place as a coach gets no roster at all. Guessing that an
  // unplaceable viewer means "everyone" is exactly how a non-coach ends up reading other
  // people's writing — the same reasoning as the sessions guard in App.jsx.
  if (!canEdit && !myCoachId) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 text-center space-y-2" dir="rtl">
        <IconUsers size={28} className="mx-auto text-stone-600" />
        <p className="text-stone-600 text-sm">
          לא נמצאה עבורך רשומת מאמן, ולכן אין קבוצות לכתוב עליהן. פנה/י למנהל המועדון.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {!canEdit && (
        <div className="text-xs rounded-lg border border-stone-300 bg-stone-50 text-stone-700 p-2.5">
          ההערכה נועדה לשיחה מקצועית בינך לבין מנהלי המועדון. היא אינה מסמך רשמי, ואיננו
          מעבירים אותה לשחקן/ית או להורים ביוזמתנו. עם זאת, להורה עומדת זכות על פי דין
          לבקש לעיין במידע שנשמר על ילדו — ובקשה כזו תיענה.
        </div>
      )}

      {/* Hiding is not deleting. From the first of August the screen offers only the new
          season's halves, so last season's records sit in Firestore visible to nobody — and
          a record nobody sees is a record nobody remembers to purge. The manager is told. */}
      {canEdit && stale.length > 0 && (
        <div className="text-xs rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-2.5">
          <span className="font-semibold">קיימות הערכות מעונה קודמת שטרם נמחקו</span>
          {" "}({stale.join(", ")}). לפי מדיניות הפרטיות הן נשמרות לעונה שבה נכתבו בלבד —
          ראו נוהל המחיקה, סעיף 6א.3.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={activeTeamId}
          onChange={setTeamId}
          options={teamOptions}
          placeholder={canEdit ? "בחר קבוצה" : "בחר את הקבוצה שלך"}
          className="min-w-[13rem]"
        />
        <Select
          value={period}
          onChange={setPeriod}
          options={periodsOfSeason(season).map((p) => ({ id: p, name: periodLabel(p) }))}
          placeholder="בחר חציון"
          className="min-w-[13rem]"
        />
        {readOnly && <span className="text-xs text-amber-800 font-medium">חציון קודם — לקריאה בלבד</span>}
      </div>

      {!activeTeamId ? (
        <div className="bg-white rounded-xl border border-stone-200 p-6 text-center space-y-2">
          <IconPencil size={28} className="mx-auto text-stone-600" />
          <p className="text-stone-600 text-sm">
            {canEdit ? "בחר קבוצה כדי לראות את ההערכות של החציון." : "בחר את הקבוצה שלך כדי לכתוב."}
          </p>
        </div>
      ) : roster.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-6 text-center text-sm text-stone-600">
          אין שחקנים רשומים בקבוצה הזו. רשימת השחקנים מנוהלת על ידי מנהל המועדון.
        </div>
      ) : (
        <>
          {/* The manager's actual working list: who has nothing written, and by whom. This
              is what gives him something to raise with the coach.
              `no-print` because the line names children, and it is a working note for one
              manager — not something that should survive onto a sheet of paper. */}
          {canEdit && missing.length > 0 && (
            <div className="no-print text-xs rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-2.5">
              <span className="font-semibold">טרם נכתבו {missing.length} מתוך {roster.length}:</span>{" "}
              {missing.map((p) => p.name).join(" · ")}
            </div>
          )}
          {!canEdit && (
            <p className="text-sm text-stone-600">
              נכתבו <span className="font-semibold text-stone-800">{done}</span> מתוך {roster.length}.
            </p>
          )}

          <div className="space-y-2">
            {roster.map((p) => (
              <PlayerProgressCard
                key={p.id}
                player={numbered(p)}
                roster={fullRoster}
                entry={progressFor(progress, p.id, period)}
                period={period}
                canEdit={canEdit}
                readOnly={readOnly}
                onSave={save}
                onMarkRead={onMarkRead}
                authorName={authorName}
                authorEmail={authorEmail}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
