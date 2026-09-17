import assert from "node:assert/strict";
import { groupProposalByTeam, withoutCodes, applyProposal } from "../src/utils/pendingImport.js";

const teams = [{ id: "t1", name: "נערים א" }, { id: "t2", name: "ילדים א" }];
const games = [
  { federationCode: "old-1", teamId: "t1", date: "01-11-2026", time: "18:00" },
  { federationCode: "old-2", teamId: "t2", date: "02-11-2026", time: "17:00" },
];
const proposal = {
  added: [
    { code: "n1", label: "x", game: { federationCode: "n1", teamId: "t1", date: "05-11-2026", time: "18:00" } },
    { code: "n2", label: "x", game: { federationCode: "n2", teamId: "t2", date: "06-11-2026", time: "17:00" } },
    { code: "n3", label: "x", game: { federationCode: "n3", teamId: "", date: "07-11-2026", time: "19:00" } },
  ],
  updated: [{ code: "old-1", label: "x", fields: [{ key: "time", value: "19:00" }] }],
  cancelled: [{ code: "old-2", label: "x" }],
  restored: [],
  summary: { added: 3, updated: 1, cancelled: 1 },
};

let n = 0;
const T = (name, fn) => { fn(); n++; console.log("  ok  " + name); };

T("every change is filed under the squad it belongs to", () => {
  const g = groupProposalByTeam(proposal, teams, games);
  const na = g.find((x) => x.teamId === "t1");
  assert.equal(na.added.length, 1);
  assert.equal(na.updated.length, 1);   // resolved by code, not carried on the entry
  const ya = g.find((x) => x.teamId === "t2");
  assert.equal(ya.cancelled.length, 1);
});

T("a fixture with no squad gets its own pile, named", () => {
  const g = groupProposalByTeam(proposal, teams, games);
  const none = g.find((x) => x.teamId === "");
  assert.equal(none.name, "ללא שיוך לקבוצה");
  assert.equal(none.count, 1);
});

T("that pile sorts LAST — it is the one to deal with, not to start from", () => {
  const g = groupProposalByTeam(proposal, teams, games);
  assert.equal(g[g.length - 1].teamId, "");
});

T("approving ONE squad writes only that squad's fixtures", () => {
  const g = groupProposalByTeam(proposal, teams, games);
  const na = g.find((x) => x.teamId === "t1");
  const data = { teams, halls: [], coaches: [], games, sessions: [] };
  const out = applyProposal(data, proposal, new Date().toISOString(), na.codes);
  assert.equal(out.games.some((x) => x.federationCode === "n1"), true);
  assert.equal(out.games.some((x) => x.federationCode === "n2"), false); // the other squad untouched
  assert.equal(out.games.find((x) => x.federationCode === "old-1").time, "19:00");
});

T("a cancellation outside the approved squad is not applied", () => {
  const g = groupProposalByTeam(proposal, teams, games);
  const na = g.find((x) => x.teamId === "t1");
  const data = { teams, halls: [], coaches: [], games, sessions: [] };
  const out = applyProposal(data, proposal, new Date().toISOString(), na.codes);
  assert.equal(Boolean(out.games.find((x) => x.federationCode === "old-2").cancelled), false);
});

T("with no subset given, everything still applies as before", () => {
  const data = { teams, halls: [], coaches: [], games, sessions: [] };
  const out = applyProposal(data, proposal, new Date().toISOString());
  assert.equal(out.games.some((x) => x.federationCode === "n2"), true);
});

T("what is left after a squad is approved is the rest, and the counts follow", () => {
  const g = groupProposalByTeam(proposal, teams, games);
  const na = g.find((x) => x.teamId === "t1");
  const rest = withoutCodes(proposal, na.codes);
  assert.equal(rest.added.length, 2);
  assert.equal(rest.updated.length, 0);
  assert.equal(rest.summary.added, 2);
  assert.equal(rest.empty, false);
});

T("approving every squad empties the proposal", () => {
  const all = groupProposalByTeam(proposal, teams, games).flatMap((x) => x.codes);
  assert.equal(withoutCodes(proposal, all).empty, true);
});

T("an already-approved fixture cannot be offered a second time", () => {
  const g = groupProposalByTeam(proposal, teams, games);
  const rest = withoutCodes(proposal, g[0].codes);
  const again = groupProposalByTeam(rest, teams, games);
  assert.equal(again.some((x) => x.teamId === g[0].teamId), false);
});

console.log("\n" + n + " tests passed");
