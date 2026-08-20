// Who may open the club, and how close the document is to Firestore's ceiling.
//
// Both of these lived only in the Firebase console until now: adding a coach meant
// editing a raw array by hand, which is how an address with a capital letter gets in and
// silently locks someone out — the security rules compare the address exactly as stored.
// Everything here normalises before it stores, so that cannot happen from the app.

// Firestore refuses a document over 1 MiB. Every club's data — teams, sessions, players,
// the lot — lives in one document, so this is a real ceiling rather than a theoretical one.
export const DOC_LIMIT_BYTES = 1024 * 1024;

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

// Would this change leave the club with nobody who can edit it? A club with no admins
// cannot be repaired from inside the app — the rules read the stored list to decide who
// may write, so the last manager removing themselves is a one-way door.
export function wouldLockOut(data, email) {
  const remaining = arr(revokeAccess(data, email).admins);
  return remaining.length === 0;
}

// Serialized size of the club document, the same way Firestore counts it closely enough
// to be useful as a warning.
export function documentBytes(data) {
  try {
    return new TextEncoder().encode(JSON.stringify(data ?? {})).length;
  } catch {
    return 0;
  }
}

export function sizeStatus(bytes) {
  const pct = bytes / DOC_LIMIT_BYTES;
  if (pct >= 0.8) return "critical";
  if (pct >= 0.5) return "warning";
  return "ok";
}
