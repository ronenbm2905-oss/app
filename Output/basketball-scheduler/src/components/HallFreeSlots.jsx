import { useMemo } from "react";
import { hallBusyBlocks, freeGaps, slotIsFree, fitIntoGap } from "../utils/hallAvailability";
import { IconCheck, IconBan } from "./ui/icons";

// The hall's day, shown while the hour is still being chosen.
//
// It sits directly under the time fields because that is where the question is asked. The
// free slots are BUTTONS: a manager reading "פנוי 18:30–20:00" and then typing 18:30 into a
// field has been made to do the app's work twice.
export function HallFreeSlots({ data, hallId, day, weekOf, excludeId, start, end, onPick }) {
  const busy = useMemo(
    () => hallBusyBlocks(data, { hallId, day, weekOf, excludeId }),
    [data, hallId, day, weekOf, excludeId]
  );
  const gaps = useMemo(() => freeGaps(busy), [busy]);
  const ok = slotIsFree(busy, start, end);

  if (!hallId || !day) return null;

  const hallName = (data.halls || []).find((h) => h.id === hallId)?.name || "";

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-2.5 space-y-2" dir="rtl">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-stone-700">
          {hallName} · יום {day}
        </span>
        {start && end && (
          <span
            className={`text-xs font-medium flex items-center gap-1 ${ok ? "text-emerald-700" : "text-red-600"}`}
          >
            {ok ? <><IconCheck size={12} /> השעה שבחרת פנויה</> : <><IconBan size={12} /> השעה שבחרת תפוסה</>}
          </span>
        )}
      </div>

      {busy.length === 0 ? (
        <p className="text-xs text-emerald-700">האולם פנוי כל היום.</p>
      ) : (
        <>
          {gaps.length > 0 ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-stone-500 shrink-0">פנוי:</span>
              {gaps.map((g) => (
                <button
                  key={`${g.start}-${g.end}`}
                  type="button"
                  onClick={() => onPick(fitIntoGap(g, start, end))}
                  title={`שבץ כאן — ${g.start}–${g.end}`}
                  className="px-2 py-0.5 text-xs rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 tabular-nums"
                >
                  <span dir="ltr">{g.start}–{g.end}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-red-600">אין שעה פנויה באולם הזה ביום הזה.</p>
          )}

          {/* Who holds each block, not just that it is held — the difference between a dead
              end and a phone call that frees the hour. */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-stone-500 shrink-0">תפוס:</span>
            {busy.map((b, i) => (
              <span
                key={i}
                className={`px-2 py-0.5 text-xs rounded-md border tabular-nums ${
                  b.kind === "closure"
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-stone-300 bg-white text-stone-600"
                }`}
              >
                <span dir="ltr">{b.start}–{b.end}</span>
                <span className="font-normal"> {b.kind === "closure" ? "⛔" : ""} {b.label}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
