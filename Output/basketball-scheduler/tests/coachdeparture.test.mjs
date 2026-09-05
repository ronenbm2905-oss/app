// A coach leaves. What does the club still hold in their name, and what happens to it?
//
// Written because the legal gate found the promise and the mechanism out of step: the
// privacy policy said a departing coach's details come off their records, and only the
// video library could actually do it. The two record types that could not are the two that
// carry player names — a training plan's lineups and its "missing" field name minors.
//
// The assertions worth reading are the ones about what is NOT touched: releasing must not
// take the content with it, and it must not reach a second coach's records.

import assert from "node:assert/strict";
import {
  ownedBy, releaseRecord, isReleased, departureHoldings, buildDeparturePlan, describeHoldings,
} from "../src/utils/coachDeparture.js";

const DANA = "dana.coach@gmail.com";
const RONI = "roni@club.org";

const coach = { id: "c1", name: "דנה", email: DANA };
const other = { id: "c2", name: "רוני", email: RONI };

const sources = () => ({
  notes: {
    g1: { text: "שיחקנו טוב", authorEmail: DANA, author: "דנה", readAt: null },
    g2: { text: "של רוני", authorEmail: RONI, author: "רוני" },
  },
  plans: {
    s1: { summary: "מערך", missing: "יואב", units: { 1: { quads: ["נועם"], fives: [] } }, authorEmail: DANA, author: "דנה" },
  },
  videos: [
    { id: "v1", title: "תרגיל מסירה", url: "https://youtu.be/x", authorEmail: DANA, author: "דנה" },
    { id: "v2", title: "הגנה", url: "https://youtu.be/y", authorEmail: RONI, author: "רוני" },
  ],
  absences: [
    { id: "a1", coachId: "c1", date: "2026-09-06", note: "מילואים" },
    { id: "a2", coachId: "c2", date: "2026-09-07", note: "" },
    { id: "a3", hallId: "h1", date: "2026-09-08", note: "עירייה" },
  ],
});

// ---- Ownership is the address, never the name ----
assert.ok(ownedBy({ authorEmail: DANA }, DANA));
assert.ok(ownedBy({ authorEmail: "Dana.Coach@Gmail.COM" }, DANA), "stored casing must not hide a record");
assert.ok(ownedBy({ authorEmail: DANA }, "  DANA.COACH@gmail.com "), "the argument is normalised too");
assert.ok(!ownedBy({ authorEmail: RONI }, DANA));
assert.ok(!ownedBy({ author: "דנה" }, DANA), "a display name is not ownership — two coaches share a first name");
// A blank address matches nothing, in either direction. Otherwise the first departure
// would sweep up every already-released record in the club.
assert.ok(!ownedBy({ authorEmail: "" }, ""));
assert.ok(!ownedBy({ authorEmail: "" }, DANA));
assert.ok(!ownedBy({ authorEmail: DANA }, ""));
assert.ok(!ownedBy(null, DANA));

// ---- Releasing takes the person off and leaves the record ----
{
  const note = { text: "שיחקנו טוב", ourScore: 51, authorEmail: DANA, author: "דנה", readAt: "2026-09-01" };
  const out = releaseRecord(note);
  assert.equal(out.authorEmail, "", "the address the rules match on stayed");
  assert.equal(out.author, "", "the name a manager reads stayed");
  assert.equal(out.text, "שיחקנו טוב", "the content was lost");
  assert.equal(out.ourScore, 51);
  assert.equal(out.readAt, "2026-09-01", "an unrelated field was dropped");
  assert.notEqual(out, note, "the input was mutated in place");
  assert.equal(note.authorEmail, DANA, "the input was mutated in place");
}
assert.ok(isReleased(releaseRecord({ authorEmail: DANA })));
assert.ok(!isReleased({ authorEmail: DANA }));
assert.ok(isReleased({}), "a record with no address is already nobody's");
assert.ok(!isReleased(null));
assert.equal(releaseRecord(null), null);

