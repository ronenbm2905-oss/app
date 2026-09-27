import assert from "node:assert/strict";
import {
  splitTitle, decodeTitle, matchesClub, splitDateTime, eventToDraft,
  classify, draftToGame, cupCode, CUP_LEAGUES, scanOutcome, scanSummary, SCAN_EXIT,
  mayOverwriteScan,
} from "../src/utils/cupScan.js";

const ev = (id, title, date) => ({ id, date, title: { rendered: title } });
let n = 0;
const T = (name, fn) => { fn(); n++; console.log("  ok  " + name); };

T("every cup competition is listed explicitly, ids and all", () => {
  assert.equal(CUP_LEAGUES.length, 17);
  assert.equal(CUP_LEAGUES.every((l) => Number.isInteger(l.id) && l.name), true);
});

T("the federation's escaped quotes are decoded", () => {
  assert.equal(decodeTitle("מכבי ראשל&quot;צ איציק"), 'מכבי ראשל"צ איציק');
});

T("a title splits on the em dash into home and away", () => {
  assert.deepEqual(splitTitle("א — ב"), { home: "א", away: "ב" });
  assert.equal(splitTitle("בלי מפריד"), null);
  assert.equal(splitTitle("א — ב — ג"), null);
});

T("the club is recognised through the sponsor in its federation name", () => {
  assert.equal(matchesClub("עירוני ק. אונו יורם"), true);
  assert.equal(matchesClub("עירוני קרית אונו ברק"), true);
  assert.equal(matchesClub("מכבי רמת גן ליאור"), false);
});

T("the date is converted to the shape the club document uses", () => {
  assert.deepEqual(splitDateTime("2026-11-02T18:00:00"), { date: "02-11-2026", time: "18:00" });
  assert.equal(splitDateTime("nonsense"), null);
});

T("an AWAY fixture: we are on the right of the dash", () => {
  const d = eventToDraft(ev(1502052, "מכבי ראשל&quot;צ איציק — עירוני ק. אונו יורם", "2026-11-02T18:00:00"));
  assert.equal(d.isHome, false);
  assert.equal(d.opponent, 'מכבי ראשל"צ איציק');
  assert.equal(d.date, "02-11-2026");
  assert.equal(d.time, "18:00");
  assert.equal(d.federationCode, "cup-1502052");
});

T("a HOME fixture: we are on the left", () => {
  const d = eventToDraft(ev(2, "עירוני קרית אונו ברק — מכבי רמת גן ליאור", "2026-11-04T20:30:00"));
  assert.equal(d.isHome, true);
  assert.equal(d.opponent, "מכבי רמת גן ליאור");
});

T("a fixture between two other clubs is ignored", () => {
  assert.equal(eventToDraft(ev(3, "מכבי חיפה — הפועל תל אביב", "2026-10-04T19:00:00")), null);
});

T("a derby against ourselves is NOT guessed — it needs a person", () => {
  assert.equal(eventToDraft(ev(4, "עירוני קרית אונו ברק — עירוני ק. אונו יורם", "2026-10-04T19:00:00")), null);
});

T("a malformed event produces nothing rather than a broken game", () => {
  assert.equal(eventToDraft(null), null);
  assert.equal(eventToDraft(ev(5, "א — ב", "bad-date")), null);
  assert.equal(eventToDraft({ title: { rendered: "א — ב" }, date: "2026-11-02T18:00:00" }), null);
});

T("the venue address is carried when the site gives one", () => {
  const d = eventToDraft(ev(6, "מכבי ראשון לציון — עירוני קרית אונו", "2026-11-02T18:00:00"),
    { venueName: "רח' גולדה מאיר 21, ראשון לציון", leagueName: "גביע המדינה לנוער" });
  assert.equal(d.venue, "רח' גולדה מאיר 21, ראשון לציון");
  assert.equal(d.league, "גביע המדינה לנוער");
});

console.log("  — what happens to a fixture the manager already typed —");

