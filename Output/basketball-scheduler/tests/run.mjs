// Every unit suite, in one run. Each file asserts on import and throws on failure, so an
// unhandled rejection here is a failing test — which is what makes the exit code honest.
//
// Plain Node, no test framework: these modules are pure functions with no DOM and no
// Firebase, and adding vitest to run them would be a dependency that earns nothing.
// Ported from the Kiryat Ono branch one feature at a time — see docs/port-ledger.md.
// A suite lands here in the same commit as the feature it covers, never later.
const FILES = [
  "./availability.test.mjs",
  "./availability-halls.test.mjs",
  "./publish-absences.test.mjs",
  "./access.test.mjs",
  "./coach-identity.test.mjs",
  "./gamenotes.test.mjs",
];

for (const f of FILES) {
  console.log("\n=== " + f.replace("./", "") + " ===");
  await import(f);
}
console.log("\nall suites passed");