// ---- What the club holds ----
{
  const held = departureHoldings(coach, sources());
  assert.deepEqual(held.notes, ["g1"]);
  assert.deepEqual(held.plans, ["s1"]);
  assert.deepEqual(held.videos, ["v1"]);
  assert.deepEqual(held.absences, ["a1"], "an absence is matched by coachId, not by address");
  assert.equal(held.total, 4);
}
// A hall closure is not a coach's absence, and never gets swept up with one.
assert.ok(!departureHoldings(coach, sources()).absences.includes("a3"));
// The other coach keeps everything.
{
  const held = departureHoldings(other, sources());
  assert.deepEqual(held.notes, ["g2"]);
  assert.deepEqual(held.videos, ["v2"]);
  assert.deepEqual(held.absences, ["a2"]);
  assert.equal(held.total, 3);
}

// A coach who never signed in has no address, so nothing they "wrote" can be found — but
// the absences a manager wrote about them still can. This is the case that would silently
// find nothing if absences were matched by address like everything else.
{
  const held = departureHoldings({ id: "c1", name: "דנה" }, sources());
  assert.deepEqual(held.notes, []);
  assert.deepEqual(held.plans, []);
  assert.deepEqual(held.videos, []);
  assert.deepEqual(held.absences, ["a1"], "the record written ABOUT the coach was missed");
  assert.equal(held.total, 1);
}

// Malformed or absent inputs report nothing rather than throwing: this runs on a club
// document that may have arrived from anywhere.
for (const bad of [undefined, {}, { notes: null, plans: 7, videos: "x", absences: {} }]) {
  const held = departureHoldings(coach, bad);
  assert.equal(held.total, 0);
  assert.deepEqual(held.notes, []);
}
// No coach at all finds nothing — not "everything with a blank address", which is what a
// falsy-matching search would return once the club has its first released record.
assert.equal(departureHoldings(null, sources()).total, 0);
assert.equal(departureHoldings({ name: "דנה" }, sources()).total, 0, "a coach with neither id nor address");

// ---- The plan, which is data and not an action ----
{
  const s = sources();
  const plan = buildDeparturePlan(coach, s);
  assert.equal(plan.total, 4);
  assert.equal(plan.email, DANA);
  assert.equal(plan.coachId, "c1");
  assert.deepEqual(plan.absenceIds, ["a1"]);
  assert.deepEqual(plan.releases.map((r) => r.kind), ["note", "plan", "video"]);
  assert.deepEqual(plan.releases.map((r) => r.key), ["g1", "s1", "v1"]);
  for (const r of plan.releases) {
    assert.equal(r.record.authorEmail, "", `${r.kind} kept its address`);
    assert.equal(r.record.author, "", `${r.kind} kept its name`);
  }
  // The plan carries the training plan's content forward — this is the record with the
  // minors' names in it, and losing it to a departure would be the worse failure.
  const planned = plan.releases.find((r) => r.kind === "plan").record;
  assert.equal(planned.missing, "יואב");
  assert.deepEqual(planned.units, { 1: { quads: ["נועם"], fives: [] } });
  // Building the plan changes nothing until the screen runs it.
  assert.equal(s.notes.g1.authorEmail, DANA, "building the plan wrote to the source");
  assert.equal(s.videos[0].authorEmail, DANA, "building the plan wrote to the source");
  // ...and it never reaches the other coach.
  assert.ok(!plan.releases.some((r) => r.key === "g2" || r.key === "v2"));
  assert.ok(!plan.absenceIds.includes("a2"));
}
// A coach who holds nothing produces an empty plan, not a no-op that looks like work.
{
  const plan = buildDeparturePlan({ id: "c9", name: "חדש", email: "new@club.org" }, sources());
  assert.equal(plan.total, 0);
  assert.deepEqual(plan.releases, []);
  assert.deepEqual(plan.absenceIds, []);
}

// ---- What the manager reads before confirming ----
{
  const held = departureHoldings(coach, sources());
  assert.equal(describeHoldings(held), "הערת משחק אחת · מערך אימון אחד · סרטון אחד · סימון היעדרות אחד");
}
{
  const s = sources();
  s.notes.g3 = { text: "עוד", authorEmail: DANA };
  s.notes.g4 = { text: "ועוד", authorEmail: DANA };
  const held = departureHoldings(coach, s);
  assert.equal(describeHoldings(held), "3 הערות משחק · מערך אימון אחד · סרטון אחד · סימון היעדרות אחד");
  // The count in the sentence and the count in the plan are the same number, always.
  assert.equal(held.total, buildDeparturePlan(coach, s).total);
}
assert.equal(describeHoldings(departureHoldings({ id: "c9" }, sources())), "");

console.log("coach departure: 69 assertions passed");
