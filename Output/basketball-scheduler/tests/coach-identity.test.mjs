// Which coach record belongs to the person signed in.
//
// The whole point is that being wrong is worse than not knowing: a wrong match shows one
// coach another coach's board, and — since this is what gates the absence reason — one
// coach the reason a manager wrote about another. So every ambiguous case must return
// nothing rather than a best guess.

import assert from "node:assert/strict";
import { coachForUser, coachIdForUser } from "../src/utils/coachIdentity.js";

const coaches = [
  { id: "c1", name: "דנה", email: "dana@gmail.com" },
  { id: "c2", name: "יוסי", email: "Yossi@Gmail.COM" }, // saved before normalising existed
  { id: "c3", name: "רון" },                            // address never filled in
  { id: "c4", name: "מיכל", email: "" },
];

const user = (email) => ({ email });

// ---- The match ----
assert.equal(coachForUser(user("dana@gmail.com"), coaches)?.id, "c1");
assert.equal(coachIdForUser(user("dana@gmail.com"), coaches), "c1");

// Case-insensitive on BOTH sides: Google hands the address back lower-case, and records
// written before the field was normalised are still out there.
assert.equal(coachIdForUser(user("yossi@gmail.com"), coaches), "c2", "stored mixed case");
assert.equal(coachIdForUser(user("DANA@GMAIL.COM"), coaches), "c1", "token mixed case");
assert.equal(coachIdForUser(user("  dana@gmail.com  "), coaches), "c1", "surrounding space");

// ---- Not knowing is a valid answer, and the only safe one ----
assert.equal(coachIdForUser(user("stranger@gmail.com"), coaches), "", "no such coach");
assert.equal(coachIdForUser(user(""), coaches), "", "signed in without an address");
assert.equal(coachIdForUser(user(undefined), coaches), "");
assert.equal(coachIdForUser(null, coaches), "", "not signed in");
assert.equal(coachIdForUser({ local: true, email: "dana@gmail.com" }, coaches), "",
  "local mode pins nobody — everyone is an admin there");

// An empty or missing address on a record must never match an empty or missing one on the
// account. Both are "unknown", and matching two unknowns is how the wrong coach gets
// someone else's board.
assert.equal(coachForUser(user(""), coaches), null);
assert.equal(coachForUser(user("   "), coaches), null);

// ---- Malformed club data must not take the screen down ----
assert.equal(coachIdForUser(user("dana@gmail.com"), undefined), "");
assert.equal(coachIdForUser(user("dana@gmail.com"), null), "");
assert.equal(coachIdForUser(user("dana@gmail.com"), "coaches"), "");
assert.equal(coachIdForUser(user("dana@gmail.com"), [null, undefined, { id: "x" }]), "");

// A record with an id but no name still resolves — the caller wants the id.
assert.equal(coachIdForUser(user("solo@gmail.com"), [{ id: "c9", email: "solo@gmail.com" }]), "c9");

console.log("coach-identity: 18 assertions passed");
