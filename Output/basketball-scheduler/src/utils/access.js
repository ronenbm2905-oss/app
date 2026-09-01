// Who may open the club.
//
// This lived only in the Firebase console until now: adding a coach meant editing a raw
// array by hand, which is how an address with a capital letter gets in and silently locks
// someone out — the security rules compare the address exactly as stored. Everything here
// normalises before it stores, so that cannot happen from the app.
//
// On a multi-club deployment the console is not an option at all: a club's own manager
// cannot be sent there, and routing every "add a coach" through the service operator makes
// support a bottleneck on the most routine act a club performs. This module is what makes
// a club self-sufficient.
//
// The document-size meter that sits beside this in the single-club branch is NOT here:
// `SettingsView` already has one, written for the club document that carries a logo and a
// settings block. Porting a second implementation would have given the same screen two
// answers to the same question.

const arr = (v) => (Array.isArray(v) ? v : []);

// Lowercased and trimmed, because that is what the rules compare against. Not a full
// RFC validator — just enough to catch a typo before it becomes a support call.
export function normalizeEmail(input) {
  return String(input || "").trim().toLowerCase();
}

export function isValidEmail(input) {
  const e = normalizeEmail(input);
  return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(e);
}

export const ROLES = { admin: "admins", member: "members" };

// A single address belongs to one role. Granting a role therefore removes the address
// from the other list — otherwise a coach promoted to manager stays in both, and which
// one wins becomes a question about rule ordering rather than about intent.
export function grantRole(data, email, role) {
  const e = normalizeEmail(email);
  const field = ROLES[role];
  if (!field || !isValidEmail(e)) return data;
  const admins = arr(data?.admins).filter((x) => normalizeEmail(x) !== e);
  const members = arr(data?.members).filter((x) => normalizeEmail(x) !== e);
  const next = { ...data, admins, members };
  next[field] = [...next[field], e];
  return next;
}

export function revokeAccess(data, email) {
  const e = normalizeEmail(email);
  return {
    ...data,
    admins: arr(data?.admins).filter((x) => normalizeEmail(x) !== e),
    members: arr(data?.members).filter((x) => normalizeEmail(x) !== e),
  };
}

// Entries already stored with different casing than the rules will accept. These look
// authorised in the list and are not — the failure the app cannot otherwise explain.
export function brokenEntries(data) {
  return [...arr(data?.admins), ...arr(data?.members)].filter(
    (e) => typeof e === "string" && e.trim() !== e.trim().toLowerCase()
  );
}

export function accessList(data) {
  const seen = new Set();
  const rows = [];
  for (const [role, field] of [["admin", "admins"], ["member", "members"]]) {
    for (const raw of arr(data?.[field])) {
      if (typeof raw !== "string" || !raw.trim()) continue;
      const email = raw.trim();
      const key = normalizeEmail(email);
      if (seen.has(key)) continue; // listed twice: show once, under the stronger role
      seen.add(key);
      rows.push({ email, role, needsFixing: email !== key });
    }
  }
  return rows;
}

// Would this change leave the club with nobody who can edit it?
//
// A one-way door, and more firmly so here than on the single-club branch. The rules read
// the stored list to decide who may write, and a service operator is NOT a way back in:
// `clubs/{clubId}` grants a super-admin `create` only, never `update`. So a club that
// removes its last manager cannot be repaired by the operator from the app either — only
// from the Firebase console, by hand, on a document belonging to someone else's club.
// That is why this refuses rather than warns.
export function wouldLockOut(data, email) {
  const remaining = arr(revokeAccess(data, email).admins);
  return remaining.length === 0;
}
