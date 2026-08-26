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
import * as XLSX from "xlsx";
import { importGamesFile, findCancelledGames } from "../src/utils/games.js";
import { parseDateDMY } from "../src/utils/dates.js";

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

// The fields that describe the fixture itself. A change in any of them is something the
// manager should see; anything else on the record is ours, not the federation's.
const WATCHED = ["date", "time", "weekDay", "isHome", "opponent", "venue", "league", "round", "ourScore", "theirScore"];
const LABELS = {
  date: "תאריך", time: "שעה", weekDay: "יום", isHome: "בית/חוץ", opponent: "יריבה",
  venue: "מיקום", league: "ליגה", round: "מחזור", ourScore: "התוצאה שלנו", theirScore: "התוצאה שלהם",
};

const shown = (v) => (v === null || v === undefined || v === "" ? "—" : typeof v === "boolean" ? (v ? "בית" : "חוץ") : String(v));

function describe(game, teams) {
  const team = teams.find((t) => t.id === game.teamId);
  return [team?.name, game.date, game.opponent && `נגד ${game.opponent}`].filter(Boolean).join(" · ");
}

function buildProposal(rows, data, { sourceFile, sourceHash }) {
  const current = data.games || [];
  const byCode = new Map(current.map((g) => [String(g.federationCode), g]));

  const result = importGamesFile(rows, data);
  if (result.error) throw new Error(`the club has no code mapping yet (${result.error})`);

  const added = [];
  const updated = [];
  for (const next of result.nextGames) {
    const code = String(next.federationCode);
    const before = byCode.get(code);
    if (!before) {
      added.push({ code, label: describe(next, data.teams), game: next });
      continue;
    }
    const changed = WATCHED.filter((f) => shown(before[f]) !== shown(next[f]));
    if (changed.length) {
      updated.push({
        code,
        label: describe(next, data.teams),
        // Only the fields that moved, in both states. Applying these onto whatever the
        // club holds at approval time is what keeps a proposal built at 03:00 from
        // overwriting an edit made at 08:00.
        fields: changed.map((f) => ({ key: f, label: LABELS[f] || f, before: shown(before[f]), after: shown(next[f]), value: next[f] })),
      });
    }
  }

  const off = findCancelledGames(current, rows, data);
  const cancelled = off.cancelled.map((code) => ({ code, label: describe(byCode.get(code) || { federationCode: code }, data.teams) }));
  const restored = off.restored.map((code) => ({ code, label: describe(byCode.get(code) || { federationCode: code }, data.teams) }));

  return {
    id: todayId(),
    status: "pending",
    fetchedAt: new Date().toISOString(),
    sourceFile,
    sourceHash,
    summary: {
      added: added.length,
      updated: updated.length,
      cancelled: cancelled.length,
      restored: restored.length,
      suspicious: off.suspicious,
      ratio: Math.round((off.ratio || 0) * 100),
    },
    scope: off.scope || null,
    added,
    updated,
    cancelled,
    restored,
  };
}

// A Firestore document stops at 1MB. The first proposal of a season is the only one likely
// to come close, and a truncated proposal is far better than a write that simply fails.
const MAX_BYTES = 800 * 1024;
function trim(proposal) {
  let size = Buffer.byteLength(JSON.stringify(proposal));
  if (size <= MAX_BYTES) return { proposal, trimmed: false, size };
  const out = { ...proposal, truncated: true };
  while (Buffer.byteLength(JSON.stringify(out)) > MAX_BYTES && out.added.length > 20) {
    out.added = out.added.slice(0, Math.floor(out.added.length / 2));
  }
  while (Buffer.byteLength(JSON.stringify(out)) > MAX_BYTES && out.updated.length > 20) {
    out.updated = out.updated.slice(0, Math.floor(out.updated.length / 2));
  }
  return { proposal: out, trimmed: true, size: Buffer.byteLength(JSON.stringify(out)) };
}

// The dates the sheet actually covers, read through the same importer the app uses so the
// answer matches what would be imported rather than what the raw cells look like.
function seasonSpan(rows, data) {
  const fresh = importGamesFile(rows, { ...data, games: [] });
  if (fresh.error) return null;
  const dates = fresh.nextGames.map((g) => parseDateDMY(g.date)).filter(Boolean).map((d) => d.getTime());
  if (!dates.length) return null;
  const from = Math.min(...dates);
  const to = Math.max(...dates);
  const fmt = (t) => new Date(t).toLocaleDateString("he-IL");
  return { from, to, label: `${fmt(from)} → ${fmt(to)}` };
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

// The only fields this job needs, checked against what games.js actually reads.
//
// Fetching the club document whole would carry players[] — the names, phone numbers and
// birth dates of children — out of Firestore and onto a personal machine every night, for
// nothing: no step here touches them. A projection means they never leave the database at
// all, which is a stronger guarantee than deleting them after they arrive.
const NEEDED = ["games", "gameMapping", "teams", "halls", "sessions"];

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
  const wb = XLSX.read(buffer, { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", header: 1 });

  let data;
  let db = null;
  if (DATA_FILE) {
    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } else {
    db = await firestore();
    data = await readClub(db);
  }

  // A season that finished before today is last year, not news. Left unguarded, the very
  // first night would file a proposal to import a few hundred games that are already over,
  // and every night after would do it again until someone accepted or rejected it.
  const span = seasonSpan(rows, data);
  if (span && span.to < Date.now() && !ALLOW_PAST) {
    log(
      `the file still covers a finished season (${span.label}) — the federation has not published the new one yet. No proposal filed. Use --allow-past to import it anyway.`
    );
    process.exitCode = 10;
    return;
  }

  const proposal = buildProposal(rows, data, { sourceFile: path.basename(SHEET), sourceHash });
  const s = proposal.summary;
  const nothing = !s.added && !s.updated && !s.cancelled && !s.restored;

  log(
    `proposal ${proposal.id}: +${s.added} new · ${s.updated} changed · ${s.cancelled} cancelled · ${s.restored} restored` +
      (s.suspicious ? `  [SUSPICIOUS — ${s.ratio}% of the games in scope would be cancelled]` : "")
  );

  if (nothing) {
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
  // day's proposal rather than stacking a second one the manager has to reconcile.
  await db.collection("clubs").doc(CLUB_ID).collection("pendingImports").doc(proposal.id).set(doc);
  log(`filed at clubs/${CLUB_ID}/pendingImports/${proposal.id}`);
}

main().catch((e) => {
  log(`FAILED: ${e.message}`);
  process.exitCode = 1;
});
