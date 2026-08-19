import { coachForUser } from "./coachIdentity";

// The name the app greets you by on the home screen.
//
// Three sources, in order of how well the name fits the person being greeted:
//
//   1. The club's own coach record, matched on the email the coach signs in with. This
//      is the name the club calls them — "יוסי" rather than whatever their Google
//      account happens to be titled — so it wins whenever an admin has filled it in.
//   2. The Google display name.
//   3. The email local part, for accounts that never set a display name.
//
// Only the first word survives: "שלום, דני" is a greeting, "שלום, דני כהן" is a form field.
//
// Returns "" when there is nobody to greet — signed out, or local mode, whose synthetic
// user is named "מצב מקומי" and greeting it by that name would read as a bug.
export function greetingName(user, coaches) {
  if (!user || user.local) return "";

  const clubName = String(coachForUser(user, coaches)?.name || "").trim();
  if (clubName) return clubName.split(/\s+/)[0];

  const display = String(user.displayName || "").trim();
  if (display) return display.split(/\s+/)[0];

  const local = String(user.email || "").split("@")[0].trim();
  if (!local) return "";
  // ron.cohen / ron_cohen / ron-cohen → "Ron". Latin only: an address written in
  // Hebrew letters is not a thing, so capitalising is safe here.
  const first = local.split(/[._-]+/).filter(Boolean)[0] || local;
  return first.charAt(0).toUpperCase() + first.slice(1);
}
