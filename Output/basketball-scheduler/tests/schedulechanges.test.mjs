// What a coach gets told when their week moves. The diff runs on every save in the app, so
// a mistake here is either a silent change or a flood of false alarms.
import assert from "node:assert/strict";
import {
  MAX_CHANGES, BULK_ADD_THRESHOLD,
  diffSessions, collapseBulk, trimChanges, withScheduleChanges,
  changesForCoach, changesForWeek, changeLabel, changeKindLabel, changeDetail, stillAhead,
  changesByCoach, changesMessage,
} from "../src/utils/scheduleChanges.js";

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("  ok  " + name); };

const NOW = "2026-09-02T10:00:00.000Z";
const LATER = "2026-09-03T10:00:00.000Z";
const W = "2026-08-30";
const names = {
  coaches: [{ id: "c1", name: "טל ברוך" }, { id: "c2", name: "אסף יוגב" }],
  halls: [{ id: "h1", name: "אולם הכפר" }, { id: "h2", name: "שרת" }],
  teams: [{ id: "t1", name: "נערים א" }],
};
const S = (over = {}) => ({
  id: "s1", coachId: "c1", teamId: "t1", hallId: "h1", weekOf: W,
  day: "רביעי", start: "16:00", end: "17:30", type: "אימון", ...over,
});

console.log("- the diff -");
t("nothing changed, nothing logged", () =>
  assert.deepEqual(diffSessions([S()], [S()], NOW), []));
t("an added session", () => {
  const [e] = diffSessions([], [S()], NOW);
  assert.equal(e.kind, "added");
  assert.equal(e.coachId, "c1");
  assert.equal(e.after.start, "16:00");
});
t("a removed session", () => {
  const [e] = diffSessions([S()], [], NOW);
  assert.equal(e.kind, "removed");
  assert.equal(e.before.start, "16:00");
});
t("a time change", () => {
  const [e] = diffSessions([S()], [S({ start: "17:30", end: "19:00" })], NOW);
  assert.equal(e.kind, "changed");
  assert.equal(e.before.start, "16:00");
  assert.equal(e.after.start, "17:30");
});
t("a hall change, a day change and a type change all register", () => {
  assert.equal(diffSessions([S()], [S({ hallId: "h2" })], NOW)[0].kind, "changed");
  assert.equal(diffSessions([S()], [S({ day: "חמישי" })], NOW)[0].kind, "changed");
  assert.equal(diffSessions([S()], [S({ type: "משחק בית" })], NOW)[0].kind, "changed");
});
t("things a coach would NOT notice are not changes", () => {
  // Notes and the game link move for all sorts of reasons; neither changes where anybody
  // has to be, and logging them would train people to ignore the banner.
  assert.deepEqual(diffSessions([S()], [S({ notes: "דגש על מסירות" })], NOW), []);
  assert.deepEqual(diffSessions([S()], [S({ federationCode: "999" })], NOW), []);
});
t("A REASSIGNED SESSION TELLS BOTH COACHES", () => {
  // The coach who lost it must hear about it. Reporting only to the new owner is how a
  // coach turns up to a training that is not his any more — or nobody turns up at all.
  const out = diffSessions([S()], [S({ coachId: "c2" })], NOW);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((e) => [e.coachId, e.kind]).sort(), [["c1", "removed"], ["c2", "added"]]);
});
t("sessions with no id are skipped rather than crashing the save", () => {
  assert.deepEqual(diffSessions([{ coachId: "c1" }], [{ coachId: "c1" }], NOW), []);
  assert.deepEqual(diffSessions(null, null, NOW), []);
});

