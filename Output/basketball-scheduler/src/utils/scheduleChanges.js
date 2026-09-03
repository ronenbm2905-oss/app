// What changed in a coach's week, and when.
//
// The app has always updated live — a coach with the board open sees a time move the
// instant a manager saves it. What it never did was *say so*. A coach who was not looking
// at that moment had no way to know, and the club's answer was to re-send the whole board
// on WhatsApp and hope people spotted the difference.
//
// The log is built by diffing, in ONE place: `useClubData.save()` sees both the document
// as it was and as it is about to be. Detecting changes at each call site instead would
// mean remembering to do it in the session form, the board's drag, the delete, the week
// copy, the CSV import and the fixed-teams strip — and the one that gets forgotten is the
// one that matters.
//
// Bounded on purpose. It lives on the club document, which is already 78 KB of a 1 MB
// ceiling with `sessions` growing all season, so the log keeps a fixed recent window
// rather than a history.

import { DAYS } from "../constants.js";

const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => String(v ?? "").trim();

export const MAX_CHANGES = 150;
export const CHANGE_TTL_DAYS = 30;
// Above this many additions for one coach in a single save, the entries collapse into one.
// A manager building next week from scratch is not making twenty announcements; a manager
// adding one training is making one. Nothing is dropped — it is summarised, and the count
// is kept.
export const BULK_ADD_THRESHOLD = 10;

// The fields a coach would notice. `type` is in here because "אימון" turning into "משחק
// בית" changes what they are showing up for.
const WATCHED = ["day", "start", "end", "hallId", "type", "teamId"];

function shape(s) {
  return { day: str(s?.day), start: str(s?.start), end: str(s?.end), hallId: str(s?.hallId), type: str(s?.type) };
}

function differs(a, b) {
  return WATCHED.some((k) => str(a?.[k]) !== str(b?.[k]));
}

// The raw diff between two session lists, keyed by session id. Pure, and unaware of who is
// looking — the caller decides what to keep.
export function diffSessions(before, after, now) {
  const prev = new Map(arr(before).filter((s) => s && s.id).map((s) => [s.id, s]));
  const next = new Map(arr(after).filter((s) => s && s.id).map((s) => [s.id, s]));
  const out = [];
  const entry = (coachId, kind, s, extra) => ({
    id: `${s.id}-${kind}-${now}`,
    at: now,
    coachId: str(coachId),
    teamId: str(s.teamId),
    weekOf: str(s.weekOf),
    kind,
    ...extra,
  });

  next.forEach((s, id) => {
    const was = prev.get(id);
    if (!was) {
      out.push(entry(s.coachId, "added", s, { after: shape(s) }));
      return;
    }
    // A session handed to another coach is a removal for one and an addition for the other.
    // Reporting it once, to whichever coach the record now names, would leave the coach who
    // lost the training with no notice at all.
    if (str(was.coachId) !== str(s.coachId)) {
      out.push(entry(was.coachId, "removed", was, { before: shape(was) }));
      out.push(entry(s.coachId, "added", s, { after: shape(s) }));
      return;
    }
    if (differs(was, s)) out.push(entry(s.coachId, "changed", s, { before: shape(was), after: shape(s) }));
  });

  prev.forEach((s, id) => {
    if (!next.has(id)) out.push(entry(s.coachId, "removed", s, { before: shape(s) }));
  });

  return out;
}

// Collapse a coach's flood of additions from one save into a single entry.
export function collapseBulk(entries, now) {
  const byCoach = new Map();
  arr(entries).forEach((e) => {
    if (!byCoach.has(e.coachId)) byCoach.set(e.coachId, []);
    byCoach.get(e.coachId).push(e);
  });
  const out = [];
  byCoach.forEach((list, coachId) => {
    const added = list.filter((e) => e.kind === "added");
    if (added.length > BULK_ADD_THRESHOLD) {
      out.push({
        id: `bulk-${coachId}-${now}`,
        at: now,
        coachId,
        teamId: "",
        weekOf: added[0].weekOf,
        kind: "bulk",
        count: added.length,
      });
      out.push(...list.filter((e) => e.kind !== "added"));
    } else {
      out.push(...list);
    }
  });
  return out;
}

export function trimChanges(changes, now) {
  const cutoff = new Date(new Date(now).getTime() - CHANGE_TTL_DAYS * 86400000).toISOString();
  return arr(changes)
    .filter((c) => c && c.at && c.at >= cutoff)
    .slice(-MAX_CHANGES);
}

