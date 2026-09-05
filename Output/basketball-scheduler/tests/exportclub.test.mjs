// Taking the club's data out — and the sheet that was missing from it.
//
// Written for the legal gate's M6. The deletion runbook says the training plans may be
// deleted "only once the export in step 1 includes them", and step 1 offers JSON or CSV.
// The CSV had no training-plan sheet at all, so a club that asked for CSV, received its
// files and confirmed receipt had its coaches' work deleted under a condition that was
// never met. The condition meant to prevent the loss was authorising it.
//
// The assertions that matter most are the two about a club that CHANGED its template after
// its coaches had written: the form is allowed to stop showing a removed column, the export
// is not allowed to stop carrying it.

import assert from "node:assert/strict";
import {
  buildClubExport, csvSheets, toCsv, planExportColumns, lineupText, exportFileName,
} from "../src/utils/exportClub.js";
import { planTemplate } from "../src/utils/trainingPlan.js";

const WEEK = "2026-09-06";

const club = () => ({
  settings: {
    name: "מכבי בדיקה",
    trainingPlan: {
      columns: [{ id: "drill", label: "תרגיל" }, { id: "time", label: "זמן" }],
      lineups: { enabled: true, groups: 2, quads: 2, fives: 1 },
      startingRows: 3,
    },
  },
  teams: [{ id: "t1", name: "נוער א", coachId: "c1" }],
  coaches: [{ id: "c1", name: "דנה", phone: "050-1111111" }],
  halls: [{ id: "h1", name: "אולם מרכזי" }],
  players: [{ id: "p1", name: "יואב", teamId: "t1" }],
  sessions: [
    { id: "s1", teamId: "t1", coachId: "c1", hallId: "h1", day: "ראשון", start: "17:00", end: "18:30", weekOf: WEEK },
    { id: "s2", teamId: "t1", coachId: "c1", hallId: "h1", day: "שלישי", start: "17:00", end: "18:30", weekOf: WEEK },
  ],
  games: [{ id: "g1", date: "2026-09-10", teamId: "t1", opponent: "הפועל", isHome: true }],
});

const plans = () => ({
  s2: {
    rows: [{ drill: "מסירות", time: "10" }, { drill: "הגנה", time: "15", sketch: { shapes: [1] } }],
    units: { 1: { quads: ["יואב", "נועם"], fives: ["רון"] }, 2: { quads: [], fives: [] } },
    players: "12", missing: "עידו", summary: "אימון טוב",
    author: "דנה", authorEmail: "dana@club.org", updatedAt: "2026-09-07T10:00:00Z",
  },
  s1: {
    rows: [{ drill: "חימום", time: "5" }],
    units: {}, players: "10", missing: "", summary: "",
    author: "דנה", authorEmail: "dana@club.org", updatedAt: "2026-09-06T10:00:00Z",
  },
});

const notes = { g1: { text: "ניצחון", ourScore: 60, theirScore: 55, author: "דנה", updatedAt: "2026-09-10" } };
const videos = [{ id: "v1", title: "מסירות", url: "https://youtu.be/x", author: "דנה", createdAt: "2026-09-01" }];

const lines = (csv) => csv.replace(/^﻿/, "").trim().split("\r\n");
const body = (csv) => lines(csv).slice(1);

// ---- The sheet that was missing ----
{
  const sheets = csvSheets(club(), notes, videos, plans());
  assert.ok("trainingPlans" in sheets, "no training-plan sheet in the CSV export");
  assert.ok("trainingPlanDrills" in sheets, "no drill sheet in the CSV export");
  assert.equal(body(sheets.trainingPlans).length, 2, "a plan went missing from the export");
  // Ordered by the schedule, not by object key order: s1 is Sunday, s2 is Tuesday.
  assert.ok(body(sheets.trainingPlans)[0].includes("ראשון"));
  assert.ok(body(sheets.trainingPlans)[1].includes("שלישי"));
  // The content a coach actually wrote.
  const tuesday = body(sheets.trainingPlans)[1];
  assert.ok(tuesday.includes("אימון טוב"), "the summary was dropped");
  assert.ok(tuesday.includes("עידו"), "the missing-players field was dropped");
  assert.ok(tuesday.includes("יואב"), "the lineup names were dropped");
  assert.ok(tuesday.includes("דנה"), "the author was dropped");
  // Three drills across two plans, each carrying its session's context.
  assert.equal(body(sheets.trainingPlanDrills).length, 3);
  assert.ok(sheets.trainingPlanDrills.includes("מסירות"));
  assert.ok(sheets.trainingPlanDrills.includes("חימום"));
  // The club's own column labels head the drill sheet — not the defaults.
  const head = lines(sheets.trainingPlanDrills)[0];
  assert.ok(head.includes("תרגיל") && head.includes("זמן"));
  assert.ok(!head.includes("דגשים"), "a column this club removed came back as a heading");
  // A diagram is not text, and saying so is what stops a blank cell reading as an empty drill.
  assert.ok(sheets.trainingPlanDrills.includes("יש — ראו קובץ ה-JSON"));
}

