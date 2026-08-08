// Which club a URL refers to.
//
// The club is resolved at runtime from the path rather than baked into the build, so
// one deployment serves every club:
//     /            → DEFAULT_CLUB_ID   (kept so existing links keep working)
//     /c/<slug>    → that club
//
// The slug becomes a Firestore document id, so it is validated rather than trusted:
// a bad value should produce a clear "club not found" screen, not a malformed read.

export const CLUB_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

// Firestore rejects these outright; listing them keeps the failure legible.
const RESERVED = new Set([".", "..", "__proto__", "config", "portalusers"]);

export function isValidClubSlug(slug) {
  const s = String(slug || "").toLowerCase();
  if (!CLUB_SLUG_PATTERN.test(s)) return false;
  if (RESERVED.has(s)) return false;
  return true;
}

// Normalises what a user might type into what we store ("Hapoel Holon" → "hapoel-holon").
export function toClubSlug(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export const clubPath = (slug) => `/c/${slug}`;