const draftAway = eventToDraft(ev(1502052, "מכבי ראשל&quot;צ איציק — עירוני ק. אונו יורם", "2026-11-02T18:00:00"));
const draftHome = eventToDraft(ev(1502099, "עירוני קרית אונו ברק — מכבי רמת גן ליאור", "2026-11-04T20:30:00"));

T("a fixture accepted in an earlier scan is SILENT, not offered again", () => {
  const existing = [{ federationCode: "cup-1502052", date: "02-11-2026", opponent: "x" }];
  const r = classify([draftAway], existing);
  assert.equal(r.known.length, 1);
  assert.equal(r.fresh.length + r.possible.length, 0);
});

T("a hand-typed game on the same date is flagged, NOT overwritten", () => {
  const typed = { federationCode: "manual-1", date: "02-11-2026", opponent: "מכבי ראשון לציון", teamId: "t1" };
  const r = classify([draftAway], [typed]);
  assert.equal(r.possible.length, 1);
  assert.equal(r.fresh.length, 0);
  // The manager's own record is handed back untouched, to be shown beside the new one.
  assert.deepEqual(r.possible[0].existing[0], typed);
});

T("a date the club has nothing on is offered as new", () => {
  const r = classify([draftHome], [{ federationCode: "m", date: "02-11-2026" }]);
  assert.equal(r.fresh.length, 1);
  assert.equal(r.fresh[0].opponent, "מכבי רמת גן ליאור");
});

T("classify never returns anything that could replace an existing game", () => {
  const typed = { federationCode: "manual-1", date: "02-11-2026", opponent: "מכבי ראשון לציון" };
  const before = JSON.stringify(typed);
  classify([draftAway, draftHome], [typed]);
  assert.equal(JSON.stringify(typed), before);
});

T("a cup code can never collide with a federation xlsx code", () => {
  assert.equal(cupCode(1502052), "cup-1502052");
  assert.equal(classify([draftAway], [{ federationCode: "1502052", date: "x" }]).known.length, 0);
});

T("the team is left EMPTY on purpose — a wrong squad is worse than no game", () => {
  assert.equal(draftToGame(draftAway).teamId, "");
  assert.equal(draftToGame(draftAway, "t7").teamId, "t7");
  assert.equal(draftToGame(draftAway, "t7").isHome, false);
  assert.equal(draftToGame(draftAway, "t7").ourScore, null);
});

console.log("\n" + n + " tests passed");

// ── replacing a hand-typed fixture with the federation's version ──────────────────────
{
  const { replaceGame, eventToDraft: toDraft } = await import("../src/utils/cupScan.js");
  const assert2 = (await import("node:assert/strict")).default;
  const draft = toDraft(
    { id: 1502052, date: "2026-11-02T18:00:00", title: { rendered: "מכבי ראשל&quot;צ איציק — עירוני ק. אונו יורם" } },
    { leagueName: "גביע המדינה לנוער", venueName: "רח' גולדה מאיר 21, ראשון לציון" }
  );
  const typed = {
    federationCode: "manual-1", date: "02-11-2026", time: "18:00", isHome: false,
    opponent: "מכבי ראשון לציון", teamId: "t-noar", timeOverride: { start: "17:15", end: "19:45" },
    addressOverride: "הכתובת שבדקתי", driverName: "יוסי", driverPhone: "0521111111",
    ourScore: null, theirScore: null, league: "גביע המדינה",
  };
  const merged = replaceGame(draft, typed);
  const ok = (n, f) => { f(); console.log("  ok  " + n); };

  ok("replacing adopts the federation's code — future scans then stay silent", () => {
    assert2.equal(merged.federationCode, "cup-1502052");
  });
  ok("the squad the manager filed it under is kept", () => {
    assert2.equal(merged.teamId, "t-noar");
  });
  ok("a block nudged on the board is kept", () => {
    assert2.deepEqual(merged.timeOverride, { start: "17:15", end: "19:45" });
  });
  ok("a hand-typed address wins over the federation's venue", () => {
    assert2.equal(merged.addressOverride, "הכתובת שבדקתי");
    assert2.equal(merged.venue, "רח' גולדה מאיר 21, ראשון לציון");
  });
  ok("the driver for the bus is kept", () => {
    assert2.equal(merged.driverName, "יוסי");
    assert2.equal(merged.driverPhone, "0521111111");
  });
  ok("the federation's own fields DO win — that is the point of replacing", () => {
    assert2.equal(merged.opponent, 'מכבי ראשל"צ איציק');
    assert2.equal(merged.league, "גביע המדינה לנוער");
  });
  ok("a score already recorded is not wiped", () => {
    const played = replaceGame(draft, { ...typed, ourScore: 71, theirScore: 68 });
    assert2.equal(played.ourScore, 71);
    assert2.equal(played.theirScore, 68);
  });
  ok("replacing a bare record leaves no team, rather than inventing one", () => {
    assert2.equal(replaceGame(draft, { federationCode: "m", date: "02-11-2026" }).teamId, "");
  });
  console.log("\n8 replace tests passed");
}

