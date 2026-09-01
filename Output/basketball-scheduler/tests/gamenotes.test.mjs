// A coach's report after a game, and whether the manager has read it.
//
// The interesting behaviour is not "does it save" — it is what counts as a CHANGE. An
// identical save must not push a note back into the manager's queue, and a real edit must.
// Get that backwards and the feature either nags forever or silently swallows corrections.

import assert from "node:assert/strict";
import {
  gameKey, noteFor, toScore, noteScore, scoreFor, hasContent, hasNote,
  isUnread, unreadCount, gamesWithUnread, buildNote, markRead,
} from "../src/utils/gameNotes.js";

// ---- The key a note hangs on ----
// It has to survive a re-import of the federation file, which rebuilds the game rows.
assert.equal(gameKey({ federationCode: "F-1", id: "x" }), "F-1", "the federation code wins");
assert.equal(gameKey({ id: "manual-1" }), "manual-1", "a manual game falls back to its id");
assert.equal(gameKey({ federationCode: "  F-2  " }), "F-2");
assert.equal(gameKey({}), "");
assert.equal(gameKey(null), "");
assert.equal(noteFor({ "F-1": { text: "כן" } }, { federationCode: "F-1" }).text, "כן");
assert.equal(noteFor({}, {}), null, "a game with no key gets no note, not an error");

// ---- Scores ----
assert.equal(toScore("72"), 72);
assert.equal(toScore(" 72 "), 72);
assert.equal(toScore("72.4"), 72, "rounded, not rejected");
assert.equal(toScore(""), null, "a cleared field is 'no score', not zero");
assert.equal(toScore("abc"), null);
assert.equal(toScore("-1"), null);
assert.equal(toScore("301"), null, "out of range");
assert.equal(toScore("0"), 0, "a shutout is a real score");
assert.deepEqual(noteScore({ ourScore: 70, theirScore: 65 }), { ourScore: 70, theirScore: 65 });
assert.equal(noteScore({ ourScore: 70 }), null, "half a result is not a result");

// The federation's number is the official record; the coach's fills the days before it
// publishes. Both present → the federation wins.
assert.deepEqual(
  scoreFor({ ourScore: 80, theirScore: 70 }, { ourScore: 1, theirScore: 2 }),
  { ourScore: 80, theirScore: 70, source: "federation" }
);
assert.deepEqual(
  scoreFor({ ourScore: null, theirScore: null }, { ourScore: 55, theirScore: 50 }),
  { ourScore: 55, theirScore: 50, source: "coach" }
);
assert.equal(scoreFor({}, null), null);
// A real 0:0 from the federation must not read as "no score reported".
assert.deepEqual(scoreFor({ ourScore: 0, theirScore: 0 }, null), { ourScore: 0, theirScore: 0, source: "federation" });

// ---- What counts as written ----
assert.equal(hasContent({ text: "שיחקנו טוב" }), true);
assert.equal(hasContent({ text: "   " }), false, "whitespace is not a report");
assert.equal(hasContent({ ourScore: 70, theirScore: 65 }), true, "a result alone is still telling the manager something");
assert.equal(hasContent({ ourScore: 70 }), false);
assert.equal(hasContent(null), false);
assert.equal(hasNote({ "F-1": { text: "כן" } }, { federationCode: "F-1" }), true);

// ---- Unread ----
assert.equal(isUnread({ text: "כן", updatedAt: "2026-09-01" }), true, "never read");
assert.equal(isUnread({ text: "כן", updatedAt: "2026-09-01", readAt: "2026-09-02" }), false);
assert.equal(isUnread({ text: "כן", updatedAt: "2026-09-03", readAt: "2026-09-02" }), true,
  "edited after it was read — a conversation, not a one-off");
assert.equal(isUnread({ text: "", updatedAt: "2026-09-01" }), false, "an empty note is not waiting for anyone");
assert.equal(unreadCount({ a: { text: "x", updatedAt: "1" }, b: { text: "y", updatedAt: "1", readAt: "2" } }), 1);
assert.equal(unreadCount(null), 0);

{
  const notes = {
    "F-1": { text: "ראשון", updatedAt: "2026-09-01" },
    "F-2": { text: "שני", updatedAt: "2026-09-05" },
    "F-3": { text: "נקרא", updatedAt: "2026-09-02", readAt: "2026-09-06" },
  };
  const games = [{ federationCode: "F-1" }, { federationCode: "F-2" }, { federationCode: "F-3" }];
  assert.deepEqual(gamesWithUnread(notes, games).map((x) => x.game.federationCode), ["F-2", "F-1"],
    "most recently written first");
  assert.deepEqual(gamesWithUnread(notes, null), []);
}

// ---- buildNote: the part that decides whether the manager sees it again ----
const NOW = "2026-09-10T10:00:00.000Z";
const BEFORE = "2026-09-01T10:00:00.000Z";
const prev = {
  text: "שיחקנו טוב", ourScore: 70, theirScore: 65,
  author: "דנה", authorEmail: "dana@gmail.com",
  createdAt: BEFORE, updatedAt: BEFORE, readAt: "2026-09-02T00:00:00.000Z",
};

// An identical save must change nothing. Without this the note keeps asking to be read
// again without anyone having written a word.
{
  const same = buildNote(prev, { text: "שיחקנו טוב", ourScore: "70", theirScore: "65", author: "דנה", authorEmail: "dana@gmail.com", now: NOW });
  assert.equal(same.updatedAt, BEFORE, "an unchanged save moved updatedAt");
  assert.equal(same.readAt, prev.readAt, "an unchanged save marked it unread again");
  assert.equal(isUnread(same), false);
}
// A corrected score IS a change — comparing only the text would leave the correction
// sitting silently behind a note already marked read.
{
  const fixed = buildNote(prev, { text: "שיחקנו טוב", ourScore: "71", theirScore: "65", author: "דנה", authorEmail: "dana@gmail.com", now: NOW });
  assert.equal(fixed.updatedAt, NOW);
  assert.equal(fixed.readAt, null);
  assert.equal(isUnread(fixed), true);
}
{
  const edited = buildNote(prev, { text: "בעצם היה קשה", ourScore: "70", theirScore: "65", author: "דנה", authorEmail: "dana@gmail.com", now: NOW });
  assert.equal(edited.updatedAt, NOW);
  assert.equal(edited.readAt, null);
}
// createdAt is the note's birthday and never moves.
assert.equal(buildNote(prev, { text: "חדש", author: "דנה", authorEmail: "dana@gmail.com", now: NOW }).createdAt, BEFORE);
assert.equal(buildNote(null, { text: "ראשון", author: "דנה", authorEmail: "dana@gmail.com", now: NOW }).createdAt, NOW);

// The owner field is what the rules match on, so it is stored lower-cased — a capital
// letter would lock the coach out of their own writing with nothing on screen to explain it.
assert.equal(buildNote(null, { text: "x", author: "דנה", authorEmail: "  Dana@Gmail.COM ", now: NOW }).authorEmail, "dana@gmail.com");
// An edit that arrives without an author keeps the original one rather than blanking it.
assert.equal(buildNote(prev, { text: "y", now: NOW }).authorEmail, "dana@gmail.com");
assert.equal(buildNote(prev, { text: "y", now: NOW }).author, "דנה");

assert.equal(markRead(prev, NOW).readAt, NOW);
assert.equal(markRead(null, NOW), null);

console.log("game-notes: 45 assertions passed");
