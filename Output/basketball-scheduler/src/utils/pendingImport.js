import { applyCancellations, syncGamesToSessions } from "./games.js";

// Turning an approved proposal into the club's next state.
//
// The proposal is a set of changes keyed by federation code, not a snapshot of the games
// list — deliberately. It is prepared in the middle of the night and approved hours later,
// and in between a manager may well have moved a game or fixed an address. Applying keyed
// changes to whatever the club holds at the moment of approval keeps that work; replacing
// the list with a three-in-the-morning photograph would erase it.

export function applyProposal(data, proposal, now) {
  const byCode = new Map((data.games || []).map((g) => [String(g.federationCode), g]));

  // Changed fields land on the record that is there now, so anything the file does not
  // own — a nudged start time, a hand-typed address — is left exactly as it was.
  for (const u of proposal.updated || []) {
    const game = byCode.get(String(u.code));
    if (!game) continue;
    const patch = {};
    for (const f of u.fields || []) patch[f.key] = f.value;
    byCode.set(String(u.code), { ...game, ...patch });
  }

  // A game already present is not added twice: a proposal approved from two tabs, or a
  // manual import that ran in between, must not double the fixture.
  for (const a of proposal.added || []) {
    if (!byCode.has(String(a.code)) && a.game) byCode.set(String(a.code), a.game);
  }

  const games = applyCancellations([...byCode.values()], {
    cancelled: (proposal.cancelled || []).map((c) => c.code),
    restored: (proposal.restored || []).map((c) => c.code),
    now,
  });

  // Rebuilt rather than patched: the board rows are a projection of the games list, and
  // letting the two drift apart is how they stop agreeing.
  return { ...data, games, sessions: syncGamesToSessions(games, { ...data, games }) };
}

// What the banner says, from the stored summary. Kept next to the applying code so the
// count a manager reads and the change they get can never come from different places.
export function proposalCounts(proposal) {
  return {
    added: (proposal?.added || []).length,
    updated: (proposal?.updated || []).length,
    cancelled: (proposal?.cancelled || []).length,
    restored: (proposal?.restored || []).length,
  };
}