// ── the fixture the scanner itself supplied yesterday ─────────────────────────────────
{
  const { classify: cls, eventToDraft: toDraft } = await import("../src/utils/cupScan.js");
  const { adoptFixture } = await import("../src/utils/games.js");
  const a = (await import("node:assert/strict")).default;
  const ok = (n, f) => { f(); console.log("  ok  " + n); };

  const draft = toDraft(
    { id: 1501989, date: "2026-10-08T17:00:00", title: { rendered: "הפועל חולון נריה — עירוני קרית אונו" } },
    { leagueName: "גביע המדינה לילדים א" }
  );

  ok("a record still wearing the scanned id is recognised", () => {
    const r = cls([draft], [{ federationCode: "cup-1501989", date: draft.date }]);
    a.equal(r.known.length, 1);
  });

  ok("THE BUG: adopted into the federation's code, it was offered again every night", () => {
    const adopted = { federationCode: "779878", date: draft.date, time: draft.time, opponent: draft.opponent };
    // Without either guard this lands in `possible` and the manager is asked about it daily.
    const r = cls([draft], [adopted]);
    a.equal(r.known.length, 1);
    a.equal(r.possible.length, 0);
  });

  ok("adopting carries the origin forward, so the next scan is silent by id alone", () => {
    const merged = adoptFixture({ federationCode: "cup-1501989", teamId: "t1" }, { federationCode: "779878", teamId: "t1" });
    a.equal(merged.scannedCode, "cup-1501989");
    a.equal(cls([draft], [merged]).known.length, 1);
  });

  ok("and an origin already recorded is not lost on the next adoption", () => {
    const again = adoptFixture({ federationCode: "779878", scannedCode: "cup-1501989" }, { federationCode: "779878" });
    a.equal(again.scannedCode, "cup-1501989");
  });

  ok("a DIFFERENT fixture on the same day is still brought for a decision", () => {
    const other = { federationCode: "m1", date: draft.date, time: "19:00", opponent: "מישהו אחר" };
    const r = cls([draft], [other]);
    a.equal(r.known.length, 0);
    a.equal(r.possible.length, 1);
  });

  ok("same day and hour but another opponent is not silently swallowed", () => {
    const other = { federationCode: "m1", date: draft.date, time: draft.time, opponent: "מכבי אחרת" };
    a.equal(cls([draft], [other]).possible.length, 1);
  });

  console.log("\n6 recognition tests passed");
}

// ---------- added 27.9.2026: did the scan cover what it claims to cover? ----------

T("REGRESSION: reaching none of the competitions is a failure, not a quiet night", () => {
  // 26.9.2026, two runs forty minutes apart, both ending "nothing to propose" with exit 10:
  //     11:11      0 fixtures across 17 competitions
  //     12:19    133 fixtures across 17 competitions
  // The first had reached nothing. Every channel a person reads said the night was fine.
  const dead = scanOutcome({ total: 17, reached: 0 });
  const quiet = scanOutcome({ total: 17, reached: 17 });
  assert.equal(dead.state, "failed");
  assert.equal(quiet.state, "none");
  assert.notEqual(dead.exitCode, quiet.exitCode, "the two runs must not exit the same way");
});

