import assert from "node:assert/strict";
import {
  birthdaysInWeek, playerBirthdaysInWeek, birthdayWhen, todayOffsetInWeek,
} from "../src/utils/birthdays.js";

// This module shipped in August and ran on the club's notice board for two months with NO
// TESTS AT ALL — not because anyone decided to skip them, but because it imported
// "../constants" without the ".js" and therefore could not be loaded under Node. The
// extension was fixed on 22.9.2026 while adding players, and these are the assertions that
// should have existed from the start.

let count = 0;
const T = (name, fn) => { fn(); console.log("  ok  " + name); count++; };

// Sunday 11.10.2026 → Saturday 17.10.2026.
const WEEK = "2026-10-11";
const names = (list) => list.map((e) => e.name);

T("only the people whose birthday lands inside the week appear", () => {
  const people = [
    { id: "a", name: "נדב", birthDate: "1988-10-11" },   // the Sunday itself
    { id: "b", name: "עומר", birthDate: "1990-10-17" },  // the Saturday itself
    { id: "c", name: "סהר", birthDate: "1991-10-18" },   // one day late
    { id: "d", name: "רועי", birthDate: "1991-10-10" },  // one day early
  ];
  assert.deepEqual(names(birthdaysInWeek(people, WEEK)), ["נדב", "עומר"]);
});

T("both ends of the week are inside it", () => {
  // An off-by-one here silently drops a birthday, and nobody finds out until the day after.
  const sun = birthdaysInWeek([{ id: "a", name: "א", birthDate: "1988-10-11" }], WEEK);
  const sat = birthdaysInWeek([{ id: "b", name: "ב", birthDate: "1988-10-17" }], WEEK);
  assert.equal(sun[0].offset, 0);
  assert.equal(sat[0].offset, 6);
});

T("the YEAR is ignored — the birthday recurs, and no age is derived", () => {
  const entry = birthdaysInWeek([{ id: "a", name: "א", birthDate: "1950-10-14" }], WEEK)[0];
  assert.equal(entry.dateLabel, "14/10");
  // Nothing in the entry may carry an age or a year. This is the guarantee the policy
  // rests on, and for players it is a guarantee about a child.
  assert.equal(JSON.stringify(entry).includes("1950"), false);
  assert.deepEqual(
    Object.keys(entry).sort(),
    ["dateLabel", "dayName", "id", "name", "observed", "offset"]
  );
});

T("the list is ordered by the day it falls on, then by name", () => {
  const people = [
    { id: "a", name: "ת", birthDate: "1988-10-15" },
    { id: "b", name: "ב", birthDate: "1988-10-12" },
    { id: "c", name: "א", birthDate: "1988-10-12" },
  ];
  assert.deepEqual(names(birthdaysInWeek(people, WEEK)), ["א", "ב", "ת"]);
});

// 29 February — the case that silently never fires if nobody thought about it.
T("someone born on 29/02 is shown on 28/02 in a common year, and flagged", () => {
  const leapling = [{ id: "a", name: "א", birthDate: "2000-02-29" }];
  // 2027 is not a leap year; the week of Sunday 28.2.2027 opens on 28.2.
  const entry = birthdaysInWeek(leapling, "2027-02-28")[0];
  assert.equal(entry.dateLabel, "28/02");
  assert.equal(entry.observed, true, "the screen must be able to say 'born on 29/02'");
});

T("and on 29/02 itself in a leap year, unflagged", () => {
  const leapling = [{ id: "a", name: "א", birthDate: "2000-02-29" }];
  // 2028 is a leap year; the week of Sunday 27.2.2028 contains 29.2.
  const entry = birthdaysInWeek(leapling, "2028-02-27")[0];
  assert.equal(entry.dateLabel, "29/02");
  assert.equal(entry.observed, false);
});

T("an impossible date is not rolled over into a real one", () => {
  // `new Date(2020, 1, 31)` is 2 March. A birthday on the 2nd of March would be invented
  // out of a typo.
  assert.deepEqual(birthdaysInWeek([{ id: "a", name: "א", birthDate: "2020-02-31" }], "2026-03-01"), []);
  assert.deepEqual(birthdaysInWeek([{ id: "a", name: "א", birthDate: "1988-13-01" }], WEEK), []);
});

T("a missing or unreadable birth date is skipped, not guessed", () => {
  const people = [
    { id: "a", name: "יש", birthDate: "1988-10-14" },
    { id: "b", name: "אין", birthDate: "" },
    { id: "c", name: "זבל", birthDate: "14 באוקטובר" },
    { id: "d", name: "חסר" },
    { id: "e", name: "לא תאריך", birthDate: "1988" },
  ];
  assert.deepEqual(names(birthdaysInWeek(people, WEEK)), ["יש"]);
});

