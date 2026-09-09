import assert from "node:assert/strict";
import {
  ARCHIVE_KEEP_MONTHS, monthKey, cutoffMonth, sessionsByMonth, archivableMonths,
  splitForArchive, archiveDoc, withArchived, isArchivedMonth, bytesOf,
} from "../src/utils/archive.js";
import { isTooLarge, DOC_FULL_MESSAGE } from "../src/utils/access.js";

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("  ok  " + name); };

// weekOf is a Sunday; `day` is the Hebrew weekday, and together they give the real date.
const s = (id, weekOf, day = "ראשון") => ({
  id, weekOf, day, teamId: "t1", coachId: "c1", hallId: "h1",
  start: "17:00", end: "18:30", type: "אימון",
});

const NOW = new Date(2026, 8, 9); // 9 September 2026, local time

console.log("- the keep window -");
t("two months back, so the month being settled is still live", () => {
  assert.equal(ARCHIVE_KEEP_MONTHS, 2);
  assert.equal(cutoffMonth(NOW), "2026-07");
});
t("the cutoff crosses a year boundary", () =>
  assert.equal(cutoffMonth(new Date(2027, 0, 15)), "2026-11"));
t("a bad date yields no cutoff rather than a wrong one", () =>
  assert.equal(cutoffMonth(new Date("nonsense")), ""));

console.log("- monthKey is local, never UTC -");
t("a date late on the last of the month stays in that month", () => {
  // toISOString() would push 31/08 23:00 in Israel into September. Payroll months must not
  // move because of a timezone.
  assert.equal(monthKey(new Date(2026, 7, 31, 23, 30)), "2026-08");
  assert.equal(monthKey(new Date(2026, 0, 1, 0, 15)), "2026-01");
});

console.log("- grouping -");
t("sessions land in the month their real date falls in", () => {
  const map = sessionsByMonth([s("a", "2026-06-28"), s("b", "2026-07-05"), s("c", "2026-07-12")]);
  assert.equal(map.get("2026-06").length, 1);
  assert.equal(map.get("2026-07").length, 2);
});
t("a week that straddles a month splits by the actual day", () => {
  // Week of Sunday 28/06: Sunday is June, Thursday is July.
  const map = sessionsByMonth([s("a", "2026-06-28", "ראשון"), s("b", "2026-06-28", "חמישי")]);
  assert.equal(map.get("2026-06").length, 1);
  assert.equal(map.get("2026-07").length, 1);
});
t("a session with no derivable month is grouped under empty, not guessed", () => {
  const map = sessionsByMonth([{ id: "x" }, { id: "y", weekOf: "2026-07-05", day: "לא-יום" }]);
  assert.equal(map.get("").length, 2);
});

console.log("- what may be offered -");
const data = {
  sessions: [
    s("a", "2026-06-28"), s("b", "2026-07-05"), s("c", "2026-07-12"),
    s("d", "2026-08-02"), s("e", "2026-09-06"),
    { id: "broken" }, // no week at all
  ],
  archivedMonths: [],
};
t("only months at or before the cutoff, oldest first", () => {
  const months = archivableMonths(data, NOW);
  assert.deepEqual(months.map((m) => m.month), ["2026-06", "2026-07"]);
  assert.equal(months[1].count, 2);
  assert.ok(months[0].bytes > 0);
});
t("the current month and the one before it are never offered", () => {
  const months = archivableMonths(data, NOW).map((m) => m.month);
  assert.equal(months.includes("2026-08"), false);
  assert.equal(months.includes("2026-09"), false);
});
t("a month already archived is not offered again", () => {
  const months = archivableMonths({ ...data, archivedMonths: ["2026-06"] }, NOW);
  assert.deepEqual(months.map((m) => m.month), ["2026-07"]);
});
t("the undated session is never offered — archiving it by guess is losing it", () => {
  const months = archivableMonths(data, NOW).map((m) => m.month);
  assert.equal(months.includes(""), false);
});
t("nothing to archive, no throw", () => {
  assert.deepEqual(archivableMonths({}, NOW), []);
  assert.deepEqual(archivableMonths(null, NOW), []);
});

