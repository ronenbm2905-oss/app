// Cup and friendly fixtures — the games the federation's xlsx feed does not carry.
//
// The nightly feed (`club/…?feed=xlsx`) covers league play. Cup competitions are published
// separately, one page per age group, and a manager who wants to know about them has to
// remember to open seventeen pages. On 17.9.2026 two cup fixtures were live on the site and
// missing from the club — one of them three weeks away.
//
// The site runs SportsPress and exposes it: `/wp-json/sportspress/v2/events?leagues=<id>`
// returns date, time and the two team names, structured. No PDF is parsed and no document
// is read; if that ever stops being true, this stops working loudly rather than quietly.
//
// ONE TRAP, FOUND BY TESTING IT: the site's own team SEARCH is broken — a query for a team
// that certainly exists comes back empty. A scanner built on search would report "nothing
// new" forever and look perfectly healthy. So nothing here searches; every competition is
// listed and filtered locally.

// Discovered by walking /league/2026-9NN/ and reading each page's own league id. The ids
// are sequential, which is convenient and is NOT relied upon — each one is written out, so
// a season that renumbers them fails visibly instead of scanning the wrong competitions.
export const CUP_LEAGUES = [
  { id: 120223, name: "גביע המדינה לגברים" },
  { id: 120224, name: "גביע המדינה לנשים" },
  { id: 120225, name: "גביע האיגוד לגברים" },
  { id: 120226, name: "גביע האיגוד לנשים" },
  { id: 120227, name: "גביע האיגוד ליגה ב" },
  { id: 120228, name: "גביע המדינה לנוער" },
  { id: 120229, name: "גביע האיגוד לנוער" },
  { id: 120230, name: "גביע המדינה לנערים א" },
  { id: 120231, name: "גביע האיגוד לנערים א" },
  { id: 120232, name: "גביע המדינה לנערים ב" },
  { id: 120233, name: "גביע המדינה לנערות א" },
  { id: 120234, name: "גביע המדינה לילדים א" },
  { id: 120235, name: "גביע המדינה לנערות ב" },
  { id: 120236, name: "גביע המדינה לילדות א" },
  { id: 120237, name: "ידידות קטסל א בנים" },
  { id: 120238, name: "ידידות קטסל בנות" },
  { id: 120239, name: "ידידות קטסל ב בנים" },
];

// The club as the federation writes it. Their names carry a sponsor or a coach — "עירוני
// ק. אונו יורם", "עירוני קרית אונו ברק" — so the town is the only stable part.
export const CLUB_PATTERNS = ["אונו"];

const arr = (list) => (Array.isArray(list) ? list : []);

export function decodeTitle(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

// SportsPress writes "HOME — AWAY" with an em dash. Which side we are on is the only thing
// that decides home or away, so a title that does not split is dropped rather than guessed.
export function splitTitle(title) {
  const parts = decodeTitle(title).split(/\s+[—–]\s+/);
  if (parts.length !== 2) return null;
  return { home: parts[0].trim(), away: parts[1].trim() };
}

export function matchesClub(name, patterns = CLUB_PATTERNS) {
  const n = String(name || "");
  return patterns.some((p) => n.includes(p));
}

// "2026-11-02T18:00:00" -> { date: "02-11-2026", time: "18:00" }, the shapes the club
// document already uses. A date the app cannot read is worse than no date at all.
export function splitDateTime(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(iso || ""));
  if (!m) return null;
  return { date: `${m[3]}-${m[2]}-${m[1]}`, time: `${m[4]}:${m[5]}` };
}

// `cup-` keeps these in their own namespace: a federation xlsx code and a SportsPress event
// id are both numbers, and a collision would let a re-import overwrite a cup fixture.
export const cupCode = (eventId) => `cup-${eventId}`;

export function eventToDraft(event, { leagueName = "", venueName = "", patterns } = {}) {
  const sides = splitTitle(event?.title?.rendered ?? event?.title);
  const when = splitDateTime(event?.date);
  if (!sides || !when || !event?.id) return null;

  const weAreHome = matchesClub(sides.home, patterns);
  const weAreAway = matchesClub(sides.away, patterns);
  // Neither side is us, or a derby the club plays against itself — both are dropped rather
  // than guessed at. A derby is a real thing and it needs a person, not a rule.
  if (weAreHome === weAreAway) return null;

  return {
    federationCode: cupCode(event.id),
    eventId: event.id,
    date: when.date,
    time: when.time,
    isHome: weAreHome,
    opponent: weAreHome ? sides.away : sides.home,
    ourName: weAreHome ? sides.home : sides.away,
    venue: venueName || "",
    league: leagueName,
  };
}

