import assert from "node:assert/strict";
import {
  newEntriesSince, notificationsFor, tokensForCoach, tokenDoc, isDeadToken,
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
  assert.ok(out[0].body.includes("→"), "body must show before → after");
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
t("email is normalised, the rest is carried", () => {
  const d = tokenDoc({ token: "T", coachId: "c1", email: "Ronen@Club.IL", now: "2026-09-16T08:00:00.000Z" });
  assert.deepEqual(d, { token: "T", coachId: "c1", email: "ronen@club.il", updatedAt: "2026-09-16T08:00:00.000Z" });
});

console.log("- dead tokens -");
t("FCM's own codes are recognised", () => {
  assert.equal(isDeadToken({ code: "messaging/registration-token-not-registered" }), true);
  assert.equal(isDeadToken({ errorInfo: { code: "messaging/invalid-registration-token" } }), true);
});
t("a network blip is not a dead device", () => {
  // Deleting a token because the send timed out would silence a coach permanently.
  assert.equal(isDeadToken({ code: "messaging/server-unavailable" }), false);
  assert.equal(isDeadToken(new Error("ETIMEDOUT")), false);
  assert.equal(isDeadToken(null), false);
});

console.log("\n" + pass + " tests passed");
