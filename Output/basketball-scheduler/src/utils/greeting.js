// The name the app greets you by on the home screen.
//
// Only the first word: "שלום, דני" is a greeting, "שלום, דני כהן" is a form field.
// Google's displayName is the name a coach recognises as their own; the email local
// part is the fallback for accounts that never set one.
//
// Returns "" when there is nobody to greet — signed out, or local mode, whose synthetic
// user is named "מצב מקומי" and greeting it by that name would read as a bug.
export function greetingName(user) {
  if (!user || user.local) return "";

  const display = String(user.displayName || "").trim();
  if (display) return display.split(/\s+/)[0];

  const local = String(user.email || "").split("@")[0].trim();
  if (!local) return "";
  // ron.cohen / ron_cohen / ron-cohen → "Ron". Latin only: an address written in
  // Hebrew letters is not a thing, so capitalising is safe here.
  const first = local.split(/[._-]+/).filter(Boolean)[0] || local;
  return first.charAt(0).toUpperCase() + first.slice(1);
}
