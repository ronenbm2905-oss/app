// Alphabetical by name, Hebrew-aware.
//
// `localeCompare` with "he" is what makes א before ב and puts a Latin-named coach in a
// stable place rather than wherever code points happen to fall. Copies first: the arrays
// handed in come straight off the club document, and sorting one in place would reorder
// what gets saved back.
//
// Entries without a usable name sink to the end instead of throwing — a half-typed record
// should not decide where the rest of the list sits.
export function sortByName(list) {
  return (Array.isArray(list) ? [...list] : []).sort((a, b) => {
    const an = String(a?.name || "").trim();
    const bn = String(b?.name || "").trim();
    if (!an && !bn) return 0;
    if (!an) return 1;
    if (!bn) return -1;
    return an.localeCompare(bn, "he");
  });
}
