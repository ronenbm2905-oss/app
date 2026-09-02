// The monthly hours report — what each coach worked, and what the club settles against.
//
// This arithmetic used to live inside `ReportView`, where nothing could test it. It is the
// one calculation in the app that decides what somebody is paid, and in August 2026 it
// silently reported a doubled month because 115 duplicated sessions had landed in a week
// (see the vault entry on the copy-week bug). A number that determines pay belongs in a
// pure function with tests around it, not in a component.

import * as XLSX from "xlsx";
import { sessionDateIso } from "./availability.js";

// כל יחידת אימון = שעה וחצי.
export const HOURS_PER_UNIT = 1.5;

// Session types that are not the coach's own training hours, so they stay out of the
// monthly total the report is used to settle.
export const EXCLUDED_TYPES = ["ספורטתרפיה", "יורם", 'חד"כ'];

// Built from the list rather than written out, so the note on screen cannot drift from
// what the report actually does — it already had, the moment a third type was added.
export const excludedLabel = EXCLUDED_TYPES.map((t) => `"${t}"`).join(", ");

const arr = (v) => (Array.isArray(v) ? v : []);

// Teams whose sessions never reach this report. The basketball school is paid on its own
// arrangement, and its blocks are three and four hours long — counted as units they would
// be wrong in one direction, counted by the clock they would be wrong in the other. They
// simply do not belong here.
//
// **Read from an explicit flag, never from the team's name.** Matching "בית ספר" would mean
// that renaming a team silently changes what somebody is paid, months later, with nothing
// on screen to connect the two. The name is used once, by a button in the roster screen
// that offers to tick the flag — a suggestion a person accepts, not a rule.
export function isHoursExempt(team) {
  return Boolean(team && team.noHours);
}

export function exemptTeamIds(teams) {
  return new Set(arr(teams).filter(isHoursExempt).map((t) => t.id));
}

export function exemptTeamNames(teams) {
  return arr(teams).filter(isHoursExempt).map((t) => String(t.name || "").trim()).filter(Boolean);
}

// Only for the roster screen's one-time offer. Never consulted by the report itself.
export function looksLikeSchoolTeam(team) {
  return /בית\s*ספר/.test(String(team?.name || ""));
}

export function countsToward(session, exemptIds) {
  if (!session) return false;
  if (EXCLUDED_TYPES.includes(session.type)) return false;
  if (exemptIds && typeof exemptIds.has === "function" && exemptIds.has(session.teamId)) return false;
  return true;
}

// The one filter both the rows and the totals go through, so they cannot disagree about
// what the month contains.
export function countedSessions(data, month) {
  if (!month) return [];
  const exempt = exemptTeamIds(data?.teams);
  return arr(data?.sessions).filter((s) => countsToward(s, exempt) && monthOfSession(s) === month);
}

// "YYYY-MM" for a session, from the week it sits in plus its weekday. Returns "" for a
// session with no week or an unknown day rather than guessing a month.
export function monthOfSession(session) {
  const iso = sessionDateIso(session);
  return iso ? iso.slice(0, 7) : "";
}

// One row per coach who worked that month, busiest first.
//
// `days` is the count of DISTINCT DATES, not of sessions. A coach who runs three groups on
// one Tuesday afternoon worked one day and three units — and the two numbers answer
// different questions: hours are what he is owed, days are how often he had to show up.
// Deriving days from `units` would be wrong on exactly the coaches it matters most for.
export function hoursRows(data, month) {
  const d = data || {};
  if (!month) return [];
  const counted = countedSessions(d, month);
  return arr(d.coaches)
    .map((coach) => {
      const mine = counted.filter((s) => s.coachId === coach.id);
      const days = new Set(mine.map(sessionDateIso).filter(Boolean)).size;
      return { id: coach.id, name: coach.name, units: mine.length, hours: mine.length * HOURS_PER_UNIT, days };
    })
    .filter((r) => r.units > 0)
    .sort((a, b) => b.hours - a.hours || String(a.name).localeCompare(String(b.name), "he"));
}

// Totals for the footer.
//
// `days` is the SUM of the coaches' days — coach-days — and deliberately not the number of
// dates on which the club trained. Those are different numbers (two coaches on one evening
// are two coach-days and one club day), and the column being summed is a per-coach column.
// `clubDays` is offered beside it for whoever wants the other one, so nobody has to guess
// which of the two the footer means.
export function hoursTotals(rows, data, month) {
  const list = arr(rows);
  const units = list.reduce((n, r) => n + r.units, 0);
  const counted = countedSessions(data, month);
  return {
    units,
    hours: units * HOURS_PER_UNIT,
    days: list.reduce((n, r) => n + r.days, 0),
    clubDays: new Set(counted.map(sessionDateIso).filter(Boolean)).size,
  };
}

// Whole numbers stay whole: 12 rather than 12.0, but 12.5 keeps its half.
export function fmtHours(h) {
  const n = Number(h) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export const HOURS_HEADERS = ["מאמן", "ימי אימון", "יחידות אימון", 'סה"כ שעות'];

export function hoursRowToCells(row) {
  return [row.name, row.days, row.units, row.hours];
}

// The sheet a person opens, not a feed a machine parses — hence the totals row and the
// footnote under it. The month is in the sheet name and the file name too, because a
// payroll file that does not say which month it is for is a file nobody can check later.
export function hoursSheetAoa(rows, totals, monthText) {
  return [
    HOURS_HEADERS,
    ...arr(rows).map(hoursRowToCells),
    ['סה"כ', totals.days, totals.units, totals.hours],
    [],
    [`${monthText} · כל יחידת אימון = ${HOURS_PER_UNIT} שעות · ${excludedLabel} אינם נספרים`],
    ["ימי אימון = ימים שונים. מאמן עם שלושה אימונים באותו יום נספר יום אחד."],
    [`סכום עמודת הימים הוא סך ימי-המאמן. המועדון עצמו פעל ב-${totals.clubDays} ימים בחודש זה.`],
  ];
}

// The workbook itself. Kept beside the arithmetic rather than in the component, so the
// sheet and the screen can never disagree about what a column means — they are built from
// the same rows.
export function exportHoursXlsx(rows, totals, month, monthText) {
  const ws = XLSX.utils.aoa_to_sheet(hoursSheetAoa(rows, totals, monthText));
  ws["!cols"] = [{ wch: 22 }, { wch: 11 }, { wch: 13 }, { wch: 11 }];
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] }; // Excel opens the sheet right-to-left
  // The sheet name carries the month too. A payroll file that does not say which month it
  // covers is a file nobody can check three months later.
  XLSX.utils.book_append_sheet(wb, ws, `שעות ${month}`);
  XLSX.writeFile(wb, `דוח-שעות-מאמנים-${month}.xlsx`);
}
