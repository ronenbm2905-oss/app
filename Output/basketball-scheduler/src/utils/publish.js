// The weekly projection published to parents.
//
// All club data lives in ONE Firestore document that also holds players' names, phone
// numbers and dates of birth (minors), coaches' phone numbers, and the admin/member
// allowlists. Parents must never be able to read that document, so publishing writes a
// SEPARATE, much smaller document containing only what a parent needs: the week's
// sessions, games and holidays.
//
// This is the privacy boundary of the whole portal. It is written as an explicit
// allowlist — every field is copied by name and the source objects are never spread —
// so a new field added to a session or game elsewhere in the app cannot silently leak
// here. Keep it that way.

import { DAYS } from "../constants";
import { getWeekDates, toISODate, formatDate, weekStartOfDMY } from "./dates";
import { clubName } from "./club";

// Effective address of a game: a manual override wins over the federation file's value.
const gameAddress = (g) => (g.addressOverride || g.venue || "");

// Holidays that touch the given week (a holiday may be a multi-day range).
export function holidaysInWeek(holidays, weekStart) {
  if (!weekStart) return [];
  const dates = getWeekDates(weekStart);
  const first = toISODate(dates[DAYS[0]]);
  const last = toISODate(dates[DAYS[DAYS.length - 1]]);
  return (holidays || [])
    .filter((h) => {
      const start = h.date;
      const end = h.endDate || h.date;
      return start && start <= last && end >= first; // ranges overlap
    })
    .map((h) => ({ date: h.date, endDate: h.endDate || "", name: h.name || "" }));
}

// Builds the public week document. `publishedAt` is passed in rather than read from the
// clock so the result is deterministic and testable.
export function buildPublicWeek(data, weekStart, publishedAt) {
  const weekDates = getWeekDates(weekStart);
  const hallName = (id) => (data.halls || []).find((h) => h.id === id)?.name || "";
  const coachName = (id) => (data.coaches || []).find((c) => c.id === id)?.name || "";

  const teams = {};
  (data.teams || []).forEach((team) => {
    const sessions = (data.sessions || [])
      .filter((s) => s.teamId === team.id && (s.weekOf || "") === weekStart)
      .map((s) => ({
        day: s.day || "",
        date: weekDates[s.day] ? formatDate(weekDates[s.day]) : "",
        start: s.start || "",
        end: s.end || "",
        type: s.type || "",
        hallName: hallName(s.hallId),
        notes: s.notes || "",
      }))
      .sort((a, b) =>
        DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || String(a.start).localeCompare(String(b.start))
      );

    const games = (data.games || [])
      .filter((g) => g.teamId === team.id && weekStartOfDMY(g.date) === weekStart)
      .map((g) => ({
        date: g.date || "",
        time: g.time || "",
        opponent: g.opponent || "",
        isHome: Boolean(g.isHome),
        venue: gameAddress(g),
      }))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.time).localeCompare(String(b.time)));

    // A team with nothing this week is still published, so the portal can say
    // "no training this week" rather than looking broken.
    teams[team.id] = {
      name: team.name || "",
      // The coach's NAME only — never the phone number stored alongside it.
      coachName: coachName(team.coachId),
      sessions,
      games,
    };
  });

  return {
    weekOf: weekStart,
    publishedAt: publishedAt || "",
    clubName: clubName(data),
    teams,
    holidays: holidaysInWeek(data.holidays, weekStart),
  };
}

// Fields that must never appear anywhere in a published document. Used by the tests,
// and cheap enough to keep as a runtime guard before writing.
export const FORBIDDEN_KEYS = [
  "players", "admins", "members", "phone", "birthDate", "constraints",
  "gameMapping", "weeklyAssignments", "jerseyNumber", "joinCode",
];

// Walks the built document and returns any forbidden key found. Empty array = safe.
export function findLeakedKeys(node, path = "$", found = []) {
  if (node === null || typeof node !== "object") return found;
  if (Array.isArray(node)) {
    node.forEach((v, i) => findLeakedKeys(v, `${path}[${i}]`, found));
    return found;
  }
  for (const [k, v] of Object.entries(node)) {
    if (FORBIDDEN_KEYS.includes(k)) found.push(`${path}.${k}`);
    findLeakedKeys(v, `${path}.${k}`, found);
  }
  return found;
}
