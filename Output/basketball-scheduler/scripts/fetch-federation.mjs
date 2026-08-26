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
import * as XLSX from "xlsx";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INBOX = process.env.FEDERATION_INBOX || path.join(ROOT, "federation-inbox");
const URL_ = process.env.FEDERATION_XLSX_URL || "https://ibasketball.co.il/club/1071-2/?feed=xlsx&club_id=715510";
const KEEP_DAYS = 14;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

// The columns the club's file has always had. Checked before a download is accepted:
// a site that starts serving an error page, a login redirect, or a changed layout must
// fail loudly tonight rather than quietly feed nonsense into the schedule in the morning.
const REQUIRED_COLUMNS = ["Code", "תאריך", "Time", "Home Team Code", "Away Team Code", "Venue"];

const stamp = () => new Date().toISOString().slice(0, 19).replace("T", " ");
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

function validate(buffer) {
  if (buffer.length < 1000) return `the response is only ${buffer.length} bytes`;
  if (buffer.subarray(0, 2).toString() !== "PK") return "the response is not a zip, so it is not an xlsx";
  let rows;
  try {
    const wb = XLSX.read(buffer, { type: "buffer" });
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", header: 1 });
  } catch (e) {
    return `the file does not parse as a spreadsheet (${e.message})`;
  }
  const head = (rows[0] || []).map((c) => String(c).trim());
  const missing = REQUIRED_COLUMNS.filter((c) => !head.includes(c));
  if (missing.length) return `columns missing from the sheet: ${missing.join(", ")}`;
  if (rows.length < 10) return `only ${rows.length} rows — the file looks empty`;
  return null;
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

  const res = await fetch(URL_, { headers: { "User-Agent": UA, Accept: "*/*" }, redirect: "follow" });
  if (!res.ok) throw new Error(`the federation answered ${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const bad = validate(buffer);
  if (bad) throw new Error(`the download was rejected: ${bad}`);

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

  log(`${changed ? "NEW" : "unchanged"}  ${buffer.length} bytes  sha ${hash.slice(0, 12)}  → ${path.basename(target)}`);
  // Set rather than called: process.exit() during an in-flight fetch tears the event loop
  // down mid-operation and Node aborts with 127, which is exactly the code the nightly
  // batch file would then misread.
  process.exitCode = changed ? 0 : 10;
}

main().catch((e) => {
  log(`FAILED: ${e.message}`);
  process.exitCode = 1;
});
