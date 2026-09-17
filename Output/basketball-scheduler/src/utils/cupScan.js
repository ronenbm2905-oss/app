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
export function classify(drafts, existingGames) {
  const games = arr(existingGames);
  const byCode = new Set(games.map((g) => String(g?.federationCode)));
  const out = { known: [], possible: [], fresh: [] };

  arr(drafts).forEach((d) => {
    if (!d) return;
    if (byCode.has(String(d.federationCode))) { out.known.push(d); return; }
    const sameDay = games.filter((g) => String(g?.date) === d.date);
    if (sameDay.length > 0) out.possible.push({ draft: d, existing: sameDay });
    else out.fresh.push(d);
  });

  return out;
}

// The game record as the club stores it. `teamId` is deliberately absent: the federation's
// name for us carries a coach or a sponsor, not our team names, and a wrong guess files a
// fixture under the wrong squad — which is worse than not knowing about it.
export function draftToGame(draft, teamId) {
  return {
    federationCode: draft.federationCode,
    teamId: teamId || "",
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
