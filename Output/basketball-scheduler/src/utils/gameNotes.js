// Notes a coach writes after a game, and whether the professional manager has read them.
//
// Kept in their own documents (clubs/{id}/gameNotes/{gameKey}) rather than inside the club
// document. Free text per game is the first thing in this app that grows without bound,
// and everything else already shares one 1 MB document — a season of reports would crowd
// out the schedule itself.

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

export function hasNote(notes, game) {
  return Boolean(str(noteFor(notes, game)?.text));
}

// Unread means: a coach has written something, and it changed after the last time a
// manager marked it read. Comparing timestamps rather than a boolean means a coach adding
// to a note the manager already read makes it unread again — which is the behaviour you
// want from something that is meant to be a conversation.
export function isUnread(note) {
  if (!note || !str(note.text)) return false;
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

// The stored shape. `updatedAt` moves on every save; `readAt` only when a manager marks it.
// `updatedAt` marks when the CONTENT last changed, not when save was last pressed. If it
// moved on every save, re-saving an unchanged note would push it back into the manager's
// unread queue — the note would keep asking to be read again without anyone writing a word.
export function buildNote(previous, { text, author, now }) {
  const body = str(text);
  const unchanged = previous && body === str(previous.text);
  return {
    text: body,
    author: str(author) || str(previous?.author),
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
