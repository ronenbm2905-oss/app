// Join codes let a parent attach their account to one team without an admin having to
// approve each person by hand.
//
// The alphabet deliberately drops characters that get misread when a code is copied off
// a WhatsApp message or read aloud at a parents' evening: 0/O, 1/I/L, 5/S, 8/B.

// Excluded on purpose: 0/O, 1/I/L, 5/S, 8/B — each pair is easy to confuse in a
// screenshot or when read aloud.
const ALPHABET = "ACDEFGHJKMNPQRTUVWXY234679";
export const JOIN_CODE_LENGTH = 6;

// How many teams one parent account may link (siblings). Mirrored in firestore.rules —
// change both together. The cap exists so a leaked account cannot accumulate access to
// a whole club one code at a time.
export const MAX_PORTAL_TEAMS = 10;

export function generateJoinCode(randomFn) {
  const rnd = randomFn || ((n) => Math.floor(Math.random() * n));
  let out = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) out += ALPHABET[rnd(ALPHABET.length)];
  return out;
}

// What a parent types is normalised before comparison: people type lowercase and add
// spaces or hyphens ("abc-123").
//
// Deliberately NOT done here: mapping lookalike characters (0→O, 1→I) onto alphabet
// members. The alphabet already excludes every ambiguous character, so such a mapping
// could only ever turn one valid code into a DIFFERENT valid code — attaching a parent
// to the wrong team. A rejected code is a far better outcome than a silently wrong one.
export function normalizeJoinCode(input) {
  return String(input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, JOIN_CODE_LENGTH);
}

// Codes are compared after normalising BOTH sides, so a code generated before a
// normalisation tweak still matches what the parent types.
export function joinCodesMatch(typed, stored) {
  const a = normalizeJoinCode(typed);
  const b = normalizeJoinCode(stored);
  return a.length === JOIN_CODE_LENGTH && a === b;
}

// The team a typed code belongs to, or null.
export function teamForJoinCode(teams, typed) {
  if (normalizeJoinCode(typed).length !== JOIN_CODE_LENGTH) return null;
  return (teams || []).find((t) => t.joinCode && joinCodesMatch(typed, t.joinCode)) || null;
}

// Display form, grouped for readability: "ABC123" → "ABC-123".
export const formatJoinCode = (code) => {
  const c = String(code || "");
  return c.length === 6 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
};
