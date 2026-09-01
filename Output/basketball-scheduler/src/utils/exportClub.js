// Taking your data out.
//
// Written for a contractual obligation, not a convenience: regulation 15 requires the
// processing agreement to set out how data is RETURNED at the end of the engagement,
// and the draft agreement had to say "the provider will produce it" — a promise that
// depends on one person being reachable, offered to a club that may be leaving over a
// billing dispute. A club that can press a button does not need him to answer.
//
// The club document is the authoritative dataset: teams, coaches, halls, sessions,
// games, players, constraints, holidays, announcements and settings all live in it.
// Published weeks are a derived projection of it and are deliberately NOT exported —
// re-publishing regenerates them, and including them would imply the export is
// incomplete without them.
//
// Game notes are the exception to "the club document is everything": they live in their
// own subcollection and are NOT derived from anything, so leaving them out would hand a
// departing club an incomplete copy of records its coaches wrote. They are passed in.
//
// One coupling worth stating, because it is invisible from here: a COACH only ever
// receives their own notes (the rules scope their listen by `authorEmail`), so an export
// built from a coach's session would silently be partial while calling itself complete.
// The export lives on the settings screen, which is admin-only, and an admin's listen is
// unscoped. If that screen ever opens to coaches, this has to be revisited.
//
// Pure on purpose: no Firestore, no DOM. The download plumbing lives at the call site.

import { DAYS } from "../constants";

// Fields never handed to anyone, including the club itself, because they are about the
// service rather than about the club: nothing here yet, but the list exists so a future
// internal field has an obvious place to be excluded rather than shipping by accident.
const INTERNAL_KEYS = [];

export function buildClubExport(data, { clubId, exportedAt, gameNotes }) {
  const club = { ...(data || {}) };
  INTERNAL_KEYS.forEach((k) => delete club[k]);
  const notes = gameNotes && typeof gameNotes === "object" ? gameNotes : {};
  return {
    _format: "basketball-scheduler/club-export",
    _version: 1,
    _clubId: clubId || "",
    _exportedAt: exportedAt || "",
    _note:
      "קובץ זה מכיל את כל נתוני המועדון כפי שהם שמורים במערכת, כולל הערות המאמנים אחרי משחקים. לוחות שפורסמו לפורטל ההורים נגזרים מהנתונים האלה ואינם כלולים.",
    club,
    gameNotes: notes,
  };
}

// ---- CSV ----
//
// JSON is the faithful copy; CSV is the one a club can open. A return obligation met
// only in a format that needs a developer is met on paper.

const csvCell = (value) => {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows, columns) {
  const head = columns.map((c) => csvCell(c.label)).join(",");
  const body = (rows || []).map((r) => columns.map((c) => csvCell(c.get(r))).join(","));
  // A BOM, so Excel opens Hebrew as Hebrew instead of mojibake. Without it the file is
  // technically correct and unreadable to the person it was produced for.
  return "﻿" + [head, ...body].join("\r\n") + "\r\n";
}

const nameOf = (list, id) => (list || []).find((x) => x.id === id)?.name || "";

// The tabular parts, resolved from ids into names. An export full of "t7f3k" is a
// backup, not a copy of your records.
export function csvSheets(data, gameNotes) {
  const d = data || {};
  const notes = gameNotes && typeof gameNotes === "object" ? gameNotes : {};
  return {
    teams: toCsv(d.teams, [
      { label: "שם קבוצה", get: (t) => t.name },
      { label: "מאמן", get: (t) => nameOf(d.coaches, t.coachId) },
    ]),
    coaches: toCsv(d.coaches, [
      { label: "שם", get: (c) => c.name },
      { label: "טלפון", get: (c) => c.phone || "" },
    ]),
    halls: toCsv(d.halls, [{ label: "שם אולם", get: (h) => h.name }]),
    players: toCsv(d.players, [
      { label: "שם", get: (p) => p.name },
      { label: "קבוצה", get: (p) => nameOf(d.teams, p.teamId) },
      { label: "טלפון", get: (p) => p.phone || "" },
      { label: "תאריך לידה", get: (p) => p.birthDate || "" },
      { label: "מספר גופייה", get: (p) => p.jerseyNumber || "" },
      { label: "חולצה", get: (p) => p.shirtSize || "" },
      { label: "מכנס", get: (p) => p.pantsSize || "" },
      { label: "פוטר", get: (p) => p.sweaterSize || "" },
    ]),
    sessions: toCsv(
      [...(d.sessions || [])].sort(
        (a, b) =>
          String(a.weekOf || "").localeCompare(String(b.weekOf || "")) ||
          DAYS.indexOf(a.day) - DAYS.indexOf(b.day) ||
          String(a.start || "").localeCompare(String(b.start || ""))
      ),
      [
        { label: "שבוע", get: (s) => s.weekOf || "" },
        { label: "יום", get: (s) => s.day || "" },
        { label: "התחלה", get: (s) => s.start || "" },
        { label: "סיום", get: (s) => s.end || "" },
        { label: "קבוצה", get: (s) => nameOf(d.teams, s.teamId) },
        { label: "מאמן", get: (s) => nameOf(d.coaches, s.coachId) },
        { label: "אולם", get: (s) => nameOf(d.halls, s.hallId) },
        { label: "סוג", get: (s) => s.type || "" },
        { label: "הערות", get: (s) => s.notes || "" },
      ]
    ),
    gameNotes: toCsv(
      Object.entries(notes)
        .map(([key, n]) => ({ key, ...(n || {}) }))
        // The game a note belongs to is matched on the same key the app stores it under —
        // a federation code where there is one, the game's own id otherwise.
        .map((n) => ({ ...n, game: (d.games || []).find((g) => (g.federationCode || g.id) === n.key) || null }))
        .sort((a, b) => String(a.game?.date || "").localeCompare(String(b.game?.date || ""))),
      [
        { label: "תאריך", get: (n) => n.game?.date || "" },
        { label: "קבוצה", get: (n) => nameOf(d.teams, n.game?.teamId) },
        { label: "יריבה", get: (n) => n.game?.opponent || "" },
        { label: "תוצאה", get: (n) => (n.ourScore != null && n.theirScore != null ? `${n.ourScore}:${n.theirScore}` : "") },
        { label: "נכתב ע\"י", get: (n) => n.author || "" },
        { label: "עודכן", get: (n) => n.updatedAt || "" },
        { label: "הערה", get: (n) => n.text || "" },
      ]
    ),
    games: toCsv(d.games, [
      { label: "תאריך", get: (g) => g.date || "" },
      { label: "שעה", get: (g) => g.time || "" },
      { label: "קבוצה", get: (g) => nameOf(d.teams, g.teamId) },
      { label: "יריבה", get: (g) => g.opponent || "" },
      { label: "בית/חוץ", get: (g) => (g.isHome ? "בית" : "חוץ") },
      { label: "מיקום", get: (g) => g.addressOverride || g.venue || "" },
    ]),
  };
}

// Stable, sortable, and safe as a filename on every platform.
export const exportFileName = (clubId, isoDate, ext) =>
  `${String(clubId || "club").replace(/[^a-z0-9-]/gi, "")}-${String(isoDate).slice(0, 10)}.${ext}`;