console.log("- a week being built is not twenty announcements -");
const many = (n, over = {}) => Array.from({ length: n }, (_, i) => S({ id: `x${i}`, ...over }));
t("more than the threshold collapses into one entry, and keeps the count", () => {
  const out = collapseBulk(diffSessions([], many(BULK_ADD_THRESHOLD + 5), NOW), NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "bulk");
  assert.equal(out[0].count, BULK_ADD_THRESHOLD + 5);
});
t("at or below the threshold every addition is kept", () => {
  const out = collapseBulk(diffSessions([], many(BULK_ADD_THRESHOLD), NOW), NOW);
  assert.equal(out.length, BULK_ADD_THRESHOLD);
  assert.ok(out.every((e) => e.kind === "added"));
});
t("a removal is NEVER collapsed away, even inside a bulk build", () => {
  // A cancelled training hidden inside "נוספו 14 אימונים" is the one line that had to survive.
  //
  // The removed row is a DIFFERENT slot from the ones being added. It used to be identical to
  // them, which made the fixture say something it did not mean: a row removed while thirteen
  // identical ones appear is not a cancellation at all — the training is still there — and
  // the twin guard added on 1.10.2026 correctly says nothing about it. A Friday morning
  // training being dropped while the week is built is the case this test is actually about.
  const before = [S({ id: "gone", day: "שישי", start: "08:00", end: "09:30" })];
  const after = many(BULK_ADD_THRESHOLD + 3);
  const out = collapseBulk(diffSessions(before, after, NOW), NOW);
  assert.equal(out.filter((e) => e.kind === "removed").length, 1);
  assert.equal(out.filter((e) => e.kind === "bulk").length, 1);
});
t("two coaches are collapsed independently", () => {
  const out = collapseBulk(
    diffSessions([], [...many(BULK_ADD_THRESHOLD + 2), ...many(2, { coachId: "c2" }).map((s, i) => ({ ...s, id: `y${i}` }))], NOW),
    NOW
  );
  assert.equal(out.filter((e) => e.kind === "bulk").length, 1);
  assert.equal(out.filter((e) => e.kind === "added" && e.coachId === "c2").length, 2);
});

console.log("- the write path -");
t("a save that touches no session writes no log", () => {
  const prev = { sessions: [S()], changes: [] };
  const next = { sessions: [S()], teams: [{ id: "t9", name: "חדשה" }] };
  assert.equal(withScheduleChanges(prev, next, NOW).changes, undefined, "no changes key added");
});
t("the very same array reference short-circuits", () => {
  const shared = [S()];
  const next = { sessions: shared, players: [1] };
  assert.equal(withScheduleChanges({ sessions: shared }, next, NOW), next);
});
t("a real move appends to the existing log", () => {
  // Friday, so the training is still ahead of LATER — a move to a day already gone is not
  // logged at all any more, which is what the next section is about.
  const prev = { sessions: [S({ day: "שישי" })], changes: [{ id: "old", at: NOW, coachId: "c1", kind: "added" }] };
  const next = { sessions: [S({ day: "שישי", start: "17:30" })], changes: prev.changes };
  const out = withScheduleChanges(prev, next, LATER);
  assert.equal(out.changes.length, 2);
  assert.equal(out.changes[1].kind, "changed");
});
t("a document with no sessions array is returned untouched", () => {
  const next = { teams: [] };
  assert.equal(withScheduleChanges({ sessions: [] }, next, NOW), next);
});
t("GATE #11 M1: a save that touched no session STILL expires stale entries", () => {
  // Trimming only on a save that produced an entry makes deletion a function of activity
  // rather than of the clock — and it breaks in exactly the case the deletion procedure
  // gives as its example: a coach leaving at the end of the season, when nobody is moving
  // trainings and so nothing gets purged.
  const stale = { id: "old", at: "2026-01-01T00:00:00.000Z", coachId: "c1", kind: "added" };
  const shared = [S()];
  const next = { sessions: shared, changes: [stale], teams: [] };
  const out = withScheduleChanges({ sessions: shared, changes: [stale] }, next, NOW);
  assert.deepEqual(out.changes, [], "the expired entry should be gone");
});
t("...and a save with nothing stale and no session change is still a no-op", () => {
  const shared = [S()];
  const fresh = { id: "f", at: NOW, coachId: "c1", kind: "added" };
  const next = { sessions: shared, changes: [fresh] };
  assert.equal(withScheduleChanges({ sessions: shared }, next, NOW), next, "same object back");
});

console.log("- the log stays bounded: it lives on a document with a 1 MB ceiling -");
t("entries older than the window are dropped", () => {
  const old = { id: "o", at: "2026-01-01T00:00:00.000Z", coachId: "c1", kind: "added" };
  const fresh = { id: "f", at: NOW, coachId: "c1", kind: "added" };
  assert.deepEqual(trimChanges([old, fresh], NOW).map((c) => c.id), ["f"]);
});
t("the log never exceeds its cap, and it is the OLDEST that go", () => {
  const list = Array.from({ length: MAX_CHANGES + 40 }, (_, i) => ({ id: `c${i}`, at: NOW, coachId: "c1", kind: "added" }));
  const out = trimChanges(list, NOW);
  assert.equal(out.length, MAX_CHANGES);
  assert.equal(out[out.length - 1].id, `c${MAX_CHANGES + 39}`, "the newest survived");
});
t("a malformed entry cannot wedge the trim", () =>
  assert.deepEqual(trimChanges([null, {}, { at: "" }], NOW), []));

