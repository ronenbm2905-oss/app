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
// Exit codes match run-nightly.cmd: 0 there is something to look at · 10 nothing · 1 failed.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CUP_LEAGUES, eventToDraft, classify, scanOutcome, scanSummary,
} from "../src/utils/cupScan.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLUB_ID = process.env.VITE_CLUB_ID || "main";
const API = process.env.FEDERATION_API || "https://ibasketball.co.il/wp-json/sportspress/v2";
const UA = "Mozilla/5.0 (compatible; kiryat-ono-scheduler/1.0)";

const log = (...a) => console.log("[cups]", ...a);

async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

// Venue names are fetched once each and reused. A cup round puts twenty fixtures in three
// halls; asking the site twenty times would be rude and slower than the whole scan.
const venueCache = new Map();
async function venueName(id) {
  if (!id) return "";
  if (venueCache.has(id)) return venueCache.get(id);
  try {
    const v = await getJson(`${API}/venues/${id}?_fields=name`);
    const name = String(v?.name || "").trim();
    venueCache.set(id, name);
    return name;
  } catch {
    venueCache.set(id, "");
    return "";
  }
}

async function scanLeague(league) {
  const url = `${API}/events?leagues=${league.id}&per_page=100&_fields=id,date,title,venues`;
  const events = await getJson(url);
  const drafts = [];
  for (const ev of Array.isArray(events) ? events : []) {
    const draft = eventToDraft(ev, { leagueName: league.name });
    if (!draft) continue;
    // Only ours gets a second request. Resolving every venue in every competition would be
    // a hundred calls to learn nothing.
    //
    // A HOME game needs this as much as an away one: the club plays in several halls, and
    // the federation's venue is the only thing that says which. (It will not be spelled the
    // way we spell it — see matchHall.)
    draft.venue = await venueName(ev?.venues?.[0]);
    drafts.push(draft);
  }
  return { count: Array.isArray(events) ? events.length : 0, drafts };
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
  let seen = 0;
  let reached = 0;
  const drafts = [];
  for (const league of CUP_LEAGUES) {
    try {
      const r = await scanLeague(league);
      seen += r.count;
      reached += 1;
      drafts.push(...r.drafts);
      log(`${String(r.count).padStart(3)} fixtures · ${league.name}${r.drafts.length ? `  << ${r.drafts.length} ours` : ""}`);
    } catch (err) {
      // One competition failing must not lose the other sixteen — that part was always
      // right. What was missing is that `reached` is now counted, so the run can say how
      // much of the federation it actually saw instead of implying all of it. See
      // scanOutcome() for what happened when all seventeen failed.
      log(`!! ${league.name}: ${err.message}`);
    }
  }
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
  await db.collection("clubs").doc(CLUB_ID).collection("cupScans").doc(id).set({
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
