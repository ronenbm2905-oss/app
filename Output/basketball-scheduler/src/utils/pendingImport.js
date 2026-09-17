import { applyCancellations, syncGamesToSessions, sameFixtureIndex, adoptFixture } from "./games.js";

// Turning an approved proposal into the club's next state.
//
// The proposal is a set of changes keyed by federation code, not a snapshot of the games
// list — deliberately. It is prepared in the middle of the night and approved hours later,
// and in between a manager may well have moved a game or fixed an address. Applying keyed
// changes to whatever the club holds at the moment of approval keeps that work; replacing
// the list with a three-in-the-morning photograph would erase it.

// `onlyCodes` narrows the apply to part of the proposal — one squad's fixtures rather than
// all of them. A season published in one go is three hundred rows, and three hundred rows
// approved in one click is a review nobody performed. Twenty fixtures for one squad is a
// list a person can actually look at and say yes to.
//
// Omitted, everything applies, exactly as before.
export function applyProposal(data, proposal, now, onlyCodes) {
  const wanted = onlyCodes ? new Set([...onlyCodes].map(String)) : null;
  const take = (code) => !wanted || wanted.has(String(code));
  const byCode = new Map((data.games || []).map((g) => [String(g.federationCode), g]));

  // Changed fields land on the record that is there now, so anything the file does not
  // own — a nudged start time, a hand-typed address — is left exactly as it was.
  for (const u of (proposal.updated || []).filter((u) => take(u.code))) {
    const game = byCode.get(String(u.code));
    if (!game) continue;
    const patch = {};
    for (const f of u.fields || []) patch[f.key] = f.value;
    byCode.set(String(u.code), { ...game, ...patch });
  }

  // A game already present is not added twice: a proposal approved from two tabs, or a
  // manual import that ran in between, must not double the fixture.
  for (const a of (proposal.added || []).filter((a) => take(a.code))) {
    if (byCode.has(String(a.code)) || !a.game) continue;
    // The fixture may already be here under the id it arrived with from the cup scan. A
    // proposal built by code would add it a second time; the same rule the import uses
    // adopts the record instead. Without this, approving tonight's proposal would have
    // put every cup game on the board twice.
    const list = [...byCode.values()];
    const idx = sameFixtureIndex(list, a.game);
    if (idx >= 0) {
      const kept = list[idx];
      byCode.delete(String(kept.federationCode));
      byCode.set(String(a.code), adoptFixture(kept, a.game));
      continue;
    }
    byCode.set(String(a.code), a.game);
  }

  const games = applyCancellations([...byCode.values()], {
    cancelled: (proposal.cancelled || []).map((c) => c.code).filter(take),
    restored: (proposal.restored || []).map((c) => c.code).filter(take),
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

// The proposal, split the way a manager reads it: one squad at a time.
//
// A fixture the file could not attach to any of the club's teams gets its own group rather
// than being dropped or scattered. In a flat list of three hundred rows it is invisible;
// here it is a labelled pile that says how many, which is the only way anyone notices that
// a team code was never mapped.
export function groupProposalByTeam(proposal, teams, games) {
  const nameOf = (id) => (Array.isArray(teams) ? teams : []).find((t) => t && t.id === id)?.name || "";
  // Only an ADDED entry carries the fixture itself; a change, a cancellation and a
  // restoration are keyed by code alone. Their squad is the one on the record the club
  // already holds — looked up here rather than written into the proposal, so a document
  // filed before this existed groups correctly too.
  const byCode = new Map((Array.isArray(games) ? games : []).map((g) => [String(g?.federationCode), g]));
  const teamOf = (code) => byCode.get(String(code))?.teamId || "";
  const buckets = new Map();
  const put = (kind, entry, teamId) => {
    const key = teamId || "";
    if (!buckets.has(key)) buckets.set(key, { teamId: key, name: nameOf(key) || "ללא שיוך לקבוצה", added: [], updated: [], cancelled: [], restored: [] });
    buckets.get(key)[kind].push(entry);
  };
  (proposal?.added || []).forEach((a) => put("added", a, a?.game?.teamId));
  (proposal?.updated || []).forEach((u) => put("updated", u, u?.teamId || teamOf(u?.code)));
  (proposal?.cancelled || []).forEach((c) => put("cancelled", c, c?.teamId || teamOf(c?.code)));
  (proposal?.restored || []).forEach((c) => put("restored", c, c?.teamId || teamOf(c?.code)));

  return [...buckets.values()]
    .map((b) => ({ ...b, codes: [...b.added, ...b.updated, ...b.cancelled, ...b.restored].map((x) => String(x.code)), count: b.added.length + b.updated.length + b.cancelled.length + b.restored.length }))
    .filter((b) => b.count > 0)
    // Unattached last: it is the pile to deal with, not the one to start from.
    .sort((a, b) => (a.teamId ? 0 : 1) - (b.teamId ? 0 : 1) || a.name.localeCompare(b.name, "he"));
}

// What remains pending after part of it was applied. The proposal SHRINKS rather than being
// marked up: anything still listed is still waiting, so a half-approved proposal reopened
// tomorrow cannot offer the same fixtures twice.
export function withoutCodes(proposal, codes) {
  const gone = new Set([...(codes || [])].map(String));
  const keep = (x) => !gone.has(String(x?.code));
  const next = {
    ...proposal,
    added: (proposal?.added || []).filter(keep),
    updated: (proposal?.updated || []).filter(keep),
    cancelled: (proposal?.cancelled || []).filter(keep),
    restored: (proposal?.restored || []).filter(keep),
  };
  next.summary = {
    ...(proposal?.summary || {}),
    added: next.added.length,
    updated: next.updated.length,
    cancelled: next.cancelled.length,
    restored: next.restored.length,
  };
  next.empty = next.added.length + next.updated.length + next.cancelled.length + next.restored.length === 0;
  return next;
}