console.log("- reading: the coach's banner -");
const log = [
  { id: "a", at: NOW, coachId: "c1", weekOf: W, kind: "added", after: { day: "רביעי", start: "16:00", end: "17:30", hallId: "h1" } },
  { id: "b", at: LATER, coachId: "c1", weekOf: W, kind: "removed", before: { day: "שני", start: "18:00", end: "19:30", hallId: "h2" } },
  { id: "c", at: LATER, coachId: "c2", weekOf: W, kind: "added", after: { day: "שישי", start: "10:00", end: "11:30", hallId: "h1" } },
];
t("a coach sees only their own, newest first", () =>
  assert.deepEqual(changesForCoach(log, "c1").map((c) => c.id), ["b", "a"]));
t("and only what happened since they last looked", () =>
  assert.deepEqual(changesForCoach(log, "c1", NOW).map((c) => c.id), ["b"]));
t("no coach, nothing", () => {
  assert.deepEqual(changesForCoach(log, ""), []);
  assert.deepEqual(changesForCoach(null, "c1"), []);
});
t("the week view takes everyone's", () =>
  assert.deepEqual(changesForWeek(log, W).map((c) => c.id), ["a", "b", "c"]));

console.log("- wording -");
t("an addition and a cancellation read as sentences", () => {
  // The headline now says WHAT and the date says WHEN. Both facts were already in the
  // record and neither was printed — see THE TWO SILENT MISSES at the end of this file.
  assert.equal(changeLabel(log[0], names), "אימון חדש · יום רביעי 2.9 · 16:00–17:30 · אולם הכפר");
  assert.equal(changeLabel(log[1], names), "ביטול אימון · יום שני 31.8 · 18:00–19:30 · שרת");
});
t("a change names ONLY what moved", () => {
  const e = { kind: "changed", before: { day: "רביעי", start: "16:00", end: "17:30", hallId: "h1" },
              after: { day: "רביעי", start: "17:30", end: "19:00", hallId: "h1" } };
  const line = changeLabel(e, names);
  // The new time first, and the old one named as such. An arrow between two left-to-right
  // numeric runs inside right-to-left text is laid out either way by the bidi algorithm —
  // and on a real phone it came out backwards, which made the sentence say the opposite.
  assert.ok(line.includes("17:30–19:00 (במקום 16:00–17:30)"));
  assert.equal(line.includes("→"), false);
  assert.ok(!line.includes("אולם הכפר"), "the unchanged hall is noise");
});
t("a hall move names both halls", () => {
  const e = { kind: "changed", before: { day: "רביעי", start: "16:00", end: "17:30", hallId: "h1" },
              after: { day: "רביעי", start: "16:00", end: "17:30", hallId: "h2" } };
  assert.ok(changeLabel(e, names).includes("שרת (במקום אולם הכפר)"));
});
t("the hall is looked up at read time, not frozen into the record", () => {
  // A hall renamed after the fact should read by its new name.
  const renamed = { ...names, halls: [{ id: "h1", name: "אולם חדש" }] };
  assert.ok(changeLabel(log[0], renamed).includes("אולם חדש"));
});
t("a bulk entry says how many", () =>
  assert.equal(changeLabel({ kind: "bulk", count: 14 }, names), "מפגשים נוספו · 14 מפגשים"));
t("nothing throws on a broken entry", () => {
  assert.equal(changeLabel(null, names), "");
  assert.equal(typeof changeLabel({ kind: "changed", before: {}, after: {} }, names), "string");
});

