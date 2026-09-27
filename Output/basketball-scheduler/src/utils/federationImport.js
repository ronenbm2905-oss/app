// Turning the federation's weekly file into a proposal a human can approve.
//
// Extracted verbatim from `scripts/prepare-import.mjs` on 27.9.2026 so that the script and
// the Cloud Function build proposals the same way. The logic below is unchanged — what
// changed is where it can run.
//
// The rule it exists to protect is older than this file: NOTHING HERE WRITES TO THE CLUB
// DOCUMENT. It reads the club, works out what the new file would change, and returns that
// as a proposal. The only write to clubs/{id} stays where it has always been — a person
// pressing save in the app — because useClubData.js writes the document WHOLE, and anything
// automated writing there would erase a manager mid-edit with no error and no trace.

import { importGamesFile, findCancelledGames } from "./games.js";
import { parseDateDMY } from "./dates.js";

// The only fields the import needs, checked against what games.js actually reads.
//
// Fetching the club document whole would carry players[] — the names, phone numbers and
// birth dates of children — out of Firestore for nothing: no step here touches them. A
// projection means they never leave the database at all, which is a stronger guarantee than
// deleting them after they arrive.
export const NEEDED = ["games", "gameMapping", "teams", "halls", "sessions"];

// The fields that describe the fixture itself. A change in any of them is something the
// manager should see; anything else on the record is ours, not the federation's.
export const WATCHED = [
  "date", "time", "weekDay", "isHome", "opponent", "venue", "league", "round", "ourScore", "theirScore",
];

export const LABELS = {
  date: "תאריך", time: "שעה", weekDay: "יום", isHome: "בית/חוץ", opponent: "יריבה",
  venue: "מיקום", league: "ליגה", round: "מחזור", ourScore: "התוצאה שלנו", theirScore: "התוצאה שלהם",
};

const shown = (v) =>
  v === null || v === undefined || v === "" ? "—" : typeof v === "boolean" ? (v ? "בית" : "חוץ") : String(v);

function describe(game, teams) {
  const team = (teams || []).find((t) => t.id === game.teamId);
  return [team?.name, game.date, game.opponent && `נגד ${game.opponent}`].filter(Boolean).join(" · ");
}

const dayId = (now = new Date()) => now.toISOString().slice(0, 10);

export function buildProposal(rows, data, { sourceFile, sourceHash, now = new Date() } = {}) {
  const current = data.games || [];
  const byCode = new Map(current.map((g) => [String(g.federationCode), g]));

  const result = importGamesFile(rows, data);
  if (result.error) throw new Error(`the club has no code mapping yet (${result.error})`);

  const added = [];
  const updated = [];
  for (const next of result.nextGames) {
    const code = String(next.federationCode);
    const before = byCode.get(code);
    if (!before) {
      added.push({ code, label: describe(next, data.teams), game: next });
      continue;
    }
    const changed = WATCHED.filter((f) => shown(before[f]) !== shown(next[f]));
    if (changed.length) {
      updated.push({
        code,
        label: describe(next, data.teams),
        // Only the fields that moved, in both states. Applying these onto whatever the club
        // holds at approval time is what keeps a proposal built at 03:00 from overwriting an
        // edit made at 08:00.
        fields: changed.map((f) => ({
          key: f, label: LABELS[f] || f, before: shown(before[f]), after: shown(next[f]), value: next[f],
        })),
      });
    }
  }

  const off = findCancelledGames(current, rows, data);
  const cancelled = off.cancelled.map((code) => ({
    code, label: describe(byCode.get(code) || { federationCode: code }, data.teams),
  }));
  const restored = off.restored.map((code) => ({
    code, label: describe(byCode.get(code) || { federationCode: code }, data.teams),
  }));

  return {
    id: dayId(now),
    status: "pending",
    fetchedAt: now.toISOString(),
    sourceFile,
    sourceHash,
    summary: {
      added: added.length,
      updated: updated.length,
      cancelled: cancelled.length,
      restored: restored.length,
      suspicious: off.suspicious,
      ratio: Math.round((off.ratio || 0) * 100),
    },
    scope: off.scope || null,
    added,
    updated,
    cancelled,
    restored,
  };
}

