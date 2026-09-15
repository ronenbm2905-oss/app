import assert from "node:assert/strict";
import {
  DAY_START, DAY_END, minutesToTime, hallBusyBlocks, freeGaps, slotIsFree, fitIntoGap,
} from "../src/utils/hallAvailability.js";

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("  ok  " + name); };

const WEEK = "2026-09-13"; // Sunday
const s = (id, hallId, day, start, end, teamId = "t1") => ({
  id, hallId, day, start, end, teamId, coachId: "c1", type: "אימון", weekOf: WEEK,
});

const data = {
  halls: [{ id: "h1", name: "אולם עלומים" }, { id: "h2", name: "אולם ברק" }],
  teams: [{ id: "t1", name: "נערים א" }, { id: "t2", name: "קטסל ב" }],
  sessions: [
    s("a", "h1", "שני", "17:00", "18:30", "t1"),
    s("b", "h1", "שני", "18:30", "20:00", "t2"),
    s("c", "h1", "שלישי", "16:00", "17:00"),
    s("d", "h2", "שני", "17:00", "18:00"), // another hall
    { ...s("e", "h1", "שני", "20:00", "21:30"), weekOf: "2026-09-06" }, // another week
  ],
  absences: [],
};

console.log("- what makes a hall busy -");
t("only this hall, this day, this week", () => {
  const busy = hallBusyBlocks(data, { hallId: "h1", day: "שני", weekOf: WEEK });
  assert.deepEqual(busy.map((b) => b.start), ["17:00", "18:30"]);
});
t("each block says who holds it, not just that it is held", () => {
  const busy = hallBusyBlocks(data, { hallId: "h1", day: "שני", weekOf: WEEK });
  assert.deepEqual(busy.map((b) => b.label), ["נערים א", "קטסל ב"]);
});
t("a game occupies the hall exactly like a training", () => {
  const withGame = { ...data, sessions: [...data.sessions, { ...s("g", "h1", "רביעי", "19:30", "21:00"), fromGame: true, type: "משחק בית" }] };
  assert.equal(hallBusyBlocks(withGame, { hallId: "h1", day: "רביעי", weekOf: WEEK }).length, 1);
});
t("the session being edited does not block itself", () => {
  const busy = hallBusyBlocks(data, { hallId: "h1", day: "שני", weekOf: WEEK, excludeId: "a" });
  assert.deepEqual(busy.map((b) => b.start), ["18:30"]);
});
t("nothing asked, nothing returned", () => {
  assert.deepEqual(hallBusyBlocks(data, { hallId: "", day: "שני", weekOf: WEEK }), []);
  assert.deepEqual(hallBusyBlocks(data, { hallId: "h1", day: "", weekOf: WEEK }), []);
  assert.deepEqual(hallBusyBlocks(null, { hallId: "h1", day: "שני", weekOf: WEEK }), []);
});

console.log("- a hall taken by the municipality -");
t("a windowed closure blocks its hours and says why", () => {
  // Monday of the week of Sunday 13/09 is the 14th.
  const withClosure = {
    ...data,
    absences: [{ id: "x", hallId: "h1", date: "2026-09-14", start: "20:00", end: "22:00", note: "אירוע עירייה" }],
  };
  const busy = hallBusyBlocks(withClosure, { hallId: "h1", day: "שני", weekOf: WEEK });
  const closure = busy.find((b) => b.kind === "closure");
  assert.equal(closure.start, "20:00");
  assert.equal(closure.label, "אירוע עירייה");
});
t("an all-day closure swallows the whole day", () => {
  const withClosure = { ...data, absences: [{ id: "x", hallId: "h1", date: "2026-09-14" }] };
  const closure = hallBusyBlocks(withClosure, { hallId: "h1", day: "שני", weekOf: WEEK }).find((b) => b.kind === "closure");
  assert.equal(closure.start, DAY_START);
  assert.equal(closure.end, DAY_END);
  assert.deepEqual(freeGaps(hallBusyBlocks(withClosure, { hallId: "h1", day: "שני", weekOf: WEEK })), []);
});
t("another hall's closure is not this hall's problem", () => {
  const withClosure = { ...data, absences: [{ id: "x", hallId: "h2", date: "2026-09-14" }] };
  assert.equal(hallBusyBlocks(withClosure, { hallId: "h1", day: "שני", weekOf: WEEK }).some((b) => b.kind === "closure"), false);
});
t("a COACH being away never closes a hall", () => {
  // Different question, different answer: the hall is free, the person is not — and a
  // substitute solves it. Folding them together would hide a bookable hour.
  const withCoach = { ...data, absences: [{ id: "x", coachId: "c1", date: "2026-09-14" }] };
  assert.equal(hallBusyBlocks(withCoach, { hallId: "h1", day: "שני", weekOf: WEEK }).some((b) => b.kind === "closure"), false);
});

