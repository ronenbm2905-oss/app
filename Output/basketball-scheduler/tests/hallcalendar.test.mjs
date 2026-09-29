// One hall, one month — "is it free on the 2nd?"
//
// Built 29.9.2026 from Ronen's own case: a coach asks to bring a fixture forward from 17.12
// to 2.12, and answering it meant two trips through the weekly board on a phone while the
// other side waited. The tests below are that call, and the ways it can be answered wrongly.

import assert from "node:assert/strict";
import {
  hallMonth, gamesByDate, hallOfGame, monthGrid, shiftMonth, dayAnswer, monthLabel, isoOf,
} from "../src/utils/hallCalendar.js";

let n = 0;
const T = (name, fn) => { fn(); n++; console.log("  ok  " + name); };

const HALLS = [{ id: "h1", name: "ברק" }, { id: "h2", name: "רימונים" }];
const TEAMS = [{ id: "t1", name: "קטסל א" }, { id: "t2", name: "נוער" }];
const base = (games = [], absences = []) => ({ halls: HALLS, teams: TEAMS, games, absences });
const g = (o) => ({ federationCode: "x", teamId: "t1", isHome: true, hallId: "h1", time: "18:00", ...o });
const SEP29 = new Date(2026, 8, 29);

T("THE CALL: 17.12 is taken, 2.12 is free — the two dates that started this", () => {
  const data = base([g({ federationCode: "1", date: "17-12-2026", opponent: "מכבי רעננה" })]);
  const m = hallMonth(data, "h1", 2026, 11, { today: SEP29 });
  const d17 = m.days.find((d) => d.iso === "2026-12-17");
  const d2 = m.days.find((d) => d.iso === "2026-12-02");
  assert.equal(d17.state, "games");
  assert.equal(dayAnswer(d17), "1 משחק");
  assert.equal(d2.state, "free");
  assert.equal(dayAnswer(d2), "פנוי ממשחקים");
});

T("AN AWAY FIXTURE DOES NOT BLOCK OUR HALL — it is played in someone else's", () => {
  // The likeliest way this screen could lie: counting every fixture and showing a hall as
  // busy on an evening it is standing empty.
  const data = base([g({ date: "02-12-2026", isHome: false, hallId: "", venue: "אולם גבעתיים" })]);
  const m = hallMonth(data, "h1", 2026, 11, { today: SEP29 });
  assert.equal(m.days.find((d) => d.iso === "2026-12-02").state, "free");
  assert.equal(m.withGames, 0);
});

T("a fixture with no hallId is matched by its venue name", () => {
  // Fixtures imported before the form started storing the id carry only the federation's
  // spelling. Both of the club's own seeded fixtures are like this.
  const data = base([g({ date: "13-10-2026", hallId: "", venue: "ברק", opponent: "אליצור" })]);
  assert.equal(hallOfGame(data.games[0], HALLS), "h1");
  const m = hallMonth(data, "h1", 2026, 9, { today: SEP29 });
  assert.equal(m.days.find((d) => d.iso === "2026-10-13").state, "games");
});

T("a fixture in the OTHER hall does not appear", () => {
  const data = base([g({ date: "02-12-2026", hallId: "h2" })]);
  assert.equal(hallMonth(data, "h1", 2026, 11, { today: SEP29 }).withGames, 0);
  assert.equal(hallMonth(data, "h2", 2026, 11, { today: SEP29 }).withGames, 1);
});

T("A HALL CLOSURE BLOCKS THE DATE, or the screen would offer a hall that is not there", () => {
  // The municipality takes the hall for an event. Counting only fixtures would print "free"
  // over it, and that answer gets given on the phone.
  const data = base([], [{ hallId: "h1", date: "2026-12-02", allDay: true, note: "עירייה" }]);
  const d = hallMonth(data, "h1", 2026, 11, { today: SEP29 }).days.find((x) => x.iso === "2026-12-02");
  assert.equal(d.state, "closed");
  assert.equal(dayAnswer(d), "האולם תפוס — עירייה");
});

T("a closure on the OTHER hall does not block this one", () => {
  const data = base([], [{ hallId: "h2", date: "2026-12-02", allDay: true }]);
  assert.equal(hallMonth(data, "h1", 2026, 11, { today: SEP29 }).closedDays, 0);
});

T("a closure outranks a fixture — the hall is gone either way", () => {
  const data = base(
    [g({ date: "02-12-2026" })],
    [{ hallId: "h1", date: "2026-12-02", allDay: true, note: "שיפוץ" }]
  );
  const d = hallMonth(data, "h1", 2026, 11, { today: SEP29 }).days.find((x) => x.iso === "2026-12-02");
  assert.equal(d.state, "closed");
});

