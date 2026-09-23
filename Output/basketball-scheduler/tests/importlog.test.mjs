import assert from "node:assert/strict";
import {
  importLogEntry, isEmptyEntry, entrySummary, sortEntries, entriesByDay, LOG_KINDS,
} from "../src/utils/importLog.js";

let count = 0;
const T = (name, fn) => { fn(); console.log("  ok  " + name); count++; };

// A proposal shaped exactly as the nightly job files it.
const proposal = {
  id: "2026-09-23",
  sourceFile: "latest.xlsx",
  sourceHash: "c40c789d6a76",
  summary: { added: 2, updated: 1, cancelled: 1, restored: 0 },
  added: [
    { code: "800509", label: "קטסל א עידו · 13-10-2026 · נגד אליצור גבעת שמואל", game: { teamId: "t1", opponent: "אליצור גבעת שמואל" } },
    { code: "800510", label: "קטסל א איתי · 13-10-2026 · נגד מכבי רעננה", game: { teamId: "t2", opponent: "מכבי רעננה" } },
  ],
  updated: [{ code: "800511", label: "נוער · 20-10-2026 · השעה שונתה", game: { teamId: "t1" } }],
  cancelled: [{ code: "792109", label: "ילדים א · 12-11-2026 · נגד אליצור מ.ב. חשמונאים" }],
  restored: [],
};

const AT = "2026-09-23T17:43:05.000Z";

T("approving everything records everything", () => {
  const e = importLogEntry(proposal, null, { at: AT, by: "ronen@example.com" });
  assert.equal(e.total, 4);
  assert.equal(e.added.length, 2);
  assert.equal(e.updated.length, 1);
  assert.equal(e.cancelled.length, 1);
  assert.equal(e.partial, false);
  assert.equal(e.by, "ronen@example.com");
  assert.equal(e.proposalId, "2026-09-23");
});

T("approving one squad records THAT squad and nothing else", () => {
  // The same `codes` the board is written from, so the record cannot describe something
  // other than what was applied.
  const e = importLogEntry(proposal, ["800509"], { at: AT, by: "ronen@example.com" });
  assert.equal(e.total, 1);
  assert.deepEqual(e.added.map((x) => x.code), ["800509"]);
  assert.equal(e.updated.length, 0);
  assert.equal(e.cancelled.length, 0);
  assert.equal(e.partial, true, "three entries on one date have to be explainable");
});

T("the fixture is slimmed to what a reader needs — not the whole game object", () => {
  // A record that grows with the schema is a record that eventually holds something nobody
  // decided to keep.
  const e = importLogEntry(proposal, null, { at: AT, by: "x" });
  assert.deepEqual(Object.keys(e.added[0]).sort(), ["code", "label", "teamId"]);
  assert.equal(e.added[0].teamId, "t1");
  assert.equal(JSON.stringify(e).includes("opponent"), false, "the payload leaked into the log");
});

T("an item with no game still records its code and label", () => {
  const e = importLogEntry(proposal, null, { at: AT, by: "x" });
  assert.equal(e.cancelled[0].code, "792109");
  assert.equal(e.cancelled[0].teamId, "");
});

T("a decision that changes nothing is not written at all", () => {
  const empty = { id: "d", added: [], updated: [], cancelled: [], restored: [] };
  assert.equal(isEmptyEntry(importLogEntry(empty, null, { at: AT, by: "x" })), true);
  assert.equal(isEmptyEntry(importLogEntry(proposal, ["nope"], { at: AT, by: "x" })), true);
  assert.equal(isEmptyEntry(importLogEntry(proposal, null, { at: AT, by: "x" })), false);
});

T("nothing in, nothing out — and no throw", () => {
  const e = importLogEntry(null, null, { at: "", by: "" });
  assert.equal(e.total, 0);
  for (const k of LOG_KINDS) assert.deepEqual(e[k], []);
});

T("the summary names only what is not zero", () => {
  assert.equal(
    entrySummary(importLogEntry(proposal, null, { at: AT, by: "x" })),
    "2 נוספו · 1 שונו · 1 בוטלו"
  );
  assert.equal(entrySummary({ added: [], updated: [], cancelled: [], restored: [] }), "ללא שינוי");
});

T("newest first, and a broken timestamp sorts last rather than to the top", () => {
  const out = sortEntries([
    { at: "2026-09-21T10:00:00.000Z", total: 1 },
    { at: "", total: 9 },
    { at: "2026-09-23T10:00:00.000Z", total: 2 },
  ]);
  assert.deepEqual(out.map((e) => e.total), [2, 1, 9]);
});

T("grouped by day, because one file can be approved in several sittings", () => {
  const days = entriesByDay([
    { at: "2026-09-23T06:10:00.000Z", total: 1 },
    { at: "2026-09-23T17:43:00.000Z", total: 7 },
    { at: "2026-09-22T05:32:00.000Z", total: 98 },
  ]);
  assert.deepEqual(days.map((d) => d.day), ["2026-09-23", "2026-09-22"]);
  assert.equal(days[0].entries.length, 2);
  assert.equal(days[0].total, 8, "the day's total is the sum of its approvals");
  assert.equal(days[1].total, 98);
});

console.log(`\n${count} import-log tests passed`);
