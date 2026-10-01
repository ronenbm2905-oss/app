import assert from "node:assert/strict";
import {
  newEntriesSince, notificationsFor, tokensForCoach, tokenDoc, isDeadToken,
  israelHour, inQuietWindow, isFresh, freshEntries, MAX_AGE_HOURS,
} from "../src/utils/pushTargets.js";

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("  ok  " + name); };

// A REAL entry, with before/after — the shape diffSessions actually produces.
//
// The first version of this fixture had no before/after, so changeLabel compared undefined
// to undefined, found nothing changed, and returned "". Every assertion about the body then
// passed against an empty string. A test that cannot fail is worse than no test: it reports
// that the thing it never checked is fine. (Adi, push gate, M6.)
const e = (at, coachId, extra = {}) => ({
  at,
  coachId,
  teamId: "t1",
  kind: "moved",
  before: { day: "שני", start: "17:00", end: "18:30", hallId: "h1", type: "אימון" },
  after: { day: "שני", start: "18:00", end: "19:30", hallId: "h1", type: "אימון" },
  ...extra,
});

// ARRAYS, because changeLabel does `(names.halls || []).find(...)`. The first version passed
// an object here; it never threw only because no fixture reached the hall lookup. In the
// Cloud Function, where a hall really does change, that is a TypeError mid-send.
const names = {
  teams: [{ id: "t1", name: "נערים א" }],
  halls: [{ id: "h1", name: "אולם עלומים" }, { id: "h2", name: "אולם ברק" }],
};

console.log("- what counts as new -");
t("only entries stamped after the newest one already seen", () => {
  const prev = [e("2026-09-16T08:00:00.000Z", "c1")];
  const next = [...prev, e("2026-09-16T09:00:00.000Z", "c2"), e("2026-09-16T10:00:00.000Z", "c3")];
  assert.deepEqual(newEntriesSince(prev, next).map((x) => x.coachId), ["c2", "c3"]);
});
t("a trimmed log is not mistaken for a changed one", () => {
  // trimChanges drops old entries on EVERY save. Comparing the arrays would fire a
  // notification for nothing, every time, which is how people turn the feature off.
  const prev = [e("2026-09-01T08:00:00.000Z", "c1"), e("2026-09-16T08:00:00.000Z", "c2")];
  const next = [e("2026-09-16T08:00:00.000Z", "c2")]; // the old one aged out
  assert.deepEqual(newEntriesSince(prev, next), []);
});
t("the first change ever is new", () =>
  assert.equal(newEntriesSince([], [e("2026-09-16T08:00:00.000Z", "c1")]).length, 1));
t("a save that changed no session notifies nobody", () => {
  const same = [e("2026-09-16T08:00:00.000Z", "c1")];
  assert.deepEqual(newEntriesSince(same, same), []);
});
t("no log, no throw", () => {
  assert.deepEqual(newEntriesSince(null, null), []);
  assert.deepEqual(newEntriesSince(undefined, []), []);
});

