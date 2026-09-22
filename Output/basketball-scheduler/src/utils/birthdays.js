// The extension is not decoration: Vite resolves "../constants" happily, Node does not —
// and that single missing ".js" is the reason this module had no tests for two months while
// every module beside it did. Same fix as utils/conflicts.js on 20.9.
import { DAYS } from "../constants.js";

// Birthdays, matched to the week being viewed rather than to a rolling window from today.
//
// Coaches from the start; PLAYERS from 22.9.2026, through the same function — a person here
// is anything carrying a name and a birthDate, and a player record carries both under the
// same field names. See playerBirthdaysInWeek below for the part that is not shared: who is
// allowed to be in the list at all. The board, the notice and everything else in this app are organised by week, so
// "whose birthday is this week" is the question that actually gets asked — and it keeps
// working when the manager looks ahead at next week.
//
// ONLY MONTH AND DAY ARE USED. The stored year is deliberately ignored and no age is ever
// derived — not for a coach, who did not ask for their age on the notice board, and even
// less for a child. "Born on 14/03" is what a birthday reminder needs; "is 11 today" is a
// different piece of information about a minor, and the app does not compute it.

const MS_PER_DAY = 86400000;

function parseIsoDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, mo - 1, d);
  // Rejects impossible dates that Date would roll over (31/02 → 03/03).
  if (date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return { y, mo, d, date };
}

const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

// Does a birthday of month/day fall on this calendar date?
// 29 February is observed on 28 February in a common year — otherwise someone born on the
// 29th would silently never appear, which is worse than a day's approximation.
function fallsOn(bMonth, bDay, date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if (bMonth === m && bDay === d) return true;
  if (bMonth === 2 && bDay === 29 && m === 2 && d === 28 && !isLeapYear(date.getFullYear())) {
    return true;
  }
  return false;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// weekStartIso is the Sunday that keys the week, exactly as everywhere else in this app.
// Returns one entry per person whose birthday falls inside that Sunday→Saturday window,
// ordered by the day it lands on.
export function birthdaysInWeek(people, weekStartIso) {
  const start = parseIsoDate(weekStartIso);
  if (!start) return [];
  const out = [];
  for (const person of people || []) {
    const name = String(person?.name || "").trim();
    if (!name) continue;
    const born = parseIsoDate(person?.birthDate);
    if (!born) continue;
    for (let offset = 0; offset < 7; offset++) {
      const day = new Date(start.date.getTime() + offset * MS_PER_DAY);
      if (!fallsOn(born.mo, born.d, day)) continue;
      out.push({
        id: person.id,
        name,
        offset,
        dayName: DAYS[day.getDay()],
        dateLabel: `${pad(day.getDate())}/${pad(day.getMonth() + 1)}`,
        observed: !(born.mo === day.getMonth() + 1 && born.d === day.getDate()), // 29/02 in a common year
      });
      break;
    }
  }
  return out.sort((a, b) => a.offset - b.offset || a.name.localeCompare(b.name, "he"));
}

// "יום שלישי, 12/08" — or "היום" / "מחר" when the week being viewed is the current one,
// which is the common case and reads far better on a notice.
export function birthdayWhen(entry, todayOffset) {
  if (!entry) return "";
  // No emoji in the string. A screen reader reads "party popper" out of the middle of the
  // notice, and the caller can render one with aria-hidden if it wants the colour.
  if (todayOffset === entry.offset) return "היום";
  if (todayOffset === entry.offset - 1) return "מחר";
  const when = `יום ${entry.dayName}, ${entry.dateLabel}`;
  // A day earlier in the week being viewed has already gone. Without saying so, "יום ראשון,
  // 20/09" read on a Tuesday looks like something coming up — and somebody wishes a child
  // happy birthday two days late, which is worse than not wishing at all. Only when the
  // week on screen IS the current one: todayOffset is -1 otherwise, and then nothing in
  // that week has either passed or arrived.
  if (todayOffset >= 0 && todayOffset > entry.offset) return `${when} (עבר)`;
  return when;
}

// Which slot of the displayed week today occupies, or -1 when the week shown is not the
// current one. Lets the caller say "today" only when it is genuinely today.
export function todayOffsetInWeek(weekStartIso, todayIso) {
  const start = parseIsoDate(weekStartIso);
  const today = parseIsoDate(todayIso);
  if (!start || !today) return -1;
  const diff = Math.round((today.date - start.date) / MS_PER_DAY);
  return diff >= 0 && diff < 7 ? diff : -1;
}

// ---------- players ----------
//
// WHO IS ALLOWED INTO THE LIST is the whole of this function, and it is why players do not
// simply get passed to `birthdaysInWeek` at the call site.
//
// A coach sees the children of their own squads and nobody else's. Not because the roster
// is secret from them — they stand in front of these kids twice a week — but because there
// is no reason for thirty coaches to hold the birth date of every one of the club's ~550
// children, and "no reason" is the whole test for minors' data. A manager sees the club,
// which is the job.
//
// `teamIds === null` means "no scope", i.e. the manager. An EMPTY array is a real scope
// that matches nothing — a coach with no squads gets an empty list, not everyone's.
// A child whose parent asked not to be listed carries `noBirthday: true`. THE DEFAULT IS
// THE PERMISSIVE ONE — a record without the field is listed — which is why the opt-out has
// to be paired with the notice in the privacy policy and a way to ask for it: nobody can
// step out of something they were never told about. The birth date itself stays, because
// it is what places the child in an age group and registers them with the federation, and
// deleting it to silence a birthday would do real harm to answer a small request.
export function playerBirthdaysInWeek(data, weekStartIso, { teamIds = null } = {}) {
  const players = (Array.isArray(data?.players) ? data.players : []).filter(
    (p) => p && p.noBirthday !== true
  );
  const scope = teamIds === null ? null : new Set(teamIds);
  const inScope = scope ? players.filter((p) => scope.has(p.teamId)) : players;

  const byId = new Map(inScope.map((p) => [p.id, p]));
  return birthdaysInWeek(inScope, weekStartIso).map((entry) => {
    const teamId = byId.get(entry.id)?.teamId || "";
    // The squad's plain name, NOT `teamLabel`. That helper appends the coach, which here
    // would print a coach's own name against every one of their own children — and a
    // manager does not need two identically-named squads told apart in order to wish a
    // child happy birthday.
    const team = (data?.teams || []).find((t) => t && t.id === teamId);
    return { ...entry, teamId, team: String(team?.name || "") };
  });
}