console.log("- the gaps -");
t("before, between and after", () => {
  const busy = hallBusyBlocks(data, { hallId: "h1", day: "שלישי", weekOf: WEEK });
  assert.deepEqual(freeGaps(busy), [{ start: "08:00", end: "16:00" }, { start: "17:00", end: "23:00" }]);
});
t("back-to-back bookings do not invent a zero-length gap", () => {
  // 17:00–18:30 then 18:30–20:00 is one solid block, not two with a seam.
  const busy = hallBusyBlocks(data, { hallId: "h1", day: "שני", weekOf: WEEK });
  assert.deepEqual(freeGaps(busy), [{ start: "08:00", end: "17:00" }, { start: "20:00", end: "23:00" }]);
});
t("overlapping blocks merge instead of stacking", () => {
  const busy = [
    { start: "17:00", end: "19:00" },
    { start: "18:00", end: "20:00" },
  ];
  assert.deepEqual(freeGaps(busy), [{ start: "08:00", end: "17:00" }, { start: "20:00", end: "23:00" }]);
});
t("a sliver too short to book is not offered", () => {
  // Eleven free minutes is not an opening; listing it pushes the real ones off the line.
  const busy = [{ start: "08:00", end: "16:00" }, { start: "16:11", end: "23:00" }];
  assert.deepEqual(freeGaps(busy), []);
  assert.equal(freeGaps(busy, { minMinutes: 10 }).length, 1);
});
t("an empty hall is one long gap", () =>
  assert.deepEqual(freeGaps([]), [{ start: DAY_START, end: DAY_END }]));
t("junk blocks are ignored rather than throwing", () =>
  assert.deepEqual(freeGaps([{ start: "", end: "" }, { start: "19:00", end: "18:00" }]), [
    { start: DAY_START, end: DAY_END },
  ]));

console.log("- is the chosen hour free -");
t("inside a gap is free; overlapping a booking is not", () => {
  const busy = hallBusyBlocks(data, { hallId: "h1", day: "שני", weekOf: WEEK });
  assert.equal(slotIsFree(busy, "15:00", "16:30"), true);
  assert.equal(slotIsFree(busy, "17:30", "18:00"), false);
  assert.equal(slotIsFree(busy, "16:00", "17:30"), false);
});
t("touching an edge is not overlapping", () =>
  // Ending exactly when the next starts is how a real schedule is built.
  assert.equal(slotIsFree([{ start: "17:00", end: "18:30" }], "15:30", "17:00"), true));
t("an incomplete or backwards time is not called busy", () => {
  assert.equal(slotIsFree([{ start: "17:00", end: "18:30" }], "", ""), true);
  assert.equal(slotIsFree([{ start: "17:00", end: "18:30" }], "18:00", "17:00"), true);
});

console.log("- clicking a free slot -");
t("keeps the length the manager already chose", () => {
  // They decided this is 90 minutes. The click answers "when", not "how long".
  assert.deepEqual(fitIntoGap({ start: "20:00", end: "23:00" }, "17:00", "18:30"), { start: "20:00", end: "21:30" });
});
t("a gap too short gives back the whole gap rather than spilling past it", () =>
  assert.deepEqual(fitIntoGap({ start: "20:00", end: "20:45" }, "17:00", "18:30"), { start: "20:00", end: "20:45" }));
t("no times yet defaults to an hour", () =>
  assert.deepEqual(fitIntoGap({ start: "16:00", end: "23:00" }, "", ""), { start: "16:00", end: "17:00" }));
t("no gap, nothing to fit", () => assert.equal(fitIntoGap(null, "17:00", "18:00"), null));

console.log("- minutesToTime -");
t("pads and clamps", () => {
  assert.equal(minutesToTime(9 * 60 + 5), "09:05");
  assert.equal(minutesToTime(0), "00:00");
  assert.equal(minutesToTime(-30), "00:00");
});

console.log("\n" + pass + " tests passed");
