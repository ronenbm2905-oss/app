// Turn the file the nightly job downloaded into a proposal a human can approve.
//
// This never writes to the club document. It reads it, works out what the new file would
// change, and files that as a proposal under clubs/{id}/pendingImports/{date}. The only
// write to clubs/{id} stays where it has always been: a person pressing save in the app.
// That is what makes a background job safe here — useClubData.js writes the whole document
// with setDoc, so anything automated writing there would erase a manager mid-edit.
//
// Run: node scripts/prepare-import.mjs [--dry] [--data <club.json>] [--file <sheet.xlsx>]
//   --dry   print the proposal instead of filing it (no credentials needed)
//   --data  read the club from a JSON file instead of Firestore (for testing)
// Exit: 0 a proposal was filed · 10 nothing changed · 1 failure

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { sheetRows } from "../src/utils/federationFile.js";
import { prepareProposal, trim, NEEDED, mayOverwriteProposal } from "../src/utils/federationImport.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INBOX = process.env.FEDERATION_INBOX || path.join(ROOT, "federation-inbox");
const CLUB_ID = process.env.VITE_CLUB_ID || "main";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const DRY = flag("--dry");
// The federation publishes one season at a time and the export carries no season
// parameter — asking for a different one is silently ignored. So the only way to know the
// file is still last season's is to look at the dates in it.
const ALLOW_PAST = flag("--allow-past");
const SHEET = value("--file", path.join(INBOX, "latest.xlsx"));
const DATA_FILE = value("--data", null);

const stamp = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const todayId = () => new Date().toISOString().slice(0, 10);

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

async function readClub(db) {
  const { FieldPath } = await import("firebase-admin/firestore");
  const snap = await db.collection("clubs").where(FieldPath.documentId(), "==", CLUB_ID).select(...NEEDED).get();
  if (snap.empty) throw new Error(`there is no club document at clubs/${CLUB_ID}`);
  const data = snap.docs[0].data();
  // A projection returns only what was asked for, so anything missing is genuinely absent
  // rather than withheld — and the importer expects arrays, not undefined.
  for (const f of NEEDED) if (!Array.isArray(data[f])) data[f] = [];
  return data;
}

async function main() {
  if (!fs.existsSync(SHEET)) throw new Error(`no sheet to read at ${SHEET}`);
  const buffer = fs.readFileSync(SHEET);
  const sourceHash = crypto.createHash("sha256").update(buffer).digest("hex");
  const rows = sheetRows(buffer);

  let data;
  let db = null;
  if (DATA_FILE) {
    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } else {
    db = await firestore();
    data = await readClub(db);
  }

  // The same three-way decision the Cloud Function makes, from the same function — so a
  // proposal built here and a proposal built there cannot differ.
  const { state, span, proposal } = prepareProposal(rows, data, {
    sourceFile: path.basename(SHEET),
    sourceHash,
    allowPast: ALLOW_PAST,
  });

  if (state === "stale") {
    log(
      `the file still covers a finished season (${span.label}) — the federation has not published the new one yet. No proposal filed. Use --allow-past to import it anyway.`
    );
    process.exitCode = 10;
    return;
  }

  const s = proposal.summary;
  log(
    `proposal ${proposal.id}: +${s.added} new · ${s.updated} changed · ${s.cancelled} cancelled · ${s.restored} restored` +
      (s.suspicious ? `  [SUSPICIOUS — ${s.ratio}% of the games in scope would be cancelled]` : "")
  );

  if (state === "none") {
    log("the file changes nothing — no proposal filed");
    process.exitCode = 10;
    return;
  }

  const { proposal: doc, trimmed, size } = trim(proposal);
  if (trimmed) log(`the proposal was trimmed to fit the 1MB document limit (${Math.round(size / 1024)}KB)`);

  if (DRY) {
    log(`[dry] not writing. ${Math.round(size / 1024)}KB`);
    fs.writeFileSync(path.join(INBOX, `proposal-${proposal.id}.json`), JSON.stringify(doc, null, 2));
    log(`[dry] written to federation-inbox/proposal-${proposal.id}.json for inspection`);
    return;
  }

  if (!db) db = await firestore();
  // The date as the document id, not an auto-id: running twice in one day replaces the
  // day's proposal rather than stacking a second one the manager has to reconcile — unless
  // the manager already dealt with today's, in which case replacing it would bring the
  // banner back and erase who dealt with it. See mayOverwriteProposal().
  const ref = db.collection("clubs").doc(CLUB_ID).collection("pendingImports").doc(proposal.id);
  const already = await ref.get();
  if (!mayOverwriteProposal(already.exists ? already.data() : null)) {
    log("today's proposal has already been dealt with — leaving it alone");
    process.exitCode = 10;
    return;
  }
  await ref.set(doc);
  log(`filed at clubs/${CLUB_ID}/pendingImports/${proposal.id}`);
}

main().catch((e) => {
  log(`FAILED: ${e.message}`);
  process.exitCode = 1;
});
