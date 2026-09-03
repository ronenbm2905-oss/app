import { useState, useEffect } from "react";
import { changesForCoach, changeLabel } from "../utils/scheduleChanges";
import { IconCheck } from "./ui/icons";

// "Something in your week moved." Shown at the top of every screen until the coach dismisses it.
//
// The app has always updated live; what it never did was say so. A coach who was not
// looking at that moment had no way to know a training had moved — and the club's answer
// was to re-send the whole board and hope somebody spotted the difference.
//
// **Whose banner this is not:** the manager's. They made the change; being told about it is
// noise. It renders only for a coach the club can actually place (`coachId`).

// The "I have seen this" mark lives in localStorage, and here that is the right home rather
// than a compromise. A coach cannot write the club document at all — the rules allow
// managers only — so there is nowhere in Firestore for them to record it. It is also
// genuinely per-person: what one coach has read says nothing about another. The cost is
// that a coach on both a phone and a laptop dismisses it twice, which is the smaller of
// the two problems.
const SEEN_KEY = "bball-changes-seen-v1";

const readSeen = () => {
  try {
    return JSON.parse(window.localStorage.getItem(SEEN_KEY) || "{}");
  } catch {
    return {};
  }
};

export function ScheduleChangesBanner({ data, coachId, onOpen }) {
  const [seenAt, setSeenAt] = useState("");

  useEffect(() => {
    if (!coachId) return;
    setSeenAt(readSeen()[coachId] || "");
  }, [coachId]);

  if (!coachId) return null;

  const fresh = changesForCoach(data?.changes, coachId, seenAt);
  if (fresh.length === 0) return null;

  const dismiss = () => {
    // Stamped with the newest entry's own time, not with the clock. A change saved while
    // this banner was on screen would otherwise be marked read without ever being seen.
    const newest = fresh[0]?.at || new Date().toISOString();
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify({ ...readSeen(), [coachId]: newest }));
    } catch { /* quota */ }
    setSeenAt(newest);
  };

  const names = { halls: data?.halls || [], teams: data?.teams || [] };
  // Four is enough to tell the story; the rest are one line away on the board itself.
  const shown = fresh.slice(0, 4);

  return (
    <div className="no-print rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 flex items-start gap-2.5" dir="rtl">
      <span aria-hidden="true" className="text-lg leading-none mt-0.5">🔔</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-rose-800 mb-1">
          {fresh.length === 1 ? "שינוי אחד בלו״ז שלך" : `${fresh.length} שינויים בלו״ז שלך`}
        </p>
        <ul className="space-y-0.5">
          {shown.map((c) => (
            <li key={c.id} className="text-sm text-rose-900">• {changeLabel(c, names)}</li>
          ))}
        </ul>
        {fresh.length > shown.length && (
          <p className="text-xs text-rose-700 mt-0.5">ועוד {fresh.length - shown.length}…</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {onOpen && (
          <button onClick={onOpen} className="text-xs text-rose-700 underline hover:text-rose-900">
            פתח את הלו״ז
          </button>
        )}
        <button
          onClick={dismiss}
          className="text-xs text-rose-700 hover:text-rose-900 flex items-center gap-1"
        >
          <IconCheck size={13} /> ראיתי
        </button>
      </div>
    </div>
  );
}
