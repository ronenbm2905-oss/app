// The guard that would have saved twelve records on the morning of 30.9.2026.
//
// Two of Ronen's devices overwrote each other for two hours. The phone held the club document
// as it stood at 07:15; the computer held it as it stood before that. Each save wrote the
// WHOLE document, so each wiped whatever the other had done — silently, and with nothing in
// the change log, because that log diffs what a client had against what it saves and neither
// client had seen the other's work.

import assert from "node:assert/strict";
import {
  revOf, nextRev, isStale, currentRev, conflictError, isConflict,
  CONFLICT_CODE, CONFLICT_MESSAGE,
} from "../src/utils/docVersion.js";

let n = 0;
const T = (name, fn) => { fn(); n++; console.log("  ok  " + name); };

T("a document written before this existed counts as rev 0 and is adopted, not rejected", () => {
  // Every club document in production today has no `rev`. Treating "missing" as anything
  // other than 0 would refuse the very first save after the deploy.
  assert.equal(revOf(undefined), 0);
  assert.equal(revOf({}), 0);
  assert.equal(revOf({ rev: null }), 0);
  assert.equal(nextRev(revOf({})), 1);
  assert.equal(isStale(0, 0), false, "a fresh document must accept its first save");
});

T("rubbish in `rev` reads as 0 rather than locking the document", () => {
  // The failure direction is chosen. A value that cannot be read meaning "very high" would
  // refuse every save for ever, from every device, with no way out from inside the app.
  assert.equal(revOf({ rev: "abc" }), 0);
  assert.equal(revOf({ rev: -5 }), 0);
  assert.equal(revOf({ rev: 3.7 }), 3);
  assert.equal(revOf({ rev: NaN }), 0);
});

T("THE 09:23 OVERWRITE: a save built on an older copy is refused", () => {
  // The phone believed it was editing rev 4 (its 07:15 copy). The computer had since moved
  // the server to 9. Before this guard, the phone's write simply landed.
  assert.equal(isStale(4, 9), true);
});

T("a save built on the current copy goes through", () => {
  assert.equal(isStale(9, 9), false);
});

T("a client somehow AHEAD of the server is allowed, not locked out", () => {
  // Behind is a conflict; ahead is a curiosity — a restore, a rolled-back write. Refusing it
  // would brick the app with no recovery path from the UI.
  assert.equal(isStale(9, 4), false);
});

T("TWO QUICK SAVES FROM ONE DEVICE DO NOT CONFLICT WITH EACH OTHER", () => {
  // The snapshot listener takes a moment. Between a successful save and the new document
  // arriving, `data.rev` is still the old one — and a guard that only trusted the snapshot
  // would make the app fight itself on every rapid edit, which is worse than the bug.
  const snapshotRev = 4;     // what the listener last delivered
  const lastWritten = 5;     // what this device just wrote, snapshot not back yet
  const expected = currentRev(snapshotRev, lastWritten);
  assert.equal(expected, 5);
  assert.equal(isStale(expected, 5), false, "its own write must not look stale");
});

T("and once the snapshot catches up, the two agree", () => {
  assert.equal(currentRev(5, 5), 5);
  assert.equal(currentRev(6, 5), 6, "another device moved it on — the snapshot wins");
});

T("a device that never wrote anything trusts the snapshot alone", () => {
  assert.equal(currentRev(9, 0), 9);
  assert.equal(currentRev(undefined, undefined), 0);
});

T("the rev always moves forward by exactly one", () => {
  assert.equal(nextRev(0), 1);
  assert.equal(nextRev(41), 42);
  // Computed from what the TRANSACTION read, never from what the client believed — so two
  // devices racing cannot both write the same number.
  assert.equal(nextRev(nextRev(0)), 2);
});

T("a conflict is its own kind of error, not a generic failure", () => {
  const err = conflictError();
  assert.equal(isConflict(err), true);
  assert.equal(err.code, CONFLICT_CODE);
  assert.equal(isConflict(new Error("network")), false);
  assert.equal(isConflict(null), false);
});

T("THE MESSAGE SAYS WHAT TO DO, AND DOES NOT SAY 'TRY AGAIN'", () => {
  // "Save failed, try again" would be a lie here: trying again from the same screen is
  // exactly the action that overwrites the other device.
  assert.equal(CONFLICT_MESSAGE.includes("נסה שוב"), false);
  assert.equal(CONFLICT_MESSAGE.includes("רענן"), true);
  assert.equal(CONFLICT_MESSAGE.includes("ממכשיר אחר"), true);
  // And it reassures: the work already saved is not what was lost.
  assert.equal(CONFLICT_MESSAGE.includes("נשמר"), true);
});

T("the sequence that actually happened, step by step", () => {
  // Server starts at 4 — the state both devices loaded.
  let server = 4;
  const phone = 4;      // its copy, taken at 07:15
  const computer = 4;   // its copy, taken earlier

  // 08:02 the computer saves. It is not stale, so it lands and moves the server on.
  assert.equal(isStale(computer, server), false);
  server = nextRev(server); // 5
  // ... and several more saves through the morning.
  for (let i = 0; i < 4; i++) server = nextRev(server); // 9

  // 09:23 the phone saves, still holding its 07:15 copy. THIS is the write that cost the
  // morning — and now it does not happen.
  assert.equal(isStale(phone, server), true);
  assert.equal(server, 9, "the server is untouched by the refused save");
});

console.log(`\n${n} document-version tests passed`);
