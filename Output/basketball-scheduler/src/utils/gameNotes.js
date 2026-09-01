// Notes a coach writes after a game, and whether the professional manager has read them.
//
// Kept in their own documents (clubs/{id}/gameNotes/{gameKey}) rather than inside the club
// document. Free text per game is the first thing in this app that grows without bound,
// and everything else already shares one 1 MB document — a season of reports would crowd
// out the schedule itself.

import { normalizeEmail } from "./access.js";

const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => String(v ?? "").trim();

// A game's stable key. Imported games carry a federation code; manual ones get an id at
// creation. Either way the note has to survive a re-import of the federation file, which
// rebuilds the game rows.
export function gameKey(game) {
  return str(game?.federationCode) || str(game?.id) || "";
}

export function noteFor(notes, game) {
  const k = gameKey(game);
  return k ? notes?.[k] || null : null;
}

// A score the coach typed. Kept on the note rather than on the game, because the import
// refreshes `ourScore`/`theirScore` from the federation file on every run — a number
// written onto the game would survive exactly until the next nightly sync.
export function toScore(value) {
  const s = str(value);
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= 300 ? Math.round(n) : null;
}

export function noteScore(note) {
  const ours = toScore(note?.ourScore);
  const theirs = toScore(note?.theirScore);
  return ours === null || theirs === null ? null : { ourScore: ours, theirScore: theirs };
}

// The score to show for a game, and where it came from.
//
// The federation's own number is the official record and wins whenever it exists. The
// coach's fills the days between the final whistle and the federation publishing — which
// on this club's file is most of a week.
export function scoreFor(game, note) {
  if (game && game.ourScore !== null && game.ourScore !== undefined && game.theirScore !== null && game.theirScore !== undefined) {
    return { ourScore: game.ourScore, theirScore: game.theirScore, source: "federation" };
  }
  const s = noteScore(note);
  return s ? { ...s, source: "coach" } : null;
}

// A note counts as written if it carries either a report or a score — a coach who only
// had time to type the result has still told the manager something.
export function hasContent(note) {
  return Boolean(str(note?.text)) || noteScore(note) !== null;
}

export function hasNote(notes, game) {
  return hasContent(noteFor(notes, game));
}

// Unread means: a coach has written something, and it changed after the last time a
// manager marked it read. Comparing timestamps rather than a boolean means a coach adding
// to a note the manager already read makes it unread again — which is the behaviour you
// want from something that is meant to be a conversation.
export function isUnread(note) {
  if (!hasContent(note)) return false;
  if (!note.readAt) return true;
  return String(note.updatedAt || "") > String(note.readAt);
}

export function unreadCount(notes) {
  return Object.values(notes || {}).filter(isUnread).length;
}

// Games whose note still needs the manager's eyes, most recently written first.
export function gamesWithUnread(notes, games) {
  return arr(games)
    .map((g) => ({ game: g, note: noteFor(notes, g) }))
    .filter((x) => isUnread(x.note))
    .sort((a, b) => String(b.note.updatedAt || "").localeCompare(String(a.note.updatedAt || "")));
}

// The owner of a record is `authorEmail`, and it is the only field the security rules can
// act on. `author` beside it is a display name — useful to read, useless to a rule.
//
// Normalised through `access.js` rather than through a second copy defined here. Both do
// trim-and-lowercase, and both exist for the same reason: the rules compare strings
// exactly, so a capital letter in a coach's address locks them out of their own writing
// with nothing on screen to explain why. Two implementations of that would be two places
// for it to drift.
// The stored shape. `updatedAt` moves on every save; `readAt` only when a manager marks it.
// `updatedAt` marks when the CONTENT last changed, not when save was last pressed. If it
// moved on every save, re-saving an unchanged note would push it back into the manager's
// unread queue — the note would keep asking to be read again without anyone writing a word.
export function buildNote(previous, { text, ourScore, theirScore, author, authorEmail, now }) {
  const body = str(text);
  const ours = toScore(ourScore);
  const theirs = toScore(theirScore);
  // "Unchanged" has to cover the score too. A coach who corrects 50 to 51 and saves has
  // changed the note, and the manager should see it again — comparing only the text would
  // leave that correction sitting silently behind a note already marked read.
  const unchanged =
    previous &&
    body === str(previous.text) &&
    ours === toScore(previous.ourScore) &&
    theirs === toScore(previous.theirScore);
  return {
    text: body,
    ourScore: ours,
    theirScore: theirs,
    author: str(author) || str(previous?.author),
    authorEmail: normalizeEmail(authorEmail) || str(previous?.authorEmail),
    createdAt: previous?.createdAt || now,
    updatedAt: unchanged ? previous.updatedAt || now : now,
    // A real edit puts it back in front of the manager; an identical save does not.
    readAt: unchanged ? previous.readAt || null : null,
  };
}

export function markRead(note, now) {
  if (!note) return note;
  return { ...note, readAt: now };
}