console.log("- the WhatsApp message -");
t("grouped by coach, alphabetical, with a heading", () => {
  const msg = changesMessage(log, W, "30/08–05/09", names);
  assert.ok(msg.startsWith("עדכון לו״ז — 30/08–05/09"));
  assert.ok(msg.indexOf("אסף יוגב") < msg.indexOf("טל ברוך"), "Hebrew alphabetical");
  // The WhatsApp message shares one renderer with the banner and the phone notification, so
  // the headline lands here too — which is the point: "אימון חדש" tells a coach reading a
  // group message what the line is about before they read the rest of it.
  assert.ok(msg.includes("• אימון חדש ·"), msg);
});
t("a week with nothing to say produces NO message, not an empty one", () => {
  // A manager pasting "עדכון לו״ז" with nothing under it teaches coaches to ignore it.
  assert.equal(changesMessage(log, "2026-09-13", "x", names), "");
  assert.equal(changesMessage([], W, "x", names), "");
});
t("a session with no coach still reaches the message rather than vanishing", () => {
  const orphan = [{ id: "z", at: NOW, coachId: "", weekOf: W, kind: "removed", before: { day: "שני", start: "18:00", end: "19:30" } }];
  assert.ok(changesMessage(orphan, W, "x", names).includes("ללא מאמן"));
});
t("changesByCoach drops groups whose lines all came out empty", () =>
  assert.deepEqual(changesByCoach([{ coachId: "c1" }], names), []));

console.log("\n" + pass + " tests passed");

// ── a training that has already happened is not news ─────────────────────────────────
//
// On 22.9.2026 Ronen archived July. The diff saw eleven deletions and six coaches were
// told on their phones that a training had been cancelled — a training in July. Archiving
// is a storage move; nobody can act on a Sunday two months gone.
{
  const a = (await import("node:assert/strict")).default;
  const { stillAhead } = await import("../src/utils/scheduleChanges.js");
  const ok = (n, f) => { f(); pass++; console.log("  ok  " + n); };

  // Sunday 20.9.2026 → Saturday 26.9. "Today" is Wednesday the 23rd.
  const WEEK = "2026-09-20";
  const TODAY = "2026-09-23T09:00:00.000Z";
  const E = (kind, day, over = {}) => ({
    id: "e", at: TODAY, coachId: "c1", teamId: "t1", weekOf: WEEK, kind,
    ...(kind === "removed" ? { before: { day } } : { after: { day } }),
    ...over,
  });

  console.log("- a past training is not news -");

  ok("a cancellation of a day already gone is not logged", () => {
    a.equal(stillAhead(E("removed", "ראשון"), TODAY), false);   // Sunday, three days ago
    a.equal(stillAhead(E("removed", "שלישי"), TODAY), false);   // Tuesday, yesterday
  });

  ok("TODAY still counts as ahead — a training this evening is very much news", () => {
    a.equal(stillAhead(E("changed", "רביעי"), TODAY), true);
  });

  ok("and the rest of the week is untouched", () => {
    // Suppressing the whole current week would hide a change to Friday made on Wednesday,
    // which is the exact notice the log exists for.
    a.equal(stillAhead(E("added", "חמישי"), TODAY), true);
    a.equal(stillAhead(E("added", "שבת"), TODAY), true);
  });

  ok("a training moved OUT of a past day is still news, because the new day is not", () => {
    // Monday → Friday, decided on Wednesday. The old date has gone; the new one has not.
    a.equal(stillAhead({ ...E("changed", "x"), before: { day: "שני" }, after: { day: "שישי" } }, TODAY), true);
    // ...and the reverse is not: nothing to turn up to.
    a.equal(stillAhead({ ...E("changed", "x"), before: { day: "שישי" }, after: { day: "שני" } }, TODAY), true);
  });

  ok("when the date cannot be worked out the entry is KEPT", () => {
    // A stale notice confuses a coach; a swallowed one sends them to a training that moved.
    a.equal(stillAhead({ kind: "removed", weekOf: "", before: { day: "שני" } }, TODAY), true);
    a.equal(stillAhead({ kind: "removed", weekOf: WEEK, before: { day: "יום כזה אין" } }, TODAY), true);
    a.equal(stillAhead({ kind: "bulk", weekOf: WEEK, count: 12 }, TODAY), true);
    a.equal(stillAhead(null, TODAY), true);
    a.equal(stillAhead(E("removed", "ראשון"), "nonsense"), true);
  });

  console.log("- THE ARCHIVE -");

  ok("ARCHIVING A FINISHED MONTH WRITES NOTHING TO THE LOG", () => {
    // Exactly the shape of 22.9: a month's sessions leave the club document at once.
    const july = ["ראשון", "שני", "שלישי", "רביעי"].map((day, i) => ({
      id: "j" + i, coachId: "c1", teamId: "t1", hallId: "h1",
      weekOf: "2026-07-26", day, start: "17:00", end: "18:30", type: "אימון",
    }));
    const prev = { sessions: [...july, S({ day: "שישי" })] };
    const next = { sessions: [S({ day: "שישי" })] };
    const out = withScheduleChanges(prev, next, TODAY);
    a.deepEqual(out.changes || [], [], "an archive is a storage move, not eleven cancellations");
  });

  ok("but deleting a training that has NOT happened yet still tells the coach", () => {
    const prev = { sessions: [S({ day: "שישי", weekOf: WEEK })] };
    const next = { sessions: [] };
    const out = withScheduleChanges(prev, next, TODAY);
    a.equal(out.changes.length, 1);
    a.equal(out.changes[0].kind, "removed");
  });

  ok("and the log is not flooded, which is the second half of the damage", () => {
    // The log is capped at MAX_CHANGES. Ronen's stood at exactly 150/150 when this was
    // found: every entry an archive writes evicts a real one from the other end.
    const many = Array.from({ length: 200 }, (_, i) => ({
      id: "p" + i, coachId: "c1", teamId: "t1", hallId: "h1",
      weekOf: "2026-07-26", day: "שני", start: "17:00", end: "18:30", type: "אימון",
    }));
    const real = { id: "keep", at: TODAY, coachId: "c1", kind: "added", weekOf: WEEK };
    const out = withScheduleChanges({ sessions: many, changes: [real] }, { sessions: [], changes: [real] }, TODAY);
    a.deepEqual(out.changes.map((c) => c.id), ["keep"], "the real entry survives the archive");
  });

  ok("AND THE ELEVEN ALREADY WRITTEN CLEAN THEMSELVES OUT ON THE NEXT SAVE", () => {
    // The archive of 22.9 is already in the live log. Putting existing entries through the
    // same test means the next ordinary save removes them, rather than six coaches staring
    // at a July cancellation until volume evicts it.
    const july = { id: "j", at: TODAY, coachId: "c1", kind: "removed", weekOf: "2026-07-26", before: { day: "ראשון" } };
    const real = { id: "keep", at: TODAY, coachId: "c1", kind: "removed", weekOf: WEEK, before: { day: "שישי" } };
    const shared = [S({ day: "שישי" })];
    const out = withScheduleChanges({ sessions: shared, changes: [july, real] }, { sessions: shared, changes: [july, real] }, TODAY);
    a.deepEqual(out.changes.map((c) => c.id), ["keep"]);
  });
}


