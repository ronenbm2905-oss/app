import assert from "node:assert/strict";
import { sameFixtureIndex, adoptFixture } from "../src/utils/games.js";
import { applyProposal } from "../src/utils/pendingImport.js";

// The night the federation published a fixture the club already had.
const fromScan = {
  federationCode: "cup-1502072", teamId: "t-na", date: "04-11-2026", time: "20:30",
  isHome: true, opponent: "מכבי רמת גן ליאור", venue: "אולם עלומים, רח' הכפר 2, קריית אונו",
  hallId: "h-barak", departOverride: { at: "19:00", forGameTime: "20:30" },
  addressOverride: "", driverName: "יוסי", driverPhone: "0521111111",
};
const fromFile = {
  federationCode: "779711", teamId: "t-na", date: "04-11-2026", time: "20:30",
  isHome: true, opponent: "עירוני קרית אונו ברק", venue: "", league: "גביע המדינה לנערים א",
  ourScore: null, theirScore: null,
};
const data = { teams: [{ id: "t-na", name: "נערים א" }], halls: [], games: [fromScan], sessions: [] };

let n = 0;
const T = (name, fn) => { fn(); n++; console.log("  ok  " + name); };

T("the same squad, day and hour is recognised as one fixture", () => {
  assert.equal(sameFixtureIndex([fromScan], fromFile), 0);
});

T("a different squad at the same hour is a DIFFERENT fixture", () => {
  assert.equal(sameFixtureIndex([fromScan], { ...fromFile, teamId: "t-other" }), -1);
});

T("the same squad an hour later is a different fixture", () => {
  assert.equal(sameFixtureIndex([fromScan], { ...fromFile, time: "18:00" }), -1);
});

T("only a scanned record is adopted — two federation records never merge", () => {
  assert.equal(sameFixtureIndex([{ ...fromScan, federationCode: "779999" }], fromFile), -1);
});

T("adoption takes the federation's fields", () => {
  const out = adoptFixture(fromScan, fromFile);
  assert.equal(out.federationCode, "779711");
  assert.equal(out.league, "גביע המדינה לנערים א");
});

T("and keeps every decision a person made", () => {
  const out = adoptFixture(fromScan, fromFile);
  assert.equal(out.hallId, "h-barak");
  assert.deepEqual(out.departOverride, { at: "19:00", forGameTime: "20:30" });
  assert.equal(out.driverName, "יוסי");
  assert.equal(out.driverPhone, "0521111111");
});

console.log("  — approving the proposal, which is where it would have doubled —");

T("THE ONE THAT MATTERS: approving does not put the game on the board twice", () => {
  const out = applyProposal(data, { added: [{ code: "779711", game: fromFile }] }, new Date());
  assert.equal(out.games.length, 1);
  assert.equal(out.games[0].federationCode, "779711");
  assert.equal(out.games[0].hallId, "h-barak");
});

T("a genuinely new fixture is still added", () => {
  const other = { ...fromFile, federationCode: "779999", date: "11-11-2026" };
  const out = applyProposal(data, { added: [{ code: "779999", game: other }] }, new Date());
  assert.equal(out.games.length, 2);
});

T("approving twice does not double it either", () => {
  const once = applyProposal(data, { added: [{ code: "779711", game: fromFile }] }, new Date());
  const twice = applyProposal(once, { added: [{ code: "779711", game: fromFile }] }, new Date());
  assert.equal(twice.games.length, 1);
});

console.log("\n" + n + " tests passed");
