import { changeLabel } from "./scheduleChanges.js";

// Who gets a phone notification, and what it says.
//
// Pure, and separated from anything that sends — because the sending half runs in a Cloud
// Function where it cannot be tested the way the rest of this app is tested, and the part
// most likely to be wrong is not the network call. It is "which coach hears about which
// change", and that is decided here, in a file `npm test` covers.
//
// The whole feature rides on `changes`, the log built at gate #11. A change was already
// diffed, already attributed to a coach, and a reassignment was already logged to BOTH the
// old coach and the new one. Nothing about push needed a second source of truth, and
// building one would have meant two answers to "what changed" that could disagree.

const arr = (list) => (Array.isArray(list) ? list : []);
const str = (v) => String(v ?? "").trim();

// A notification is worth interrupting someone for only if it is NEW.
//
// Entries are append-only and carry `at`, so "new" is everything stamped after the newest
// stamp already seen. Comparing the arrays themselves would be fragile: `trimChanges` drops
// old entries on every save, so a trimmed log looks like a changed log.
export function newEntriesSince(prevChanges, nextChanges) {
  const prev = arr(prevChanges);
  const next = arr(nextChanges);
  if (next.length === 0) return [];
  const newest = prev.reduce((max, e) => (str(e?.at) > max ? str(e.at) : max), "");
  if (!newest) return prev.length === 0 ? next.slice() : [];
  return next.filter((e) => str(e?.at) > newest);
}

// The quiet window — 22:00 to 07:00, Israel time.
//
// **There is no legislated right to disconnect in Israel**, and Adi said so explicitly: a
// notification at 23:00 is not an offence. This is risk management, and it is Ronen's
// decision, recorded. What it protects against is the thing that actually happens — a
// coach woken at midnight once turns the feature off for ever, and then misses the change
// that mattered.
//
// A change made inside the window is not dropped. It waits, and the morning job sends it.
export const QUIET_START_HOUR = 22;
export const QUIET_END_HOUR = 7;

// Israel time, whatever the server thinks it is. A Cloud Function runs in UTC, so asking
// the Date object for its own hour would silence 01:00–10:00 Israel time and wake people
// at 02:00 — the exact inverse of the intent.
export function israelHour(date = new Date()) {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    hour12: false,
  }).format(date instanceof Date ? date : new Date(date));
  return Number(h) % 24;
}

export function inQuietWindow(date = new Date()) {
  const h = israelHour(date);
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
}

// How old a change may be and still be worth interrupting someone for.
//
// Two different failures land here. A restored backup or a migration arrives with no
// `before` snapshot, so every entry in the log looks new — up to 150 of them, a month old.
// And the morning job, after a quiet night, must send last night's changes and not last
// week's. A notification about a change from two weeks ago is not a notification.
export const MAX_AGE_HOURS = 12;

export function isFresh(entry, now = new Date(), maxAgeHours = MAX_AGE_HOURS) {
  const at = Date.parse(str(entry?.at));
  if (!Number.isFinite(at)) return false;
  const age = (now instanceof Date ? now.getTime() : Date.parse(now)) - at;
  return age >= 0 && age <= maxAgeHours * 3600 * 1000;
}

export function freshEntries(entries, now = new Date(), maxAgeHours = MAX_AGE_HOURS) {
  return arr(entries).filter((e) => isFresh(e, now, maxAgeHours));
}

// One notification per coach, however many of their sessions moved.
//
// Five separate buzzes for one evening's re-shuffle is how a person turns notifications off
// for an app, and then misses the one that mattered. So the entries are grouped and the
// body says how many — the detail is in the app, which is where they are heading anyway.
//
// A change with no coach (a bulk paste, a team with no coach assigned) is deliberately NOT
// broadcast to everyone. An interruption addressed to nobody in particular is the fastest
// way to teach people the interruption is noise.
export function notificationsFor(entries, names = {}) {
  const byCoach = new Map();
  arr(entries).forEach((e) => {
    const coachId = str(e?.coachId);
    if (!coachId) return;
    if (!byCoach.has(coachId)) byCoach.set(coachId, []);
    byCoach.get(coachId).push(e);
  });

  return [...byCoach.entries()].map(([coachId, list]) => ({
    coachId,
    title: "שינוי בלו״ז שלך",
    body:
      list.length === 1
        ? changeLabel(list[0], names)
        : `${list.length} שינויים באימונים שלך. ${changeLabel(list[0], names)}`,
    count: list.length,
  }));
}

// The device rows to send to, for one coach.
//
// Tokens are stored per DEVICE, not per person: a coach with a phone and a tablet has two,
// and revoking one must not silence the other. `email` is carried so a token can be traced
// back to a person when it starts failing, and `coachId` so this lookup costs nothing.
export function tokensForCoach(tokenRows, coachId) {
  const id = str(coachId);
  if (!id) return [];
  return arr(tokenRows)
    .filter((r) => r && str(r.coachId) === id && str(r.token))
    .map((r) => str(r.token));
}

// The document written when a coach turns notifications on.
//
// Keyed by the token itself, because that is what FCM invalidates — when a token dies the
// thing to delete is identified by the token, not by the person.
//
// THE FIELD IS `authorEmail`, AND THAT NAME IS NOT A PREFERENCE. Every ownership rule in
// `firestore.rules` reads `authorEmail` — `ownsExisting()` and `ownsIncoming()` are
// written once and reused by every collection. Storing this row under `email` would give
// a rules block that reviews cleanly, looks identical to the others, and fails only at
// run time: the coach could not delete their own row, which means **they could not turn
// notifications off**. The promise in privacy policy §2ז would be unkeepable by a field
// name. (Adi, push gate, M1א.)
export function tokenDoc({ token, coachId, email, now = new Date().toISOString() }) {
  return {
    token: str(token),
    coachId: str(coachId),
    authorEmail: str(email).toLowerCase(),
    updatedAt: now,
  };
}

// Tokens FCM reported as dead. Deleting them is not tidiness: a token that keeps failing
// makes every later send slower and noisier, and the failure looks like "the feature is
// broken" long before anyone checks why.
export const DEAD_TOKEN_CODES = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
];

export function isDeadToken(error) {
  const code = str(error?.code || error?.errorInfo?.code).toLowerCase();
  return DEAD_TOKEN_CODES.some((c) => code === c);
}
