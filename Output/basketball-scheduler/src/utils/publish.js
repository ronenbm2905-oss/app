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

import { DAYS } from "../constants.js";
import { getWeekDates, toISODate, formatDate, weekStartOfDMY } from "./dates.js";
import { clubName, clubLegal } from "./club.js";

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
    // Added to the allowlist deliberately, and it is the club's OWN contact details —
    // never a player's or a coach's. The portal cannot read clubs/{clubId}, by design,
    // so without this a parent opening the privacy policy from the portal footer was
    // shown ⟨שם המפעיל — למילוי⟩ and no address to write to: no way to identify the
    // controller of their child's data, and no way to exercise access or erasure. The
    // notice obligation is owed to the parent, so the details have to reach them.
    legal: clubLegal(data),
    teams,
    holidays: holidaysInWeek(data.holidays, weekStart),
  };
}

// ---------------------------------------------------------------------------
// Split publication: one shared document, one document per team.
//
// The single document above carries EVERY team, and the rules could only ask "is this
// person a member of this club" — so a parent of one team could read the whole file and
// see every other team's week. The portal filtered it for display, which is not a
// boundary; it is a rendering choice.
//
// Firestore rules cannot split a string, so a composite id like "{week}__{teamId}" is
// unreadable to them. A subcollection puts the team id in the path, where a rule can
// match it directly:
//
//   published/{weekOf}                 — club-level, any portal member of the club
//   published/{weekOf}/teams/{teamId}  — that team only
//
// buildPublicWeek stays as the single source of what may be published at all; these two
// functions only decide which half each field belongs to.
// ---------------------------------------------------------------------------

// Everything that is about the club rather than about any one team. A parent needs it
// whichever team their child is in, and none of it says who plays where.
export function buildSharedWeek(data, weekStart, publishedAt) {
  const full = buildPublicWeek(data, weekStart, publishedAt);
  return {
    weekOf: full.weekOf,
    publishedAt: full.publishedAt,
    clubName: full.clubName,
    legal: full.legal,
    holidays: full.holidays,
    // Names only, so the portal can offer a parent with two children a team switcher
    // without having to read a week they may not open.
    teamNames: Object.fromEntries(
      Object.entries(full.teams).map(([id, t]) => [id, t.name])
    ),
  };
}

// One team's week. Returns null for a team that does not exist, so a caller cannot
// publish an empty document under a made-up id.
export function buildTeamWeek(data, weekStart, teamId, publishedAt) {
  const full = buildPublicWeek(data, weekStart, publishedAt);
  const team = full.teams[teamId];
  if (!team) return null;
  return {
    weekOf: full.weekOf,
    publishedAt: full.publishedAt,
    teamId,
    ...team,
  };
}

// The team ids a publish should write. Kept here so the caller does not re-derive it.
export const publishableTeamIds = (data) =>
  (data.teams || []).map((t) => t.id).filter(Boolean);

// Fields that must never appear anywhere in a published document. Used by the tests,
// and cheap enough to keep as a runtime guard before writing.
// `absences` sits here for the same reason as `constraints`, and one more: an absence
// carries a free-text `note` written by a MANAGER about a COACH, who did not write it and
// may not know it exists ("מילואים", "ניתוח"). `availability.js` already defaults to
// hiding that note inside the app; this list makes the parent-facing document unable to
// carry the record at all, whatever a future field addition does upstream.
export const FORBIDDEN_KEYS = [
  "players", "admins", "members", "phone", "birthDate", "constraints", "absences",
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