// What the scan found, against what the club already has.
//
// NOTHING HERE EVER REWRITES AN EXISTING GAME. A fixture the manager typed by hand is the
// manager's, including the way they spelled the opponent and the team they assigned it to.
// The scan can only ever add, and only after a person says so.
//
//   known    — already accepted from a previous scan (same code). Silent.
//   possible — the club already has a game on that date. Shown side by side, NOT merged:
//              "מכבי ראשל״צ איציק" and "מכבי ראשון לציון" are the same fixture and share no
//              word, so no rule can tell them apart. A person can, in one glance.
//   fresh    — nothing on that date. Offered as new.
// Two fixtures are the same when they are on the same day, at the same hour, against the
// same opponent. Used only to RECOGNISE something already present — never to merge, never to
// write. It is what lets a record adopted before `scannedCode` existed be recognised at all,
// with no migration and no write to anybody's data.
const sameFixture = (g, d) =>
  String(g?.date) === String(d.date) &&
  String(g?.time) === String(d.time) &&
  decodeTitle(g?.opponent) === decodeTitle(d.opponent);

export function classify(drafts, existingGames) {
  const games = arr(existingGames);
  const byCode = new Set(games.map((g) => String(g?.federationCode)));
  // Both ids count: the one the record wears now, and the one it was first seen under.
  const byScanned = new Set(games.map((g) => String(g?.scannedCode || "")).filter(Boolean));
  const out = { known: [], possible: [], fresh: [] };

  arr(drafts).forEach((d) => {
    if (!d) return;
    if (byCode.has(String(d.federationCode)) || byScanned.has(String(d.federationCode))) {
      out.known.push(d);
      return;
    }
    // Already here under a different id entirely — adopted before this was tracked.
    if (games.some((g) => sameFixture(g, d))) { out.known.push(d); return; }
    const sameDay = games.filter((g) => String(g?.date) === d.date);
    if (sameDay.length > 0) out.possible.push({ draft: d, existing: sameDay });
    else out.fresh.push(d);
  });

  return out;
}

// The game record as the club stores it. `teamId` is deliberately absent: the federation's
// name for us carries a coach or a sponsor, not our team names, and a wrong guess files a
// fixture under the wrong squad — which is worse than not knowing about it.
export function draftToGame(draft, teamId, hallId) {
  return {
    federationCode: draft.federationCode,
    teamId: teamId || "",
    ...(hallId ? { hallId } : {}),
    league: draft.league || "",
    date: draft.date,
    time: draft.time,
    isHome: Boolean(draft.isHome),
    opponent: draft.opponent || "",
    venue: draft.venue || "",
    ourScore: null,
    theirScore: null,
  };
}

// Everything on a game record that belongs to the MANAGER and not to the federation.
//
// The same bargain `importGamesFile` already makes with the weekly file: what the source
// owns is refreshed, what a person set by hand is carried across. Losing any of these on a
// replace would quietly undo a decision — the squad it was filed under, a block nudged on
// the board, an address typed because the federation's was wrong, the driver for the bus.
export const MANAGER_OWNED = [
  "teamId", "hallId", "timeOverride", "addressOverride", "departOverride", "scannedCode",
  "driverName", "driverPhone",
  "ourScore", "theirScore",
];

// Adopting a hand-typed fixture into the federation's version of it.
//
// This is NOT the same as adding. Adding leaves two games on one date; this replaces the
// record in place, keeping everything above. The code changes from the manager's own to
// `cup-<id>`, which is the quiet payoff: every future scan then recognises this fixture and
// says nothing about it, instead of offering it again every night forever.
// The id the fixture was first seen under.
//
// A scanned game is later adopted into the federation's own code — by the weekly import, or
// by the manager merging two records — and the cup id is overwritten when that happens. On
// 18.9.2026 that meant the scanner stopped recognising three fixtures it had itself supplied
// the day before, and offered them again. It would have done so every night, for ever.
//
// So the original id travels with the record.
export function withScannedCode(game, code) {
  const from = String(code || "");
  if (!from.startsWith("cup-")) return game;
  return { ...game, scannedCode: from };
}

export function replaceGame(draft, existing) {
  const base = draftToGame(draft, existing?.teamId || "");
  MANAGER_OWNED.forEach((k) => {
    const v = existing?.[k];
    if (v !== undefined && v !== null && v !== "") base[k] = v;
  });
  return base;
}

