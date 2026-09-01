// The parent-facing document must never carry an absence.
//
// An absence is the one record in the club document written by a MANAGER about a COACH.
// The coach did not write it, and may not know it exists — `note` is where "מילואים" or
// "ניתוח" gets typed. `availability.js` hides that note by default inside the app; this
// suite is the outer boundary: nothing about an absence may reach a parent at all.
//
// Written when `absences` was ported from the single-club branch. Nothing published it
// then — `buildPublicWeek` is an allowlist, so a new club-document field is excluded by
// construction. That is exactly why the test exists: it locks the current, correct
// behaviour in place before a future field addition upstream has a chance to change it.

import assert from "node:assert/strict";
import {
  buildPublicWeek,
  buildSharedWeek,
  buildTeamWeek,
  findLeakedKeys,
  FORBIDDEN_KEYS,
} from "../src/utils/publish.js";

const WEEK = "2026-09-06"; // a Sunday

const NOTE = "מילואים";

const club = {
  settings: { name: "מכבי בדיקה" },
  teams: [{ id: "t1", name: "נוער א" }],
  coaches: [{ id: "c1", name: "דנה" }],
  halls: [{ id: "h1", name: "אולם מרכזי" }],
  sessions: [
    {
      id: "s1", teamId: "t1", coachId: "c1", hallId: "h1",
      day: "ראשון", start: "17:00", end: "18:30", weekOf: WEEK, type: "אימון",
    },
  ],
  holidays: [],
  absences: [
    { id: "a1", coachId: "c1", date: "2026-09-06", start: "", end: "", note: NOTE },
    { id: "a2", hallId: "h1", date: "2026-09-07", start: "18:00", end: "22:00", note: "עירייה" },
  ],
};

const asText = (doc) => JSON.stringify(doc);

// ---- 1. Nothing about an absence survives publication ----
for (const [label, doc] of [
  ["buildPublicWeek", buildPublicWeek(club, WEEK, 0)],
  ["buildSharedWeek", buildSharedWeek(club, WEEK, 0)],
  ["buildTeamWeek", buildTeamWeek(club, WEEK, "t1", 0)],
]) {
  const text = asText(doc);
  assert.ok(!text.includes(NOTE), `${label}: the manager's note reached the parent document`);
  assert.ok(!text.includes("עירייה"), `${label}: a hall-closure note reached the parent document`);
  assert.ok(!text.includes("absences"), `${label}: the absences key reached the parent document`);
  assert.ok(!text.includes('"a1"') && !text.includes('"a2"'), `${label}: an absence id reached the parent document`);
  assert.deepEqual(findLeakedKeys(doc), [], `${label}: findLeakedKeys reported a leak`);
}

// The week that IS published still works — a test that only proves emptiness proves nothing.
assert.equal(buildTeamWeek(club, WEEK, "t1", 0).sessions.length, 1, "the session itself stopped being published");

// ---- 2. The detector actually detects ----
// Without this, every assertion above would keep passing if `findLeakedKeys` were broken
// or `absences` were quietly dropped from the list. This project has shipped a dead
// privacy test before — a regex with no slashes that matched nothing.
assert.ok(FORBIDDEN_KEYS.includes("absences"), "`absences` is not on the forbidden list");
const injected = { ...buildTeamWeek(club, WEEK, "t1", 0), absences: club.absences };
assert.deepEqual(findLeakedKeys(injected), ["$.absences"], "an injected absences block was not caught");

// Nested, too — a leak one level down is the realistic shape (a session carrying its own).
const nested = buildTeamWeek(club, WEEK, "t1", 0);
nested.sessions[0].absences = [club.absences[0]];
assert.deepEqual(findLeakedKeys(nested), ["$.sessions[0].absences"], "a nested absences block was not caught");

console.log("publish-absences: 15 assertions passed");
