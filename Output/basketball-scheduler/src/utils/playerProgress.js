// A coach's half-season note on how a player is progressing, read by the professional
// manager and by nobody else.
//
// Lives in its own subcollection, one document per player per half:
// clubs/{id}/playerProgress/{playerId}__{period}. Not on the club document — that is
// already 78 KB of a 1 MB ceiling and `sessions` alone will take most of the rest before
// the season is out.
//
// **The player's NAME is deliberately not stored here.** Only `playerId`. The name lives
// once, on the club document, and copying it into a second place would put a minor's
// details somewhere else to find and somewhere else to forget. It also makes a parent's
// deletion request a single lookup by id, instead of the roster-scan the deletion
// procedure has to prescribe for `gameNotes`. The cost — a note whose player has left the
// club shows no name — is the behaviour we want: the record goes anonymous by itself.
//
// **No rating, no scale, no tags.** A number on a child is a profile; a paragraph is a
// conversation, and a conversation between the coach and the manager is the whole point.

const str = (v) => String(v ?? "").trim();
const arr = (v) => (Array.isArray(v) ? v : []);

// The season opens in AUGUST, not September. Youth clubs here start pre-season in August,
// and a season that began in September would file a training from the 20th of August under
// the *previous* season — where the end-of-season purge would delete it a fortnight after
// it was written.
export const SEASON_START_MONTH = 8;
// And the second half opens in February: six months and six months, so every date in the
// calendar belongs to exactly one half and none is orphaned. Splitting by the league's
// first/second round was considered and rejected — the turn falls in a different week for
// every age group, it is nowhere in our data, and it would need a table for someone to
// keep up to date. This has to be decidable from the date alone.
export const HALF_B_START_MONTH = 2;

// Long enough for a real paragraph, short enough that nobody mistakes the box for a file.
export const MAX_LEN = 1500;

// "YYYY-MM-DD" → { y, m } or null. Validates the RANGE and not merely the shape: without
// it "2026-13-01" parses happily and lands in a season that does not exist.
function parts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(iso));
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  // Reject a day that does not exist in that month (30 February).
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
  return { y, mo };
}

