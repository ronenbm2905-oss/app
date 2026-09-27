// Talking to the federation's SportsPress API — the HTTP half of the cup scan.
//
// WHY THIS IS A MODULE AND NOT PART OF THE SCRIPT. Until 27.9.2026 this code lived inside
// `scripts/scan-cups.mjs`, which is fine while one machine runs it. It stopped being fine
// the moment the same scan had to run in a Cloud Function too: the alternative to sharing
// is a second copy, edited by hand, and `functions/copy-shared.mjs` already says what this
// project thinks of that — "two answers to one question that agree until the day they do
// not." The decision logic (`cupScan.js`) was always shared; now the fetching is too.
//
// Nothing here touches the filesystem, `process`, or Firestore, so it runs unchanged in a
// function, in the script, and in a test with a stubbed fetch.

export const FEDERATION_API = "https://ibasketball.co.il/wp-json/sportspress/v2";

// Named, not a browser string copied from somewhere. If the federation ever wants to block
// or rate-limit this scan, they should be able to identify it and ask — and the measurement
// on 27.9.2026 showed the site treats this UA exactly as it treats Chrome, byte for byte.
export const FEDERATION_UA = "Mozilla/5.0 (compatible; kiryat-ono-scheduler/1.0)";

export function createFederationApi({
  base = FEDERATION_API,
  fetchImpl = fetch,
  userAgent = FEDERATION_UA,
  timeoutMs = 20000,
} = {}) {
  async function getJson(url) {
    // A hung request must not hold the whole run. In a Cloud Function the timeout is the
    // function's own, and hitting THAT kills every competition still unscanned rather than
    // the one that stalled — so the per-request bound is the one that keeps a partial scan
    // partial instead of total.
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
    try {
      const res = await fetchImpl(url, {
        headers: { "User-Agent": userAgent, Accept: "application/json" },
        ...(ctl ? { signal: ctl.signal } : {}),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
      return await res.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // Venue names are fetched once each and reused. A cup round puts twenty fixtures in three
  // halls; asking the site twenty times would be rude and slower than the whole scan.
  const venueCache = new Map();
  async function venueName(id) {
    if (!id) return "";
    if (venueCache.has(id)) return venueCache.get(id);
    try {
      const v = await getJson(`${base}/venues/${id}?_fields=name`);
      const name = String(v?.name || "").trim();
      venueCache.set(id, name);
      return name;
    } catch {
      // A missing venue is not a failed competition: the fixture is still real and the hall
      // can be filled in by hand. Cached as empty so one unreachable venue is asked once.
      venueCache.set(id, "");
      return "";
    }
  }

  async function events(leagueId) {
    const url = `${base}/events?leagues=${leagueId}&per_page=100&_fields=id,date,title,venues`;
    const list = await getJson(url);
    return Array.isArray(list) ? list : [];
  }

  return { getJson, venueName, events };
}

// Scan every competition, and report HOW MANY ANSWERED.
//
// `reached` is the number the whole honesty of this job rests on — see `scanOutcome` in
// cupScan.js for the night when nobody counted it. One competition failing must not lose the
// other sixteen, so each is caught on its own; what changed is that the failure is now a
// number the caller can act on rather than a line in a log.
export async function scanCompetitions(leagues, { api, toDraft, onLeague, onFailure } = {}) {
  const drafts = [];
  let seen = 0;
  let reached = 0;

  for (const league of leagues) {
    try {
      const list = await api.events(league.id);
      const mine = [];
      for (const ev of list) {
        const draft = toDraft(ev, league);
        if (!draft) continue;
        // Only ours gets a second request. Resolving every venue in every competition would
        // be a hundred calls to learn nothing.
        //
        // A HOME game needs this as much as an away one: the club plays in several halls,
        // and the federation's venue is the only thing that says which.
        draft.venue = await api.venueName(ev?.venues?.[0]);
        mine.push(draft);
      }
      seen += list.length;
      reached += 1;
      drafts.push(...mine);
      if (onLeague) onLeague(league, list.length, mine.length);
    } catch (err) {
      if (onFailure) onFailure(league, err);
    }
  }

  return { seen, reached, drafts, total: leagues.length };
}