T("a CANCELLED fixture frees the date — and still says a game was there", () => {
  // The hall genuinely is free that evening. But a date that used to hold a fixture and now
  // shows nothing cannot be told apart from one nobody ever booked, and the difference is
  // worth seeing when somebody asks why it came free.
  const data = base([g({ date: "02-12-2026", cancelled: true, opponent: "חולון" })]);
  const d = hallMonth(data, "h1", 2026, 11, { today: SEP29 }).days.find((x) => x.iso === "2026-12-02");
  assert.equal(d.state, "off");
  assert.equal(d.live, 0);
  assert.equal(d.games.length, 1, "the cancelled fixture is still listed");
  assert.equal(dayAnswer(d), "פנוי (המשחק בוטל)");
});

T("a live fixture beside a cancelled one still reads as taken", () => {
  const data = base([
    g({ federationCode: "1", date: "02-12-2026", cancelled: true }),
    g({ federationCode: "2", date: "02-12-2026", time: "20:00" }),
  ]);
  const d = hallMonth(data, "h1", 2026, 11, { today: SEP29 }).days.find((x) => x.iso === "2026-12-02");
  assert.equal(d.state, "games");
  assert.equal(d.live, 1);
});

T("PAST DAYS ARE NOT COUNTED AS FREE — offering a date that has gone is worse than none", () => {
  const data = base([]);
  // Asked on the 29th of September, about September.
  const m = hallMonth(data, "h1", 2026, 8, { today: SEP29 });
  assert.equal(m.freeAhead, 2, "only the 29th and the 30th are still ahead");
});

T("fixtures on one date are listed in time order", () => {
  const data = base([
    g({ federationCode: "1", date: "02-12-2026", time: "20:00" }),
    g({ federationCode: "2", date: "02-12-2026", time: "17:30" }),
  ]);
  const list = gamesByDate(data, "h1").get("2026-12-02");
  assert.deepEqual(list.map((x) => x.time), ["17:30", "20:00"]);
});

T("the team's name travels with the fixture, not its id", () => {
  const data = base([g({ date: "02-12-2026", teamId: "t2", opponent: "רעננה" })]);
  const [row] = gamesByDate(data, "h1").get("2026-12-02");
  assert.equal(row.team, "נוער");
  assert.equal(row.opponent, "רעננה");
});

T("an unreadable date is dropped rather than landing on a wrong day", () => {
  const data = base([g({ date: "לא תאריך" }), g({ federationCode: "2", date: "" })]);
  assert.equal(gamesByDate(data, "h1").size, 0);
});

T("no hall selected means no fixtures, not every fixture", () => {
  assert.equal(gamesByDate(base([g({ date: "02-12-2026" })]), "").size, 0);
});

T("the grid is Sunday-first, whole weeks, and neighbours are flagged", () => {
  // December 2026 starts on a Tuesday, so the row must be padded back to Sunday 29.11.
  const cells = monthGrid(2026, 11);
  assert.equal(cells.length % 7, 0);
  assert.equal(cells[0].weekDay, 0);
  assert.equal(cells[0].iso, "2026-11-29");
  assert.equal(cells[0].inMonth, false);
  assert.equal(cells.find((c) => c.iso === "2026-12-01").inMonth, true);
});

T("a six-week month keeps its sixth row; a short one does not grow one", () => {
  // August 2026 starts on a Saturday and needs six rows. February-style months must not be
  // padded with a row of nothing but the next month.
  assert.equal(monthGrid(2026, 7).length, 42);
  assert.equal(monthGrid(2026, 1).length % 7, 0);
  assert.equal(monthGrid(2026, 1).length <= 35, true);
});

T("moving month by month does not skip one at a year boundary", () => {
  // `new Date(y, m+1, 31)` is how December turns into the 31st of a month that has 30 days.
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month: 0 });
  assert.deepEqual(shiftMonth(2027, 0, -1), { year: 2026, month: 11 });
  assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, month: 11 });
});

T("the month reads in Hebrew, and the ISO helper is local — not UTC", () => {
  assert.equal(monthLabel(2026, 11), "דצמבר 2026");
  // A date built locally at midnight is the previous day in UTC. `toISOString().slice(0,10)`
  // would move every evening fixture back a day for anyone east of Greenwich — which is
  // everyone using this.
  assert.equal(isoOf(new Date(2026, 11, 2)), "2026-12-02");
});

console.log(`\n${n} hall-calendar tests passed`);