// This test used to assert the OPPOSITE — that "14/10/1988" is garbage and skipped. It was
// written when ISO was the only format anyone believed was stored, and it is exactly the
// assumption that made the list show no child at all on the day it shipped: sixteen of the
// club's eighteen players carry "23-09-2014", written by the Excel import. And the club's
// own template (`players.js`, the example row) demonstrates "12/07/2012" — so a manager
// filling it in by hand produces the third form.
T("the two formats a birth date is actually stored in both read", () => {
  const people = [
    { id: "a", name: "מהטופס", birthDate: "1988-10-14" },   // <input type="date">
    { id: "b", name: "מהאקסל", birthDate: "14-10-1988" },   // formatDateFromExcel
    { id: "c", name: "מהתבנית", birthDate: "14/10/1988" },  // typed into the template
  ];
  const out = birthdaysInWeek(people, WEEK);
  assert.equal(out.length, 3);
  assert.deepEqual([...new Set(out.map((e) => e.dateLabel))], ["14/10"]);
});

T("a four-digit year is either first or last, so the two forms cannot be confused", () => {
  // 01-02-1988 is the 1st of February, not the 2nd of January — the year says which end.
  const [entry] = birthdaysInWeek([{ id: "a", name: "א", birthDate: "01-02-1988" }], "2026-02-01");
  assert.equal(entry.dateLabel, "01/02");
});

T("a person with no name is skipped — a blank line on a notice helps nobody", () => {
  assert.deepEqual(birthdaysInWeek([{ id: "a", name: "  ", birthDate: "1988-10-14" }], WEEK), []);
});

// ---------- "היום" / "מחר" ----------

T("today and tomorrow are said only when the week on screen IS this week", () => {
  const entry = { offset: 3, dayName: "רביעי", dateLabel: "14/10" };
  assert.equal(birthdayWhen(entry, 3), "היום");
  // No emoji in the returned string — a screen reader reads it aloud mid-sentence.
  assert.equal(/\p{Extended_Pictographic}/u.test(birthdayWhen(entry, 3)), false);
  assert.equal(birthdayWhen(entry, 2), "מחר");
  assert.equal(birthdayWhen(entry, 0), "יום רביעי, 14/10");
  // A day already gone must say so, or it reads as one coming up and the wish arrives late.
  assert.equal(birthdayWhen(entry, 4), "יום רביעי, 14/10 (עבר)");
  assert.equal(birthdayWhen(entry, 6), "יום רביעי, 14/10 (עבר)");
  // -1 is "the week shown is not the current one" — saying "today", or "already gone",
  // would both be lies about a week nobody is standing in.
  assert.equal(birthdayWhen(entry, -1), "יום רביעי, 14/10");
});

T("todayOffsetInWeek places today, or says it is not in this week", () => {
  assert.equal(todayOffsetInWeek(WEEK, "2026-10-11"), 0);
  assert.equal(todayOffsetInWeek(WEEK, "2026-10-17"), 6);
  assert.equal(todayOffsetInWeek(WEEK, "2026-10-18"), -1);
  assert.equal(todayOffsetInWeek(WEEK, "2026-10-10"), -1);
  assert.equal(todayOffsetInWeek(WEEK, "nonsense"), -1);
});

// ---------- players ----------

const club = {
  coaches: [{ id: "c1", name: "נדב שוורץ" }, { id: "c2", name: "עמנואל ורדי" }],
  teams: [
    { id: "t1", name: "ילדים ב", coachId: "c1" },
    { id: "t2", name: "ילדים ב", coachId: "c2" },
  ],
  players: [
    { id: "p1", name: "יוסי", teamId: "t1", birthDate: "2014-10-14", phone: "0500000000" },
    { id: "p2", name: "דנה", teamId: "t2", birthDate: "2015-10-14" },
    { id: "p3", name: "איתי", teamId: "t1", birthDate: "2014-01-01" },
  ],
};

T("a coach sees the children of their own squads and nobody else's", () => {
  const mine = playerBirthdaysInWeek(club, WEEK, { teamIds: ["t1"] });
  assert.deepEqual(names(mine), ["יוסי"]);
  assert.equal(mine.some((e) => e.name === "דנה"), false, "the other squad's child must not appear");
});

T("a manager — no scope — sees the club", () => {
  assert.deepEqual(names(playerBirthdaysInWeek(club, WEEK)).sort(), ["דנה", "יוסי"]);
  assert.deepEqual(names(playerBirthdaysInWeek(club, WEEK, { teamIds: null })).sort(), ["דנה", "יוסי"]);
});