// ---- A club that changed its template after its coaches wrote ----
//
// The form reads a plan through the current template and a removed column stops appearing,
// which is correct on screen. In the export it would be silent loss, in the one artefact
// the deletion runbook trusts.
{
  const data = club();
  const p = plans();
  p.s1.rows = [{ drill: "חימום", time: "5", focus: "ברכיים" }]; // a column since removed
  const cols = planExportColumns(planTemplate(data), p);
  assert.deepEqual(cols.map((c) => c.id), ["drill", "time", "focus"], "a stray column was dropped");
  assert.equal(cols[2].label, "focus", "a stray column should be labelled by its raw key");
  const sheets = csvSheets(data, notes, videos, p);
  assert.ok(sheets.trainingPlanDrills.includes("ברכיים"), "content in a removed column was lost");
}
// Same for a lineup group the template no longer has — and for a club that filled lineups
// in and then turned the whole block off.
{
  const data = club();
  data.settings.trainingPlan.lineups = { enabled: false, groups: 1, quads: 1, fives: 1 };
  const sheets = csvSheets(data, notes, videos, plans());
  assert.ok(sheets.trainingPlans.includes("נועם"), "a lineup name was lost when the block was switched off");
  assert.ok(sheets.trainingPlans.includes("רון"), "a lineup name was lost when the group count shrank");
}

// ---- lineupText on its own ----
assert.equal(
  lineupText({ units: { 1: { quads: ["א", "ב"], fives: ["ג"] } } }),
  "קבוצה 1 — רביעיות: א, ב · חמישיות: ג"
);
assert.equal(lineupText({ units: { 2: { quads: ["ב"] }, 1: { quads: ["א"] } } }),
  "קבוצה 1 — רביעיות: א | קבוצה 2 — רביעיות: ב", "groups came out in insertion order, not numeric order");
assert.equal(lineupText({ units: { 1: { quads: ["", "  "], fives: [] } } }), "", "blank slots produced an empty group label");
assert.equal(lineupText({}), "");
assert.equal(lineupText(null), "");

// ---- A plan whose session was deleted still comes out ----
{
  const data = club();
  data.sessions = data.sessions.filter((s) => s.id !== "s2");
  const rows = body(csvSheets(data, notes, videos, plans()).trainingPlans);
  assert.equal(rows.length, 2, "an orphaned plan was dropped — that is the loss this export prevents");
  assert.ok(rows[1].includes("אימון טוב"), "the orphan should sort last, with empty schedule columns");
  assert.ok(rows[1].startsWith(",,,"), "the orphan should have no date, day or hour");
}

// ---- Nothing to export is empty, not broken ----
for (const empty of [undefined, null, {}]) {
  const sheets = csvSheets(club(), notes, videos, empty);
  assert.equal(body(sheets.trainingPlans).length, 0);
  assert.equal(body(sheets.trainingPlanDrills).length, 0);
  assert.ok(lines(sheets.trainingPlans)[0].includes("סיכום"), "the header should stand on its own");
}
assert.doesNotThrow(() => csvSheets(null, null, null, null));
// A malformed plan document must not take the whole export down with it.
assert.doesNotThrow(() => csvSheets(club(), notes, videos, { s1: null, s2: { rows: "לא מערך", units: 7 } }));

// ---- CSV mechanics, because a file Excel cannot open is not a return ----
{
  const csv = toCsv([{ a: 'שורה, עם "מרכאות"\nושורה שנייה' }], [{ label: "טקסט", get: (r) => r.a }]);
  assert.ok(csv.startsWith("﻿"), "no BOM — Excel would render Hebrew as mojibake");
  assert.ok(csv.includes('"שורה, עם ""מרכאות""'), "a comma or quote broke the row");
  assert.ok(csv.endsWith("\r\n"));
}
// A summary carrying a comma survives the round trip into its own cell.
{
  const p = plans();
  p.s1.summary = 'עבדנו על מסירות, הגנה ו"פיק אנד רול"';
  assert.ok(csvSheets(club(), notes, videos, p).trainingPlans.includes('"עבדנו על מסירות, הגנה ו""פיק אנד רול"""'));
}

// ---- The JSON copy, which is the faithful one ----
{
  const doc = buildClubExport(club(), { clubId: "maccabi", exportedAt: "2026-09-08", gameNotes: notes, videos, trainingPlans: plans() });
  assert.equal(doc._clubId, "maccabi");
  assert.deepEqual(Object.keys(doc.trainingPlans).sort(), ["s1", "s2"]);
  assert.equal(doc.trainingPlans.s2.rows[1].sketch.shapes[0], 1, "the diagram is only in the JSON, so it has to BE there");
  assert.ok(doc._note.includes("מערכי האימון"), "the note promises the plans are here");
  assert.deepEqual(buildClubExport(null, {}).trainingPlans, {}, "a missing argument must not become undefined in the file");
}

// ---- Filenames ----
assert.equal(exportFileName("maccabi-trainingPlans", "2026-09-08T10:00:00Z", "csv"), "maccabi-trainingPlans-2026-09-08.csv");
assert.equal(exportFileName("", "2026-09-08", "json"), "club-2026-09-08.json");

console.log("club export: 50 assertions passed");
