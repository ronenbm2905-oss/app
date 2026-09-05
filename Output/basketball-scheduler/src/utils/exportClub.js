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
// Game notes, the training plans and the drill library are the exception to "the club
// document is everything":
// they live in their own subcollections and are NOT derived from anything, so leaving them
// out would hand a departing club an incomplete copy of what its coaches wrote and
// collected. They are passed in.
//
// One coupling worth stating, because it is invisible from here: a COACH only ever
// receives their own notes (the rules scope their listen by `authorEmail`), so an export
// built from a coach's session would silently be partial while calling itself complete.
// The export lives on the settings screen, which is admin-only, and an admin's listen is
// unscoped. If that screen ever opens to coaches, this has to be revisited.
//
// Pure on purpose: no Firestore, no DOM. The download plumbing lives at the call site.

// Extensions on both, because these modules are imported by the plain-Node test harness as
// well as by Vite, and Node does not resolve an extensionless relative path. The export had
// no suite until now for exactly this reason, which is how the missing sheet survived.
import { DAYS } from "../constants.js";
import { planTemplate } from "./trainingPlan.js";

// Fields never handed to anyone, including the club itself, because they are about the
// service rather than about the club: nothing here yet, but the list exists so a future
// internal field has an obvious place to be excluded rather than shipping by accident.
const INTERNAL_KEYS = [];