// ─────────────────────────────────────────────────────────────────────────────────────────
// THE TWO SILENT MISSES — measured on the live club on 1.10.2026.
//
// A single approved federation import carried twenty-six changes and produced FOUR log
// entries. The other twenty-two told nobody anything, and two distinct faults were behind it.
//
// Both come from the same root: a GAME's board row is keyed `game-<federationCode>` and that
// id lives for the whole season, where a TRAINING gets a new id in every week. Everything the
// diff watched was written when only trainings existed.
console.log("- the two silent misses, 1.10.2026 -");

// `game-800903`, קטסל א שחר against נס ציונה: Saturday 17.10 at 12:00 → Saturday 24.10 at
// 12:00. Away, so no hall. Same weekday, same hour, same type. Every watched field identical.
const GAME = (over = {}) => ({
  id: "game-800903", coachId: "c1", teamId: "t1", hallId: "", weekOf: "2026-10-11",
  day: "שבת", start: "11:30", end: "13:30", type: "משחק חוץ", fromGame: true, ...over,
});

t("A GAME MOVED BY EXACTLY ONE WEEK IS A CHANGE — it used to be nothing at all", () => {
  const before = GAME();
  const after = GAME({ weekOf: "2026-10-18" });
  const out = diffSessions([before], [after], NOW);
  assert.equal(out.length, 1, "this produced no entry and no notification until 1.10.2026");
  assert.equal(out[0].kind, "changed");
  assert.equal(out[0].before.weekOf, "2026-10-11", "the old week must travel on the entry");
  assert.equal(out[0].after.weekOf, "2026-10-18");
});

t("and it says BOTH dates, because 'it moved' with one date is a question", () => {
  const out = diffSessions([GAME()], [GAME({ weekOf: "2026-10-18" })], NOW);
  const line = changeLabel(out[0], names);
  assert.ok(line.startsWith("שינוי משחק חוץ"), line);
  assert.ok(line.includes("24.10"), line);
  assert.ok(line.includes("במקום"), line);
  assert.ok(line.includes("17.10"), line);
});