// A Firestore document stops at 1MB. The first proposal of a season is the only one likely
// to come close, and a truncated proposal is far better than a write that simply fails.
const MAX_BYTES = 800 * 1024;

const byteLength = (obj) => {
  const json = JSON.stringify(obj);
  // Buffer where there is one (Node, and the Cloud Function); TextEncoder otherwise. The
  // difference matters: `.length` counts CHARACTERS, and Hebrew is two bytes in UTF-8, so a
  // proposal measured with `.length` reads as 40% smaller than it is. That exact mistake was
  // made measuring the club document on 22.9.2026.
  return typeof Buffer !== "undefined" ? Buffer.byteLength(json) : new TextEncoder().encode(json).length;
};

export function trim(proposal) {
  let size = byteLength(proposal);
  if (size <= MAX_BYTES) return { proposal, trimmed: false, size };
  const out = { ...proposal, truncated: true };
  while (byteLength(out) > MAX_BYTES && out.added.length > 20) {
    out.added = out.added.slice(0, Math.floor(out.added.length / 2));
  }
  while (byteLength(out) > MAX_BYTES && out.updated.length > 20) {
    out.updated = out.updated.slice(0, Math.floor(out.updated.length / 2));
  }
  return { proposal: out, trimmed: true, size: byteLength(out) };
}

// The dates the sheet actually covers, read through the same importer the app uses so the
// answer matches what would be imported rather than what the raw cells look like.
//
// The federation publishes one season at a time and the export carries no season parameter —
// asking for a different one is silently ignored. So the only way to know the file is still
// last season's is to look at the dates inside it.
export function seasonSpan(rows, data) {
  const fresh = importGamesFile(rows, { ...data, games: [] });
  if (fresh.error) return null;
  const dates = fresh.nextGames.map((g) => parseDateDMY(g.date)).filter(Boolean).map((d) => d.getTime());
  if (!dates.length) return null;
  const from = Math.min(...dates);
  const to = Math.max(...dates);
  const fmt = (t) => new Date(t).toLocaleDateString("he-IL");
  return { from, to, label: `${fmt(from)} → ${fmt(to)}` };
}

// Everything above, in the order the nightly job needs it, with the outcome named rather
// than signalled by an exit code. The caller decides what to do about each state; this
// decides which state it is, and it is the same decision in both places it runs.
//
//   "stale"   the file still covers a season that finished — do not file anything
//   "none"    the file changes nothing
//   "ready"   there is a proposal to file
export function prepareProposal(rows, data, { sourceFile, sourceHash, now = new Date(), allowPast = false } = {}) {
  // Left unguarded, the very first night of a new season would file a proposal to import a
  // few hundred games that are already over, and every night after would do it again until
  // someone accepted or rejected it.
  const span = seasonSpan(rows, data);
  if (span && span.to < now.getTime() && !allowPast) {
    return { state: "stale", span, proposal: null };
  }

  const proposal = buildProposal(rows, data, { sourceFile, sourceHash, now });
  const s = proposal.summary;
  if (!s.added && !s.updated && !s.cancelled && !s.restored) {
    return { state: "none", span, proposal };
  }

  return { state: "ready", span, proposal };
}

// May today's proposal be written over the one already there?
//
// `pendingImports/{date}` is keyed by the day, and `usePendingImport.js` records the
// manager's decision ON that document: `status`, `resolvedAt`, `resolvedBy`. A second run
// the same day used to `.set()` the whole thing again with `status: "pending"` — the banner
// comes back, and the record of who dealt with it and when is gone.
//
// This is the league-side twin of `mayOverwriteScan` in cupScan.js, and it became worth
// having on 27.9.2026 for the same reason: until then one machine ran the job, and now the
// cloud does too.
//
// WHY SKIPPING IS SAFE, and it is worth being precise because the two halves differ. A cup
// proposal skipped today is re-offered tomorrow. A league proposal is not even a loss of a
// day: `prepareProposal` compares the file against the CLUB DOCUMENT, so anything still
// genuinely outstanding reappears in tomorrow's proposal by construction. What would be
// lost by overwriting — a named person's decision — cannot be reconstructed at all.
export function mayOverwriteProposal(existing) {
  if (!existing) return true;
  return !existing.status || existing.status === "pending";
}
