import assert from "node:assert/strict";
import { CLASH_HEADERS, clashRows, clashRowToCells, clashSheetAoa, clashFileName } from "../src/utils/clashExport.js";
import { isoToDmy, parseBirthDate, toIsoBirthDate, birthDateDmy } from "../src/utils/dates.js";
import { birthDateText } from "../src/utils/coachExport.js";
import { birthText } from "../src/utils/playerExport.js";

let count = 0;
const T = (name, fn) => { fn(); console.log("  ok  " + name); count++; };

// Two findings on two different evenings, in date order as `seasonHallClashes` returns them.
const clashes = [
  {
    date: "2026-10-15", day: "חמישי", hall: "רימונים", sameTeam: false, duplicate: false,
    rows: [
      { id: "s1", team: "נערים א · דני כהן", start: "17:00", end: "18:30", kind: "game", label: "משחק בית",
        opponent: "מכבי רעננה", code: "800509" },
      { id: "s2", team: "ילדים ב · רון לוי", start: "18:00", end: "19:30", kind: "training", label: "אימון",
        opponent: "", code: "" },
    ],
  },
  {
    date: "2026-10-22", day: "חמישי", hall: "ברק", sameTeam: true, duplicate: true,
    rows: [
      { id: "s3", team: "נוער · שיר בר", start: "20:00", end: "21:30", kind: "training", label: "אימון" },
      { id: "s4", team: "נוער · שיר בר", start: "20:00", end: "21:30", kind: "training", label: "אימון" },
    ],
  },
];

const rows = clashRows(clashes);

T("two rows per finding — one per side", () => {
  assert.equal(rows.length, 4);
});

T("every row stands on its own — nothing is left blank for the row above", () => {
  // This is the whole difference from the PDF. A blank cell belongs to whatever lands
  // above it once the sheet is sorted, and a filter on one hall drops half of every pair.
  // `opponent` and `code` are deliberately NOT in this list: a training has neither, and
  // blank there is the true answer rather than a repeat of the row above.
  for (const r of rows) {
    for (const field of ["date", "day", "hall", "finding", "start", "end", "team", "label"]) {
      assert.notEqual(r[field], "", `"${field}" was left blank`);
    }
  }
});

T("the opposing club and the fixture number travel with the row", () => {
  // The report exists to be acted on, and the action is a phone call to the other club.
  assert.equal(rows[0].opponent, "מכבי רעננה");
  assert.equal(rows[0].code, "800509");
});

T("a training has no opponent and no fixture number — blank, not a dash", () => {
  // Blank so that filtering the column separates fixtures from trainings in one click.
  assert.equal(rows[1].opponent, "");
  assert.equal(rows[1].code, "");
});

T("the finding number is what keeps a pair together after a sort", () => {
  assert.deepEqual(rows.map((r) => r.n), [1, 1, 2, 2]);
});

T("sorting by the finding number restores date order", () => {
  const shuffled = [...rows].reverse().sort((a, b) => a.n - b.n);
  assert.deepEqual(shuffled.map((r) => r.date), rows.map((r) => r.date));
});

T("the finding is named on BOTH rows, in the same words the screen uses", () => {
  assert.deepEqual(
    rows.map((r) => r.finding),
    ["שתי קבוצות באותו אולם", "שתי קבוצות באותו אולם",
     "אותה שורה פעמיים — כפילות", "אותה שורה פעמיים — כפילות"]
  );
});

T("dates are written DD/MM/YYYY, not the stored ISO", () => {
  assert.equal(rows[0].date, "15/10/2026");
});

T("a booking with no squad says so rather than leaving a cell empty", () => {
  const out = clashRows([{ date: "2026-10-15", day: "חמישי", hall: "רימונים",
    rows: [{ start: "17:00", end: "18:30", label: "אימון" }, { start: "17:30", end: "19:00", team: "נוער", label: "אימון" }] }]);
  assert.equal(out[0].team, "(ללא קבוצה)");
});

