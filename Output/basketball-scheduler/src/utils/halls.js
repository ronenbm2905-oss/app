// Matching the federation's name for a hall to ours.
//
// The federation publishes venues under the municipality's names, and those are not always
// the names the club uses on its own board. The hall everyone here calls **ברק** is
// published as "אולם עלומים, רח' הכפר 2, קריית אונו" — it is the same building; עלומים is
// simply the name it had before it was renamed (Ronen, 17.9.2026).
//
// Without this, a HOME fixture lands on the weekly board with no hall at all: the venue text
// matches nothing, `hallByName` returns empty, and the row appears with a blank where the
// room should be. Nobody gets an error; the game is just homeless.

// Old name → the name the club uses today. Text only, deliberately: a rename is about what
// a place is CALLED, and tying it to a hall id would break the first time a hall record is
// recreated.
export const HALL_RENAMES = [
  { was: "עלומים", now: "ברק", note: "אולם עלומים שונה לאולם ברק" },
];

export function withHallAliases(text) {
  let out = String(text || "");
  HALL_RENAMES.forEach(({ was, now }) => {
    out = out.split(was).join(now);
  });
  return out;
}

// Which of OUR halls a venue string means.
//
// AN EXACT NAME WINS, ALWAYS, AND THAT IS NOT A TIE-BREAK — it is the whole correctness of
// this function on a club whose halls are named in families:
//
//     ברק · ברק מקורה 1 · ברק מקורה 2 · ברק חד"כ
//     רימונים · רימונים מקורה
//
// The rule underneath is "longest name first", and it exists for venue TEXT that mentions
// both — "אולם ברק מקורה 1, רח' הכפר 2" has to resolve to the court and not to the building
// around it. But the match is two-directional, and the second direction is where it broke:
// with the venue "ברק", the longest hall whose NAME CONTAINS it is "ברק מקורה 1", and that
// won over the hall actually called ברק.
//
// The damage was silent and one screen away from where it was caused. A manual fixture
// stores the hall as TEXT, and `syncGamesToSessions` resolves that text back to an id — so
// a manager who picked ברק from a dropdown, saved, and looked at the board saw ברק מקורה 1.
// Same for רימונים. (Ronen, 23.9.2026.)
export function matchHall(venueName, halls) {
  const v = withHallAliases(venueName).trim();
  if (!v) return "";
  const list = (Array.isArray(halls) ? halls : []).filter((h) => h && h.name);

  const exact = list.find((h) => withHallAliases(h.name).trim() === v);
  if (exact) return exact.id;

  const sorted = list.slice().sort((a, b) => String(b.name).length - String(a.name).length);
  const hit = sorted.find((h) => {
    const name = withHallAliases(h.name);
    return v.includes(name) || name.includes(v);
  });
  return hit ? hit.id : "";
}
