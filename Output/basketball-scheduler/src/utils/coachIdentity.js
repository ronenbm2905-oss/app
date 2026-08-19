// Which coach record, if any, belongs to the person signed in.
//
// The email is the only reliable key. A Google account titled in Latin letters and a club
// record reading "יוסי לוי" will never match on name, so an unfilled email means "unknown"
// rather than a wrong guess — every caller treats that as "show the club-wide view", which
// is what the app did before any of this existed.
//
// Matching is case-insensitive on both sides: records saved before the field existed were
// never normalised, and Google hands the address back lower-case.
export function coachForUser(user, coaches) {
  if (!user || user.local) return null;

  const email = String(user.email || "").trim().toLowerCase();
  if (!email || !Array.isArray(coaches)) return null;

  return (
    coaches.find(
      (c) => c && String(c.email || "").trim().toLowerCase() === email
    ) || null
  );
}