console.log("- one buzz per coach, not per row -");
t("five moved sessions are one notification that says five", () => {
  const list = ["c1", "c1", "c1", "c1", "c1"].map((c, i) => e(`2026-09-16T1${i}:00:00.000Z`, c));
  const out = notificationsFor(list, names);
  assert.equal(out.length, 1);
  assert.equal(out[0].count, 5);
  assert.ok(out[0].body.startsWith("5 שינויים"));
  assert.ok(out[0].body.length > "5 שינויים באימונים שלך. ".length, "the sample change must follow the count");
});
t("one change speaks for itself, without a count", () => {
  const out = notificationsFor([e("2026-09-16T08:00:00.000Z", "c1")], names);
  assert.equal(out[0].count, 1);
  // Asserted to CONTAIN the change before asserting what it omits — otherwise an empty
  // body satisfies every "does not contain" in this file.
  assert.ok(out[0].body.length > 0, "body must not be empty");
  assert.ok(out[0].body.includes("17:00"), "body must name the hour that moved");
  // No arrow: it has no direction the bidi algorithm is obliged to respect, and on a
  // phone it pointed the wrong way. The new value leads, the old one is named.
  assert.ok(out[0].body.includes("(במקום"), "body must name what it used to be");
  assert.equal(out[0].body.includes("→"), false);
  assert.equal(out[0].body.includes("שינויים"), false);
});
t("a hall that moved is named — the lookup must survive the real data shape", () => {
  // names.halls is an array. Passing the object shape here is what hid the TypeError.
  const moved = e("2026-09-16T08:00:00.000Z", "c1", {
    after: { day: "שני", start: "17:00", end: "18:30", hallId: "h2", type: "אימון" },
  });
  const [out] = notificationsFor([moved], names);
  assert.ok(out.body.includes("אולם ברק"), "the new hall must appear: " + out.body);
});
t("the lock screen carries no person and no child", () => {
  // Verified against changeLabel: it reads names.halls only. teamId is on the entry and is
  // never translated or printed. Day, hour, hall — nothing else.
  const [out] = notificationsFor([e("2026-09-16T08:00:00.000Z", "c1")], names);
  assert.equal(out.body.includes("נערים א"), false);
  assert.equal(out.body.includes("t1"), false);
});
t("two coaches get one each", () => {
  const out = notificationsFor([e("2026-09-16T08:00:00.000Z", "c1"), e("2026-09-16T09:00:00.000Z", "c2")], names);
  assert.deepEqual(out.map((x) => x.coachId).sort(), ["c1", "c2"]);
});
t("a reassignment reaches BOTH coaches", () => {
  // diffSessions already logs a reassignment to the old coach and the new one. Push
  // inherits that for free — and must not undo it by de-duplicating on the session.
  const out = notificationsFor([e("2026-09-16T08:00:00.000Z", "c-old"), e("2026-09-16T08:00:00.000Z", "c-new")], names);
  assert.equal(out.length, 2);
});
t("a change with no coach is NOT broadcast to everyone", () => {
  // An interruption addressed to nobody is the fastest way to teach people it is noise.
  assert.deepEqual(notificationsFor([e("2026-09-16T08:00:00.000Z", "")], names), []);
  assert.deepEqual(notificationsFor([{ at: "2026-09-16T08:00:00.000Z", kind: "bulk" }], names), []);
});
t("nothing in, nothing out", () => {
  assert.deepEqual(notificationsFor([], names), []);
  assert.deepEqual(notificationsFor(null), []);
});

console.log("- the quiet window (Ronen's decision, 16.9 — not a legal duty) -");
t("Israel time, not the server's — a Cloud Function runs in UTC", () => {
  // 19:30 UTC is 22:30 in Israel (UTC+3, summer). Asking the Date its own hour would
  // silence 01:00–10:00 Israel time and wake people at 02:00 — the exact inverse.
  assert.equal(israelHour(new Date("2026-09-16T19:30:00Z")), 22);
  assert.equal(israelHour(new Date("2026-09-16T07:00:00Z")), 10);
});
t("22:00 to 07:00 is quiet; the working day is not", () => {
  assert.equal(inQuietWindow(new Date("2026-09-16T19:30:00Z")), true);  // 22:30
  assert.equal(inQuietWindow(new Date("2026-09-16T22:00:00Z")), true);  // 01:00
  assert.equal(inQuietWindow(new Date("2026-09-16T03:30:00Z")), true);  // 06:30
  assert.equal(inQuietWindow(new Date("2026-09-16T04:30:00Z")), false); // 07:30
  assert.equal(inQuietWindow(new Date("2026-09-16T14:00:00Z")), false); // 17:00
});
t("the boundaries belong to the side that lets a person sleep", () => {
  assert.equal(inQuietWindow(new Date("2026-09-16T18:59:00Z")), false); // 21:59
  assert.equal(inQuietWindow(new Date("2026-09-16T19:00:00Z")), true);  // 22:00
  assert.equal(inQuietWindow(new Date("2026-09-16T03:59:00Z")), true);  // 06:59
  assert.equal(inQuietWindow(new Date("2026-09-16T04:00:00Z")), false); // 07:00
});

