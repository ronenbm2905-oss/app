// "Is this really the federation's sheet?" — the guard that stands between a login page and
// the club's schedule.
//
// Extracted from `scripts/fetch-federation.mjs` on 27.9.2026 so the script and the Cloud
// Function ask the question the same way. A second copy of this check would agree with the
// first until the day it did not, and that day would be a night when an error page was
// imported as a fixture list.

import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import {
  validateSheet, sheetRows, downloadSheet, isFederationHost, withCacheBuster, sheetGeneratedAt,
  REQUIRED_COLUMNS, FEDERATION_XLSX_URL,
} from "../src/utils/federationFile.js";

let n = 0;
const T = async (name, fn) => { await fn(); n++; console.log("  ok  " + name); };

// Build a workbook the way the federation does: a header row, then fixtures.
function book(rows) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
const HEAD = [...REQUIRED_COLUMNS, "Away Team", "Home Team"];
const ROW = ["800509", "13-10-2026", "18:00", "715510", "715511", "אולם ברק", "יריבה", "אונו"];

await T("a real sheet passes", () => {
  assert.equal(validateSheet(book([HEAD, ROW])), null);
});

await T("ONE fixture is enough — the ten-row guard blocked a good file on 17.9", () => {
  // The season had just rolled over and the new file held exactly three cup fixtures. The
  // old guard would have blocked every nightly sync until enough league games appeared —
  // silently, and at the start of a season.
  assert.equal(validateSheet(book([HEAD, ROW])), null);
});

await T("a header with no fixtures is rejected", () => {
  assert.match(validateSheet(book([HEAD])), /only the header row/);
});

await T("A LOGIN PAGE IS REJECTED — this is the whole point", () => {
  const html = Buffer.from("<!DOCTYPE html><html><body>Please sign in</body></html>", "utf8");
  const bad = validateSheet(html);
  assert.notEqual(bad, null, "an HTML page must never be accepted as a sheet");
});

await T("an empty download is rejected, and says so plainly", () => {
  assert.match(validateSheet(Buffer.alloc(0)), /empty/);
});

await T("a spreadsheet with the WRONG columns is rejected and names them", () => {
  // The layout changing is the realistic failure, not the site going down. A sheet that
  // parses but means something else is the one that would quietly feed nonsense in.
  const bad = validateSheet(book([["Date", "Team", "Score"], ["x", "y", "z"]]));
  assert.match(bad, /columns missing/);
  assert.match(bad, /Code/);
});

