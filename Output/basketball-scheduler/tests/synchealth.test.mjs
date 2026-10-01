import assert from "node:assert/strict";
import {
  syncState, hoursSince, whenLabel, nightsMissed, lastDueRun,
  sourceFreshness, sourceAgeHours, humanAgo, SOURCE_SUSPECT_HOURS, SOURCE_STALE_HOURS,
} from "../src/utils/syncHealth.js";

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
  // It said `run-nightly.cmd` until 1.10.2026 — see THE MISSED-NIGHT INSTRUCTION below for
  // why that stopped being true on 27.9. What matters here is unchanged: an instruction.
  assert.equal(s.detail.includes("למי שמתחזק/ת"), true);
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

// ---------- added 27.9.2026: `partial` must reach the screen ----------

T("an incomplete cup scan is amber and says so — not 'אין שינויים'", () => {
  // The whole point of the new state. `none` and `partial` differ only in the heartbeat, so if
  // this line did not change, the fix would stop at the database and never reach the manager.
  const at = new Date(2026, 8, 27, 3, 5).toISOString();
  const now = new Date(2026, 8, 27, 8, 30);
  const quiet = syncState({ at, cups: "none", league: "unchanged" }, now);
  const partial = syncState({ at, cups: "partial", league: "unchanged" }, now);
  assert.equal(quiet.level, "ok");
  assert.equal(quiet.detail, "אין שינויים");
  assert.equal(partial.level, "warn", "a partial picture must not be a clean grey line");
  assert.notEqual(partial.detail, quiet.detail);
  assert.equal(partial.detail.includes("חלקית"), true);
});

T("an incomplete scan outranks a waiting proposal in the sentence", () => {
  // A proposal from a partial scan is worth acting on, but "nothing else came up" is not a
  // conclusion a gap supports — so the gap is what the line says.
  const at = new Date(2026, 8, 27, 3, 5).toISOString();
  const now = new Date(2026, 8, 27, 8, 30);
  const s = syncState({ at, cups: "partial", league: "unchanged" }, now, { pending: true });
  assert.equal(s.detail.includes("חלקית"), true);
  assert.equal(s.level, "warn");
});

T("a failure still outranks an incomplete scan", () => {
  const at = new Date(2026, 8, 27, 3, 5).toISOString();
  const now = new Date(2026, 8, 27, 8, 30);
  const s = syncState({ at, cups: "failed", league: "partial" }, now);
  assert.equal(s.detail, "סריקת הגביע נכשלה");
  assert.equal(s.level, "warn");
});

