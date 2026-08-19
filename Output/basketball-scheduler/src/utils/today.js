import { DAYS } from "../constants";
import { timeToMinutes } from "./dates";

// What is happening today, for the strip at the top of every screen.
//
// Deliberately about TODAY and not about the week being viewed. The rest of the app is a
// planning tool and follows whatever week you navigate to; this one line answers "what do
// I need to know right now", and it would be useless if it changed when you looked ahead
// at next month.

const MS_PER_DAY = 86400000;

function parseIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (date.getMonth() !== Number(m[2]) - 1 || date.getDate() !== Number(m[3])) return null;
  return date;
}

function toIso(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// The Sunday that keys the week containing this date — the same key sessions carry.
export function weekOfDate(iso) {
  const d = parseIso(iso);
  if (!d) return "";
  return toIso(new Date(d.getTime() - d.getDay() * MS_PER_DAY));
}

const nameOf = (list, id) => (list || []).find((x) => x && x.id === id)?.name || "";

// nowMinutes is minutes since midnight. Passed in rather than read from the clock so the
// whole thing stays a pure function of its inputs, and so "what shows at 21:00" is a test
// rather than something you can only find out by waiting until 21:00.
//
// `coachId` narrows the day to one coach's own sessions. A coach opening the app wants to
// know when THEY train, not how busy the club is; the club-wide count is a manager's
// number. Left out — or unknown, because nobody filled that coach's email in — the summary
// covers the whole club, which is what it always did.
export function todaySummary(data, todayIso, nowMinutes, coachId) {
  const date = parseIso(todayIso);
  const scoped = Boolean(coachId);
  const empty = {
    valid: false, dayName: "", dateLabel: "", sessions: [],
    count: 0, remaining: 0, next: null, published: false, scoped,
  };
  if (!date) return empty;

  const dayName = DAYS[date.getDay()];
  const weekOf = weekOfDate(todayIso);

  const sessions = (data?.sessions || [])
    .filter((s) => s && s.day === dayName && (s.weekOf || "") === weekOf)
    .filter((s) => !scoped || s.coachId === coachId)
    .slice()
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))
    .map((s) => ({
      id: s.id,
      start: s.start,
      end: s.end,
      type: s.type || "אימון",
      teamName: nameOf(data?.teams, s.teamId),
      hallName: nameOf(data?.halls, s.hallId),
      coachName: nameOf(data?.coaches, s.coachId),
    }));

  // "Next" means the next one that has not finished yet — a session already under way is
  // still the one you care about, so it counts until its end time, not its start.
  const upcoming = sessions.filter((s) => timeToMinutes(s.end) > nowMinutes);

  return {
    valid: true,
    dayName,
    dateLabel: `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`,
    sessions,
    count: sessions.length,
    remaining: upcoming.length,
    next: upcoming[0] || null,
    published: (data?.schedulePublished?.weekOf || "") === weekOf,
    scoped,
  };
}

// Minutes since midnight for a Date — the second argument to todaySummary.
export function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}
