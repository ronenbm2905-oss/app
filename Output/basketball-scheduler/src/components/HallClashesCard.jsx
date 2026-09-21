import { useState } from "react";
import { seasonHallClashes, clashesByDate, formatDayMonth } from "../utils/hallClashes";
import { IconAlert, IconCheck } from "./ui/icons";

// Every double-booked hall in the season, on one screen.
//
// The weekly board already paints a clash red — but only for the week on screen, and the
// federation publishes a season at a time. Nobody pages through thirty weeks to check, so
// in practice these were found by a coach arriving at a gym that was already in use.
//
// Collapsed by default and showing only a count, like the transport editor: it is a check
// a manager runs after an import, not something to read every day. A clean season says so
// in one quiet line rather than disappearing — "no clashes" and "the check did not run"
// have to look different, the lesson the sync indicator was built on.

function Row({ clash }) {
  const tone = clash.duplicate
    ? "border-amber-300 bg-amber-50"
    : "border-red-200 bg-red-50";
  return (
    <div className={`rounded-lg border p-2 text-xs ${tone}`}>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="font-semibold text-stone-800">{clash.hall}</span>
        {clash.duplicate ? (
          <span className="text-amber-800 font-medium">אותה שורה פעמיים — כפילות</span>
        ) : clash.sameTeam ? (
          <span className="text-red-800 font-medium">אותה קבוצה, שעות חופפות</span>
        ) : (
          <span className="text-red-800 font-medium">שתי קבוצות באותו אולם</span>
        )}
      </div>
      {clash.rows.map((r, i) => (
        <div key={i} className="text-stone-700">
          <span className="font-semibold tabular-nums">{r.start}–{r.end}</span>
          {"  "}
          {r.team || "(ללא קבוצה)"}
          <span className="text-stone-500"> · {r.label}</span>
        </div>
      ))}
    </div>
  );
}

export function HallClashesCard({ data, canEdit }) {
  const [open, setOpen] = useState(false);
  if (!canEdit) return null;

  const clashes = seasonHallClashes(data);
  const days = clashesByDate(clashes);
  // Counted separately because they are dealt with differently: one is a booking to move,
  // the other is a row to delete.
  const dupes = clashes.filter((c) => c.duplicate).length;
  const real = clashes.length - dupes;

  if (clashes.length === 0) {
    return (
      <div className="text-xs text-stone-500 flex items-center gap-1.5" dir="rtl">
        <IconCheck size={13} className="opacity-60" />
        אין התנגשויות אולם בהמשך העונה.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 space-y-2" dir="rtl">
      <div className="flex items-start gap-2 flex-wrap">
        <IconAlert size={16} className="text-red-700 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-[14rem]">
          <h3 className="text-sm font-semibold text-stone-800">
            {real > 0 && `${real} התנגשויות אולם`}
            {real > 0 && dupes > 0 && " · "}
            {dupes > 0 && `${dupes} כפילויות`}
          </h3>
          <p className="text-xs text-stone-600 mt-0.5">
            ב-{days.length} ימים בהמשך העונה. כולל אימונים, לא רק משחקים — אותו אולם, שעות חופפות.
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="px-3 py-1.5 text-xs rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
        >
          {open ? "סגור" : "הצג"}
        </button>
      </div>

      {open && (
        <div className="space-y-2.5 pt-1">
          {days.map((d) => (
            <div key={d.date} className="space-y-1.5">
              <div className="text-xs font-semibold text-stone-600">
                {formatDayMonth(d.date)} · יום {d.day}
              </div>
              {d.items.map((c, i) => <Row key={i} clash={c} />)}
            </div>
          ))}
          {/* What the screen cannot do for them, said plainly rather than implied by the
              absence of a button. Moving a fixture is a phone call to the federation; this
              only finds them. */}
          <p className="text-[11px] text-stone-500">
            השינוי עצמו נעשה בלוח השבועי או מול האיגוד — כאן רק מאתרים.
          </p>
        </div>
      )}
    </div>
  );
}
