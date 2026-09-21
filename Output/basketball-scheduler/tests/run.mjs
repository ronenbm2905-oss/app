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
  "./rowcopy.test.mjs",
  "./playerprogress.test.mjs",
  "./hoursreport.test.mjs",
  "./schedulechanges.test.mjs",
  "./coachexport.test.mjs",
  "./playerexport.test.mjs",
  "./recurringtype.test.mjs",
  "./archive.test.mjs",
  "./hallavailability.test.mjs",
  "./pushtargets.test.mjs",
  "./daycopy.test.mjs",
  "./teamboard.test.mjs",
  "./cupscan.test.mjs",
  // Six suites below were written, passed when run by hand, and were never added here — so
  // `npm test` reported green on 49 assertions it had not executed. Found on 18.9.2026 while
  // adding the payment link. A test that is not in this list is not a test.
  "./halls.test.mjs",
  "./duplicates.test.mjs",
  "./adoptfixture.test.mjs",
  "./proposalgroups.test.mjs",
  "./boardsync.test.mjs",
  "./playeraccounts.test.mjs",
  "./paylink.test.mjs",
  "./synchealth.test.mjs",
  "./gamefilters.test.mjs",
  "./gamesheet.test.mjs",
];

for (const f of FILES) {
  console.log("\n=== " + f.replace("./", "") + " ===");
  await import(f);
}
console.log("\nall suites passed");
