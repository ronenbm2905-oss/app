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
// Longest name first, so "ברק מקורה 1" wins over the bare "ברק" when the venue text mentions
// both — otherwise the specific court loses to the building it is in.
export function matchHall(venueName, halls) {
  const v = withHallAliases(venueName).trim();
  if (!v) return "";
  const sorted = (Array.isArray(halls) ? halls : [])
    .filter((h) => h && h.name)
    .slice()
    .sort((a, b) => String(b.name).length - String(a.name).length);
  const hit = sorted.find((h) => {
    const name = withHallAliases(h.name);
    return v.includes(name) || name.includes(v);
  });
  return hit ? hit.id : "";
}