// The one call the write path makes. Returns `next` untouched when nothing a coach would
// notice has moved, so an edit to teams, players or the allowlist writes no log at all.
export function withScheduleChanges(prev, next, now = new Date().toISOString()) {
  if (!next || !Array.isArray(next.sessions)) return next;
  if (prev?.sessions === next.sessions) return next; // same array — nothing touched them
  const found = diffSessions(prev?.sessions, next.sessions, now);
  if (found.length === 0) return next;
  return { ...next, changes: trimChanges([...arr(next.changes), ...collapseBulk(found, now)], now) };
}

// ---------- reading ----------

export function changesForCoach(changes, coachId, sinceIso) {
  const id = str(coachId);
  if (!id) return [];
  return arr(changes)
    .filter((c) => c && c.coachId === id)
    .filter((c) => !sinceIso || String(c.at || "") > sinceIso)
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
}

export function changesForWeek(changes, weekOf) {
  const w = str(weekOf);
  if (!w) return [];
  return arr(changes)
    .filter((c) => c && c.weekOf === w)
    .sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
}

const slot = (s) => (s && s.start && s.end ? `${s.start}–${s.end}` : "");

// One readable Hebrew line. `names` supplies the lookups the log deliberately does not
// store — a hall renamed after the fact should read by its new name, not by the old one
// frozen into the record.
export function changeLabel(entry, names = {}) {
  if (!entry) return "";
  const hall = (id) => (names.halls || []).find((h) => h && h.id === id)?.name || "";
  const day = (s) => (s?.day ? `יום ${s.day}` : "");

  if (entry.kind === "bulk") return `נוספו ${entry.count} אימונים`;
  if (entry.kind === "added") {
    const a = entry.after;
    return `נוסף: ${day(a)} ${slot(a)}${hall(a?.hallId) ? ` · ${hall(a.hallId)}` : ""}`.replace(/\s+/g, " ").trim();
  }
  if (entry.kind === "removed") {
    const b = entry.before;
    return `בוטל: ${day(b)} ${slot(b)}${hall(b?.hallId) ? ` · ${hall(b.hallId)}` : ""}`.replace(/\s+/g, " ").trim();
  }

  // A change lists only the parts that actually moved. "יום רביעי 16:00–17:30 → 17:30–19:00"
  // is what a coach needs; repeating the hall that did not change is noise.
  const { before: b, after: a } = entry;
  const parts = [];
  if (str(b?.day) !== str(a?.day)) parts.push(`${day(b)} ← ${day(a)}`.replace("← ", "→ "));
  if (slot(b) !== slot(a)) parts.push(`${slot(b)} → ${slot(a)}`);
  if (str(b?.hallId) !== str(a?.hallId)) parts.push(`${hall(b?.hallId) || "—"} → ${hall(a?.hallId) || "—"}`);
  if (str(b?.type) !== str(a?.type)) parts.push(`${b?.type || "אימון"} → ${a?.type || "אימון"}`);
  const where = str(b?.day) === str(a?.day) ? day(a) : "";
  return [where, parts.join(" · ")].filter(Boolean).join(": ");
}

// Grouped for the WhatsApp message: one block per coach, in the order a person reads.
export function changesByCoach(changes, names = {}) {
  const groups = new Map();
  arr(changes).forEach((c) => {
    if (!groups.has(c.coachId)) groups.set(c.coachId, []);
    groups.get(c.coachId).push(c);
  });
  return [...groups.entries()]
    .map(([coachId, list]) => ({
      coachId,
      name: (names.coaches || []).find((x) => x && x.id === coachId)?.name || "ללא מאמן",
      lines: list.map((c) => changeLabel(c, names)).filter(Boolean),
    }))
    .filter((g) => g.lines.length)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
}

// The message the manager pastes into WhatsApp.
//
// Text and not an image, deliberately: it is short, it is searchable in the chat, and a
// coach can quote one line back to ask about it. The board is already shared as a picture —
// this is the part a picture does worst.
export function changesMessage(changes, weekOf, weekLabel, names = {}) {
  const groups = changesByCoach(changesForWeek(changes, weekOf), names);
  if (!groups.length) return "";
  const head = `עדכון לו״ז — ${weekLabel}`;
  const body = groups.map((g) => [`${g.name}:`, ...g.lines.map((l) => `• ${l}`)].join("\n")).join("\n\n");
  return `${head}\n\n${body}`;
}

export const DAY_ORDER = DAYS;
