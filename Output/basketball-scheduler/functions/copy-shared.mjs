import { mkdirSync, copyFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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
  ["utils/notifyPause.js", "utils/notifyPause.js"],
  ["utils/boardChanges.js", "utils/boardChanges.js"],
  // `scheduleChanges.js` grew an import of `getWeekDates` in 0f89b12 and this list was not
  // updated with it. Nothing broke, because the deployed bundle still held the old file —
  // so the breakage was stored up for whoever deployed functions next, months later, and it
  // would have surfaced as push notifications silently dying. Found 27.9.2026 by importing
  // the module instead of reading it. The closure check below exists so that the list can
  // never again be quietly one file short.
  ["utils/dates.js", "utils/dates.js"],
  // The cup scan, from 27.9.2026: the decision logic and the HTTP layer, both unchanged.
  ["utils/cupScan.js", "utils/cupScan.js"],
  ["utils/federationApi.js", "utils/federationApi.js"],
  // The league half, from 27.9.2026. `games.js` pulls in `halls.js` and `xlsx`.
  ["utils/halls.js", "utils/halls.js"],
  ["utils/games.js", "utils/games.js"],
  ["utils/federationFile.js", "utils/federationFile.js"],
  ["utils/federationImport.js", "utils/federationImport.js"],
];

mkdirSync(join(out, "utils"), { recursive: true });
FILES.forEach(([from, to]) => {
  copyFileSync(join(src, from), join(out, to));
  console.log("copied", to);
});

// Does every relative import inside the copied files land on a file that was also copied?
//
// This runs as a `predeploy` step, so a missing module fails the deploy with the filename
// rather than shipping and failing at runtime in the cloud, where the only symptom is a
// function that stopped being invoked.
const specifiers = (text) =>
  [...text.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s+["'](\.[^"']+)["']/g)].map((m) => m[1]);

const missing = [];
FILES.forEach(([, to]) => {
  const file = join(out, to);
  specifiers(readFileSync(file, "utf8")).forEach((spec) => {
    const target = resolve(dirname(file), spec);
    if (!existsSync(target)) missing.push(`${to} imports ${spec}, which was not copied`);
  });
});

if (missing.length > 0) {
  console.error("\nfunctions/shared is incomplete:");
  missing.forEach((m) => console.error("  " + m));
  console.error("\nAdd the missing file(s) to FILES in copy-shared.mjs.\n");
  process.exit(1);
}
console.log(`${FILES.length} files copied, every relative import resolves`);