console.log("- old enough to stop being news -");
const NOW = new Date("2026-09-16T12:00:00.000Z");
t("a change from an hour ago is news; one from two days ago is not", () => {
  assert.equal(isFresh({ at: "2026-09-16T11:00:00.000Z" }, NOW), true);
  assert.equal(isFresh({ at: "2026-09-14T12:00:00.000Z" }, NOW), false);
});
t("a restored backup does not wake 24 coaches about last month", () => {
  // No `before` snapshot means every entry in the log looks new — up to 150 of them. The
  // age cap is what stops a restore or a migration from becoming a broadcast.
  const monthOld = Array.from({ length: 150 }, (_, i) => ({ at: `2026-08-${String((i % 28) + 1).padStart(2, "0")}T08:00:00.000Z`, coachId: "c1" }));
  assert.deepEqual(freshEntries(monthOld, NOW), []);
});
t("a clock skew into the future is not fresh either", () =>
  assert.equal(isFresh({ at: "2026-09-17T12:00:00.000Z" }, NOW), false));
t("an unreadable stamp is dropped rather than sent", () => {
  assert.equal(isFresh({ at: "" }, NOW), false);
  assert.equal(isFresh({}, NOW), false);
  assert.equal(isFresh(null, NOW), false);
});
t("the window is twelve hours — a night plus the morning job", () =>
  assert.equal(MAX_AGE_HOURS, 12));


console.log("- devices, not people -");
t("a coach with a phone and a tablet gets both", () => {
  const rows = [
    { token: "aaa", coachId: "c1" },
    { token: "bbb", coachId: "c1" },
    { token: "ccc", coachId: "c2" },
  ];
  assert.deepEqual(tokensForCoach(rows, "c1"), ["aaa", "bbb"]);
});
t("a row with no token is skipped rather than sent an empty string", () =>
  assert.deepEqual(tokensForCoach([{ token: "", coachId: "c1" }, { token: "x", coachId: "c1" }], "c1"), ["x"]));
t("no coach, no tokens", () => {
  assert.deepEqual(tokensForCoach([{ token: "a", coachId: "c1" }], ""), []);
  assert.deepEqual(tokensForCoach(null, "c1"), []);
});

console.log("- the stored row -");
t("the field is authorEmail — the name every ownership rule reads", () => {
  const d = tokenDoc({ token: "T", coachId: "c1", email: "Ronen@Club.IL", now: "2026-09-16T08:00:00.000Z" });
  assert.deepEqual(d, { token: "T", coachId: "c1", authorEmail: "ronen@club.il", updatedAt: "2026-09-16T08:00:00.000Z" });
});

console.log("- dead tokens -");
t("FCM's own codes are recognised", () => {
  assert.equal(isDeadToken({ code: "messaging/registration-token-not-registered" }), true);
  assert.equal(isDeadToken({ errorInfo: { code: "messaging/invalid-registration-token" } }), true);
});
t("a network blip is not a dead device", () => {
  // Deleting a token because the send timed out would silence a coach permanently.
  assert.equal(isDeadToken({ code: "messaging/server-unavailable" }), false);
  // A malformed payload is OUR bug, not a dead device. Treating it as dead would delete
  // every registration on one bad send — the exact "silence everybody at once" failure.
  assert.equal(isDeadToken({ code: "messaging/invalid-argument" }), false);
  assert.equal(isDeadToken(new Error("ETIMEDOUT")), false);
  assert.equal(isDeadToken(null), false);
});

console.log("- the lock screen says WHAT, not just THAT -");

t("THE TITLE IS NOT THE SAME FOUR WORDS FOR EVERYTHING ANY MORE", () => {
  // Until 1.10.2026 every notification was titled "שינוי בלו״ז שלך" — a cancelled fixture,
  // a hall change and a training moved by half an hour, all identical on the one line most
  // people read without unlocking the phone.
  const base = { day: "שבת", start: "11:30", end: "13:30", hallId: "", type: "משחק חוץ", weekOf: "2026-10-11" };
  const cancelled = e("2026-09-16T08:00:00.000Z", "c1", {
    before: base, after: { ...base, cancelled: true },
  });
  const [out] = notificationsFor([cancelled], names);
  assert.equal(out.title, "ביטול משחק חוץ", "home or away is kept — §2ז promises the coach the type");
  // And the body carries the date, which was never there at all.
  assert.ok(out.body.includes("17.10"), out.body);
});

