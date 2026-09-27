// The HTTP half of the cup scan, with the federation stubbed.
//
// This module was pulled out of `scripts/scan-cups.mjs` on 27.9.2026 so that the script and
// the Cloud Function run the same code instead of two copies. The extraction is only worth
// anything if the counting survives it — `reached` is what tells a failed scan from a quiet
// night, and it is now computed here rather than in the script.

import assert from "node:assert/strict";
import { createFederationApi, scanCompetitions, FEDERATION_UA } from "../src/utils/federationApi.js";

let n = 0;
const T = async (name, fn) => { await fn(); n++; console.log("  ok  " + name); };

const LEAGUES = [{ id: 1, name: "גביע א" }, { id: 2, name: "גביע ב" }, { id: 3, name: "גביע ג" }];
const ev = (id) => ({ id, date: "2026-11-02T18:00:00", title: { rendered: "א — ב" }, venues: [] });

// A fetch that answers from a map of url-substring -> value, and throws for anything else.
function stubFetch(routes) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    for (const [key, value] of routes) {
      if (String(url).includes(key)) {
        if (value instanceof Error) throw value;
        return { ok: true, status: 200, statusText: "OK", json: async () => value };
      }
    }
    return { ok: false, status: 500, statusText: "stub miss", json: async () => null };
  };
  return { impl, calls };
}

const draftOf = (e, league) => ({ code: `cup-${e.id}`, league: league.name });

await T("all three answer: reached is 3 and nothing is lost", async () => {
  const { impl } = stubFetch([["leagues=1", [ev(11)]], ["leagues=2", [ev(21), ev(22)]], ["leagues=3", []]]);
  const out = await scanCompetitions(LEAGUES, {
    api: createFederationApi({ fetchImpl: impl }),
    toDraft: draftOf,
  });
  assert.equal(out.reached, 3);
  assert.equal(out.total, 3);
  assert.equal(out.seen, 3);
  assert.equal(out.drafts.length, 3);
});

await T("A COMPETITION WITH NO FIXTURES IS COVERAGE, not a failure", async () => {
  // The distinction the whole heartbeat rests on. An empty cup answered; it just has nothing
  // scheduled yet. Counting it as unreached would cry wolf every night of the pre-season.
  const { impl } = stubFetch([["leagues=", []]]);
  const out = await scanCompetitions(LEAGUES, {
    api: createFederationApi({ fetchImpl: impl }),
    toDraft: draftOf,
  });
  assert.equal(out.reached, 3, "an empty list is an answer");
  assert.equal(out.seen, 0);
});

await T("one competition failing does not lose the other two", async () => {
  const { impl } = stubFetch([
    ["leagues=1", [ev(11)]],
    ["leagues=2", new Error("socket hang up")],
    ["leagues=3", [ev(31)]],
  ]);
  const failed = [];
  const out = await scanCompetitions(LEAGUES, {
    api: createFederationApi({ fetchImpl: impl }),
    toDraft: draftOf,
    onFailure: (league, err) => failed.push([league.name, err.message]),
  });
  assert.equal(out.reached, 2);
  assert.equal(out.total, 3);
  assert.equal(out.drafts.length, 2);
  assert.deepEqual(failed, [["גביע ב", "socket hang up"]]);
});

await T("THE NIGHT OF 26.9: nothing answers, and reached is 0 — not a quiet night", async () => {
  const impl = async () => { throw new Error("fetch failed"); };
  const out = await scanCompetitions(LEAGUES, {
    api: createFederationApi({ fetchImpl: impl }),
    toDraft: draftOf,
  });
  assert.equal(out.reached, 0);
  assert.equal(out.seen, 0);
  assert.equal(out.drafts.length, 0);
});

await T("a non-200 is a failure, not an empty competition", async () => {
  // A 503 that parsed as `[]` would be counted as coverage and would read as a quiet night —
  // the same bug wearing a different status code.
  const impl = async () => ({ ok: false, status: 503, statusText: "Service Unavailable", json: async () => [] });
  const out = await scanCompetitions(LEAGUES, {
    api: createFederationApi({ fetchImpl: impl }),
    toDraft: draftOf,
  });
  assert.equal(out.reached, 0);
});

await T("a body that is not a list is treated as no fixtures, not a crash", async () => {
  // WordPress answers an error as an OBJECT. `.length` on it is undefined, and a loop over it
  // throws — which would turn one odd response into a failed competition for no reason.
  const { impl } = stubFetch([["leagues=", { code: "rest_no_route" }]]);
  const out = await scanCompetitions(LEAGUES, {
    api: createFederationApi({ fetchImpl: impl }),
    toDraft: draftOf,
  });
  assert.equal(out.reached, 3);
  assert.equal(out.seen, 0);
});

await T("only OUR fixtures cost a venue request, and each venue is asked once", async () => {
  const { impl, calls } = stubFetch([
    ["venues/7", { name: "אולם ברק" }],
    ["leagues=", [{ ...ev(1), venues: [7] }, { ...ev(2), venues: [7] }, { ...ev(3), venues: [7] }]],
  ]);
  const api = createFederationApi({ fetchImpl: impl });
  const out = await scanCompetitions([LEAGUES[0]], {
    api,
    // Only the first event is ours.
    toDraft: (e, league) => (e.id === 1 ? draftOf(e, league) : null),
  });
  assert.equal(out.drafts[0].venue, "אולם ברק");
  assert.equal(calls.filter((u) => u.includes("venues/")).length, 1, "one venue request for one fixture");
});

await T("an unreachable venue leaves the fixture, it does not fail the competition", async () => {
  // The hall can be filled in by hand; the fixture cannot be invented.
  const { impl } = stubFetch([
    ["venues/9", new Error("gone")],
    ["leagues=", [{ ...ev(1), venues: [9] }]],
  ]);
  const out = await scanCompetitions([LEAGUES[0]], {
    api: createFederationApi({ fetchImpl: impl }),
    toDraft: draftOf,
  });
  assert.equal(out.reached, 1);
  assert.equal(out.drafts.length, 1);
  assert.equal(out.drafts[0].venue, "");
});

await T("the scan identifies itself, so the federation can ask it to stop", async () => {
  let seenUA = "";
  const impl = async (_url, init) => {
    seenUA = init?.headers?.["User-Agent"] || "";
    return { ok: true, status: 200, statusText: "OK", json: async () => [] };
  };
  await scanCompetitions([LEAGUES[0]], { api: createFederationApi({ fetchImpl: impl }), toDraft: draftOf });
  assert.equal(seenUA, FEDERATION_UA);
  assert.equal(seenUA.includes("kiryat-ono-scheduler"), true);
});

await T("a request that never answers is bounded, and only that one is lost", async () => {
  // In a Cloud Function the alternative bound is the function's own timeout, and hitting that
  // kills every competition still unscanned rather than the one that stalled.
  const impl = (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    });
  const out = await scanCompetitions([LEAGUES[0], LEAGUES[1]], {
    api: createFederationApi({ fetchImpl: impl, timeoutMs: 20 }),
    toDraft: draftOf,
  });
  assert.equal(out.reached, 0);
  assert.equal(out.total, 2);
});

console.log(`\n${n} federation-api tests passed`);
