import { DAYS } from "../constants";

// How the indoor courts are shared out between coaches.
//
// The club has both covered and open courts, and a slot on a covered one is the better
// slot. Whoever builds the schedule needs to see, at a glance, who has been getting them
// and who has not — so this counts indoor sessions per coach over a chosen period and
// says what share of the total each coach holds.
//
// A hall is indoor because it is marked as such on the hall record, not because its name
// happens to contain a word. Matching on the name works right up to the day someone
// renames "ברק מקורה" to "ברק (מקורה)" and the report quietly reports zero.

// A session's real date: the Sunday its week is keyed by, plus the day's offset.
export function sessionDateIso(session) {
  if (!session?.weekOf) return null;
  const idx = DAYS.indexOf(session.day);
  if (idx < 0) return null;
  const d = new Date(session.weekOf + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + idx);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Guarded by type, not by truthiness: `(x || []).filter` throws on a string, and one bad
// field in the club document would take the report down instead of showing a zero.
const arr = (v) => (Array.isArray(v) ? v : []);

export function indoorHallIdSet(halls) {
  return new Set(arr(halls).filter((h) => h && h.indoor).map((h) => h.id));
}

// Suggests which halls look indoor, for the one-time "mark them for me" helper in the
// halls screen. Only ever a suggestion the admin confirms — never applied on its own.
export function looksIndoor(hall) {
  return /מקורה/.test(String(hall?.name || ""));
}

// `from`/`to` are inclusive ISO dates; pass null for either to leave that end open.
export function indoorBalance(data, { from = null, to = null } = {}) {
  const d = data || {};
  const indoor = indoorHallIdSet(d.halls);
  const coachName = new Map(arr(d.coaches).filter(Boolean).map((c) => [c.id, c.name]));

  const rows = new Map(); // coachId -> { indoor, total }
  const bump = (coachId, isIndoor) => {
    const key = coachId || "";
    if (!rows.has(key)) rows.set(key, { indoor: 0, total: 0 });
    const r = rows.get(key);
    r.total += 1;
    if (isIndoor) r.indoor += 1;
  };

  for (const s of arr(d.sessions)) {
    if (!s) continue;
    const date = sessionDateIso(s);
    if (!date) continue;
    if (from && date < from) continue;
    if (to && date > to) continue;
    bump(s.coachId, indoor.has(s.hallId));
  }

  const totalIndoor = [...rows.values()].reduce((n, r) => n + r.indoor, 0);

  const list = [...rows.entries()]
    .map(([coachId, r]) => ({
      coachId,
      // A session can carry a coach id that no longer exists — a coach who left mid-season.
      // Counting it under "לא משויך" is better than dropping it and reporting a total that
      // does not match the board.
      name: coachName.get(coachId) || (coachId ? "מאמן שהוסר" : "ללא מאמן"),
      indoor: r.indoor,
      total: r.total,
      share: totalIndoor ? r.indoor / totalIndoor : 0,
    }))
    // Most indoor sessions first — the question is who is at the top and who is at the
    // bottom, so the answer should be readable without sorting it in your head.
    .sort((a, b) => b.indoor - a.indoor || b.total - a.total || a.name.localeCompare(b.name, "he"));

  return {
    rows: list,
    totalIndoor,
    totalSessions: [...rows.values()].reduce((n, r) => n + r.total, 0),
    indoorHallCount: indoor.size,
    // The spread is the number the whole screen exists for: how far apart the most and
    // least favoured coaches are. Coaches with no indoor sessions at all count as 0.
    spread: list.length ? list[0].indoor - list[list.length - 1].indoor : 0,
  };
}
