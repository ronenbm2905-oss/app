import assert from "node:assert/strict";
import { matchHall, withHallAliases, HALL_RENAMES } from "../src/utils/halls.js";

// The club's real halls, as they are named in the club document.
const HALLS = [
  { id: "h-barak", name: "ברק" },
  { id: "h-barak1", name: "ברק מקורה 1" },
  { id: "h-barak2", name: "ברק מקורה 2" },
  { id: "h-sharet", name: "שרת" },
  { id: "h-rimonim", name: "רימונים מקורה" },
];

// Exactly what the federation publishes for the club's home cup fixture on 4.11.2026.
const FED_VENUE = "אולם עלומים, רח' הכפר 2, קריית אונו";

let n = 0;
const T = (name, fn) => { fn(); n++; console.log("  ok  " + name); };

T("the rename is recorded, old name to new", () => {
  assert.equal(HALL_RENAMES.some((r) => r.was === "עלומים" && r.now === "ברק"), true);
});

T("THE CASE THIS EXISTS FOR: the federation's venue finds the club's hall", () => {
  assert.equal(matchHall(FED_VENUE, HALLS), "h-barak");
});

T("and without the rename it would have found nothing", () => {
  const noAlias = HALLS.find((h) => FED_VENUE.includes(h.name) || h.name.includes(FED_VENUE));
  assert.equal(noAlias, undefined);
});

T("the alias applies anywhere in the text, not only at the start", () => {
  assert.equal(withHallAliases("רח' הכפר 2, אולם עלומים"), "רח' הכפר 2, אולם ברק");
  assert.equal(withHallAliases("עלומים"), "ברק");
  assert.equal(withHallAliases(""), "");
  assert.equal(withHallAliases(null), "");
});

T("a specific court wins over the building it is in", () => {
  assert.equal(matchHall("אולם ברק מקורה 1, קריית אונו", HALLS), "h-barak1");
  assert.equal(matchHall("עלומים מקורה 2", HALLS), "h-barak2");
});

T("a hall that is named plainly still matches", () => {
  assert.equal(matchHall("אולם שרת, קריית אונו", HALLS), "h-sharet");
});

T("a venue belonging to nobody matches nothing", () => {
  assert.equal(matchHall("היכל מנורה, תל אביב", HALLS), "");
  assert.equal(matchHall("", HALLS), "");
  assert.equal(matchHall(FED_VENUE, []), "");
  assert.equal(matchHall(FED_VENUE, null), "");
});

T("a malformed hall record cannot break the match", () => {
  assert.equal(matchHall(FED_VENUE, [null, { id: "x" }, { name: "" }, ...HALLS]), "h-barak");
});

console.log("\n" + n + " tests passed");