t("A CANCELLED FIXTURE IS A CHANGE — the row stays on the board, which is why it was silent", () => {
  // Twelve fixtures were cancelled that morning. The row is kept and struck through, which is
  // right — it is information, not an absence — but it meant nothing the diff watched moved.
  const out = diffSessions([GAME()], [GAME({ cancelled: true })], NOW);
  assert.equal(out.length, 1, "twelve of these told nobody anything");
  assert.equal(changeKindLabel(out[0]), "ביטול משחק חוץ");
  const line = changeLabel(out[0], names);
  assert.ok(line.includes("יום שבת 17.10"), line);
  // What else moved in the same save is of no interest to someone no longer going.
  const alsoMoved = diffSessions([GAME()], [GAME({ cancelled: true, start: "10:00", end: "12:00" })], NOW);
  assert.equal(changeKindLabel(alsoMoved[0]), "ביטול משחק חוץ");
  assert.equal(changeLabel(alsoMoved[0], names).includes("במקום"), false, "a cancellation is not a time change");
});

t("a fixture that comes back says so", () => {
  const out = diffSessions([GAME({ cancelled: true })], [GAME()], NOW);
  assert.equal(changeKindLabel(out[0]), "משחק חוץ חזר ללו״ז");
});

t("AN ORDINARY TRAINING IS NOT REPORTED AS NEWLY UNCANCELLED", () => {
  // `cancelled` is absent on every training ever written. Compared as strings, `undefined`
  // and `false` differ — which would have made the first save after this deploy announce a
  // change on all 854 trainings at once.
  assert.deepEqual(diffSessions([S()], [S({ cancelled: false })], NOW), []);
  assert.deepEqual(diffSessions([S()], [S()], NOW), []);
});

console.log("- what it is, and when -");

t("a game change says it is a GAME and names the date", () => {
  // Ronen, 1.10.2026: "the coach is told the hour went 18 to 19 — not that it is a game, and
  // not which date." Both were in the record already.
  const out = diffSessions([GAME()], [GAME({ start: "12:30", end: "14:30" })], NOW);
  const line = changeLabel(out[0], names);
  assert.ok(line.startsWith("שינוי משחק חוץ · יום שבת 17.10"), line);
  assert.ok(line.includes("12:30–14:30 (במקום 11:30–13:30)"), line);
});

t("a training change says it is a TRAINING, and still names only what moved", () => {
  const out = diffSessions([S()], [S({ start: "17:30", end: "19:00" })], NOW);
  const line = changeLabel(out[0], names);
  assert.ok(line.startsWith("שינוי אימון · יום רביעי 2.9"), line);
  assert.equal(line.includes("אולם הכפר"), false, "the unchanged hall is still noise");
});

t("the club's other training types are trainings, not games", () => {
  // `type` also carries "יורם" and "חד״כ" in this club. A list of known values would be
  // wrong the week a new one is added; "does it start with משחק" is not.
  for (const type of ["אימון", "יורם", 'חד"כ', ""]) {
    const out = diffSessions([S({ type })], [S({ type, start: "17:00" })], NOW);
    assert.equal(changeKindLabel(out[0]), "שינוי אימון", type);
  }
  for (const type of ["משחק בית", "משחק חוץ"]) {
    const out = diffSessions([S({ type })], [S({ type, start: "17:00" })], NOW);
    assert.equal(changeKindLabel(out[0]), `שינוי ${type}`, type);
  }
});

t("an entry written before any of this still renders, without a date", () => {
  // The log holds 150 entries whose before/after carry no `weekOf`. They must read as a
  // sentence rather than as a stray separator.
  const old = { kind: "changed", weekOf: "", before: { day: "רביעי", start: "16:00", end: "17:30" },
                after: { day: "רביעי", start: "17:30", end: "19:00" } };
  const line = changeLabel(old, names);
  assert.ok(line.startsWith("שינוי אימון · יום רביעי:"), line);
  assert.equal(line.includes("undefined"), false);
  assert.equal(line.includes("NaN"), false);
});

t("nothing throws on a broken entry, with the new fields too", () => {
  assert.equal(changeKindLabel(null), "");
  assert.equal(changeDetail(null), "");
  for (const bad of [{}, { kind: "changed" }, { kind: "changed", before: {}, after: {} }]) {
    assert.equal(typeof changeLabel(bad, names), "string");
    assert.equal(typeof changeKindLabel(bad), "string");
  }
});

