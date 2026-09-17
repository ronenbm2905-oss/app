import assert from "node:assert/strict";
import { duplicateFixtures, mergeDuplicateFixtures } from "../src/utils/games.js";

const scanned = {
  federationCode: "cup-1502072", teamId: "t1", date: "04-11-2026", time: "20:30",
  isHome: true, opponent: "מכבי רמת גן ליאור", hallId: "h-barak",
  departOverride: { at: "19:00", forGameTime: "20:30" }, driverName: "יוסי",
};
const official = {
  federationCode: "779711", teamId: "t1", date: "04-11-2026", time: "20:30",
  isHome: true, opponent: "עירוני קרית אונו ברק", league: "גביע המדינה לנערים א",
};
const unrelated = { federationCode: "manual-1", teamId: "t2", date: "10-09-2026", time: "18:00" };

let n = 0;
const T = (name, fn) => { fn(); n++; console.log("  ok  " + name); };

T("two records for one fixture are found", () => {
  const pairs = duplicateFixtures([scanned, official, unrelated]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].keep.federationCode, "779711");
  assert.equal(pairs[0].drop[0].federationCode, "cup-1502072");
});

T("the FEDERATION record is the one kept, whatever the order", () => {
  assert.equal(duplicateFixtures([official, scanned])[0].keep.federationCode, "779711");
  assert.equal(duplicateFixtures([scanned, official])[0].keep.federationCode, "779711");
});

T("merging leaves one record, carrying the manual decisions", () => {
  const { games, merged } = mergeDuplicateFixtures([scanned, official, unrelated]);
  assert.equal(merged, 1);
  assert.equal(games.length, 2);
  const kept = games.find((g) => g.federationCode === "779711");
  assert.equal(kept.hallId, "h-barak");
  assert.deepEqual(kept.departOverride, { at: "19:00", forGameTime: "20:30" });
  assert.equal(kept.driverName, "יוסי");
  assert.equal(kept.league, "גביע המדינה לנערים א");
});

T("two DIFFERENT fixtures on one day are not merged", () => {
  const other = { ...official, federationCode: "779712", time: "18:00" };
  assert.equal(duplicateFixtures([scanned, other]).length, 0);
});

T("the same hour for two squads is not a duplicate", () => {
  const otherTeam = { ...official, teamId: "t9" };
  assert.equal(duplicateFixtures([scanned, otherTeam]).length, 0);
});

T("two scanned records are left alone — there is no official one to keep", () => {
  assert.equal(duplicateFixtures([scanned, { ...scanned, federationCode: "cup-99" }]).length, 0);
});

T("a clean list is returned unchanged", () => {
  const out = mergeDuplicateFixtures([official, unrelated]);
  assert.equal(out.merged, 0);
  assert.equal(out.games.length, 2);
});

T("a record with no team or date is never grouped", () => {
  assert.equal(duplicateFixtures([{ federationCode: "a" }, { federationCode: "b" }]).length, 0);
});

console.log("\n" + n + " tests passed");
