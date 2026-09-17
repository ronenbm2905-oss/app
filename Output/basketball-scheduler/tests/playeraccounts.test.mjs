import assert from "node:assert/strict";
import {
  codeFrom, newClaimCode, normalizeCode, isValidCode, CODE_LENGTH, MIN_AGE,
  ageOn, eligibleForAccount, eligiblePlayers, accountTeams, withAccountTeam,
  claimDoc, accountDoc, linkedPlayerIds,
} from "../src/utils/playerAccounts.js";

const NOW = new Date(2026, 8, 17); // 17.9.2026, local
const data = {
  playerAccountTeams: ["t-noar"],
  teams: [{ id: "t-noar", name: "נוער מחוזית" }, { id: "t-katsal", name: "קטסל ב" }],
  players: [
    { id: "p1", teamId: "t-noar", name: "דני כהן", phone: "0501234567", birthDate: "2010-03-04" }, // 16
    { id: "p2", teamId: "t-noar", name: "יובל לוי", phone: "0502222222", birthDate: "2011-09-18" }, // 14 (tomorrow 15)
    { id: "p3", teamId: "t-noar", name: "בלי תאריך", phone: "0503333333" },
    { id: "p4", teamId: "t-katsal", name: "קטן", birthDate: "2017-01-01" },
  ],
};

let n = 0;
const T = (name, fn) => { fn(); n++; console.log("  ok  " + name); };

console.log("— the code —");

T("a code is fixed length, lower case, and free of look-alikes", () => {
  const c = codeFrom([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(c.length, CODE_LENGTH);
  assert.equal(/^[a-z0-9]+$/.test(c), true);
  assert.equal(/[l1o0]/.test(c), false);
  assert.equal(newClaimCode().length, CODE_LENGTH);
});

T("it is read forgivingly — a person types it off a screen", () => {
  assert.equal(normalizeCode("  AbCd 2345 "), "abcd2345");
  assert.equal(isValidCode("ABCD2345"), true);
  assert.equal(isValidCode("abcd234"), false);   // too short
  assert.equal(isValidCode("abcd2345l"), false); // too long
  assert.equal(isValidCode("abcd234!"), false);
  assert.equal(isValidCode(""), false);
});

console.log("— who may have an account —");

T("age is counted on the actual day, not by year", () => {
  assert.equal(ageOn("2010-03-04", NOW), 16);
  assert.equal(ageOn("2011-09-18", NOW), 14); // birthday is tomorrow
  assert.equal(ageOn("2011-09-17", NOW), 15); // birthday is today
  assert.equal(ageOn("", NOW), null);
  assert.equal(ageOn("not-a-date", NOW), null);
});

T("a player in an OPEN squad who is 15+ is eligible", () => {
  assert.equal(eligibleForAccount(data.players[0], data, NOW), true);
});

T("under 15 is not — even in an open squad", () => {
  assert.equal(eligibleForAccount(data.players[1], data, NOW), false);
});

T("THE ONE THAT MATTERS: no birth date is NOT treated as old enough", () => {
  assert.equal(eligibleForAccount(data.players[2], data, NOW), false);
});

T("a squad the manager did not open is closed, whatever the age", () => {
  const old = { ...data.players[3], birthDate: "2005-01-01" };
  assert.equal(eligibleForAccount(old, data, NOW), false);
});

T("opening and closing a squad touches nothing else", () => {
  const on = withAccountTeam(data, "t-katsal", true);
  assert.deepEqual(accountTeams(on).sort(), ["t-katsal", "t-noar"]);
  assert.equal(accountTeams(withAccountTeam(on, "t-katsal", false)).length, 1);
  assert.equal(accountTeams({}).length, 0);
  assert.equal(withAccountTeam(data, "t-katsal", true).players.length, 4);
});

T("the eligible list is exactly one player here", () => {
  const list = eligiblePlayers(data, "t-noar", NOW);
  assert.deepEqual(list.map((p) => p.id), ["p1"]);
});

console.log("— the two documents —");

T("a claim names the player and says nothing about them", () => {
  const d = claimDoc(data.players[0], NOW);
  assert.equal(d.playerId, "p1");
  assert.equal(d.teamId, "t-noar");
  assert.equal(JSON.stringify(d).includes("דני"), false);
  assert.equal(JSON.stringify(d).includes("0501234567"), false);
});

T("an account carries the code, so the RULES can verify the claim", () => {
  const a = accountDoc({ uid: "u1", player: data.players[0], code: "ABCD2345", email: "K@x.com", name: "Dani", now: NOW });
  assert.equal(a.code, "abcd2345");
  assert.equal(a.playerId, "p1");
  assert.equal(a.authorEmail, "k@x.com");
});

T("and never the phone number", () => {
  const a = accountDoc({ uid: "u1", player: data.players[0], code: "abcd2345", email: "k@x.com", now: NOW });
  assert.equal(JSON.stringify(a).includes("0501234567"), false);
});

T("who is already linked, for the manager's list", () => {
  const set = linkedPlayerIds([{ playerId: "p1" }, { playerId: "" }, null]);
  assert.equal(set.has("p1"), true);
  assert.equal(set.size, 1);
});

console.log("\n" + n + " tests passed · MIN_AGE=" + MIN_AGE);
