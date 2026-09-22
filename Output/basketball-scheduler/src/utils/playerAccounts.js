// A player's own account — the first time anyone outside the club's staff signs in here.
//
// THE PROBLEM THIS SOLVES, AND THE ONE IT MUST NOT CREATE
//
// A published team board (utils/teamBoard.js) is a link, and a link travels. That is fine
// for a training schedule and not fine for anything personal, so the board carries nothing
// personal at all. An account is the other half: a named person, revocable one at a time,
// who can be sent a notification and cannot pass their access to anyone else.
//
// The hard part is the FIRST login. A child signs in with Google and the club has no idea
// which of its players they are. Three answers were considered:
//
//   • Match on the phone number the club already holds. Rejected: phone numbers are known
//     to classmates, and nothing would stop one child claiming another.
//   • Have the manager link every sign-in by hand. Correct, and seventy times of work.
//   • A one-time code per player, handed out privately. Chosen.
//
// The code is a CAPABILITY, exactly like the board token: holding it is the proof. What
// makes it safe is that it names one player, is given to one person, and can be replaced.
// The security rules check it — the browser is never trusted to say which player it is.
//
// AGE: only squads the manager has explicitly opened, and only players who are 15 or older
// where a birth date is on file. Two gates rather than one, because a team list changes and
// an age does not: a younger child moved into an open squad must not silently become
// eligible for an account.

import { parseBirthDate } from "./dates.js";

const arr = (list) => (Array.isArray(list) ? list : []);

// No look-alikes (l/1/0/o), and read aloud without ambiguity — a coach will be reading these
// off a screen to a fifteen-year-old. Eight characters out of a 32-character alphabet is
// ~10^12 combinations, against a collection that cannot be listed.
const ALPHABET = "abcdefghijkmnopqrstuvwxyz2345678";
export const CODE_LENGTH = 8;

export function codeFrom(bytes) {
  return arr(bytes)
    .slice(0, CODE_LENGTH)
    .map((b) => ALPHABET[Math.abs(Number(b) || 0) % ALPHABET.length])
    .join("");
}

export function newClaimCode() {
  const a = new Uint8Array(CODE_LENGTH);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(a);
  else for (let i = 0; i < CODE_LENGTH; i++) a[i] = Math.floor(Math.random() * 256);
  return codeFrom([...a]);
}

// Typed by a person, so it is read forgivingly: case and spaces do not matter.
export function normalizeCode(input) {
  return String(input || "").toLowerCase().replace(/\s+/g, "");
}
export function isValidCode(input) {
  const c = normalizeCode(input);
  return c.length === CODE_LENGTH && [...c].every((ch) => ALPHABET.includes(ch));
}

// ── who may have one ─────────────────────────────────────────────────────────────────

export const MIN_AGE = 15;

export function accountTeams(data) {
  return arr(data?.playerAccountTeams).filter((x) => typeof x === "string" && x);
}
export function withAccountTeam(data, teamId, on) {
  const now = accountTeams(data).filter((t) => t !== teamId);
  return { ...data, playerAccountTeams: on ? [...now, teamId] : now };
}

// Read through the shared parser, because `birthDate` is stored in two formats and this
// one used to accept only ISO. Every player imported from Excel therefore had "no date on
// file" as far as the age gate was concerned, and `eligibleForAccount` returned false for
// all of them — which FAILED SAFE, so nothing was ever wrongly opened, and that is also
// why it was never noticed. The gate only starts doing its actual job here.
export function ageOn(birthDate, now = new Date()) {
  const born = parseBirthDate(birthDate)?.date;
  if (!born) return null;
  let age = now.getFullYear() - born.getFullYear();
  const beforeBirthday =
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

// A player with no birth date on file is NOT assumed old enough. The club knows the ages of
// the squads it opened; a missing field is a gap in the record, and reading it as "fine" is
// how a twelve-year-old ends up with an account.
export function eligibleForAccount(player, data, now = new Date()) {
  if (!player?.id || !player.teamId) return false;
  if (!accountTeams(data).includes(player.teamId)) return false;
  const age = ageOn(player.birthDate, now);
  return age !== null && age >= MIN_AGE;
}

export function eligiblePlayers(data, teamId, now = new Date()) {
  return arr(data?.players)
    .filter((p) => p && (!teamId || p.teamId === teamId))
    .filter((p) => eligibleForAccount(p, data, now));
}

// ── the two documents ────────────────────────────────────────────────────────────────

// clubs/{id}/claimCodes/{code} — readable ONLY by someone who already knows the code, and
// never listable. It says which player the code belongs to, and nothing about them.
export function claimDoc(player, now = new Date()) {
  return {
    playerId: String(player?.id || ""),
    teamId: String(player?.teamId || ""),
    createdAt: now.toISOString(),
  };
}

// clubs/{id}/playerAccounts/{uid} — one per signed-in person. `code` is kept so the rules
// can verify the claim at write time; the name is kept so a screen can greet them without
// reading the club document, which they cannot read at all.
export function accountDoc({ uid, player, code, email, name, now = new Date() }) {
  return {
    uid: String(uid || ""),
    playerId: String(player?.id || ""),
    teamId: String(player?.teamId || ""),
    code: normalizeCode(code),
    playerName: String(player?.name || ""),
    authorEmail: String(email || "").toLowerCase(),
    signedInAs: String(name || ""),
    linkedAt: now.toISOString(),
  };
}

// Which players already hold an account, for the manager's list.
export function linkedPlayerIds(accounts) {
  return new Set(arr(accounts).map((a) => String(a?.playerId || "")).filter(Boolean));
}
