import assert from "node:assert/strict";
import {
  SEASON_START_MONTH, HALF_B_START_MONTH, MAX_LEN,
  seasonOf, halfOf, periodOf, seasonOfPeriod, periodsOfSeason, periodLabel,
  progressKey, parseProgressKey, buildProgress, markRead, isUnread, unreadCount,
  hasContent, progressFor, rosterFor, playerLabel, missingFor, writtenCount,
} from "../src/utils/playerProgress.js";

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("  ok  " + name); };

console.log("- the half-season model -");
t("mid-season dates land where you would say they do", () => {
  assert.equal(periodOf("2026-09-15"), "2026-27-A");
  assert.equal(periodOf("2027-03-10"), "2026-27-B");
});
t("the last day of half A, and the first day of half B", () => {
  assert.equal(periodOf("2027-01-31"), "2026-27-A");
  assert.equal(periodOf("2027-02-01"), "2026-27-B");
});
t("the last day of the season, and the first day of the next", () => {
  assert.equal(periodOf("2027-07-31"), "2026-27-B");
  // THE season rolls here, not the half — the two boundaries are a month apart and
  // confusing them is the whole risk of this module.
  assert.equal(periodOf("2027-08-01"), "2027-28-A");
});
t("August belongs to the season it opens, not the one that just ended", () => {
  // If the season began in September, a pre-season training on 20 August would file under
  // the previous season — and the end-of-season purge would delete it a fortnight later.
  assert.equal(seasonOf("2026-08-20"), "2026-27");
  assert.equal(halfOf("2026-08-20"), "A");
});
t("PROPERTY over three years, every single day: a period never leaves its season", () => {
  // This is the property the retention promise rests on. Deleting a season's documents
  // must delete exactly its two halves and leave no tail across the boundary.
  const d = new Date(Date.UTC(2025, 0, 1));
  let checked = 0;
  while (d.getUTCFullYear() < 2028) {
    const iso = d.toISOString().slice(0, 10);
    assert.equal(seasonOfPeriod(periodOf(iso)), seasonOf(iso), `drifted on ${iso}`);
    checked++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  assert.ok(checked > 1000, "the loop should have covered three years");
});
t("PROPERTY: every date falls in one of its season's two halves — no holes, no third bucket", () => {
  const d = new Date(Date.UTC(2026, 0, 1));
  while (d.getUTCFullYear() < 2028) {
    const iso = d.toISOString().slice(0, 10);
    assert.ok(periodsOfSeason(seasonOf(iso)).includes(periodOf(iso)), `orphan on ${iso}`);
    d.setUTCDate(d.getUTCDate() + 1);
  }
});
t("the split is six months and six months", () => {
  const halves = Array.from({ length: 12 }, (_, i) => halfOf(`2027-${String(i + 1).padStart(2, "0")}-15`));
  assert.equal(halves.filter((h) => h === "A").length, 6);
  assert.equal(halves.filter((h) => h === "B").length, 6);
  assert.equal(SEASON_START_MONTH, 8);
  assert.equal(HALF_B_START_MONTH, 2);
});
t("garbage returns empty and never throws", () => {
  ["", null, undefined, "not-a-date", "2026-13-01", "2026-02-30", "26-09-15", "2026-9-15"]
    .forEach((v) => {
      assert.equal(seasonOf(v), "", `seasonOf(${v})`);
      assert.equal(halfOf(v), "", `halfOf(${v})`);
      assert.equal(periodOf(v), "", `periodOf(${v})`);
    });
});
t("seasonOfPeriod and periodsOfSeason reject malformed ids", () => {
  assert.equal(seasonOfPeriod("2026-27-C"), "");
  assert.equal(seasonOfPeriod("nonsense"), "");
  assert.deepEqual(periodsOfSeason("2026-27"), ["2026-27-A", "2026-27-B"]);
  assert.deepEqual(periodsOfSeason("junk"), []);
});
t("the label is readable Hebrew", () => {
  assert.equal(periodLabel("2026-27-A"), "חציון א׳ · עונת 2026/27");
  assert.equal(periodLabel("2026-27-B"), "חציון ב׳ · עונת 2026/27");
  assert.equal(periodLabel("junk"), "");
});

console.log("- the document key -");
t("key and parse round-trip", () => {
  assert.equal(progressKey("a1b2c3d4", "2026-27-A"), "a1b2c3d4__2026-27-A");
  assert.deepEqual(parseProgressKey("a1b2c3d4__2026-27-A"), { playerId: "a1b2c3d4", period: "2026-27-A" });
});
t("a missing half refuses to build a key — better no save than a save to junk", () => {
  assert.equal(progressKey("", "2026-27-A"), "");
  assert.equal(progressKey("a1b2", ""), "");
  assert.equal(parseProgressKey("no-separator"), null);
  assert.equal(parseProgressKey("__2026-27-A"), null);
});

console.log("- buildProgress -");
const NOW = "2026-12-30T10:00:00.000Z";
const LATER = "2026-12-31T10:00:00.000Z";
const base = { playerId: "p1", teamId: "t1", period: "2026-27-A", author: "דני כהן", authorEmail: "Dani@Example.COM", now: NOW };

t("a first write", () => {
  const e = buildProgress(null, { ...base, text: "  התקדם במסירה  " });
  assert.equal(e.text, "התקדם במסירה");
  assert.equal(e.createdAt, NOW);
  assert.equal(e.updatedAt, NOW);
  assert.equal(e.readAt, null);
});
t("authorEmail is lower-cased — the rule compares it exactly", () =>
  assert.equal(buildProgress(null, { ...base, text: "x" }).authorEmail, "dani@example.com"));
t("text is capped at MAX_LEN", () => {
  const e = buildProgress(null, { ...base, text: "א".repeat(MAX_LEN + 500) });
  assert.equal(e.text.length, MAX_LEN);
});
t("an identical save does NOT move updatedAt and does NOT clear readAt", () => {
  // The lesson already paid for in buildNote: otherwise re-saving an unchanged note pushes
  // it back into the manager's unread queue with nobody having written a word.
  const first = buildProgress(null, { ...base, text: "אותו טקסט" });
  const read = markRead(first, NOW);
  const again = buildProgress(read, { ...base, text: "אותו טקסט", now: LATER });
  assert.equal(again.updatedAt, NOW);
  assert.equal(again.readAt, NOW);
  assert.equal(isUnread(again), false);
});
t("a real edit moves updatedAt and puts it back in front of the manager", () => {
  const read = markRead(buildProgress(null, { ...base, text: "ראשון" }), NOW);
  const edited = buildProgress(read, { ...base, text: "שני", now: LATER });
  assert.equal(edited.updatedAt, LATER);
  assert.equal(edited.readAt, null);
  assert.equal(isUnread(edited), true);
});
t("createdAt survives an edit", () => {
  const first = buildProgress(null, { ...base, text: "א" });
  const second = buildProgress(first, { ...base, text: "ב", now: LATER });
  assert.equal(second.createdAt, NOW);
});
t("a save with no author falls back rather than emptying ownership", () => {
  // Clearing authorEmail would fail the ownership rule on the NEXT write and silently drop
  // the record out of the coach's own filtered listen.
  const first = buildProgress(null, { ...base, text: "א" });
  const second = buildProgress(first, { ...base, text: "ב", author: "", authorEmail: "", now: LATER });
  assert.equal(second.authorEmail, "dani@example.com");
  assert.equal(second.author, "דני כהן");
});
t("THE DELETION PROMISE: the player's name is nowhere in the stored document", () => {
  // docs/data-deletion-procedure.md says a parent's request is answered by one lookup on
  // playerId. That is only true while no copy of the name lives here.
  const e = buildProgress(null, { ...base, text: "יוסי התקדם מאוד", author: "דני כהן" });
  assert.deepEqual(
    Object.keys(e).sort(),
    ["author", "authorEmail", "createdAt", "period", "playerId", "readAt", "teamId", "text", "updatedAt"]
  );
  assert.ok(!Object.keys(e).some((k) => /name/i.test(k)), "no name-shaped field");
  const values = Object.values(e).map(String);
  assert.ok(!values.includes("יוסי לוי"), "the player's name must not be stored");
});

console.log("- unread -");
t("empty text is never unread, however long it sits", () =>
  assert.equal(isUnread({ text: "   ", updatedAt: NOW, readAt: null }), false));
t("written and never read is unread", () =>
  assert.equal(isUnread({ text: "x", updatedAt: NOW, readAt: null }), true));
t("read, then edited, is unread again", () =>
  assert.equal(isUnread({ text: "x", updatedAt: LATER, readAt: NOW }), true));
t("unreadCount counts the map", () =>
  assert.equal(unreadCount({
    a: { text: "x", updatedAt: NOW, readAt: null },
    b: { text: "y", updatedAt: NOW, readAt: NOW },
    c: { text: "", updatedAt: NOW, readAt: null },
  }), 1));
t("hasContent ignores whitespace", () => {
  assert.equal(hasContent({ text: "  " }), false);
  assert.equal(hasContent({ text: " a " }), true);
  assert.equal(hasContent(null), false);
});

console.log("- the roster projection: MINIMISATION, and it is asserted not reviewed -");
const players = [
  { id: "p1", teamId: "t1", name: "יוסי לוי", phone: "050-1234567", birthDate: "01-01-2012", shirtSize: "S", jerseyNumber: "7" },
  { id: "p2", teamId: "t1", name: "יוסי לוי", phone: "052-7654321", birthDate: "02-02-2012", jerseyNumber: "9" },
  { id: "p3", teamId: "t1", name: "אבי כהן", phone: "053-1112222", jerseyNumber: "4" },
  { id: "p4", teamId: "t2", name: "רון שחר", phone: "054-3334444" },
];
t("the projection carries id, team and name — and NOTHING else", () => {
  const roster = rosterFor(players, ["t1"]);
  roster.forEach((p) => assert.deepEqual(Object.keys(p).sort(), ["id", "name", "teamId"]));
});
t("no phone, no birth date, no size survives the projection", () => {
  const blob = JSON.stringify(rosterFor(players, ["t1", "t2"]));
  ["050-1234567", "052-7654321", "053-1112222", "054-3334444", "01-01-2012", "02-02-2012", '"S"']
    .forEach((needle) => assert.ok(!blob.includes(needle), `${needle} leaked into the screen's data`));
});
t("players of other teams are not in the coach's roster", () => {
  assert.deepEqual(rosterFor(players, ["t1"]).map((p) => p.id), ["p1", "p2", "p3"]);
  assert.deepEqual(rosterFor(players, ["t2"]).map((p) => p.id), ["p4"]);
  assert.deepEqual(rosterFor(players, []), []);
});
t("nothing throws on rubbish", () => {
  assert.deepEqual(rosterFor(null, ["t1"]), []);
  assert.deepEqual(rosterFor(players, null), []);
  assert.deepEqual(rosterFor([null, {}, { id: "x" }], ["t1"]), []);
});

console.log("- telling two players with one name apart -");
t("duplicated names carry the shirt number, unique ones do not", () => {
  const full = players.filter((p) => p.teamId === "t1");
  assert.equal(playerLabel(full[0], full), "יוסי לוי (7)");
  assert.equal(playerLabel(full[1], full), "יוסי לוי (9)");
  assert.equal(playerLabel(full[2], full), "אבי כהן");
});
t("a nameless record does not crash the list", () =>
  assert.equal(playerLabel({ id: "x" }, []), "—"));

console.log("- what is still missing this half -");
const roster = rosterFor(players, ["t1"]);
const written = (playerId, period, text = "כתוב") => ({
  [progressKey(playerId, period)]: buildProgress(null, { ...base, playerId, period, text }),
});
t("missingFor lists whoever has nothing written", () => {
  const map = { ...written("p1", "2026-27-A") };
  assert.deepEqual(missingFor(roster, map, "2026-27-A").map((p) => p.id), ["p2", "p3"]);
  assert.equal(writtenCount(roster, map, "2026-27-A"), 1);
});
t("HALF A DOES NOT COUNT FOR HALF B — the test that catches ignoring `period`", () => {
  const map = { ...written("p1", "2026-27-A") };
  assert.deepEqual(missingFor(roster, map, "2026-27-B").map((p) => p.id), ["p1", "p2", "p3"]);
  assert.equal(writtenCount(roster, map, "2026-27-B"), 0);
});
t("an empty note counts as missing, not as done", () => {
  const map = { ...written("p1", "2026-27-A", "   ") };
  assert.equal(writtenCount(roster, map, "2026-27-A"), 0);
});
t("progressFor finds the right half and nothing else", () => {
  const map = { ...written("p1", "2026-27-A", "של א") , ...written("p1", "2026-27-B", "של ב") };
  assert.equal(progressFor(map, "p1", "2026-27-A").text, "של א");
  assert.equal(progressFor(map, "p1", "2026-27-B").text, "של ב");
  assert.equal(progressFor(map, "p9", "2026-27-A"), null);
});

console.log("\n" + pass + " tests passed");