await T("every required column is actually required", () => {
  for (const col of REQUIRED_COLUMNS) {
    const head = HEAD.filter((c) => c !== col);
    const bad = validateSheet(book([head, ROW.slice(0, head.length)]));
    assert.notEqual(bad, null, `dropping "${col}" should have been caught`);
    assert.match(bad, new RegExp(col.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

await T("sheetRows reads the first sheet as raw rows, blanks included", () => {
  const rows = sheetRows(book([HEAD, ROW, ["", "", "", "", "", ""]]));
  assert.equal(rows[0][0], "Code");
  assert.equal(rows[1][0], "800509");
  assert.equal(rows.length, 3, "a blank row is kept — trimming is the importer's job");
});

await T("a non-200 is an error, not an empty file", () => {
  // Returning a zero-length buffer here would reach validateSheet and be reported as "the
  // download was empty" — true but useless. The status is what a person needs.
  const impl = async () => ({ ok: false, status: 503, statusText: "Service Unavailable" });
  return downloadSheet({ fetchImpl: impl }).then(
    () => assert.fail("a 503 must not resolve"),
    (err) => assert.match(err.message, /503/)
  );
});

await T("a 200 that is not a sheet is rejected before anything reads it as fixtures", () => {
  const impl = async () => ({
    ok: true, status: 200, statusText: "OK",
    arrayBuffer: async () => Buffer.from("<html>maintenance</html>", "utf8"),
  });
  return downloadSheet({ fetchImpl: impl }).then(
    () => assert.fail("an HTML body must not resolve"),
    (err) => assert.match(err.message, /rejected/)
  );
});

await T("a good download resolves to the bytes, unaltered", async () => {
  const bytes = book([HEAD, ROW]);
  const impl = async () => ({ ok: true, status: 200, statusText: "OK", arrayBuffer: async () => bytes });
  const out = await downloadSheet({ fetchImpl: impl });
  assert.equal(Buffer.compare(Buffer.from(out), Buffer.from(bytes)), 0);
});

await T("the club's own feed url is the default, and carries the club id", () => {
  assert.match(FEDERATION_XLSX_URL, /^https:\/\//);
  assert.match(FEDERATION_XLSX_URL, /feed=xlsx/);
});


// ---------- added after gate #23 ----------

await T("A REDIRECT OFF THE FEDERATION'S HOST IS REFUSED, after the redirects not before", () => {
  // `redirect: "follow"` means the host that answers need not be the host that was asked.
  // A parked domain, a hijacked link or a CDN error page would otherwise be downloaded and
  // parsed exactly like the real file. Checking the URL we SENT would prove nothing.
  const impl = async () => ({
    ok: true, status: 200, statusText: "OK", url: "https://somewhere-else.test/file.xlsx",
    headers: new Map(), arrayBuffer: async () => book([HEAD, ROW]),
  });
  return downloadSheet({ fetchImpl: impl }).then(
    () => assert.fail("a redirect off-host must not resolve"),
    (err) => {
      assert.match(err.message, /redirected off/);
      assert.equal(err.message.includes("club_id"), false, "the club id must not travel in an error");
    }
  );
});

await T("a subdomain of the federation is fine; a lookalike is not", () => {
  assert.equal(isFederationHost("https://ibasketball.co.il/x"), true);
  assert.equal(isFederationHost("https://www.ibasketball.co.il/x"), true);
  // Both of these END WITH the allowed string, and neither is the federation.
  assert.equal(isFederationHost("https://notibasketball.co.il/x"), false);
  assert.equal(isFederationHost("https://ibasketball.co.il.evil.test/x"), false);
  assert.equal(isFederationHost("not a url"), false);
  assert.equal(isFederationHost(""), false);
});

await T("an enormous file is refused rather than read into memory", () => {
  const huge = Buffer.alloc(20 * 1024 * 1024);
  const impl = async () => ({
    ok: true, status: 200, statusText: "OK", url: "https://ibasketball.co.il/club/1071-2/",
    headers: new Map(), arrayBuffer: async () => huge,
  });
  return downloadSheet({ fetchImpl: impl }).then(
    () => assert.fail("20MB must not resolve"),
    (err) => assert.match(err.message, /refusing to read it/)
  );
});

await T("a declared content-length over the cap is refused before the body is read", () => {
  let readBody = false;
  const impl = async () => ({
    ok: true, status: 200, statusText: "OK", url: "https://ibasketball.co.il/club/1071-2/",
    headers: new Map([["content-length", String(50 * 1024 * 1024)]]),
    arrayBuffer: async () => { readBody = true; return Buffer.alloc(10); },
  });
  return downloadSheet({ fetchImpl: impl }).then(
    () => assert.fail("50MB declared must not resolve"),
    (err) => {
      assert.match(err.message, /refusing to read it/);
      assert.equal(readBody, false, "the body must not have been read");
    }
  );
});

await T("the real club file — 40KB from the federation's own host — still passes both", async () => {
  const bytes = book([HEAD, ROW]);
  const impl = async () => ({
    ok: true, status: 200, statusText: "OK",
    url: "https://ibasketball.co.il/club/1071-2/?feed=xlsx&club_id=715510",
    headers: new Map([["content-length", String(bytes.length)]]),
    arrayBuffer: async () => bytes,
  });
  const out = await downloadSheet({ fetchImpl: impl });
  assert.equal(Buffer.compare(Buffer.from(out), Buffer.from(bytes)), 0);
});

await T("THE CACHE BUSTER: every request carries a value nobody has asked for before", () => {
  const a = withCacheBuster(FEDERATION_XLSX_URL, 111);
  assert.match(a, /[?&]_=111(&|$)/, "the parameter must be in the query string");
  assert.match(a, /feed=xlsx/, "and the feed parameter must survive");
  assert.match(a, /club_id=715510/, "and so must the club id");
  assert.notEqual(withCacheBuster(FEDERATION_XLSX_URL, 111), withCacheBuster(FEDERATION_XLSX_URL, 112));
});

await T("the cache buster does not move the request off the federation", () => {
  // If it did, the host check would reject every download and the sync would die quietly.
  assert.equal(isFederationHost(withCacheBuster(FEDERATION_XLSX_URL, 7)), true);
});

await T("a second call replaces the parameter instead of stacking another", () => {
  const once = withCacheBuster(FEDERATION_XLSX_URL, 1);
  const twice = withCacheBuster(once, 2);
  assert.match(twice, /_=2/);
  assert.equal(/_=1/.test(twice), false, "the old stamp must be gone");
  assert.equal((twice.match(/_=/g) || []).length, 1, "exactly one stamp");
});

await T("rubbish in, rubbish back — never an invented URL", () => {
  assert.equal(withCacheBuster("not a url", 5), "not a url");
});

await T("THE STAMP REACHES THE WIRE — the fetch is given the busted URL", async () => {
  // The whole fix is worthless if the parameter is computed and then not sent.
  const bytes = book([HEAD, ROW]);
  let asked = "";
  const impl = async (u) => {
    asked = u;
    return {
      ok: true, status: 200, statusText: "OK", url: u,
      headers: new Map([["content-length", String(bytes.length)]]),
      arrayBuffer: async () => bytes,
    };
  };
  await downloadSheet({ fetchImpl: impl, stamp: 424242 });
  assert.match(asked, /_=424242/, "the request must carry the stamp");
});

await T("THE FILE'S OWN TIMESTAMP is read out of it, and it is what separates two nights", () => {
  // "the bytes are identical" means either "the federation published nothing" or "we were
  // handed a cached copy". Those are opposite situations and this field is the only thing
  // in the file that tells them apart.
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEAD, ROW]), "S");
  const props = { CreatedDate: new Date("2026-09-23T17:32:25Z") };
  const bytes = XLSX.write(wb, { type: "buffer", bookType: "xlsx", Props: props });
  assert.equal(sheetGeneratedAt(bytes), "2026-09-23T17:32:25.000Z");
});

await T("a file with NO timestamp reads as unknown — never as fresh, never as ancient", () => {
  // Both wrong directions are dangerous: "fresh" hides the fault, "ancient" cries wolf over
  // a file that is fine. So it is empty, and the screen renders no judgement at all.
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEAD, ROW]), "S");
  assert.equal(sheetGeneratedAt(XLSX.write(wb, { type: "buffer", bookType: "xlsx" })), "");
});

await T("garbage and an empty buffer read as unknown rather than throwing", () => {
  // This runs inside the nightly job. Throwing here would turn a cosmetic unknown into a
  // failed sync.
  assert.equal(sheetGeneratedAt(Buffer.from("<html>sign in</html>")), "");
  assert.equal(sheetGeneratedAt(Buffer.alloc(0)), "");
  assert.equal(sheetGeneratedAt(undefined), "");
});

await T("THE REAL FROZEN FILE: the evidence from 1.10.2026, if it is still on this machine", () => {
  // `federation-inbox/` is gitignored, so this is an assertion where the file exists and a
  // printed note where it does not — rather than a test that fails on a clean checkout.
  let bytes;
  try {
    bytes = readFileSync(new URL("../federation-inbox/latest.xlsx", import.meta.url));
  } catch {
    console.log("      (federation-inbox/latest.xlsx is not here — skipped)");
    return;
  }
  // Downloaded 27.9 at 10:00, generated 23.9 at 17:32. Four days of cache in one assertion.
  assert.equal(sheetGeneratedAt(bytes), "2026-09-23T17:32:25.000Z");
});

console.log(`
${n} federation-file tests passed`);
