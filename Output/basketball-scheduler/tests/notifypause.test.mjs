// Silencing the phones for the length of a scheduling session — without silencing the record.
//
// Ronen, 29.9.2026: building a fortnight of training sends the coach a notification per save,
// "as if his training had been moved". The pause stops the interruption and nothing else.

import assert from "node:assert/strict";
import {
  isNotifyPaused, pauseUntil, pauseMinutesLeft, pauseLabel, markSilent, isSilent,
  PAUSE_OPTIONS, MAX_PAUSE_MINUTES, humanLeft,
} from "../src/utils/notifyPause.js";
import { withScheduleChanges } from "../src/utils/scheduleChanges.js";
import { freshEntries } from "../src/utils/pushTargets.js";

let n = 0;
const T = (name, fn) => { fn(); n++; console.log("  ok  " + name); };

const NOW = new Date(2026, 8, 29, 20, 0);
const iso = (d) => d.toISOString();

T("no deadline means nothing is paused", () => {
  assert.equal(isNotifyPaused({}, NOW), false);
  assert.equal(isNotifyPaused({ notifyPausedUntil: null }, NOW), false);
  assert.equal(isNotifyPaused(null, NOW), false);
});

T("a deadline in the future pauses; one in the past does not", () => {
  const future = iso(new Date(NOW.getTime() + 10 * 60000));
  const past = iso(new Date(NOW.getTime() - 60000));
  assert.equal(isNotifyPaused({ notifyPausedUntil: future }, NOW), true);
  assert.equal(isNotifyPaused({ notifyPausedUntil: past }, NOW), false);
});

T("A STAMP THAT CANNOT BE READ MEANS NOT PAUSED — the safe direction", () => {
  // The other way round, one bad value silences every notification for ever with nothing on
  // any screen to say why. This way it costs one unwanted buzz.
  assert.equal(isNotifyPaused({ notifyPausedUntil: "מחר" }, NOW), false);
  assert.equal(isNotifyPaused({ notifyPausedUntil: "   " }, NOW), false);
  assert.equal(isNotifyPaused({ notifyPausedUntil: 12345 }, NOW), false);
});

T("the pause cannot be set longer than the cap, however it is asked for", () => {
  const long = pauseUntil(60 * 24, NOW);
  const capped = pauseUntil(MAX_PAUSE_MINUTES, NOW);
  assert.equal(long, capped, "a day must clamp to the maximum");
  assert.equal(pauseMinutesLeft({ notifyPausedUntil: long }, NOW), MAX_PAUSE_MINUTES);
  // And it cannot be set to nothing, which would look like it worked and do nothing.
  assert.equal(pauseMinutesLeft({ notifyPausedUntil: pauseUntil(0, NOW) }, NOW), 1);
  assert.equal(pauseMinutesLeft({ notifyPausedUntil: pauseUntil(-90, NOW) }, NOW), 1);
});

T("every offered option is within the cap", () => {
  for (const o of PAUSE_OPTIONS) assert.equal(o.minutes <= MAX_PAUSE_MINUTES, true, `${o.label} exceeds the cap`);
});

T("the label says the hour, not only a countdown", () => {
  const label = pauseLabel({ notifyPausedUntil: pauseUntil(60, NOW) }, NOW);
  assert.match(label, /עד \d{2}:\d{2}/, "a countdown alone is not something anyone can plan around");
  assert.equal(pauseLabel({}, NOW), "", "nothing to say when it is off");
});

// ---------- the write path ----------

const session = (id, day, start) => ({
  id, day, start, end: "19:30", hallId: "h1", type: "אימון", teamId: "t1", coachId: "c1",
  weekOf: "2026-10-04",
});
const club = (sessions, extra = {}) => ({ sessions, changes: [], ...extra });
const AT = "2026-10-01T17:00:00.000Z";

T("WITHOUT a pause, a new training is recorded and is notifiable", () => {
  const before = club([]);
  const after = withScheduleChanges(before, club([session("s1", "ראשון", "18:00")]), AT);
  assert.equal(after.changes.length, 1);
  assert.equal(isSilent(after.changes[0]), false);
  assert.equal(freshEntries(after.changes, new Date(AT)).length, 1, "it would ring");
});