T("a partial half on a night that never ran is still reported as not-run", () => {
  // `bad` is about the clock and must not be softened by what the last run found.
  const at = new Date(2026, 8, 24, 3, 5).toISOString();
  const now = new Date(2026, 8, 27, 8, 30);
  const s = syncState({ at, cups: "partial", league: "unchanged" }, now);
  assert.equal(s.level, "bad");
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// A FRESH FILE, NOT JUST A RUN THAT HAPPENED — the fault of 1.10.2026.
//
// Seven runs in a row the job ran, reached the federation, hashed the file and reported
// "unchanged", and this line read "סונכרן מהאיגוד: היום ב-03:10 · אין שינויים" over a file
// generated on 23.9 at 17:32 and served from a cache ever since — 175 hours old by the last
// of them. Twenty-six changes behind it, three of them fixtures moved to a different date.
// Found because a game appeared on the federation's website and not in the app.

T("THE FROZEN WEEK: a run on a file generated a week earlier is `bad`, not `ok`", () => {
  // The exact numbers from production: the run at 03:10 on 1.10 over the file the federation
  // generated at 17:32 on 23.9 — 175 hours, which is the label rounded to seven days.
  const s = syncState(
    { at: "2026-10-01T00:10:15Z", sourceAt: "2026-09-23T17:32:25Z", cups: "none", league: "unchanged" },
    new Date("2026-10-01T08:00:00")
  );
  assert.equal(s.level, "bad", "a sync that compared a week-old photograph is not healthy");
  assert.match(s.title, /מלפני 7 ימים/);
  // And the detail has to rule out the wrong conclusion, which is the one that cost the week.
  assert.match(s.detail, /אינו נראה/);
  assert.match(s.detail, /מופק בעת הבקשה/);
});

T("the same night with a file generated minutes earlier is `ok` — the fix, measured", () => {
  // 01.10 04:52:35 is the file Ronen pulled with the cache buster; the run is seconds later.
  const s = syncState(
    { at: "2026-10-01T04:52:40Z", sourceAt: "2026-10-01T04:52:35Z", cups: "none", league: "unchanged" },
    new Date("2026-10-01T08:00:00")
  );
  assert.equal(s.level, "ok");
  assert.equal(s.detail, "אין שינויים");
});

T("a few hours old is `warn` and SAYS it may be a cache — not silently fine", () => {
  const s = syncState(
    { at: "2026-10-01T03:10:00Z", sourceAt: "2026-09-30T19:10:00Z", cups: "none", league: "unchanged" },
    new Date("2026-10-01T08:00:00")
  );
  assert.equal(s.level, "warn");
  assert.match(s.detail, /אינו טרי/);
  assert.match(s.detail, /מטמון/);
});

T("the thresholds are a band, and the edges fall the safe way", () => {
  const at = "2026-10-01T06:00:00Z";
  const age = (hours) => ({
    at, sourceAt: new Date(Date.parse(at) - hours * 3600000).toISOString(),
    cups: "none", league: "unchanged",
  });
  const now = new Date("2026-10-01T09:00:00");
  // Three hours covers a clock that disagrees with ours, or an offset written wrong at
  // their end — not something to shout about.
  assert.equal(syncState(age(3), now).level, "ok");
  assert.equal(syncState(age(SOURCE_SUSPECT_HOURS), now).level, "warn");
  assert.equal(syncState(age(SOURCE_STALE_HOURS), now).level, "bad");
  assert.equal(syncState(age(SOURCE_STALE_HOURS - 0.1), now).level, "warn");
});

T("NO `sourceAt` AT ALL IS NOT A FAULT — every run recorded before this existed", () => {
  // The club's heartbeat the morning after the deploy still has no such field. Colouring
  // the line on a missing value would make the fix look like the bug.
  const s = syncState(ran("2026-09-21T03:00:00"), NOW);
  assert.equal(s.level, "ok");
  assert.equal(s.detail, "אין שינויים");
  assert.equal(sourceFreshness({ at: "2026-09-21T03:00:00Z" }).state, "unknown");
  assert.equal(sourceAgeHours({ at: "2026-09-21T03:00:00Z", sourceAt: "" }), null);
});

T("a file stamped in the FUTURE reads as fresh, not as a negative age", () => {
  // Their clock, not ours, and not worth an alarm. The only wrong answer here is a number
  // nobody can interpret.
  assert.equal(sourceAgeHours({ at: "2026-10-01T03:00:00Z", sourceAt: "2026-10-01T05:00:00Z" }), 0);
  assert.equal(sourceFreshness({ at: "2026-10-01T03:00:00Z", sourceAt: "2026-10-01T05:00:00Z" }).state, "ok");
});

T("A STALE FILE OUTRANKS A HALF THAT FAILED — the ordering is the lesson", () => {
  // A failure announces itself; a stale source masquerades as a healthy night. So when both
  // are true, the quieter danger is the one that gets said.
  const s = syncState(
    { at: "2026-10-01T00:10:00Z", sourceAt: "2026-09-23T17:32:25Z", cups: "failed", league: "unchanged" },
    new Date("2026-10-01T08:00:00")
  );
  assert.equal(s.level, "bad");
  assert.match(s.title, /התקבל קובץ מלפני/);
});

T("but a night that never ran still outranks a stale file", () => {
  // `bad` either way; the sentence has to name the cause a manager can act on, and "it did
  // not run" is actionable in a way "the file is old" is not.
  const at = new Date(2026, 8, 24, 3, 5).toISOString();
  const s = syncState(
    { at, sourceAt: new Date(2026, 8, 10, 3, 0).toISOString(), cups: "none", league: "unchanged" },
    new Date(2026, 8, 27, 8, 30)
  );
  assert.equal(s.level, "bad");
  assert.match(s.title, /לא רץ/);
});

T("the hours and days read as Hebrew, including both duals", () => {
  // "עוד 1 שעות" was caught on a screen and not in a test on 29.9. Not twice.
  assert.equal(humanAgo(1), "שעה");
  assert.equal(humanAgo(2), "שעתיים");
  assert.equal(humanAgo(7), "7 שעות");
  assert.equal(humanAgo(24), "יום");
  assert.equal(humanAgo(48), "יומיים");
  assert.equal(humanAgo(24 * 9), "9 ימים");
  assert.equal(humanAgo(0), "שעה", "zero can only be rounding by the time this is shown");
});

T("whenLabel says יומיים too, instead of 'לפני 2 ימים'", () => {
  const now = new Date(2026, 9, 1, 9, 0);
  assert.match(whenLabel(new Date(2026, 8, 29, 3, 0).toISOString(), now), /לפני יומיים/);
  assert.match(whenLabel(new Date(2026, 8, 28, 3, 0).toISOString(), now), /לפני 3 ימים/);
});

T("A CLOCK RUNNING AHEAD MUST NOT MASK STALENESS FOR EVER", () => {
  // Found in the gate on this very change. A future timestamp was clamped to an age of 0 and
  // read as fresh — so a federation clock a day ahead would make every file look freshly
  // generated, permanently, and hide the exact fault this was built to show. A few minutes
  // of drift is drift; two hours out is a timestamp we cannot use, and the honest answer is
  // "unknown", which colours nothing and claims nothing.
  const ahead = (hours) => ({
    at: "2026-10-01T03:00:00Z",
    sourceAt: new Date(Date.parse("2026-10-01T03:00:00Z") + hours * 3600000).toISOString(),
    cups: "none", league: "unchanged",
  });
  assert.equal(sourceFreshness(ahead(1)).state, "ok", "an hour of drift is drift");
  assert.equal(sourceFreshness(ahead(25)).state, "unknown", "a day ahead is not 'fresh'");
  assert.equal(sourceAgeHours(ahead(25)), null);
  // And "unknown" must leave the line alone rather than inventing a verdict.
  assert.equal(syncState(ahead(25), new Date("2026-10-01T08:00:00")).level, "ok");
});

T("the stale line now says what to DO, and does not blame the federation", () => {
  const s = syncState(
    { at: "2026-10-01T00:10:15Z", sourceAt: "2026-09-23T17:32:25Z", cups: "none", league: "unchanged" },
    new Date("2026-10-01T08:00:00")
  );
  // A red line with nothing to do about it is ignored by the third time.
  assert.match(s.detail, /אתר האיגוד/);
  // What was measured is that a cache served an old copy — not that the federation did it.
  assert.equal(s.title.includes("האיגוד מגיש"), false);
  assert.match(s.title, /התקבל קובץ מלפני/);
  // The conditional is carried without softening the alarm.
  assert.match(s.detail, /כל שינוי/);
  // And the sentence the whole message exists for has to parse.
  assert.match(s.detail, /אינו מעיד ש"לא התפרסם כלום"/);
});

T("the warn line uses the word a club manager actually knows for a cache", () => {
  const s = syncState(
    { at: "2026-10-01T03:10:00Z", sourceAt: "2026-09-30T19:10:00Z", cups: "none", league: "unchanged" },
    new Date("2026-10-01T08:00:00")
  );
  assert.match(s.detail, /מטמון/);
  assert.equal(s.detail.includes("זיכרון מתווך"), false, "'מתווך' reads as an intermediary body");
});

T("THE MISSED-NIGHT INSTRUCTION MUST BE A TRUE ONE", () => {
  // It said "הרץ scripts\run-nightly.cmd" until 1.10.2026. That stopped being the fix on
  // 27.9, when both halves moved to the cloud: the laptop script no longer runs the league
  // sync and its cup line was removed. A manager following it would watch it do nothing and
  // conclude the screen was wrong.
  const at = new Date(2026, 8, 24, 3, 5).toISOString();
  const s = syncState({ at, cups: "none", league: "unchanged" }, new Date(2026, 8, 27, 8, 30));
  assert.equal(s.level, "bad");
  assert.equal(s.detail.includes("run-nightly.cmd"), false);
  assert.match(s.detail, /למי שמתחזק/);
  // Nor an instruction aimed at a console the reader has no account for. "Run it from Cloud
  // Scheduler" was the first attempt and it reads as actionable only because the manager and
  // the developer happen to be the same person — the same defect in a different costume.
  assert.equal(s.detail.includes("Cloud Scheduler"), false);
  // Said without a gendered imperative, like the rest of the product.
  assert.equal(/\bהרץ\b/.test(s.detail), false);
});

console.log(`
${count} sync-health tests passed`);
