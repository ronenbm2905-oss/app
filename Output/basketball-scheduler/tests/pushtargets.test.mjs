import assert from "node:assert/strict";
import {
  newEntriesSince, notificationsFor, tokensForCoach, tokenDoc, isDeadToken,
} from "../src/utils/pushTargets.js";

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("  ok  " + name); };

const e = (at, coachId, extra = {}) => ({
  at, coachId, teamId: "t1", kind: "moved", day: "שני", start: "17:00", end: "18:30", ...extra,
});
const names = { teams: { t1: "נערים א" }, halls: { h1: "אולם עלומים" } };

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
});
t("one change speaks for itself, without a count", () => {
  const out = notificationsFor([e("2026-09-16T08:00:00.000Z", "c1")], names);
  assert.equal(out[0].count, 1);
  assert.equal(out[0].body.includes("שינויים"), false);
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