T("WITH a pause, the entry is STILL RECORDED — and is not notifiable", () => {
  // The record is the point: the app, the weekly message and the board all read `changes`.
  // What the pause withholds is the interruption.
  const paused = { notifyPausedUntil: new Date(Date.parse(AT) + 30 * 60000).toISOString() };
  const after = withScheduleChanges(club([]), club([session("s1", "ראשון", "18:00")], paused), AT);
  assert.equal(after.changes.length, 1, "the change is written either way");
  assert.equal(isSilent(after.changes[0]), true);
  assert.equal(freshEntries(after.changes, new Date(AT)).length, 0, "no phone rings");
});

T("AN EXPIRED PAUSE DOES NOT RETRO-SILENCE, AND A LIFTED ONE DOES NOT WAKE THE OLD ONES", () => {
  // The flag rides on the entry, decided at the moment of the save. The cloud function runs
  // seconds later and reads whatever the document holds then — by which time the pause may
  // have lapsed, and entries written while it was on would go out after all.
  const paused = { notifyPausedUntil: new Date(Date.parse(AT) + 30 * 60000).toISOString() };
  const first = withScheduleChanges(club([]), club([session("s1", "ראשון", "18:00")], paused), AT);

  // Now the manager lifts it and moves something else.
  const lifted = { ...first, notifyPausedUntil: null, sessions: [session("s1", "ראשון", "18:00"), session("s2", "שני", "17:00")] };
  const second = withScheduleChanges(first, lifted, AT);

  const silent = second.changes.filter(isSilent);
  const loud = second.changes.filter((e) => !isSilent(e));
  assert.equal(silent.length, 1, "the one written during the pause stays silent");
  assert.equal(loud.length, 1, "the one written after it does not");
  assert.equal(freshEntries(second.changes, new Date(AT)).length, 1);
});

T("a save that moves nothing writes nothing, paused or not", () => {
  const paused = { notifyPausedUntil: new Date(Date.parse(AT) + 30 * 60000).toISOString() };
  const s = [session("s1", "ראשון", "18:00")];
  const out = withScheduleChanges(club(s, paused), club(s, paused), AT);
  assert.equal((out.changes || []).length, 0);
});

T("markSilent leaves the entries alone when there is no pause", () => {
  const entries = [{ id: "a" }, { id: "b" }];
  assert.equal(markSilent(entries, false), entries, "same array, untouched");
  assert.deepEqual(markSilent(entries, true).map(isSilent), [true, true]);
  assert.deepEqual(entries.map(isSilent), [false, false], "the originals are not mutated");
});

T("the notification gate drops silent entries but keeps the fresh ones beside them", () => {
  const now = new Date(AT);
  const recent = (extra) => ({ at: AT, coachId: "c1", kind: "added", ...extra });
  const out = freshEntries([recent({}), recent({ silent: true }), recent({ id: "x" })], now);
  assert.equal(out.length, 2);
  assert.equal(out.some(isSilent), false);
});


T("Hebrew counts one, two and many differently — '1 שעות' is how a machine writes", () => {
  // Caught on the screen, not here: the card read "ההתראות מושתקות עוד 1 שעות".
  assert.equal(humanLeft(1), "דקה");
  assert.equal(humanLeft(2), "שתי דקות");
  assert.equal(humanLeft(45), "45 דקות");
  assert.equal(humanLeft(60), "שעה");
  assert.equal(humanLeft(120), "שעתיים");
  assert.equal(humanLeft(180), "3 שעות");
  assert.equal(humanLeft(0), "דקה", "never 'עוד 0 דקות' — it is still on");
});

T("every option produces a sentence a person would write", () => {
  for (const o of PAUSE_OPTIONS) {
    const label = pauseLabel({ notifyPausedUntil: pauseUntil(o.minutes, NOW) }, NOW);
    assert.equal(/עוד \d+ שעות/.test(label) && !/עוד [3-9] שעות/.test(label), false, `clumsy: ${label}`);
    assert.match(label, /^ההתראות מושתקות עוד .+ — עד \d{2}:\d{2}$/);
  }
});

console.log(`
${n} notify-pause tests passed`);
