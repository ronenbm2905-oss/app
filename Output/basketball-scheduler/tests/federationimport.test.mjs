// The three-way decision the nightly job makes about the federation's file.
//
// Lifted out of `scripts/prepare-import.mjs` on 27.9.2026 so the script and the Cloud
// Function decide identically. It had never been under test, because it lived inside a
// script's `main()` — and it is the code that decides whether a manager is asked to approve
// something at all.

import assert from "node:assert/strict";
import {
  prepareProposal, buildProposal, trim, seasonSpan, NEEDED, WATCHED, mayOverwriteProposal,
} from "../src/utils/federationImport.js";

let n = 0;
const T = (name, fn) => { fn(); n++; console.log("  ok  " + name); };

const HEAD = ["Code", "תאריך", "Time", "Home Team Code", "Away Team Code", "Venue", "Home Team", "Away Team"];
const OURS = "715510";
const row = (code, date, time = "18:00", venue = "אולם ברק", away = "715511") =>
  [code, date, time, OURS, away, venue, "עירוני ק. אונו", "מכבי רעננה"];

const club = (games = []) => ({
  games,
  gameMapping: [{ federationCodes: [OURS], teamId: "t1" }],
  teams: [{ id: "t1", name: "קטסל א" }],
  halls: [{ id: "h1", name: "אולם ברק" }],
  sessions: [],
});

const NOW = new Date(2026, 8, 27, 3, 0);

T("a file covering a season that already finished is `stale` — nothing is filed", () => {
  // The export carries no season parameter, so on the first night of a new season the file
  // is still last year's. Unguarded, night one would propose importing a few hundred games
  // that are already over, and every night after would do it again.
  const rows = [HEAD, row("800001", "13-10-2025"), row("800002", "20-10-2025")];
  const out = prepareProposal(rows, club(), { sourceFile: "x.xlsx", sourceHash: "h", now: NOW });
  assert.equal(out.state, "stale");
  assert.equal(out.proposal, null);
  assert.match(out.span.label, /2025/);
});

T("and `--allow-past` overrides it, because sometimes that IS the import you want", () => {
  const rows = [HEAD, row("800001", "13-10-2025")];
  const out = prepareProposal(rows, club(), { sourceFile: "x.xlsx", sourceHash: "h", now: NOW, allowPast: true });
  assert.equal(out.state, "ready");
});

T("a file that changes nothing is `none` — and still builds the proposal to prove it", () => {
  const rows = [HEAD, row("800001", "13-10-2026")];
  const first = prepareProposal(rows, club(), { sourceFile: "x.xlsx", sourceHash: "h", now: NOW });
  assert.equal(first.state, "ready", "against an empty club, the fixture is new");

  const after = club(first.proposal.added.map((a) => a.game));
  const second = prepareProposal(rows, after, { sourceFile: "x.xlsx", sourceHash: "h", now: NOW });
  assert.equal(second.state, "none");
  assert.equal(second.proposal.summary.added, 0);
  assert.equal(second.proposal.summary.updated, 0);
});

T("a fixture whose TIME moved is reported with both states, not just the new one", () => {
  // The proposal carries before AND after for every field that moved, and applying only
  // those onto whatever the club holds at approval time is what stops a proposal built at
  // 03:00 from overwriting an edit made at 08:00.
  const rows = [HEAD, row("800001", "13-10-2026", "18:00")];
  const seeded = club(prepareProposal(rows, club(), { sourceFile: "x", sourceHash: "h", now: NOW }).proposal.added.map((a) => a.game));

  const moved = [HEAD, row("800001", "13-10-2026", "20:30")];
  const out = prepareProposal(moved, seeded, { sourceFile: "x", sourceHash: "h", now: NOW });
  assert.equal(out.state, "ready");
  assert.equal(out.proposal.summary.updated, 1);
  const f = out.proposal.updated[0].fields.find((x) => x.key === "time");
  assert.equal(f.before, "18:00");
  assert.equal(f.after, "20:30");
  assert.equal(f.label, "שעה");
});

T("the proposal id is the DAY, so a second run replaces rather than stacks", () => {
  const rows = [HEAD, row("800001", "13-10-2026")];
  const a = prepareProposal(rows, club(), { sourceFile: "x", sourceHash: "h", now: NOW });
  const b = prepareProposal(rows, club(), { sourceFile: "x", sourceHash: "h", now: new Date(2026, 8, 27, 22, 0) });
  assert.equal(a.proposal.id, b.proposal.id);
  assert.equal(a.proposal.id, "2026-09-27");
});

