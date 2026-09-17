import assert from "node:assert/strict";
import {
  splitTitle, decodeTitle, matchesClub, splitDateTime, eventToDraft,
  classify, draftToGame, cupCode, CUP_LEAGUES,
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
