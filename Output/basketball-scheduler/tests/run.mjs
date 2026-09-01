// Every unit suite, in one run. Each file asserts on import and throws on failure, so an
// unhandled rejection here is a failing test — which is what makes the exit code honest.
//
// Plain Node, no test framework: these modules are pure functions with no DOM and no
// Firebase, and adding vitest to run them would be a dependency that earns nothing.
const FILES = [
  "./availability.test.mjs",
  "./availability-halls.test.mjs",
  "./secretary.test.mjs",
  "./transport.test.mjs",
  "./fixedteams.test.mjs",
  "./videolinks.test.mjs",
];

for (const f of FILES) {
  console.log("\n=== " + f.replace("./", "") + " ===");
  await import(f);
}
console.log("\nall suites passed");
