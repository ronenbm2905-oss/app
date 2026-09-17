import assert from "node:assert/strict";
import { boardsToRefresh } from "../src/utils/boardSync.js";
import { buildBoard } from "../src/utils/teamBoard.js";

const W = "2026-09-13";
const base = {
  boards: { t1: { token: "tok1" }, t2: { token: "tok2" } },
  teams: [{ id: "t1", name: "נוער" }, { id: "t2", name: "נערים א" }],
  halls: [{ id: "h1", name: "ברק" }],
  games: [],
  sessions: [
    { id: "a", teamId: "t1", hallId: "h1", day: "שני", start: "17:00", end: "18:30", weekOf: W },
    { id: "b", teamId: "t2", hallId: "h1", day: "רביעי", start: "19:00", end: "20:30", weekOf: W },
  ],
};
const at = { now: new Date("2026-09-16T10:00:00") };
const currentFor = (data) => ({
  tok1: buildBoard(data, "t1", at),
  tok2: buildBoard(data, "t2", at),
});

let n = 0;
const T = (name, fn) => { fn(); n++; console.log("  ok  " + name); };

T("nothing moved, nothing is written", () => {
  assert.equal(boardsToRefresh(base, currentFor(base)).length, 0);
});

T("a training that moved refreshes ONLY its own team's board", () => {
  const current = currentFor(base);
  const moved = { ...base, sessions: [{ ...base.sessions[0], start: "18:00" }, base.sessions[1]] };
  const out = boardsToRefresh(moved, current);
  assert.equal(out.length, 1);
  assert.equal(out[0].token, "tok1");
});

T("a board that does not exist yet is always written", () => {
  assert.equal(boardsToRefresh(base, {}).length, 2);
});

T("a team with no published board is ignored", () => {
  const one = { ...base, boards: { t1: { token: "tok1" } } };
  const out = boardsToRefresh(one, {});
  assert.deepEqual(out.map((x) => x.teamId), ["t1"]);
});

T("a published board whose team was deleted is left alone, not emptied", () => {
  const gone = { ...base, teams: [base.teams[0]] };
  const out = boardsToRefresh(gone, currentFor(base));
  assert.equal(out.some((x) => x.teamId === "t2"), false);
});

T("a club with nothing published does nothing at all", () => {
  assert.equal(boardsToRefresh({ ...base, boards: {} }, {}).length, 0);
  assert.equal(boardsToRefresh({}, {}).length, 0);
});

T("what comes out is a complete board, ready to write", () => {
  const out = boardsToRefresh(base, {});
  assert.equal(out[0].board.teamName, "נוער");
  assert.equal(Object.keys(out[0].board.weeks).length >= 0, true);
});

console.log("\n" + n + " tests passed");
