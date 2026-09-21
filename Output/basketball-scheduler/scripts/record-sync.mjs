// "The nightly job ran, and this is what it found."
//
// WHY THIS EXISTS. Until 21.9.2026 the only trace a run left in Firestore was a PROPOSAL —
// and a proposal is filed only when something changed, which is the minority of nights. So
// the database recorded the job's successes and nothing else, and the two sentences
//
//     "the federation published nothing this week"
//     "the sync has been dead for three days"
//
// produced exactly the same silence on the manager's screen. They were told apart only
// because someone happened to notice fixtures on the federation's site and ask.
//
// This writes one document per run, every run, including the runs that found nothing and
// the runs that failed. It is the difference between no news and no signal.
//
// Deliberately NOT on the club document: that document has a size ceiling, and a write to
// it wakes `onClubChange` in the cloud function — a nightly heartbeat there would evaluate
// push notifications at 3am for no reason. Its own tiny document has neither problem.
//
// Run: node scripts/record-sync.mjs --cups <status> --league <status> [--note "..."]
//   status: ok | none | failed | unchanged | skipped
// Exit: 0 written · 1 could not write (never fails the run that called it)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INBOX = process.env.FEDERATION_INBOX || path.join(ROOT, "federation-inbox");
const CLUB_ID = process.env.VITE_CLUB_ID || "main";

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const STATUSES = ["ok", "none", "failed", "unchanged", "skipped"];
const status = (raw) => (STATUSES.includes(String(raw)) ? String(raw) : "failed");

const stamp = () => new Date().toISOString().slice(0, 19).replace("T", " ");
function log(line) {
  const text = `${stamp()}  ${line}\n`;
  process.stdout.write(text);
  try {
    fs.appendFileSync(path.join(INBOX, "log.txt"), text);
  } catch {
    /* never fail a run over its own log */
  }
}

async function firestore() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath || !fs.existsSync(keyPath)) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set, or points at a file that is not there");
  }
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  initializeApp({ credential: cert(JSON.parse(fs.readFileSync(keyPath, "utf8"))) });
  return getFirestore();
}

async function main() {
  const doc = {
    at: new Date().toISOString(),
    cups: status(value("--cups", "skipped")),
    league: status(value("--league", "skipped")),
    note: String(value("--note", "")).slice(0, 200),
  };

  // `set` without merge, on purpose: this document is a snapshot of the LAST run and not a
  // history. A field left over from a previous night — "failed", say, on a night that
  // succeeded — would be read as current and is worse than nothing.
  const db = await firestore();
  await db.collection("clubs").doc(CLUB_ID).collection("sync").doc("nightly").set(doc);
  log(`heartbeat: cups=${doc.cups} league=${doc.league}${doc.note ? ` (${doc.note})` : ""}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    // A heartbeat that cannot be written must never take the run down with it: the actual
    // work — a cup scan, a filed proposal — has already happened by the time this runs.
    log(`the heartbeat could not be written: ${err.message}`);
    process.exit(1);
  }
);