T("one competition short is partial — coverage is the question, not fixture count", () => {
  // A competition with no fixtures yet answers with an empty list, and that IS coverage.
  assert.equal(scanOutcome({ total: 17, reached: 17, filed: false }).state, "none");
  assert.equal(scanOutcome({ total: 17, reached: 16 }).state, "partial");
  assert.equal(scanOutcome({ total: 17, reached: 1 }).state, "partial");
});

T("a proposal from an incomplete scan is still reported as incomplete", () => {
  // The fixture is worth having; "nothing else came up" is not a conclusion a gap supports.
  const out = scanOutcome({ total: 17, reached: 12, filed: true });
  assert.equal(out.state, "partial");
  assert.equal(out.exitCode, SCAN_EXIT.partial);
  assert.equal(scanOutcome({ total: 17, reached: 17, filed: true }).state, "ok");
});

T("an empty competition list is a broken scan, not a complete one", () => {
  // The shape a bad edit to CUP_LEAGUES would take: 0 of 0 reached is vacuously "all".
  assert.equal(scanOutcome({ total: 0, reached: 0 }).state, "failed");
  assert.equal(scanOutcome().state, "failed");
});

T("`reached` above `total` cannot manufacture full coverage", () => {
  assert.equal(scanOutcome({ total: 17, reached: 99 }).state, "none");
  assert.equal(scanOutcome({ total: 17, reached: -4 }).state, "failed");
});

T("the exit codes survive `if errorlevel N`, which means N or above", () => {
  // run-nightly.cmd tests 11, then 10, then 1. Two codes that collide there would silently
  // merge two states, which is the bug all over again in a different file.
  const codes = Object.values(SCAN_EXIT);
  assert.equal(new Set(codes).size, codes.length, "duplicate exit code");
  assert.equal(SCAN_EXIT.partial > SCAN_EXIT.none, true, "partial must be tested before none");
  assert.equal(SCAN_EXIT.none > SCAN_EXIT.failed, true);
  assert.equal(SCAN_EXIT.ok, 0);
});

T("the summary names what was missed, and cannot read like a full scan", () => {
  assert.equal(
    scanSummary({ total: 17, reached: 17, fixtures: 133, ours: 3 }),
    "133 fixtures across 17/17 competitions · 3 involve this club"
  );
  const bad = scanSummary({ total: 17, reached: 0, fixtures: 0, ours: 0 });
  assert.equal(bad.includes("0/17"), true);
  assert.equal(bad.includes("COULD NOT BE REACHED"), true);
  assert.notEqual(bad, scanSummary({ total: 17, reached: 17, fixtures: 0, ours: 0 }));
});

T("a proposal a manager has already dealt with is never written over", () => {
  // `cupScans/{date}` is keyed by the day, and useCupScan.js records the decision ON that
  // document — resolved, resolvedAt, resolvedBy, resolvedNote. A second scan the same day
  // used to .set() the whole thing again with `resolved: false`: the dismissed fixture came
  // back to the banner and the record of who dismissed it was gone. Found in the legal gate
  // on 27.9.2026, while the scan was moving to a Cloud Function — two runners made it likely,
  // but running the script twice in one day was always enough.
  assert.equal(mayOverwriteScan(null), true, "nothing there yet");
  assert.equal(mayOverwriteScan({ resolved: false }), true, "still open");
  assert.equal(mayOverwriteScan({ resolved: true, resolvedBy: "a@b.c" }), false);
});

T("anything truthy in `resolved` stops the overwrite — failing the safe way", () => {
  // Refusing wrongly delays a fixture by one day; allowing wrongly erases a decision.
  assert.equal(mayOverwriteScan({ resolved: "true" }), false);
  assert.equal(mayOverwriteScan({ resolved: 1 }), false);
  assert.equal(mayOverwriteScan({ resolved: undefined }), true);
  assert.equal(mayOverwriteScan({}), true);
});