T("nothing at all produces no rows, and does not throw", () => {
  assert.deepEqual(clashRows([]), []);
  assert.deepEqual(clashRows(null), []);
  assert.deepEqual(clashRows([null, undefined]), []);
});

T("a cell row matches the header, column for column", () => {
  const cells = clashRowToCells(rows[0]);
  assert.equal(cells.length, CLASH_HEADERS.length);
  assert.deepEqual(cells, [1, "15/10/2026", "חמישי", "רימונים", "שתי קבוצות באותו אולם",
    "17:00", "18:30", "נערים א · דני כהן", "משחק בית", "מכבי רעננה", "800509"]);
});

T("the sheet says what it is, how to read it, and what it cannot do", () => {
  const aoa = clashSheetAoa(rows, { dateText: "22/09/2026", findings: 2, days: 2 });
  assert.match(aoa[0][0], /התנגשויות אולם/);
  assert.match(aoa[1][0], /אותו מספר/);           // how a pair is recognised
  assert.match(aoa[2][0], /הקובץ מאתר, ואינו משנה דבר/); // the same sentence the screen carries
  assert.match(aoa[3][0], /להזזת משחק/);          // which columns to use, and that a training has neither
  assert.deepEqual(aoa[5], CLASH_HEADERS);
  assert.equal(aoa.length, 6 + rows.length + 2);
  assert.match(aoa[aoa.length - 1][0], /2 ממצאים ב-2 ימים/);
});

T("the filename carries the day, so two exports cannot look identical", () => {
  assert.equal(clashFileName("2026-09-22"), "התנגשויות-אולם-2026-09-22.xlsx");
});

// ---------- the date formatter that now has one home ----------

T("isoToDmy converts the dates the APP writes — clash dates, week keys, today", () => {
  assert.equal(isoToDmy("2010-03-04"), "04/03/2010");
  assert.equal(isoToDmy(""), "");
  assert.equal(isoToDmy("not a date"), "");
});

T("every birth date on screen or in a file goes through ONE formatter", () => {
  // Three of the four used to do this by splitting on "-" and printing the parts in the
  // order they came out — right for one stored format, backwards for the other.
  assert.equal(birthDateText, birthDateDmy, "the coach list has its own copy again");
  assert.equal(birthText, birthDateDmy, "the player list has its own copy again");
  assert.equal(birthDateDmy("2014-09-23"), "23/09/2014");
  assert.equal(birthDateDmy("23-09-2014"), "23/09/2014");
  assert.equal(birthDateDmy("זבל"), "");
});

// ---------- the birth date, which has never had one format ----------

T("both stored forms parse to the same day", () => {
  assert.deepEqual(parseBirthDate("2014-09-23"), parseBirthDate("23-09-2014"));
  assert.deepEqual(parseBirthDate("23/09/2014"), parseBirthDate("23-09-2014"));
  assert.equal(parseBirthDate("2014-09-23").mo, 9);
});

T("a four-digit year says which end is the year — nothing is guessed", () => {
  // 01-02-1988 is the 1st of February. There is no locale here and no ambiguity: the only
  // four-digit group is the year, and it is either first or last.
  assert.equal(parseBirthDate("01-02-1988").mo, 2);
  assert.equal(parseBirthDate("01-02-1988").d, 1);
  assert.equal(parseBirthDate("1988-02-01").mo, 2);
});

T("nonsense stays nonsense — the parser was widened, not loosened", () => {
  for (const bad of ["", null, undefined, "2014", "31-02-2014", "2014-13-01", "23 בספטמבר", "14-10-88"]) {
    assert.equal(parseBirthDate(bad), null, JSON.stringify(bad) + " was accepted");
  }
});

T("toIsoBirthDate is the one canonical form, and it is what the import writes now", () => {
  assert.equal(toIsoBirthDate("23-09-2014"), "2014-09-23");
  assert.equal(toIsoBirthDate("7/4/2011"), "2011-04-07");
  assert.equal(toIsoBirthDate("2014-09-23"), "2014-09-23");
  assert.equal(toIsoBirthDate("זבל"), "");
});

console.log(`\n${count} tests passed`);