t("the title and the body do not repeat each other", () => {
  const moved = e("2026-09-16T08:00:00.000Z", "c1", {
    before: { day: "שבת", start: "11:30", end: "13:30", hallId: "", type: "משחק חוץ", weekOf: "2026-10-11" },
    after: { day: "שבת", start: "12:30", end: "14:30", hallId: "", type: "משחק חוץ", weekOf: "2026-10-11" },
  });
  const [out] = notificationsFor([moved], names);
  assert.equal(out.title, "שינוי משחק חוץ");
  assert.equal(out.body.includes("שינוי משחק"), false, "the headline belongs to the title alone");
  assert.ok(out.body.includes("12:30–14:30 (במקום 11:30–13:30)"), out.body);
});

t("several changes keep a general title — naming one would mislabel the rest", () => {
  const list = ["c1", "c1"].map((c, i) => e(`2026-09-16T1${i}:00:00.000Z`, c));
  const [out] = notificationsFor(list, names);
  assert.equal(out.title, "שינויים בלו״ז שלך");
  assert.ok(out.body.startsWith("2 שינויים"));
});

t("and the date on the lock screen is still not a person or a child", () => {
  const [out] = notificationsFor([e("2026-09-16T08:00:00.000Z", "c1")], names);
  assert.equal(out.body.includes("נערים א"), false);
  assert.equal(out.body.includes("t1"), false);
  assert.equal(out.title.includes("נערים א"), false);
});


t("GATE #27 B1: A BATCH THAT CONTAINS A CANCELLATION MUST NAME THE CANCELLATION", () => {
  // The body used to be `list[0]`, and that order is the order of the sessions array —
  // arbitrary with respect to how much anything matters. Reproduced on the real shape of
  // 1.10.2026: a coach with a training nudged and a game cancelled in one federation import
  // was told "2 שינויים. שינוי אימון · …" and the cancellation appeared nowhere.
  //
  // This is worse than the silence it replaced. Every protection in this project guards
  // against a change going UNANNOUNCED; here we interrupt someone, say there are two
  // changes, name one, and the one we name is not the one that means do not come.
  const game = { day: "שבת", start: "11:30", end: "13:30", hallId: "", type: "משחק חוץ", weekOf: "2026-10-11" };
  const training = { day: "רביעי", start: "16:00", end: "17:30", hallId: "h1", type: "אימון", weekOf: "2026-08-30" };
  const list = [
    // The training comes FIRST, exactly as the array ordering delivered it.
    e("2026-09-16T08:00:00.000Z", "c1", { before: training, after: { ...training, start: "17:30" } }),
    e("2026-09-16T08:00:01.000Z", "c1", { before: game, after: { ...game, cancelled: true } }),
  ];
  const [out] = notificationsFor(list, names);
  assert.ok(out.body.includes("ביטול"), "the cancellation must be the one named: " + out.body);
  assert.ok(out.body.startsWith("2 שינויים"), out.body);
});

t("...and a removal outranks a mere change, which outranks an addition", () => {
  const base = { day: "רביעי", start: "16:00", end: "17:30", hallId: "h1", type: "אימון", weekOf: "2026-08-30" };
  const added = e("2026-09-16T08:00:00.000Z", "c1", { before: undefined, after: base, kind: "added" });
  const changed = e("2026-09-16T08:00:01.000Z", "c1", { before: base, after: { ...base, start: "17:00" } });
  const removed = e("2026-09-16T08:00:02.000Z", "c1", { before: base, after: undefined, kind: "removed" });
  assert.ok(notificationsFor([added, changed, removed], names)[0].body.includes("ביטול"));
  assert.ok(notificationsFor([added, changed], names)[0].body.includes("17:00"));
});

t("equal severity keeps the diff's own order — the sentence must not wander", () => {
  const base = { day: "רביעי", start: "16:00", end: "17:30", hallId: "h1", type: "אימון", weekOf: "2026-08-30" };
  const a = e("2026-09-16T08:00:00.000Z", "c1", { before: base, after: { ...base, start: "15:00" } });
  const b = e("2026-09-16T08:00:01.000Z", "c1", { before: base, after: { ...base, start: "14:00" } });
  assert.ok(notificationsFor([a, b], names)[0].body.includes("15:00"));
  assert.ok(notificationsFor([a, b], names)[0].body.includes("15:00"), "stable across calls");
});

console.log("\n" + pass + " tests passed");