// ---------------------------------------------------------------------------------------
// Did the scan cover what it claims to cover?
//
// A SCAN THAT REACHED NOTHING IS NOT A QUIET NIGHT — and until 27.9.2026 it said it was.
//
// Every competition is fetched inside its own try/catch, so one failure does not lose the
// other sixteen. That is deliberate and still right. But the catch only wrote a `!!` line to
// a log file and let the run carry on, so when the network was still coming up after a resume
// and ALL SEVENTEEN failed, the scan finished with "nothing to propose" and exit code 10 —
// the exact words and the exact exit code of a night when the federation published nothing.
//
// Measured on 26.9.2026, two runs forty minutes apart:
//
//     11:11      0 fixtures across 17 competitions   ->  "nothing to propose"   exit 10
//     12:19    133 fixtures across 17 competitions   ->  "nothing to propose"   exit 10
//
// The log line, the exit code, the heartbeat in Firestore and the line on the manager's
// screen were identical. The comment in the script promised the failure was "said out loud" —
// but out loud meant a line in a file nobody opens, and every channel a person actually reads
// said the night was fine.
//
// `reached` is how many competitions answered, not how many fixtures came back: a competition
// that legitimately has no fixtures yet answers with an empty list, and that is coverage.
// The question is not "did anything fail" but "did we see what we say we saw".
//
// The exit codes are consumed by run-nightly.cmd through `if errorlevel N`, which means
// "N or above" — so they are tested there from the highest down.
export const SCAN_EXIT = { ok: 0, failed: 1, none: 10, partial: 11 };

export function scanOutcome({ total = 0, reached = 0, filed = false } = {}) {
  const all = Math.max(0, Math.trunc(total));
  const got = Math.min(Math.max(0, Math.trunc(reached)), all);

  // No competitions at all means CUP_LEAGUES is empty or unreadable. That is a broken scan
  // dressed as a complete one, and it is the shape a bad edit to the list would take.
  if (all === 0) return { state: "failed", exitCode: SCAN_EXIT.failed };
  if (got === 0) return { state: "failed", exitCode: SCAN_EXIT.failed };

  // Partial outranks `filed`, and it outranks it ON PURPOSE. A proposal from an incomplete
  // scan is worth having, but the manager has to know that the fixture list behind it is not
  // the whole list — otherwise "nothing else came up" is a conclusion drawn from a gap.
  // Exit 11 is treated by the runner as "there is something to look at", so a partial night
  // is never reported to Task Scheduler as nothing-to-do.
  if (got < all) return { state: "partial", exitCode: SCAN_EXIT.partial };

  return filed
    ? { state: "ok", exitCode: SCAN_EXIT.ok }
    : { state: "none", exitCode: SCAN_EXIT.none };
}

// The sentence the log ends with. It exists so that the two runs above can never again print
// the same thing: what was unreachable is named before what was found.
export function scanSummary({ total = 0, reached = 0, fixtures = 0, ours = 0 } = {}) {
  const missing = Math.max(0, total - reached);
  const covered = `${fixtures} fixtures across ${reached}/${total} competitions · ${ours} involve this club`;
  return missing > 0 ? `${covered} · ${missing} COULD NOT BE REACHED` : covered;
}

// May today's proposal be written over the one already there?
//
// `cupScans/{date}` is keyed by the day, so a second scan on the same day rewrites the same
// document — and `useCupScan.js` records a manager's decision ON that document: `resolved`,
// `resolvedAt`, `resolvedBy`, `resolvedNote`. A full `.set()` from a later scan puts
// `resolved: false` back and takes the other three with it. The dismissed fixture returns to
// the banner and the record of who dismissed it, and when, is gone.
//
// Found 27.9.2026 in the legal gate, while the cup scan was moving to a Cloud Function. The
// move is what made it likely — two independent runners instead of one — but the hazard was
// already there for anyone who ran the script twice in a day.
//
// Skipping costs at most one day: the next scan writes tomorrow's document, and `classify`
// re-offers anything still genuinely missing. Overwriting costs a person's decision.
// Truthiness rather than `=== true`, and that is the deliberate direction of failure: a
// `resolved` field in some shape nobody expected should stop the overwrite, not wave it
// through. Refusing wrongly delays a fixture by a day; allowing wrongly erases a decision.
export function mayOverwriteScan(existing) {
  if (!existing) return true;
  return !existing.resolved;
}
