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
export function tokenDoc({ token, coachId, email, now = new Date().toISOString() }) {
  return {
    token: str(token),
    coachId: str(coachId),
    email: str(email).toLowerCase(),
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
