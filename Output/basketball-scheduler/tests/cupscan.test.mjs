import assert from "node:assert/strict";
import { DAYS } from "../src/constants.js";
import {
  splitTitle, decodeTitle, matchesClub, splitDateTime, eventToDraft,
  classify, draftToGame, cupCode, CUP_LEAGUES, scanOutcome, scanSummary, SCAN_EXIT, applyMove,
  movedCandidates, trimForScan,
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

// ─────────────────────────────────────────────────────────────────────────────────────────
// THE SAME FIXTURE, MOVED — the real event of 1.10.2026, and the shape of the gap.
//
// One SportsPress event, 1502072, followed through two scans of the club's own data:
//
//   18.9   cup-1502072   04-11-2026 20:30   ->  shown beside the club's record 779711
//   1.10   cup-1502072   16-10-2026 14:00   ->  offered as a BRAND NEW fixture
//
// The federation moved נערים א from a November evening to an October afternoon. Nothing in
// the old recognition survives that: the club's code is the xlsx one and the draft's is the
// cup one, and date, hour and venue are exactly what changed. Approving the "new" fixture
// would have left two games against one opponent, and the duplicate guard in the weekly
// import matches on date — the one thing that moved.
console.log("  — a fixture the federation moved —");

const CUP = "גביע המדינה לנערים א";
// The club's record: came from the weekly xlsx, so it wears the federation's own code.
const ours = (over = {}) => ({
  federationCode: "779711", teamId: "t-na", date: "04-11-2026", time: "20:30",
  isHome: true, opponent: "מכבי רמת גן ליאור", league: CUP,
  venue: "אולם עלומים, רח' הכפר 2, קריית אונו", hallId: "h-alumim", weekDay: "יום רביעי", ...over,
});
const movedDraft = (over = {}) => ({
  federationCode: "cup-1502072", eventId: 1502072, date: "16-10-2026", time: "14:00",
  isHome: true, opponent: "מכבי רמת גן ליאור", league: CUP,
  venue: "אולם עלומים, רח' הכפר 2, קריית אונו", ...over,
});

T("THE MOVE IS RECOGNISED, not offered as a new fixture", () => {
  const r = classify([movedDraft()], [ours()]);
  assert.equal(r.fresh.length, 0, "this was offered as new until 1.10.2026");
  assert.equal(r.moved.length, 1);
  assert.equal(r.moved[0].existing.federationCode, "779711");
  assert.equal(r.moved[0].draft.date, "16-10-2026");
});

T("a fixture already carrying the cup id is recognised when it moves too", () => {
  // Known BY ID used to end the question — "recognised" and "unchanged" were one statement.
  // A fixture adopted from an earlier scan would move and never be mentioned again.
  const adopted = ours({ federationCode: "779878", scannedCode: "cup-1502072" });
  const r = classify([movedDraft()], [adopted]);
  assert.equal(r.known.length, 0);
  assert.equal(r.moved.length, 1);
  assert.equal(r.moved[0].existing.federationCode, "779878");
});

T("and a fixture that has NOT moved is still silent", () => {
  // The whole value of `known` is that a quiet competition says nothing at all.
  const r = classify([movedDraft({ date: "04-11-2026", time: "20:30" })], [ours({ scannedCode: "cup-1502072" })]);
  assert.equal(r.known.length, 1);
  assert.equal(r.moved.length + r.fresh.length + r.possible.length, 0);
});

T("IDENTITY IS COMPETITION + OPPONENT + SIDE — never two of the three", () => {
  // Each of these is a DIFFERENT fixture and must not be swallowed into the first one.
  assert.equal(classify([movedDraft({ league: "גביע המדינה לנערים ב" })], [ours()]).moved.length, 0);
  assert.equal(classify([movedDraft({ opponent: "הפועל חולון" })], [ours()]).moved.length, 0);
  assert.equal(classify([movedDraft({ isHome: false })], [ours()]).moved.length, 0, "the away leg is its own game");
});

T("TWO CANDIDATES ARE NOT A MATCH — a person decides, nothing is guessed", () => {
  // A replay, a two-legged tie, or a competition that does not behave the way this assumes.
  // Moving the wrong fixture silently is worse than offering a duplicate somebody can see.
  const r = classify([movedDraft()], [ours(), ours({ federationCode: "779712", date: "11-11-2026" })]);
  assert.equal(r.moved.length, 0);
  assert.equal(r.possible.length, 1, "shown side by side instead");
  assert.equal(r.possible[0].existing.length, 2);
});

T("a cancelled fixture is not a candidate for a move", () => {
  assert.equal(classify([movedDraft()], [ours({ cancelled: true })]).moved.length, 0);
});

T("APPLYING A MOVE KEEPS THE FEDERATION'S OWN CODE", () => {
  // `replaceGame` hands the record the cup id, which is right when adopting a hand-typed
  // fixture and wrong here: overwrite 779711 and the next weekly import finds it missing
  // from the sheet and reports it CANCELLED — the false cancellation of 17.9, reversed.
  const out = applyMove(ours(), movedDraft(), DAYS);
  assert.equal(out.federationCode, "779711");
  assert.equal(out.scannedCode, "cup-1502072", "the scanned id rides along, so the next scan knows it");
  assert.equal(out.date, "16-10-2026");
  assert.equal(out.time, "14:00");
});

T("...and everything the manager owns", () => {
  const mine = ours({
    teamId: "t-na", hallId: "h-alumim", addressOverride: "כתובת שהזנתי",
    driverName: "משה", driverPhone: "052-1", ourScore: 61, theirScore: 58, timeOverride: { start: "19:00" },
  });
  const out = applyMove(mine, movedDraft(), DAYS);
  for (const k of ["teamId", "hallId", "addressOverride", "driverName", "driverPhone", "ourScore", "theirScore"]) {
    assert.deepEqual(out[k], mine[k], k);
  }
  assert.deepEqual(out.timeOverride, mine.timeOverride);
});

T("the weekday is recomputed, or the next import would offer to fix it", () => {
  // 16.10.2026 is a Friday; the record said Wednesday. Left stale it reads wrong on the
  // board AND shows up in the next weekly proposal as a field that disagrees with the sheet.
  assert.equal(applyMove(ours(), movedDraft(), DAYS).weekDay, "יום שישי");
  // With no day table to hand, the old value is kept rather than a wrong one invented.
  assert.equal(applyMove(ours(), movedDraft()).weekDay, "יום רביעי");
});

T("a move never mutates the record it was given", () => {
  const mine = ours();
  const before = JSON.stringify(mine);
  applyMove(mine, movedDraft(), DAYS);
  assert.equal(JSON.stringify(mine), before);
});

console.log(`\n${n} cup-scan tests passed`);

console.log("  — what the gate found in the first version —");

T("GATE #28 B3: A FIXTURE THAT WAS PLAYED IS NEVER DRAGGED FORWARD", () => {
  // "Only one candidate" assumes both legs of a tie are ours. In the three FRIENDLY
  // competitions a second meeting with the same club is the ordinary thing — and when only
  // one leg is ours, the guard never fires. The October fixture would have been moved to
  // December, carrying its score, with no undo.
  const today = new Date("2026-11-01T00:00:00");
  const withScore = ours({ date: "10-10-2026", ourScore: 61, theirScore: 58 });
  assert.equal(movedCandidates([withScore], movedDraft(), today).length, 0, "a result rules it out");
  const inThePast = ours({ date: "10-10-2026" });
  assert.equal(movedCandidates([inThePast], movedDraft(), today).length, 0, "so does a date gone by");
  assert.equal(classify([movedDraft()], [inThePast], { today }).moved.length, 0);
  // And it is not silently dropped — a person is shown it.
  assert.equal(classify([movedDraft()], [inThePast], { today }).fresh.length, 1);
});

T("...and a fixture still ahead with no score is still a candidate", () => {
  assert.equal(movedCandidates([ours()], movedDraft(), new Date("2026-10-01T00:00:00")).length, 1);
});

T("GATE #28: THE SCAN DOCUMENT NEVER CARRIES A DRIVER'S NAME OR NUMBER", () => {
  // The first version pushed the whole club record into `cupScans`, which is written nightly
  // and kept until the season is cleared — outside the fourteen-day driver sweep entirely.
  // The same finding as gate #26's, in a new place, a week after it was closed.
  const withDriver = ours({ driverName: "משה", driverPhone: "052-1234567", notes: "טקסט חופשי" });
  const r = classify([movedDraft()], [withDriver]);
  const stored = JSON.stringify(r.moved[0].existing);
  assert.equal(stored.includes("052-1234567"), false, stored);
  assert.equal(stored.includes("משה"), false, stored);
  assert.equal(stored.includes("טקסט חופשי"), false, stored);
  // And what the screen needs is still there.
  assert.equal(r.moved[0].existing.federationCode, "779711");
  assert.equal(r.moved[0].existing.date, "04-11-2026");
  assert.equal(r.moved[0].existing.hallId, "h-alumim");
});

T("a projection, not a list of fields to strip", () => {
  // A strip-list has to be updated whenever a field is added, and the one that gets
  // forgotten is the one that matters. Anything unnamed never leaves the club document.
  const odd = ours({ somethingAddedNextYear: "secret", playerNotes: "x" });
  const stored = JSON.stringify(classify([movedDraft()], [odd]).moved[0].existing);
  assert.equal(stored.includes("secret"), false);
  assert.equal(stored.includes("playerNotes"), false);
});

T("the screen is told HOW the match was made", () => {
  // A match by id is the same fixture beyond doubt; a match by competition+opponent+side is
  // an inference. The screen says different things about the two and cannot tell them apart
  // from the outside.
  assert.equal(classify([movedDraft()], [ours({ scannedCode: "cup-1502072" })]).moved[0].by, "id");
  assert.equal(classify([movedDraft()], [ours()]).moved[0].by, "fixture");
});

console.log(`\n${n} cup-scan tests passed`);

T("GATE #28 B2: a move can carry the hall and clear a hand-typed address", () => {
  // `venue` is text. What decides where people drive is `hallId` for a home fixture and
  // `addressOverride` for an away one — and keeping both untouched, which is right when only
  // the clock moved, sent a squad to the OLD hall under the new date while the screen above
  // the button displayed the new one.
  const mine = ours({ hallId: "h-old", addressOverride: "כתובת ישנה שהזנתי" });
  const kept = applyMove(mine, movedDraft(), DAYS);
  assert.equal(kept.hallId, "h-old", "silence still means keep");
  assert.equal(kept.addressOverride, "כתובת ישנה שהזנתי");

  const moved = applyMove(mine, movedDraft(), DAYS, { hallId: "h-new", clearAddressOverride: true });
  assert.equal(moved.hallId, "h-new");
  assert.equal(moved.addressOverride, "");
  // And everything else the manager owns is still untouched.
  assert.equal(moved.teamId, mine.teamId);
  assert.equal(moved.federationCode, "779711");
});

console.log(`\n${n} cup-scan tests passed`);