t("THE OLD DATE IS JUDGED ON THE OLD WEEK — a fixture pulled forward is not 'in the past'", () => {
  // `stillAhead` measured both sides against the entry's week, which is the NEW one. For a
  // training that was harmless; a game can move between weeks while keeping its id.
  const out = diffSessions(
    [GAME({ weekOf: "2026-12-13", day: "חמישי" })],
    [GAME({ weekOf: "2026-11-01", day: "רביעי" })],
    NOW
  );
  assert.equal(stillAhead(out[0], "2026-10-20T08:00:00.000Z"), true, "both dates are still ahead");
  assert.equal(stillAhead(out[0], "2027-01-05T08:00:00.000Z"), false, "both are behind — not news");
});


t("GATE #27 M2: AN AWAY FIXTURE THAT CHANGES HALL IS A CHANGE", () => {
  // The third silent miss of the same family, and the one that would have survived this fix.
  // An away game's `hallId` is always "" — the place lived only inside `notes`, which is
  // deliberately never diffed because it is free text where a child's name can appear. So
  // the federation moved an away fixture to another town and every watched field matched.
  //
  // The asymmetry that settled it: `boardChanges` DOES compare `where`, so the PARENTS were
  // told their team's game had moved hall and the coach was not.
  const away = (over = {}) => GAME({ venue: "אולם הירוק, רח' נחשון 6, הוד השרון", ...over });
  const out = diffSessions([away()], [away({ venue: "תיכון ברנר, פתח תקווה" })], NOW);
  assert.equal(out.length, 1, "this produced nothing at all before 1.10.2026");
  const line = changeLabel(out[0], names);
  assert.ok(line.includes("תיכון ברנר, פתח תקווה (במקום אולם הירוק"), line);
});

t("a home fixture's hall is still reported through hallId, and only once", () => {
  // `venue` is written exactly when `hallId` is empty, so one line covers the place however
  // it is held — never two lines about one move.
  const home = (over = {}) => GAME({ type: "משחק בית", hallId: "h1", venue: "", ...over });
  const line = changeLabel(diffSessions([home()], [home({ hallId: "h2" })], NOW)[0], names);
  assert.ok(line.includes("שרת (במקום אולם הכפר)"), line);
  assert.equal((line.match(/במקום/g) || []).length, 1, "said once, not twice");
});

t("a week move does not repeat the weekday inside the bracket", () => {
  // "שבת 24.10 (במקום יום שבת 17.10)" buries the two numbers that are the whole message —
  // and a week move is the case this gate was opened for.
  const line = changeLabel(diffSessions([GAME()], [GAME({ weekOf: "2026-10-18" })], NOW)[0], names);
  assert.ok(line.includes("(במקום 17.10)"), line);
  assert.equal(line.includes("(במקום יום שבת"), false, line);
});

t("a bulk entry says מפגשים, because it is the one kind that cannot know", () => {
  // `collapseBulk` fires on the first federation import of a season — a hundred FIXTURES —
  // and a bulk entry carries no before/after, so nothing can tell it what they were.
  assert.equal(changeKindLabel({ kind: "bulk", count: 14 }), "מפגשים נוספו");
  assert.equal(changeLabel({ kind: "bulk", count: 14 }, names).includes("אימונים"), false);
});


t("GATE #27 M8: A HOME FIXTURE WHOSE HALL CANNOT BE MATCHED STILL HAS A WATCHED PLACE", () => {
  // The second door, found in the re-check. The first version of the fix wrote `venue` for
  // AWAY fixtures only — but a home fixture whose hall cannot be matched gets `hallId: ""`
  // too, and so got no place field at all while the board still showed it a place.
  //
  // Not hypothetical: games.js records the day every home fixture in the hall the federation
  // still calls "עלומים" landed with no hall. This club has two names for one hall.
  const unmatched = (over = {}) => GAME({ type: "משחק בית", hallId: "", venue: "אולם עלומים, קריית אונו", ...over });
  const out = diffSessions([unmatched()], [unmatched({ venue: "אולם ברק, קריית אונו" })], NOW);
  assert.equal(out.length, 1, "a home fixture with an unmatched hall must not be silent");
  assert.ok(changeLabel(out[0], names).includes("אולם ברק, קריית אונו (במקום אולם עלומים"), changeLabel(out[0], names));
});