console.log("- the split -");
t("only the named months move; everything else stays", () => {
  const { byMonth, kept } = splitForArchive(data.sessions, ["2026-06", "2026-07"]);
  assert.deepEqual(Object.keys(byMonth).sort(), ["2026-06", "2026-07"]);
  assert.equal(byMonth["2026-07"].length, 2);
  assert.deepEqual(kept.map((x) => x.id).sort(), ["broken", "d", "e"]);
});
t("the undated session stays live no matter what is asked for", () => {
  const { kept } = splitForArchive(data.sessions, ["2026-06", "2026-07", "2026-08", "2026-09", ""]);
  assert.equal(kept.some((x) => x.id === "broken"), true);
});
t("nothing named, nothing moves", () => {
  const { byMonth, kept } = splitForArchive(data.sessions, []);
  assert.deepEqual(byMonth, {});
  assert.equal(kept.length, data.sessions.length);
});
t("no sessions, no throw", () => {
  assert.deepEqual(splitForArchive(null, ["2026-07"]), { byMonth: {}, kept: [] });
});

console.log("- the two documents that get written -");
t("the archive document carries its own month and count", () => {
  const doc = archiveDoc("2026-07", [s("b", "2026-07-05")], "2026-09-09T10:00:00.000Z");
  assert.equal(doc.month, "2026-07");
  assert.equal(doc.count, 1);
  assert.equal(doc.sessions.length, 1);
  assert.equal(doc.archivedAt, "2026-09-09T10:00:00.000Z");
});
t("the club document loses the sessions and gains the index", () => {
  const { kept } = splitForArchive(data.sessions, ["2026-06"]);
  const next = withArchived(data, ["2026-06"], kept);
  assert.equal(next.sessions.length, 5);
  assert.deepEqual(next.archivedMonths, ["2026-06"]);
  assert.equal(isArchivedMonth(next, "2026-06"), true);
  assert.equal(isArchivedMonth(next, "2026-07"), false);
});
t("archiving a second month adds to the index rather than replacing it", () => {
  const first = withArchived(data, ["2026-06"], []);
  const second = withArchived(first, ["2026-07"], []);
  assert.deepEqual(second.archivedMonths, ["2026-06", "2026-07"]);
});
t("the same month twice does not appear twice", () => {
  const twice = withArchived(withArchived(data, ["2026-06"], []), ["2026-06"], []);
  assert.deepEqual(twice.archivedMonths, ["2026-06"]);
});
t("the index is small — it exists so nobody reads the archive to know it is there", () =>
  assert.ok(bytesOf(withArchived(data, ["2026-06", "2026-07"], []).archivedMonths) < 40));

console.log("- telling the ceiling apart from a dropped connection -");
t("the real Firestore rejection is recognised", () => {
  assert.equal(isTooLarge({ code: "invalid-argument", message: "Document 'clubs/main' cannot be written because its size (1052341 bytes) exceeds the maximum allowed size of 1048576 bytes." }), true);
  assert.equal(isTooLarge({ message: "The value of property 'sessions' is longer than 1048487 bytes." }), true);
});
t("a network failure is NOT reported as a full document", () => {
  // The whole point: these two used to produce the same sentence, and the manager retried
  // for a day. Getting this backwards is worse than having no message at all.
  assert.equal(isTooLarge({ code: "unavailable", message: "Failed to get document because the client is offline." }), false);
  assert.equal(isTooLarge({ code: "permission-denied", message: "Missing or insufficient permissions." }), false);
  assert.equal(isTooLarge(new Error("Network request failed")), false);
  assert.equal(isTooLarge(null), false);
  assert.equal(isTooLarge(undefined), false);
  assert.equal(isTooLarge({}), false);
});
t("the message says the one thing that helps, and that retrying will not", () => {
  assert.ok(DOC_FULL_MESSAGE.includes("ארכוב"));
  assert.ok(DOC_FULL_MESSAGE.includes("ניסיון חוזר לא יעזור"));
});

console.log("\n" + pass + " tests passed");
