// Nightly download of the club's fixture list from the federation.
//
// The federation's club page carries an "export to xlsx" link, and that link is a plain
// URL that returns the file directly — no login, no form, no JavaScript. The one catch is
// that the site answers 403 to a request that does not look like a browser, so a
// User-Agent header is not optional here.
//
// Run: node scripts/fetch-federation.mjs
// Exit: 0 a new file was saved · 10 the file is unchanged since last time · 1 failure

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { downloadSheet, sheetGeneratedAt, FEDERATION_XLSX_URL } from "../src/utils/federationFile.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INBOX = process.env.FEDERATION_INBOX || path.join(ROOT, "federation-inbox");
const URL_ = process.env.FEDERATION_XLSX_URL || FEDERATION_XLSX_URL;
const KEEP_DAYS = 14;

const stamp =() => new Date().toISOString().slice(0, 19).replace("T", " ");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function log(line) {
  const text = `${stamp()}  ${line}\n`;
  process.stdout.write(text);
  try {
    fs.appendFileSync(path.join(INBOX, "log.txt"), text);
  } catch {
    /* the log is a convenience; never fail the run over it */
  }
}

// A download is only a file once it is complete. Writing to a temp name and renaming means
// a run killed halfway leaves nothing rather than a truncated xlsx that still opens.
function writeAtomic(target, buffer) {
  const tmp = `${target}.part`;
  fs.writeFileSync(tmp, buffer);
  fs.renameSync(tmp, target);
}

function prune() {
  const files = fs
    .readdirSync(INBOX)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.xlsx$/.test(f))
    .sort();
  for (const f of files.slice(0, Math.max(0, files.length - KEEP_DAYS))) {
    fs.unlinkSync(path.join(INBOX, f));
    log(`pruned ${f}`);
  }
}

async function main() {
  fs.mkdirSync(INBOX, { recursive: true });

  // Downloading and deciding "is this really the federation's sheet" now live in
  // src/utils/federationFile.js, shared with the Cloud Function. Two copies of that check
  // would agree until the day they did not — and the day they did not would be a night when
  // a login page got imported as a fixture list.
  const buffer = await downloadSheet({ url: URL_ });

  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const target = path.join(INBOX, `${today()}.xlsx`);
  const latest = path.join(INBOX, "latest.xlsx");

  // Comparing against the previous download, not against today's file: re-running on the
  // same day should still say "unchanged" rather than compare the file to itself.
  const previous = fs.existsSync(latest) ? crypto.createHash("sha256").update(fs.readFileSync(latest)).digest("hex") : null;
  const changed = previous !== hash;

  writeAtomic(target, buffer);
  writeAtomic(latest, buffer);
  prune();

  // WHEN THE FEDERATION GENERATED IT, not when we asked. Written to a file of its own so
  // run-nightly.cmd can hand it to record-sync.mjs — without it the manual path DELETES the
  // freshness field the cloud wrote, and the screen stops showing the age of the file at
  // exactly the moment someone is running this by hand because they suspect it.
  const madeAt = sheetGeneratedAt(buffer);
  try {
    fs.writeFileSync(path.join(INBOX, "source-at.txt"), madeAt, "utf8");
  } catch {
    /* a missing hint is "not measured", which is the safe reading — never fail the run */
  }

  log(`${changed ? "NEW" : "unchanged"}  ${buffer.length} bytes  sha ${hash.slice(0, 12)}  generated ${madeAt || "unknown"}  → ${path.basename(target)}`);
  // Set rather than called: process.exit() during an in-flight fetch tears the event loop
  // down mid-operation and Node aborts with 127, which is exactly the code the nightly
  // batch file would then misread.
  process.exitCode = changed ? 0 : 10;
}

main().catch((e) => {
  log(`FAILED: ${e.message}`);
  process.exitCode = 1;
});