t("and a fixture flipped from home to away says the place once, not twice", () => {
  // Both fields change at the same moment here. Two separate comparisons produced two
  // sentences about one move.
  const home = GAME({ type: "משחק בית", hallId: "h1", venue: "" });
  const away = GAME({ type: "משחק חוץ", hallId: "", venue: "תיכון ברנר, פתח תקווה" });
  const line = changeLabel(diffSessions([home], [away], NOW)[0], names);
  assert.equal((line.match(/במקום/g) || []).length, 2, "one for the place, one for the type: " + line);
  assert.ok(line.includes("תיכון ברנר, פתח תקווה (במקום אולם הכפר)"), line);
});


t("MIGRATION: a row that predates the `venue` field is not a row whose hall moved", () => {
  // `venue` arrived on 1.10.2026. Every game row written before it has no such key, and the
  // first save that rebuilds the board from the games — the next federation import — would
  // otherwise report all 251 away fixtures as having moved hall, to every coach at once.
  //
  // Found by measuring after a deploy, not by a test: `venue` showed on 0 rows, because the
  // field is only written when the games are re-synced. `cancelled` was the same shape hours
  // earlier and a test did catch that one.
  const legacy = { id: "game-1", coachId: "c1", teamId: "t1", hallId: "", weekOf: "2026-10-11",
                   day: "שבת", start: "11:30", end: "13:30", type: "משחק חוץ" };
  const migrated = { ...legacy, venue: "תיכון ברנר, פתח תקווה" };
  assert.deepEqual(diffSessions([legacy], [migrated], NOW), [], "the field appearing is not a change");
  // And the exemption ends there: once both sides carry it, an empty venue is an empty venue.
  const moved2 = { ...migrated, venue: "אולם הירוק, הוד השרון" };
  assert.equal(diffSessions([migrated], [moved2], NOW).length, 1);
  assert.equal(diffSessions([{ ...legacy, venue: "" }], [migrated], NOW).length, 1);
});

t("...and a hall change is still reported on a row with no venue key at all", () => {
  // The first version of this guard hung the whole place line on the venue, which silenced
  // every ordinary hall move. Every training in the club is such a row.
  const line = changeLabel(diffSessions([S()], [S({ hallId: "h2" })], NOW)[0], names);
  assert.ok(line.includes("שרת (במקום אולם הכפר)"), line);
});

console.log(`
${pass} tests passed`);

// ─────────────────────────────────────────────────────────────────────────────────────────
// GATE #29 B1 — TIDYING UP IS NOT A SCHEDULE CHANGE.
//
// The "delete this duplicate" button removes one of two identical rows. By id that is a row
// that vanished, so the diff called it `removed` and the phone announced **ביטול אימון** —
// for a training that is still on the board, because the twin stayed. Reproduced before it
// was fixed, on the exact shape the button produces.
//
// The direction of the error is what made it a blocker: a coach who believes the message
// does not come, and children are in a hall without one. It is also the second time the same
// shape has bitten — the July archive of 22.9 told six coaches their trainings were cancelled.
t("GATE #29 B1: deleting one of two IDENTICAL rows announces nothing", () => {
  const twin = (id) => S({ id });
  assert.deepEqual(diffSessions([twin("a"), twin("b")], [twin("a")], NOW), []);
});

t("...but deleting the LAST one is a real cancellation and is still announced", () => {
  const out = diffSessions([S({ id: "a" })], [], NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "removed");
  assert.equal(changeKindLabel(out[0]), "ביטול אימון");
});

t("and a row that only LOOKS similar is not a twin", () => {
  // The guard uses `sessionKey` — the same definition by which the duplicate was identified —
  // so anything that differs in a watched field is a genuine removal.
  for (const change of [{ start: "18:00" }, { hallId: "h2" }, { teamId: "t9" }, { type: "משחק בית" }]) {
    const out = diffSessions([S({ id: "a" }), S({ id: "b", ...change })], [S({ id: "b", ...change })], NOW);
    assert.equal(out.length, 1, JSON.stringify(change));
    assert.equal(out[0].kind, "removed");
  }
});

t("a twin in ANOTHER WEEK does not excuse a cancellation", () => {
  // The week is part of the key. Without it, deleting Monday's training would be silent
  // because next Monday's identical one exists — which is every weekly training there is.
  const out = diffSessions([S({ id: "a" }), S({ id: "b", weekOf: "2026-09-06" })], [S({ id: "b", weekOf: "2026-09-06" })], NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "removed");
});

console.log(`\n${pass} tests passed`);