T("`NEEDED` does not ask for players, and that is the guarantee not the intention", () => {
  // The projection is what keeps children's names, phones and birth dates inside the
  // database. A field added here without thought would undo it silently.
  assert.equal(NEEDED.includes("players"), false);
  assert.deepEqual(NEEDED, ["games", "gameMapping", "teams", "halls", "sessions"]);
});

T("the watched fields are the federation's, never ours", () => {
  // driverName/driverPhone, hallId, notes and the rest belong to the club. If one crept in
  // here, every nightly run would propose undoing a manager's own edit.
  for (const ours of ["driverName", "driverPhone", "hallId", "notes", "departBeforeMin"]) {
    assert.equal(WATCHED.includes(ours), false, `${ours} is ours, not the federation's`);
  }
});

T("a club with no code mapping fails loudly rather than proposing nonsense", () => {
  const rows = [HEAD, row("800001", "13-10-2026")];
  assert.throws(
    () => buildProposal(rows, { ...club(), gameMapping: [] }, { sourceFile: "x", sourceHash: "h", now: NOW }),
    /code mapping/
  );
});

T("an oversized proposal is trimmed rather than failing the write", () => {
  // A Firestore document stops at 1MB. The first proposal of a season is the only one
  // likely to come close, and a truncated proposal beats a write that simply fails.
  const big = {
    id: "2026-09-27", summary: {}, cancelled: [], restored: [],
    added: Array.from({ length: 4000 }, (_, i) => ({
      code: String(i), label: "קטסל א · 13-10-2026 · נגד מכבי רעננה שם ארוך למדי",
      game: { federationCode: String(i), opponent: "מכבי רעננה", venue: "אולם ברק מקורה 1" },
    })),
    updated: [],
  };
  const out = trim(big);
  assert.equal(out.trimmed, true);
  assert.equal(out.proposal.truncated, true);
  assert.equal(out.size <= 800 * 1024, true);
  assert.equal(out.proposal.added.length >= 20, true, "it trims, it does not empty");
});

T("a proposal that fits is returned untouched, with no `truncated` flag", () => {
  const small = { id: "d", added: [], updated: [], cancelled: [], restored: [], summary: {} };
  const out = trim(small);
  assert.equal(out.trimmed, false);
  assert.equal(out.proposal.truncated, undefined);
});

T("SIZE IS MEASURED IN BYTES, NOT CHARACTERS — Hebrew is two bytes in UTF-8", () => {
  // Measuring with `.length` reads a Hebrew payload as ~40% smaller than it is. That exact
  // mistake was made measuring the club document on 22.9.2026.
  const hebrew = { id: "d", added: [], updated: [], cancelled: [], restored: [], note: "ש".repeat(1000) };
  const out = trim(hebrew);
  assert.equal(out.size > JSON.stringify(hebrew).length, true, "bytes must exceed characters here");
});

T("seasonSpan reads dates through the importer, not off the raw cells", () => {
  const rows = [HEAD, row("800001", "13-10-2026"), row("800002", "05-02-2027")];
  const span = seasonSpan(rows, club());
  assert.equal(span.from < span.to, true);
  assert.match(span.label, /2026/);
  assert.match(span.label, /2027/);
});

T("a file with no readable dates gives no span, rather than a wrong one", () => {
  assert.equal(seasonSpan([HEAD], club()), null);
});

console.log(`\n${n} federation-import tests passed`);

// ---------- added after gate #23 ----------

T("a proposal the manager already dealt with is never written over", () => {
  // `pendingImports/{date}` is keyed by the day, and usePendingImport.js records the
  // decision ON it: status, resolvedAt, resolvedBy. A second run the same day used to
  // .set() it whole with status:"pending" — banner back, and no record of who dealt with it.
  // It became real on 27.9.2026, when the cloud became a second writer alongside the laptop.
  assert.equal(mayOverwriteProposal(null), true);
  assert.equal(mayOverwriteProposal({ status: "pending" }), true);
  assert.equal(mayOverwriteProposal({ status: "approved", resolvedBy: "a@b.c" }), false);
  assert.equal(mayOverwriteProposal({ status: "rejected" }), false);
});

T("a proposal with no status at all is treated as open, not as resolved", () => {
  // The opposite default from the cup scan's guard, and deliberately so: `status` is written
  // by buildProposal on every proposal, so its absence means a malformed or partial document
  // — and refusing forever on one of those would silently stop every future night.
  assert.equal(mayOverwriteProposal({}), true);
  assert.equal(mayOverwriteProposal({ status: "" }), true);
});