export function buildClubExport(data, { clubId, exportedAt, gameNotes, videos, trainingPlans }) {
  const club = { ...(data || {}) };
  INTERNAL_KEYS.forEach((k) => delete club[k]);
  const notes = gameNotes && typeof gameNotes === "object" ? gameNotes : {};
  const library = Array.isArray(videos) ? videos : [];
  const plans = trainingPlans && typeof trainingPlans === "object" ? trainingPlans : {};
  return {
    _format: "basketball-scheduler/club-export",
    _version: 1,
    _clubId: clubId || "",
    _exportedAt: exportedAt || "",
    _note:
      "קובץ זה מכיל את כל נתוני המועדון כפי שהם שמורים במערכת, כולל הערות המאמנים אחרי משחקים, מערכי האימון וספריית הסרטונים. לוחות שפורסמו לפורטל ההורים נגזרים מהנתונים האלה ואינם כלולים.",
    club,
    gameNotes: notes,
    videos: library,
    trainingPlans: plans,
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

const cell = (v) => (typeof v === "string" ? v.trim() : v === 0 || v ? String(v) : "");

// The columns a training-plan export has to carry: the club's own, plus anything a coach
// wrote into a column the club has since removed.
//
// This is the difference between the export and the form. `normalizePlan` reads a plan
// THROUGH the club's current template, which is right on screen — a removed column should
// stop appearing in the form. In an export it would be silent data loss, and in the one
// place that must not lose anything: the deletion runbook lets a club's records be deleted
// once the export contains them. So this reads the stored rows directly and keeps the
// strays, labelled by their raw key so the club can at least see what they were.
export function planExportColumns(tpl, plans) {
  const cols = tpl.columns.map((c) => ({ id: c.id, label: c.label }));
  const known = new Set([...cols.map((c) => c.id), "sketch"]);
  for (const plan of Object.values(plans || {})) {
    for (const row of Array.isArray(plan?.rows) ? plan.rows : []) {
      for (const key of Object.keys(row && typeof row === "object" ? row : {})) {
        if (known.has(key)) continue;
        known.add(key);
        cols.push({ id: key, label: key });
      }
    }
  }
  return cols;
}

// The lineups, flattened into one cell, read off the STORED groups rather than off the
// template — same reason as the columns above, and it also covers the club that filled
// lineups in and then switched them off. Player names, some of them minors: this is the
// field the privacy policy calls out by name, and it belongs in the club's copy of its own
// records exactly because the club is the controller of it.
export function lineupText(plan) {
  const units = plan?.units && typeof plan.units === "object" ? plan.units : {};
  return Object.keys(units)
    .sort((a, b) => String(a).localeCompare(String(b), "en", { numeric: true }))
    .map((g) => {
      const u = units[g] && typeof units[g] === "object" ? units[g] : {};
      const list = (v) => (Array.isArray(v) ? v.map(cell).filter(Boolean) : []);
      const quads = list(u.quads);
      const fives = list(u.fives);
      const parts = [];
      if (quads.length) parts.push(`רביעיות: ${quads.join(", ")}`);
      if (fives.length) parts.push(`חמישיות: ${fives.join(", ")}`);
      return parts.length ? `קבוצה ${g} — ${parts.join(" · ")}` : "";
    })
    .filter(Boolean)
    .join(" | ");
}

// Plans joined to the session they belong to, in schedule order.
//
// A plan whose session was deleted still comes out, at the end and with empty schedule
// columns. It is a coach's written work, and dropping it because the row it hung from is
// gone would be exactly the loss this export exists to prevent.
function planRows(d, plans) {
  return Object.entries(plans)
    .map(([key, plan]) => ({
      key,
      plan: plan && typeof plan === "object" ? plan : {},
      session: (d.sessions || []).find((s) => s.id === key) || null,
    }))
    .sort((a, b) => {
      if (!a.session || !b.session) return (a.session ? 0 : 1) - (b.session ? 0 : 1);
      return (
        String(a.session.weekOf || "").localeCompare(String(b.session.weekOf || "")) ||
        DAYS.indexOf(a.session.day) - DAYS.indexOf(b.session.day) ||
        String(a.session.start || "").localeCompare(String(b.session.start || ""))
      );
    });
}

// The tabular parts, resolved from ids into names. An export full of "t7f3k" is a
// backup, not a copy of your records.
export function csvSheets(data, gameNotes, videos, trainingPlans) {
  const d = data || {};
  const notes = gameNotes && typeof gameNotes === "object" ? gameNotes : {};
  const library = Array.isArray(videos) ? videos : [];
  const plans = trainingPlans && typeof trainingPlans === "object" ? trainingPlans : {};
  const tpl = planTemplate(d);
  const planCols = planExportColumns(tpl, plans);
  const rows = planRows(d, plans);
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
    videos: toCsv(library, [
      { label: "שם", get: (v) => v.title || "" },
      { label: "קטגוריה", get: (v) => v.category || "" },
      { label: "קישור", get: (v) => v.url || "" },
      { label: "הוסיף", get: (v) => v.author || "" },
      { label: "נוסף בתאריך", get: (v) => v.createdAt || "" },
      { label: "הערה", get: (v) => v.note || "" },
    ]),
    // Two sheets, because a training plan is two shapes: one record per session, and a
    // table of drills inside it. Flattening both into one sheet would repeat the summary
    // on every drill row; keeping only the first would drop the drills, which are the part
    // a coach actually spent the evening writing.
    trainingPlans: toCsv(rows, [
      { label: "תאריך", get: (r) => r.session?.weekOf || "" },
      { label: "יום", get: (r) => r.session?.day || "" },
      { label: "שעה", get: (r) => r.session?.start || "" },
      { label: "קבוצה", get: (r) => nameOf(d.teams, r.session?.teamId) },
      { label: "מאמן משובץ", get: (r) => nameOf(d.coaches, r.session?.coachId) },
      { label: "נכתב ע\"י", get: (r) => cell(r.plan.author) },
      { label: "נכחו", get: (r) => cell(r.plan.players) },
      { label: "חסרים", get: (r) => cell(r.plan.missing) },
      { label: "הרכבים", get: (r) => lineupText(r.plan) },
      { label: "סיכום", get: (r) => cell(r.plan.summary) },
      { label: "מס' תרגילים", get: (r) => (Array.isArray(r.plan.rows) ? r.plan.rows.length : 0) },
      { label: "עודכן", get: (r) => cell(r.plan.updatedAt) },
    ]),
    trainingPlanDrills: toCsv(
      rows.flatMap((r) =>
        (Array.isArray(r.plan.rows) ? r.plan.rows : []).map((row, i) => ({ ...r, row: row || {}, index: i + 1 }))
      ),
      [
        { label: "תאריך", get: (x) => x.session?.weekOf || "" },
        { label: "קבוצה", get: (x) => nameOf(d.teams, x.session?.teamId) },
        { label: "מס' תרגיל", get: (x) => x.index },
        ...planCols.map((c) => ({ label: c.label, get: (x) => cell(x.row[c.id]) })),
        // The diagram itself is not text. Saying that it exists is what stops a club from
        // reading a blank drill row and concluding the coach left it empty.
        { label: "שרטוט", get: (x) => (x.row.sketch ? "יש — ראו קובץ ה-JSON" : "") },
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
