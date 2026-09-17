import { duplicateFixtures, mergeDuplicateFixtures, syncGamesToSessions } from "../utils/games";
import { IconAlert } from "./ui/icons";

// Two records for one fixture, and no way to remove either by hand.
//
// The delete button on this screen is offered only for games entered manually, so a fixture
// that arrived twice from the federation could be seen and not fixed. That is the gap this
// fills — and it only appears when there is something to fix.
//
// Merging keeps the record carrying the federation's own code, because that is the one the
// weekly file will keep refreshing, and folds the other into it so the squad, the hall, a
// hand-set departure and the driver are not lost with it.
export function DuplicateFixturesCard({ data, save, canEdit }) {
  if (!canEdit) return null;
  const pairs = duplicateFixtures(data.games || []);
  if (pairs.length === 0) return null;

  const teamName = (id) => (data.teams || []).find((t) => t.id === id)?.name || "";

  const merge = () => {
    const { games } = mergeDuplicateFixtures(data.games || []);
    save({ ...data, games, sessions: syncGamesToSessions(games, { ...data, games }) });
  };

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-3" dir="rtl">
      <div className="flex items-start gap-2">
        <IconAlert size={16} className="mt-0.5 text-amber-700 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-amber-900">
            {pairs.length === 1 ? "משחק אחד רשום פעמיים" : `${pairs.length} משחקים רשומים פעמיים`}
          </h3>
          <p className="text-xs text-amber-900 mt-0.5">
            אותו משחק הגיע גם מסריקת הגביעים וגם מקובץ האיגוד, תחת שני מזהים. המיזוג משאיר
            רשומה אחת — זו של האיגוד — ושומר את הקבוצה, האולם, שעת היציאה והנהג.
          </p>
        </div>
      </div>

      <div className="space-y-1">
        {pairs.map(({ keep, drop }) => (
          <div key={keep.federationCode} className="text-sm text-amber-900">
            {keep.date} · {keep.time} · {teamName(keep.teamId)} · נגד {keep.opponent}
            <span className="text-xs text-amber-700"> ({drop.length + 1} רשומות)</span>
          </div>
        ))}
      </div>

      <button
        onClick={merge}
        className="px-3 py-1.5 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700"
      >
        מזג לרשומה אחת
      </button>
    </div>
  );
}
