import { mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The function and the app must decide "who hears about what" the same way.
//
// Firebase deploys only what sits inside `functions/`, so the shared modules have to be
// physically present here. The alternative — a second copy of the targeting logic, edited
// by hand — is exactly the failure this project keeps finding: two answers to one question
// that agree until the day they do not.
//
// So the files are COPIED at deploy time, never edited here. `functions/shared/` is
// gitignored on purpose: a checked-in copy is a copy someone will eventually fix in the
// wrong place. The single source of truth stays in `src/utils/`, where `npm test` runs.
//
// The relative layout is preserved so the imports inside them resolve unchanged
// (`./scheduleChanges.js`, `../constants.js`).
const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src");
const out = join(here, "shared");

const FILES = [
  ["constants.js", "constants.js"],
  ["utils/scheduleChanges.js", "utils/scheduleChanges.js"],
  ["utils/pushTargets.js", "utils/pushTargets.js"],
  ["utils/boardChanges.js", "utils/boardChanges.js"],
];

mkdirSync(join(out, "utils"), { recursive: true });
FILES.forEach(([from, to]) => {
  copyFileSync(join(src, from), join(out, to));
  console.log("copied", to);
});
