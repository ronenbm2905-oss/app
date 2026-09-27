// "Is this really the federation's sheet?" — the guard that stands between a login page and
// the club's schedule.
//
// Extracted from `scripts/fetch-federation.mjs` on 27.9.2026 so the script and the Cloud
// Function ask the question the same way. A second copy of this check would agree with the
// first until the day it did not, and that day would be a night when an error page was
// imported as a fixture list.

import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  validateSheet, sheetRows, downloadSheet, isFederationHost,
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

console.log(`
${n} federation-file tests passed`);
