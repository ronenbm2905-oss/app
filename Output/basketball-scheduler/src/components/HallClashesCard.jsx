import { useState } from "react";
import { seasonHallClashes, clashesByDate, formatDayMonth } from "../utils/hallClashes";
import { duplicateSessionGroups, duplicateRowCount, withoutSessions } from "../utils/duplicateSessions";
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

// The other question a manager asks after an import, and a DIFFERENT one: not "are two
// squads booked into one gym" but "is this row here twice".
//
// It reports zero out loud. A check that is silent when it finds nothing is
// indistinguishable from a check that never ran — the lesson the sync indicator was built
// on, one screen over.
function DuplicateRows({ data, save, canEdit }) {
  const [confirming, setConfirming] = useState(false);
  const groups = duplicateSessionGroups(data, { from: new Date() });
  const extra = duplicateRowCount(groups);

  if (extra === 0) {
    return (
      <div className="text-xs text-stone-500 flex items-center gap-1.5">
        <IconCheck size={13} className="opacity-60" />
        אין שורות כפולות בלוח בהמשך העונה.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-stone-800">
          {extra === 1 ? "שורה אחת כפולה בלוח" : `${extra} שורות כפולות בלוח`}
        </h3>
        <p className="text-xs text-stone-600 mt-0.5">
          אותה קבוצה, אותו מאמן, אותו אולם, אותן שעות, באותו שבוע — כלומר אותה שורה נכנסה פעמיים.
        </p>
      </div>
      <div className="space-y-1">
        {groups.map((g, i) => (
          <div key={i} className="text-xs text-stone-700">
            <span className="font-semibold tabular-nums">{formatDayMonth(g.date)}</span>
            <span className="text-stone-500"> · {g.day} · </span>
            <span className="font-semibold tabular-nums">{g.start}–{g.end}</span>
            {"  "}
            {g.team}
            <span className="text-stone-500"> · {g.label}</span>
            {g.count > 2 && <span className="text-amber-800 font-medium"> ×{g.count}</span>}
          </div>
        ))}
      </div>
      {canEdit && (
        // Deleting rows, so it asks — and the question says how many and what survives,
        // because "האם אתה בטוח" is a question nobody reads.
        confirming ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-stone-700">
              למחוק {extra === 1 ? "שורה אחת" : `${extra} שורות`}? מכל כפילות נשארת שורה אחת.
            </span>
            <button
              onClick={() => {
                setConfirming(false);
                save(withoutSessions(data, groups.flatMap((g) => g.dropIds)));
              }}
              className="px-2.5 py-1 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700"
            >
              אישור — מחק
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-2.5 py-1 text-xs rounded-lg border border-stone-300 text-stone-600"
            >
              ביטול
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="px-3 py-1.5 text-xs rounded-lg border border-amber-400 bg-white text-amber-900 hover:bg-amber-100"
          >
            נקה כפילויות
          </button>
        )
      )}
    </div>
  );
}

export function HallClashesCard({ data, save, canEdit }) {
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
      <div className="space-y-2" dir="rtl">
        <div className="text-xs text-stone-500 flex items-center gap-1.5">
          <IconCheck size={13} className="opacity-60" />
          אין התנגשויות אולם בהמשך העונה.
        </div>
        <DuplicateRows data={data} save={save} canEdit={canEdit} />
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
      <DuplicateRows data={data} save={save} canEdit={canEdit} />
    </div>
  );
}
