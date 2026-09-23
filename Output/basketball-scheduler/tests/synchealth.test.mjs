import assert from "node:assert/strict";
import { syncState, hoursSince, whenLabel, nightsMissed, lastDueRun } from "../src/utils/syncHealth.js";

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

// This test used to assert the OPPOSITE — that a run "yesterday at 03:00", read at 09:00
// today, is healthy. It is not: a run was due at 03:00 this morning and did not write. The
// assumption was "the job runs once a day, so a day old is fine", and it is what produced
// the twelve-hour blind window that hid the missed night of 23.9.2026.
T("yesterday's run, read this morning, means last night was missed", () => {
  const s = syncState(ran("2026-09-20T03:00:00"), NOW);
  assert.equal(s.level, "bad");
  assert.equal(s.title, "הסנכרון מהאיגוד לא רץ הלילה");
});

T("the same run, read the evening it happened, is healthy", () => {
  const s = syncState(ran("2026-09-20T03:00:00"), new Date("2026-09-20T23:00:00"));
  assert.equal(s.level, "ok");
  assert.equal(s.title, "סונכרן מהאיגוד: היום ב-03:00");
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

// THE CASE THAT BROKE IT, AND THE REASON THIS IS NO LONGER A COUNT OF HOURS.
//
// On 23.9.2026 the machine slept through 03:00. At 08:50 the line still read
// "סונכרן מהאיגוד: אתמול ב-03:00" in quiet grey, because 29 hours is under the 36-hour
// threshold that used to decide this. Every morning had a twelve-hour window in which a
// missed night looked healthy — and the morning is when the line is read.
T("a night slept through is red the same morning, not at three in the afternoon", () => {
  const morning = new Date("2026-09-23T08:50:00");
  const s = syncState(ran("2026-09-22T03:00:22"), morning);
  assert.equal(s.level, "bad");
  assert.equal(s.title, "הסנכרון מהאיגוד לא רץ הלילה");
  assert.match(s.detail, /אתמול ב-03:00/);
});

T("the boundary is the scheduled hour, and the grace covers a run in progress", () => {
  const yesterday = "2026-09-22T03:00:22";
  // 02:00, before tonight's run is due at all — yesterday's heartbeat is current.
  assert.equal(syncState(ran(yesterday), new Date("2026-09-23T02:00:00")).level, "ok");
  // 03:20, the run may still be fetching. Not yet a missed night.
  assert.equal(syncState(ran(yesterday), new Date("2026-09-23T03:20:00")).level, "ok");
  // 04:00, the grace is over and nothing was written.
  assert.equal(syncState(ran(yesterday), new Date("2026-09-23T04:00:00")).level, "bad");
});

T("nights are counted from the runs that were due, not from hours elapsed", () => {
  const now = new Date("2026-09-23T09:00:00");
  assert.equal(nightsMissed("2026-09-23T03:00:10", now), 0);
  assert.equal(nightsMissed("2026-09-22T03:00:10", now), 1);
  assert.equal(nightsMissed("2026-09-20T03:00:10", now), 3);
  assert.equal(nightsMissed("", now), null);
  assert.equal(lastDueRun(new Date("2026-09-23T02:00:00")).getDate(), 22);
  assert.equal(lastDueRun(new Date("2026-09-23T09:00:00")).getDate(), 23);
});

// THE SENTENCE THAT SENT HIM LOOKING FOR SOMETHING THAT WAS NOT THERE.
T("'updates found' is said in the past tense once the proposal is dealt with", () => {
  const found = { at: "2026-09-21T03:00:00", cups: "ok", league: "unchanged" };
  const s = syncState(found, NOW);
  assert.equal(s.level, "ok");
  assert.equal(s.detail, "נמצאו עדכונים, וההצעה כבר טופלה");
});

T("and points at the card when one IS waiting", () => {
  const found = { at: "2026-09-21T03:00:00", cups: "ok", league: "unchanged" };
  assert.equal(syncState(found, NOW, { pending: true }).detail, "יש הצעה שממתינה לאישור — בכרטיס שלמעלה");
  // A quiet night with something still waiting says so too — the proposal may be older.
  assert.equal(syncState(ran("2026-09-21T03:00:00"), NOW, { pending: true }).detail, "יש הצעה שממתינה לאישור — בכרטיס שלמעלה");
});

T("a failure outranks a waiting proposal — the run is what broke", () => {
  const s = syncState({ at: "2026-09-21T03:00:00", cups: "none", league: "failed" }, NOW, { pending: true });
  assert.equal(s.level, "warn");
  assert.equal(s.detail, "משיכת קובץ הליגה נכשלה");
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