// "2026-09-15" → "2026-27"
export function seasonOf(iso) {
  const p = parts(iso);
  if (!p) return "";
  const start = p.mo >= SEASON_START_MONTH ? p.y : p.y - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

// "A" for August–January, "B" for February–July.
export function halfOf(iso) {
  const p = parts(iso);
  if (!p) return "";
  return p.mo >= SEASON_START_MONTH || p.mo < HALF_B_START_MONTH ? "A" : "B";
}

// "2026-09-15" → "2026-27-A"
export function periodOf(iso) {
  const season = seasonOf(iso);
  const half = halfOf(iso);
  return season && half ? `${season}-${half}` : "";
}

// "2026-27-A" → "2026-27". A slice, not a recomputation — so it cannot drift from the
// value it was built from, which is what makes the retention promise checkable.
export function seasonOfPeriod(periodId) {
  const s = str(periodId);
  return /^\d{4}-\d{2}-[AB]$/.test(s) ? s.slice(0, -2) : "";
}

export function periodsOfSeason(season) {
  const s = str(season);
  return /^\d{4}-\d{2}$/.test(s) ? [`${s}-A`, `${s}-B`] : [];
}

// "2026-27-A" → "חציון א׳ · עונת 2026/27"
export function periodLabel(periodId) {
  const season = seasonOfPeriod(periodId);
  if (!season) return "";
  const half = str(periodId).slice(-1) === "A" ? "א׳" : "ב׳";
  return `חציון ${half} · עונת ${season.replace("-", "/")}`;
}

// The document id. Player ids come from `uid()` — eight lower-case alphanumerics, never a
// double underscore — so the separator is safe and the key is reversible.
export function progressKey(playerId, period) {
  const p = str(playerId), q = str(period);
  return p && q ? `${p}__${q}` : "";
}

export function parseProgressKey(key) {
  const i = str(key).indexOf("__");
  if (i <= 0) return null;
  const playerId = str(key).slice(0, i);
  const period = str(key).slice(i + 2);
  return playerId && period ? { playerId, period } : null;
}

// Lower-cased because the rules compare strings exactly while the rest of the app treats
// e-mail case-insensitively — a capital letter would lock a coach out of their own writing
// with nothing on screen to explain it. Same reasoning as `gameNotes.normalizeEmail`.
export function normalizeEmail(email) {
  return str(email).toLowerCase();
}

export function hasContent(entry) {
  return Boolean(str(entry?.text));
}

export function progressFor(map, playerId, period) {
  const k = progressKey(playerId, period);
  return k ? (map || {})[k] || null : null;
}

// `updatedAt` marks when the CONTENT last changed, not when save was last pressed — the
// lesson already paid for in `buildNote`. Without it, re-saving an unchanged note pushes it
// back into the manager's unread queue and the note keeps asking to be read again with
// nobody having written a word.
//
// `authorEmail` falls back to the previous value rather than to empty: a save that cleared
// it would fail the ownership rule on the NEXT write and drop the record out of the coach's
// own filtered listen — they would simply stop seeing what they wrote.
export function buildProgress(previous, { text, playerId, teamId, period, author, authorEmail, now }) {
  const body = str(text).slice(0, MAX_LEN);
  const unchanged = previous && body === str(previous.text);
  return {
    playerId: str(playerId) || str(previous?.playerId),
    teamId: str(teamId) || str(previous?.teamId),
    period: str(period) || str(previous?.period),
    text: body,
    author: str(author) || str(previous?.author),
    authorEmail: normalizeEmail(authorEmail) || str(previous?.authorEmail),
    createdAt: previous?.createdAt || now,
    updatedAt: unchanged ? previous.updatedAt || now : now,
    // A real edit puts it back in front of the manager; an identical save does not.
    readAt: unchanged ? previous.readAt || null : null,
  };
}

export function markRead(entry, now) {
  return entry ? { ...entry, readAt: now } : entry;
}

export function isUnread(entry) {
  if (!hasContent(entry)) return false;
  if (!entry.readAt) return true;
  return String(entry.updatedAt || "") > String(entry.readAt);
}

export function unreadCount(map) {
  return Object.values(map || {}).filter(isUnread).length;
}

// The roster this screen is allowed to render: **id, team and name, and nothing else.**
//
// Note carefully what this is and is not. It is not a security boundary — `players` is an
// array on the club document, every allowlisted member's SDK holds the whole thing in
// memory already, and no Firestore rule can reach inside an array of maps. What it is, is
// this screen physically never holding a phone number, a birth date or a clothing size, in
// a way a test can assert. The players tab stays admin-only exactly as it was; this feature
// does not open it.
export function rosterFor(players, teamIds) {
  const allowed = new Set(arr(teamIds).filter(Boolean));
  return arr(players)
    .filter((p) => p && p.id && allowed.has(p.teamId))
    .map((p) => ({ id: p.id, teamId: p.teamId, name: str(p.name) }));
}

// Two players called "יוסי לוי" in one squad are indistinguishable in a list, and writing
// the wrong one's progress is not a mistake anybody catches. Only the ambiguous ones carry
// a shirt number — adding it to every row would be noise.
export function playerLabel(player, roster) {
  const name = str(player?.name);
  if (!name) return "—";
  const twins = arr(roster).filter((p) => str(p.name) === name).length > 1;
  const shirt = str(player?.jerseyNumber);
  return twins && shirt ? `${name} (${shirt})` : name;
}

// Who still has nothing written for this half. This is the list the manager actually acts
// on, and the count the coach works down.
export function missingFor(roster, map, period) {
  return arr(roster).filter((p) => !hasContent(progressFor(map, p.id, period)));
}

export function writtenCount(roster, map, period) {
  return arr(roster).length - missingFor(roster, map, period).length;
}
