// Who may open the club.
//
// New here — the single-club branch ships this feature without a suite. It earns one on a
// multi-club deployment for a reason the single-club case does not have: these functions
// decide who reaches a club's data, the Firestore rules read the very arrays they write,
// and a club's manager has no Firebase console to repair a mistake from.

import assert from "node:assert/strict";
import {
  normalizeEmail, isValidEmail, grantRole, revokeAccess,
  brokenEntries, accessList, wouldLockOut,
} from "../src/utils/access.js";

const club = (admins, members = []) => ({ settings: { name: "מועדון" }, admins, members });

// ---- Normalising, because the rules compare the stored string exactly ----
assert.equal(normalizeEmail("  Coach@Gmail.COM "), "coach@gmail.com");
assert.equal(normalizeEmail(null), "");
assert.equal(normalizeEmail(undefined), "");

assert.ok(isValidEmail("a@b.co"));
assert.ok(isValidEmail("  A@B.CO  "), "validation runs on the normalised form");
assert.ok(!isValidEmail("nope"));
assert.ok(!isValidEmail("a@b"), "no top-level domain");
assert.ok(!isValidEmail("a@b.c"), "one-letter TLD");
assert.ok(!isValidEmail("a b@c.co"), "a space would split the stored array entry");
assert.ok(!isValidEmail("a,b@c.co"), "a comma reads as two entries");

// ---- Granting stores lowercase, whatever was typed ----
{
  const next = grantRole(club(["boss@club.org"]), "  New.Coach@Gmail.Com ", "member");
  assert.deepEqual(next.members, ["new.coach@gmail.com"]);
  assert.deepEqual(next.admins, ["boss@club.org"], "granting one role left the other list alone");
}

// An address belongs to exactly one role — promotion must not leave it in both, or which
// list wins becomes a question about rule ordering rather than about intent.
{
  const next = grantRole(club(["boss@club.org"], ["coach@club.org"]), "coach@club.org", "admin");
  assert.deepEqual(next.members, [], "promoted address stayed behind in members");
  assert.deepEqual(next.admins, ["boss@club.org", "coach@club.org"]);
}
{
  const next = grantRole(club(["boss@club.org", "coach@club.org"]), "coach@club.org", "member");
  assert.deepEqual(next.admins, ["boss@club.org"]);
  assert.deepEqual(next.members, ["coach@club.org"]);
}

// A bad address changes nothing at all, rather than storing something the rules will
// never match.
{
  const before = club(["boss@club.org"]);
  assert.equal(grantRole(before, "not-an-email", "member"), before);
  assert.equal(grantRole(before, "ok@club.org", "owner"), before, "unknown role");
}

// Demotion is case-insensitive: a stored "Coach@..." must be found by "coach@...".
{
  const next = grantRole(club(["boss@club.org"], ["Coach@Club.org"]), "coach@club.org", "admin");
  assert.deepEqual(next.members, [], "the mixed-case entry survived the move");
  assert.deepEqual(next.admins, ["boss@club.org", "coach@club.org"]);
}

// ---- Revoking clears both lists, whatever the casing ----
{
  const next = revokeAccess(club(["boss@club.org", "Dual@club.org"], ["dual@CLUB.org"]), "dual@club.org");
  assert.deepEqual(next.admins, ["boss@club.org"]);
  assert.deepEqual(next.members, []);
}

// ---- The last manager is a one-way door, so it is refused, not warned about ----
assert.ok(wouldLockOut(club(["boss@club.org"]), "boss@club.org"), "removing the only admin");
assert.ok(wouldLockOut(club(["Boss@Club.org"]), "boss@club.org"), "...and casing must not hide it");
assert.ok(!wouldLockOut(club(["boss@club.org", "two@club.org"]), "boss@club.org"));
// A viewer is not a way back in: the rules grant writes to `admins` only.
assert.ok(wouldLockOut(club(["boss@club.org"], ["viewer@club.org"]), "boss@club.org"));

// ---- Entries that look authorised and are not ----
{
  const c = club(["Boss@Club.org", "fine@club.org"], ["  Spaced@club.org  "]);
  assert.deepEqual(brokenEntries(c), ["Boss@Club.org", "  Spaced@club.org  "]);
  assert.deepEqual(brokenEntries(club(["fine@club.org"])), [], "all-lowercase is clean");
}

// ---- The list a manager reads ----
{
  const rows = accessList(club(["boss@club.org", "Dual@club.org"], ["dual@club.org", "", null, "v@club.org"]));
  assert.deepEqual(rows.map((r) => r.email), ["boss@club.org", "Dual@club.org", "v@club.org"]);
  assert.deepEqual(rows.map((r) => r.role), ["admin", "admin", "member"]);
  assert.equal(rows[1].needsFixing, true, "the mixed-case row is flagged");
  assert.equal(rows[0].needsFixing, false);
}
// Listed under both roles: shown once, under the stronger one — otherwise the screen
// offers two role pickers for one person and they disagree.
{
  const rows = accessList(club(["x@club.org"], ["x@club.org"]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].role, "admin");
}

// ---- A club document that arrived malformed must not take the screen down ----
for (const bad of [undefined, {}, { admins: "boss@club.org" }, { admins: null, members: 7 }]) {
  assert.deepEqual(accessList(bad), []);
  assert.deepEqual(brokenEntries(bad), []);
  assert.ok(wouldLockOut(bad, "anyone@club.org"), "no admins at all is a locked-out club");
}

console.log("access: 38 assertions passed");
