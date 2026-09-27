// The cup fixtures the nightly xlsx feed does not carry.
//
// League play arrives in the federation's file. Cup competitions are published separately —
// one page per age group, seventeen of them — and nothing tells a manager when one appears.
// On 17.9.2026 two of this club's cup fixtures were live on the site and absent from the
// club, one of them three weeks away.
//
// Same bargain as the nightly import, for the same reason:
//   • This job NEVER writes to the club document. It files a proposal under
//     clubs/{id}/cupScans/{date}. The club document is written by one thing only — a person
//     pressing a button while looking at the screen — because every save writes it whole,
//     and a background writer would erase an edit in progress with no error and no trace.
//   • It reads the club through a PROJECTION. `players[]` — children's names, phones and
//     birth dates — never leaves the database, which is stronger than deleting it after.
//   • It never rewrites an existing game. It can only propose additions.
//
// Exit codes match run-nightly.cmd — see SCAN_EXIT in cupScan.js:
//   0 filed  ·  10 nothing new  ·  11 some competitions unreachable  ·  1 none reached.

import fs from "node:fs";
import {
  CUP_LEAGUES, eventToDraft, classify, scanOutcome, scanSummary, mayOverwriteScan,
} from "../src/utils/cupScan.js";
import { createFederationApi, scanCompetitions, FEDERATION_API } from "../src/utils/federationApi.js";

const CLUB_ID = process.env.VITE_CLUB_ID || "main";
const API = process.env.FEDERATION_API || FEDERATION_API;

const log = (...a) => console.log("[cups]", ...a);

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
  // The scan itself lives in src/utils/, so this script and the Cloud Function run the same
  // code rather than two copies of it. What stays here is only how a terminal reports it.
  const { seen, reached, drafts } = await scanCompetitions(CUP_LEAGUES, {
    api: createFederationApi({ base: API }),
    toDraft: (ev, league) => eventToDraft(ev, { leagueName: league.name }),
    onLeague: (league, count, ours) =>
      log(`${String(count).padStart(3)} fixtures · ${league.name}${ours ? `  << ${ours} ours` : ""}`),
    // One competition failing must not lose the other sixteen — that part was always right.
    // What was missing is that `reached` is now counted, so the run can say how much of the
    // federation it actually saw instead of implying all of it. See scanOutcome().
    onFailure: (league, err) => log(`!! ${league.name}: ${err.message}`),
  });
  log(scanSummary({ total: CUP_LEAGUES.length, reached, fixtures: seen, ours: drafts.length }));

  // Decided before the Firestore read, because a scan that reached nothing has nothing to
  // classify and must not spend a query to conclude "nothing new".
  if (reached === 0) {
    const out = scanOutcome({ total: CUP_LEAGUES.length, reached });
    log("the federation could not be reached at all — this is a FAILED scan, not a quiet night");
    process.exitCode = out.exitCode;
    return;
  }

  const db = await firestore();
  const { FieldPath } = await import("firebase-admin/firestore");
  const snap = await db.collection("clubs").where(FieldPath.documentId(), "==", CLUB_ID).select("games").get();
  if (snap.empty) throw new Error(`there is no club document at clubs/${CLUB_ID}`);
  const games = snap.docs[0].data().games || [];

  const result = classify(drafts, games);
  log(`already accepted: ${result.known.length} · new: ${result.fresh.length} · same date as an existing game: ${result.possible.length}`);

  if (result.fresh.length === 0 && result.possible.length === 0) {
    const out = scanOutcome({ total: CUP_LEAGUES.length, reached });
    // "nothing to propose" is only allowed to be the last word when every competition
    // answered. Otherwise it is a conclusion about a list we did not finish reading.
    log(out.state === "partial" ? "nothing to propose — but the scan was incomplete" : "nothing to propose");
    process.exitCode = out.exitCode;
    return;
  }

  const id = new Date().toISOString().slice(0, 10);
  const ref = db.collection("clubs").doc(CLUB_ID).collection("cupScans").doc(id);
  const existing = await ref.get();
  if (!mayOverwriteScan(existing.exists ? existing.data() : null)) {
    // Someone already dealt with today's proposal. Writing over it would put the fixture
    // they dismissed back on the banner and delete the record of who dismissed it.
    log(`today's proposal has already been dealt with — leaving it alone`);
    process.exitCode = scanOutcome({ total: CUP_LEAGUES.length, reached }).exitCode;
    return;
  }
  await ref.set({
    id,
    scannedAt: new Date().toISOString(),
    competitions: CUP_LEAGUES.length,
    fixturesSeen: seen,
    fresh: result.fresh,
    possible: result.possible,
    resolved: false,
  });
  log(`filed at clubs/${CLUB_ID}/cupScans/${id}`);

  // A proposal from an incomplete scan still exits 11, not 0. The manager gets the fixture
  // AND the fact that it came out of a partial reading — "nothing else came up" must not be
  // inferred from a gap.
  const out = scanOutcome({ total: CUP_LEAGUES.length, reached, filed: true });
  if (out.state === "partial") log("the proposal above came from an INCOMPLETE scan");
  process.exitCode = out.exitCode;
}

main().catch((err) => {
  log("failed:", err.message);
  process.exitCode = 1;
});
