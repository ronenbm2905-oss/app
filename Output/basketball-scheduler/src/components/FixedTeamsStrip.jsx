import { uid } from "../utils/dates";
import { pendingFixedTeams, buildFixedSessions, countPending, skipWeek } from "../utils/fixedTeams";
import { IconCopy, IconX } from "./ui/icons";

// "The school's four rows are missing from this week — add them."
//
// A click rather than an automatic fill: the fill writes the whole club document, and
// paging forward through ten weeks to look at something would quietly create ten weeks of
// sessions nobody asked for. One press, and it says exactly what it is about to add and
// which week it is copying — a button that adds eleven rows should never be a surprise.
export function FixedTeamsStrip({ data, save, canEdit, weekStart }) {
  if (!canEdit) return null;
  const pending = pendingFixedTeams(data, weekStart);
  if (!pending.length) return null;

  const total = countPending(pending);
  const from = pending[0].from;
  const sameSource = pending.every((p) => p.from === from);

  const add = () => {
    const built = buildFixedSessions(pending, weekStart, uid);
    save({ ...data, sessions: [...data.sessions, ...built] });
  };

  const skip = () => save({ ...data, fixedWeekSkips: skipWeek(data, weekStart) });

  const label = (iso) => {
    const p = String(iso).split("-");
    return p.length === 3 ? `${p[2]}/${p[1]}` : iso;
  };

  return (
    <div className="no-print text-xs rounded-lg border border-brand-200 bg-brand-50 text-brand-900 p-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="font-semibold">
        🔁 {pending.length === 1 ? "קבוצה קבועה אחת" : `${pending.length} קבוצות קבועות`} טרם הוזנו לשבוע הזה
        {" "}({total === 1 ? "אימון אחד" : `${total} אימונים`})
      </span>
      <span className="text-brand-700">
        {pending.map((p) => p.team.name).join(" · ")}
      </span>
      {/* Naming the source week is the difference between a button you trust and one you
          press hoping for the best — it is also how a stale template gives itself away. */}
      <span className="text-brand-700">
        {sameSource ? `לפי השבוע של ${label(from)}` : "לפי השבוע האחרון של כל קבוצה"}
      </span>
      <button
        onClick={add}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 shrink-0"
      >
        <IconCopy size={14} /> הוסף לשבוע הזה
      </button>
      <button
        onClick={skip}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-brand-700 hover:bg-brand-100 shrink-0"
        title="אל תציע את זה שוב לשבוע הזה"
      >
        <IconX size={13} /> לא השבוע
      </button>
    </div>
  );
}
