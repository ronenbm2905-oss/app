import assert from "node:assert/strict";
import { syncState, hoursSince, whenLabel, STALE_HOURS } from "../src/utils/syncHealth.js";

let count = 0;
const T = (name, fn) => { fn(); console.log("  ok  " + name); count++; };

// 03:00 runs, and a manager looking at the screen during the day.
const ran = (iso) => ({ at: iso, cups: "none", league: "unchanged" });
const NOW = new Date("2026-09-21T09:00:00");

T("a run this morning reads as today, with the hour", () => {
  const s = syncState(ran("2026-09-21T03:04:00"), NOW);
  assert.equal(s.level, "ok");
  assert.equal(s.title, "סונכרן מהאיגוד: היום ב-03:04");
});

T("a quiet night says so — that is the sentence that was missing", () => {
  // "no changes" and "nothing checked" were the same blank screen until this existed.
  assert.equal(syncState(ran("2026-09-21T03:00:00"), NOW).detail, "אין שינויים");
});

T("yesterday is still healthy — the job runs once a day", () => {
  const s = syncState(ran("2026-09-20T03:00:00"), NOW);
  assert.equal(s.level, "ok");
  assert.equal(s.title, "סונכרן מהאיגוד: אתמול ב-03:00");
});

// THE BUG, replayed. On 21.9 at 09:00 the last run was 18.9 at 03:00.
T("three missed nights are named, in nights", () => {
  const s = syncState(ran("2026-09-18T03:00:00"), NOW);
  assert.equal(s.level, "bad");
  assert.equal(s.title, "הסנכרון מהאיגוד לא רץ 3 לילות");
});

T("and it says what to DO, not only what is wrong", () => {
  const s = syncState(ran("2026-09-18T03:00:00"), NOW);
  assert.equal(s.detail.includes("run-nightly.cmd"), true);
  assert.equal(s.detail.includes("לא נמשכו"), true);
});

// Checked in the evening, which is when it was actually noticed: a run at 03:00 YESTERDAY
// is 39 hours old, so last night was missed — and the sentence has to say that, not "2 days".
T("one missed night is singular, and names the night", () => {
  const evening = new Date("2026-09-21T18:00:00");
  const s = syncState(ran("2026-09-20T03:00:00"), evening);
  assert.equal(s.level, "bad");
  assert.equal(s.title, "הסנכרון מהאיגוד לא רץ הלילה");
});

T("the threshold sits between one healthy day and one missed night", () => {
  const at = new Date(NOW.getTime() - (STALE_HOURS - 1) * 3600000).toISOString();
  const after = new Date(NOW.getTime() - (STALE_HOURS + 1) * 3600000).toISOString();
  assert.equal(syncState(ran(at), NOW).level, "ok");
  assert.equal(syncState(ran(after), NOW).level, "bad");
});

T("a run that found something says so", () => {
  const s = syncState({ at: "2026-09-21T03:00:00", cups: "ok", league: "unchanged" }, NOW);
  assert.equal(s.level, "ok");
  assert.equal(s.detail, "נמצאו עדכונים");
});

// The two halves break separately, so they are reported separately.
T("a failed cup scan is a warning, and names which half broke", () => {
  const s = syncState({ at: "2026-09-21T03:00:00", cups: "failed", league: "unchanged" }, NOW);
  assert.equal(s.level, "warn");
  assert.equal(s.detail, "סריקת הגביע נכשלה");
});

T("a failed league fetch, likewise", () => {
  const s = syncState({ at: "2026-09-21T03:00:00", cups: "none", league: "failed" }, NOW);
  assert.equal(s.level, "warn");
  assert.equal(s.detail, "משיכת קובץ הליגה נכשלה");
});

T("both broken is its own sentence", () => {
  const s = syncState({ at: "2026-09-21T03:00:00", cups: "failed", league: "failed" }, NOW);
  assert.equal(s.detail, "שני החלקים נכשלו");
});

// A run that failed AND is old is stale first: "it has not run" outranks "it broke".
T("stale beats failed — not running is the bigger fact", () => {
  const s = syncState({ at: "2026-09-18T03:00:00", cups: "failed", league: "failed" }, NOW);
  assert.equal(s.level, "bad");
});

T("no heartbeat yet is honest, not alarming", () => {
  // True for everyone the moment this ships, until the next 03:00.
  for (const doc of [null, undefined, {}, { at: "" }, { at: "not a date" }]) {
    const s = syncState(doc, NOW);
    assert.equal(s.level, "unknown");
    assert.equal(s.title, "טרם נרשם סנכרון מהאיגוד");
  }
});

T("a clock skewed into the future is not reported as negative age", () => {
  assert.equal(hoursSince("2026-09-21T12:00:00", NOW), 0);
  assert.equal(syncState(ran("2026-09-21T12:00:00"), NOW).level, "ok");
});

T("older than a couple of days carries the date, so it can be checked", () => {
  assert.equal(whenLabel("2026-09-18T03:00:00", NOW), "לפני 3 ימים (18.9)");
  assert.equal(whenLabel("nonsense", NOW), "");
});

console.log(`\n${count} sync-health tests passed`);