// THE DISTINCTION THAT DECIDES WHETHER THIS IS SAFE.
T("an EMPTY scope means nothing, not everything", () => {
  // A coach the club has not linked to any squad must get an empty list. Falling back to
  // "show everyone" would hand ~550 children's birth dates to an unplaceable account.
  assert.deepEqual(playerBirthdaysInWeek(club, WEEK, { teamIds: [] }), []);
});

T("each child's squad is named, so ten names in a week can be placed", () => {
  const all = playerBirthdaysInWeek(club, WEEK);
  const yossi = all.find((e) => e.name === "יוסי");
  const dana = all.find((e) => e.name === "דנה");
  // The squad name plain — appending the coach would print a coach's own name against
  // every one of their own children.
  assert.equal(yossi.team, "ילדים ב");
  assert.equal(dana.team, "ילדים ב");
  assert.equal(yossi.teamId, "t1");
});

// The entry travels into a React component and out to the screen. Whatever is on it can be
// read; whatever is not on it cannot leak.
T("NOTHING about the child travels except the name, the day and the squad", () => {
  const entry = playerBirthdaysInWeek(club, WEEK, { teamIds: ["t1"] })[0];
  assert.deepEqual(
    Object.keys(entry).sort(),
    ["dateLabel", "dayName", "id", "name", "observed", "offset", "team", "teamId"]
  );
  const json = JSON.stringify(entry);
  assert.equal(json.includes("0500000000"), false, "no phone");
  assert.equal(json.includes("2014"), false, "no year of birth, and therefore no age");
});

T("a child with no birth date on file simply does not appear", () => {
  const partial = { ...club, players: [{ id: "p9", name: "ללא", teamId: "t1", birthDate: "" }] };
  assert.deepEqual(playerBirthdaysInWeek(partial, WEEK, { teamIds: ["t1"] }), []);
});

T("a child not attached to any squad is invisible to a coach, visible to a manager", () => {
  const orphan = { ...club, players: [{ id: "p9", name: "תלוש", teamId: "", birthDate: "2014-10-14" }] };
  assert.deepEqual(playerBirthdaysInWeek(orphan, WEEK, { teamIds: ["t1"] }), []);
  assert.deepEqual(names(playerBirthdaysInWeek(orphan, WEEK)), ["תלוש"]);
  assert.equal(playerBirthdaysInWeek(orphan, WEEK)[0].team, "");
});

T("rubbish never throws", () => {
  assert.deepEqual(birthdaysInWeek(null, WEEK), []);
  assert.deepEqual(birthdaysInWeek([null, undefined], WEEK), []);
  assert.deepEqual(birthdaysInWeek([{ name: "א", birthDate: "1988-10-14" }], "nonsense"), []);
  assert.deepEqual(playerBirthdaysInWeek(null, WEEK), []);
  assert.deepEqual(playerBirthdaysInWeek({}, WEEK), []);
  assert.deepEqual(playerBirthdaysInWeek({ players: [null] }, WEEK), []);
  assert.equal(birthdayWhen(null, 0), "");
});

console.log(`\n${count} birthday tests passed`);

// ── the parent who asked that their child not be listed ──────────────────────────────
{
  const a = (await import("node:assert/strict")).default;
  const ok = (n, f) => { f(); console.log("  ok  " + n); };
  const { playerBirthdaysInWeek } = await import("../src/utils/birthdays.js");

  const W = "2026-10-11";
  const club = {
    teams: [{ id: "t1", name: "ילדים ב" }],
    players: [
      { id: "p1", name: "מופיע", teamId: "t1", birthDate: "2014-10-14" },
      { id: "p2", name: "ביקשו שלא", teamId: "t1", birthDate: "2014-10-14", noBirthday: true },
    ],
  };

  ok("a child marked noBirthday is out of the list — for the coach AND for the manager", () => {
    // The manager is the one who set the flag on the parent's behalf; showing it back to
    // him would make the request meaningless.
    a.deepEqual(playerBirthdaysInWeek(club, W, { teamIds: ["t1"] }).map((e) => e.name), ["מופיע"]);
    a.deepEqual(playerBirthdaysInWeek(club, W).map((e) => e.name), ["מופיע"]);
  });

  ok("the birth date itself is untouched — it is what places the child in an age group", () => {
    // Answering "do not list my child" by deleting their date of birth would take them out
    // of their age category and off the federation registration. The flag exists so that
    // the small request has a small answer.
    a.equal(club.players[1].birthDate, "2014-10-14");
  });

  ok("only an explicit true opts out — a missing field means listed", () => {
    for (const noBirthday of [undefined, false, null, 0, ""]) {
      const d = { ...club, players: [{ ...club.players[0], noBirthday }] };
      a.equal(playerBirthdaysInWeek(d, W).length, 1, JSON.stringify(noBirthday));
    }
  });

  console.log("\n3 opt-out tests passed");
}
