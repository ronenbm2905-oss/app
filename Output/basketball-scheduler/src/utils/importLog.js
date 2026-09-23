// What was actually approved from a federation file, written down at the moment it was
// approved.
//
// WHY THE PROPOSAL ITSELF IS NOT THIS RECORD, which is the whole reason this file exists.
// `pendingImports` holds one document PER DATE, and two things happen to it:
//
//   • **It is overwritten.** Every run that finds a change refiles the same day's document.
//     On 23.9.2026 the morning's proposal (one cancelled fixture, approved at 09:10) was
//     gone by the evening, replaced by a later run with seven changes. Measured, not feared.
//   • **It shrinks.** `withoutCodes` removes what has been approved so the banner's count
//     stays true — so a proposal handled squad by squad keeps only the last squad.
//
// Either one alone would make it a poor record of decisions. What survives in the proposal
// is who resolved it and when, and the code comment there says why that matters: the case
// for letting a background job near this data at all is that a named person approved every
// change. That claim needs something to point at.
//
// So: one entry per APPROVAL ACTION, never touched again. A season approved squad by squad
// produces one entry per squad, which is what happened rather than a tidier summary of it.

const arr = (list) => (Array.isArray(list) ? list : []);

// The fixture as the log keeps it: what the reader needs to recognise it, and nothing else.
// NOT the whole `game` object the proposal carries — that is the payload for applying the
// change, it is several times the size, and a record that grows with the schema is a record
// that eventually holds something nobody decided to keep.
function slim(item) {
  return {
    code: String(item?.code ?? ""),
    // Already written for a person by the nightly job:
    // "קטסל א עידו · 13-10-2026 · נגד אליצור גבעת שמואל".
    label: String(item?.label ?? ""),
    teamId: String(item?.game?.teamId ?? item?.teamId ?? ""),
  };
}

export const LOG_KINDS = ["added", "updated", "cancelled", "restored"];

export const KIND_LABELS = {
  added: "נוספו",
  updated: "שונו",
  cancelled: "בוטלו",
  restored: "חזרו",
};

// `codes = null` means the whole proposal was approved in one go; an array means this squad
// or this selection. The SAME argument `approve()` passes to `applyProposal`, so the log
// cannot describe something different from what was written to the board.
export function importLogEntry(proposal, codes, { at, by }) {
  const only = codes === null || codes === undefined ? null : new Set([...codes].map(String));
  const take = (list) => arr(list).filter((x) => !only || only.has(String(x?.code))).map(slim);

  const entry = {
    at: String(at || ""),
    // LOWER-CASED HERE, and it is not tidiness. `firestore.rules` binds this field to the
    // signed-in address through `myEmail()`, which lower-cases — so a manager whose Google
    // address carries a capital letter would be refused on every approval, and the only
    // sign of it would be the amber "could not write to the log" line with no reason in it.
    // The same trap is written at the top of `firestore.rules`, where it was added after it
    // had already happened once.
    by: String(by || "").trim().toLowerCase(),
    // The date the file was fetched under. Not unique — the same day can be approved twice —
    // which is exactly why this is a field and not the document id.
    proposalId: String(proposal?.id || ""),
    sourceFile: String(proposal?.sourceFile || ""),
    // `partial` is not cosmetic. A reader who sees three entries on one date needs to know
    // whether that is three files or one file approved in three sittings.
    partial: Boolean(only),
  };

  let total = 0;
  for (const kind of LOG_KINDS) {
    entry[kind] = take(proposal?.[kind]);
    total += entry[kind].length;
  }
  entry.total = total;
  return entry;
}

// Nothing was approved — the caller should not write an entry at all. A log of empty
// decisions is a log nobody reads, and it would fire on the "already applied" path where a
// proposal is resolved without changing anything.
export function isEmptyEntry(entry) {
  return !entry || entry.total === 0;
}

// "3 נוספו · 1 בוטל" — the counts that are not zero, in a fixed order so two entries can be
// compared at a glance.
export function entrySummary(entry) {
  const parts = [];
  for (const kind of LOG_KINDS) {
    const n = arr(entry?.[kind]).length;
    if (n > 0) parts.push(`${n} ${KIND_LABELS[kind]}`);
  }
  return parts.join(" · ") || "ללא שינוי";
}

// Newest first. Entries carry an ISO timestamp, which sorts lexicographically, and an entry
// with no timestamp sorts LAST rather than first — a broken record at the top of a list is
// how a manager concludes the whole screen is broken.
export function sortEntries(entries) {
  return arr(entries)
    .filter(Boolean)
    .slice()
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
}

// THE TIMESTAMP IS UTC, AND EVERY PLACE THAT SHOWS IT HAS TO SAY SO IN ISRAEL TIME.
//
// `at` is `new Date().toISOString()`. Slicing that string — `at.slice(11,16)` for the hour,
// `at.slice(0,10)` for the day — prints UTC while looking exactly like a local clock. An
// approval given at 09:10 would have read 06:10, and one given at 23:30 would have been
// filed under the previous day. The whole value of this record is that it says WHEN.
//
// Pinned to Asia/Jerusalem rather than left to the device: the club is in one place, and a
// manager reading the log from abroad should see the hour the decision was actually made.
// Same call `pushTargets.js` makes for the quiet window, and for the same reason.
//
// The SORT still compares the raw ISO strings, which is correct — they are all UTC, so
// lexicographic order is chronological order. Only display and grouping were wrong.
const TZ = { timeZone: "Asia/Jerusalem" };

export function localTime(iso) {
  const d = new Date(iso || "");
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("he-IL", { ...TZ, hour: "2-digit", minute: "2-digit", hour12: false });
}

// "23/09/2026" — the day the decision was made, where it was made.
export function localDay(iso) {
  const d = new Date(iso || "");
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("he-IL", { ...TZ, day: "2-digit", month: "2-digit", year: "numeric" });
}

// Grouped by calendar day for the screen, because "what came in on Tuesday" is the question
// asked, and one file can produce several entries.
export function entriesByDay(entries) {
  const out = [];
  const index = new Map();
  for (const e of sortEntries(entries)) {
    const day = localDay(e.at) || "—";
    if (!index.has(day)) {
      index.set(day, { day, entries: [], total: 0 });
      out.push(index.get(day));
    }
    const bucket = index.get(day);
    bucket.entries.push(e);
    bucket.total += Number(e.total) || 0;
  }
  return out;
}
