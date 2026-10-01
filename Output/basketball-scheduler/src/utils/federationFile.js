// The federation's weekly league file: fetching it, and deciding whether it is a file at all.
//
// Extracted from `scripts/fetch-federation.mjs` on 27.9.2026, when the nightly sync moved to
// a Cloud Function. Same reason the cup scan's HTTP layer moved: two copies of "is this a
// real sheet" would agree until the day they did not, and the day they did not would be a
// night when a login page got imported as a fixture list.
//
// NOTHING NODE-SPECIFIC LIVES HERE. No `node:crypto`, no `node:fs`, no `process` — so this
// module is safe to import from anywhere, and hashing is left to the caller, which has a
// Buffer and knows what it wants to do with it.

import * as XLSX from "xlsx";

export const FEDERATION_HOST = "ibasketball.co.il";

export const FEDERATION_XLSX_URL =
  "https://ibasketball.co.il/club/1071-2/?feed=xlsx&club_id=715510";

// The columns that prove this is the federation's export and not an error page, a login
// redirect, or a maintenance notice that happened to return 200.
export const REQUIRED_COLUMNS = ["Code", "תאריך", "Time", "Home Team Code", "Away Team Code", "Venue"];

export function sheetRows(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", header: 1 });
}

// Every request has to look like one nobody has made before — or we are reading a photograph.
//
// MEASURED 1.10.2026, and this is the whole reason the function exists. From 24.9 the feed
// came back from a cache filled on 23.9 at 17:32:25 UTC: byte for byte, to four downloads
// kept on the laptop and three the Cloud Function logged. The nightly sync hashed it, found
// it identical, and correctly reported "unchanged" — over a file 175 hours old, a week, that
// was missing twenty-six changes, three of them fixtures moved to a different date.
//
// A query parameter is part of Cloudflare's cache key, so a unique one asks for a file that
// has never been asked for before. PROVEN AGAINST THE LIVE SITE BEFORE IT WAS WRITTEN HERE:
// the same URL with `&_=…` appended returned a file whose own `dcterms:created` was the
// second of the request. `_` is the conventional name and the feed ignores parameters it
// does not know — measured on that download, not assumed.
//
// This does NOT weaken the host check below: the parameter changes the query string and
// never the host, and the check runs on where the response actually landed.
export function withCacheBuster(url, stamp = Date.now()) {
  try {
    const u = new URL(String(url));
    u.searchParams.set("_", String(stamp));
    return u.toString();
  } catch {
    // An unparseable URL is not this function's problem. Hand it back and let `fetch` fail
    // with its own message rather than invent a string that looks like a URL.
    return String(url);
  }
}

// WHEN THE FEDERATION GENERATED THIS FILE, read out of the file itself.
//
// The export is produced on demand and it records the moment it was produced:
// `docProps/core.xml` carries `dcterms:created`, which SheetJS parses into
// `Props.CreatedDate`. Across the fourteen downloads kept in `federation-inbox/`, every one
// up to 23.9 carries a timestamp equal to the moment of the request, to the second.
//
// That single field is what separates the two things "the bytes are identical" can mean, and
// which the sync could not tell apart until now:
//
//     the federation published nothing       ← normal, most weeks
//     we are being handed a cached copy      ← a week of changes, invisible
//
// Returns an ISO string, or "" when the file carries no readable timestamp. Empty rather
// than a guess, deliberately: an unknown age must read as unknown, never as fresh (which
// would hide the fault) and never as ancient (which would cry wolf over a file that is fine).
export function sheetGeneratedAt(buffer) {
  try {
    // Properties only — the fixtures are parsed elsewhere and there is no reason to build
    // forty thousand cells to read one date.
    const wb = XLSX.read(buffer, { type: "buffer", bookProps: true, bookSheets: true });
    const made = wb?.Props?.CreatedDate;
    const t = made instanceof Date ? made.getTime() : Date.parse(String(made || ""));
    return Number.isFinite(t) && t > 0 ? new Date(t).toISOString() : "";
  } catch {
    return "";
  }
}

// Returns a reason to reject, or null. The reasons are sentences because they end up in a
// log that someone reads months later wondering why a night did nothing.
export function validateSheet(buffer) {
  if (!buffer || buffer.length === 0) return "the download was empty";

  let rows;
  try {
    rows = sheetRows(buffer);
  } catch (e) {
    return `the file does not parse as a spreadsheet (${e.message})`;
  }

  const head = (rows[0] || []).map((c) => String(c).trim());
  const missing = REQUIRED_COLUMNS.filter((c) => !head.includes(c));
  if (missing.length) return `columns missing from the sheet: ${missing.join(", ")}`;

  // One data row, not ten.
  //
  // The columns above already prove this is a federation sheet and not an error page, so
  // what is left to catch is a file with nothing in it. Ten was a guess, and on 17.9.2026
  // it rejected a perfectly good download: the season had just rolled over and the new file
  // held exactly three cup fixtures. The guard would have blocked every nightly sync until
  // enough league games were published — silently, and at the start of a season.
  //
  // A truncated file is a real risk, but it is not this guard's job: the importer never
  // deletes, and mass-cancellation is held back by CANCEL_SUSPICIOUS_RATIO, which measures
  // the proportion that vanished instead of guessing at a row count.
  if (rows.length < 2) return "no fixtures in the file — only the header row";

  return null;
}

// Download and validate. Throws with a sentence rather than returning a half-file, because
// every caller's next move on failure is the same: say so and stop.
export async function downloadSheet({
  url = FEDERATION_XLSX_URL,
  fetchImpl = fetch,
  // NOT to be "corrected" to a named agent. Gate #5 measured it: this site returns 403 to
  // non-browser user agents on the /club/ path — a blanket rule, not access control — and
  // an honest UA here simply breaks the download. The cup scan's API path is the opposite
  // and identifies itself there.
  userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  timeoutMs = 60000,
  allowedHost = FEDERATION_HOST,
  maxBytes = 15 * 1024 * 1024,
  // Injectable so a test can assert the exact URL that goes out. In production it is simply
  // the clock, which is all "a value nobody has asked for before" needs to be.
  stamp = Date.now(),
} = {}) {
  const target = withCacheBuster(url, stamp);
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  let res;
  try {
    res = await fetchImpl(target, {
      headers: { "User-Agent": userAgent, Accept: "*/*" },
      redirect: "follow",
      ...(ctl ? { signal: ctl.signal } : {}),
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`the federation answered ${res.status} ${res.statusText}`);

  // WHERE DID WE ACTUALLY END UP? `redirect: "follow"` is convenient and it means the host
  // that answers is not necessarily the host that was asked. A federation page that starts
  // redirecting elsewhere — a CDN error page, a parked domain, a hijacked link — would be
  // downloaded and parsed exactly like the real file. Checked AFTER the redirects, because
  // checking the URL we sent proves nothing.
  const landed = String(res.url || target);
  if (!isFederationHost(landed, allowedHost)) {
    throw new Error(`the download was redirected off ${allowedHost} (to ${safeHost(landed)})`);
  }

  // A ceiling, because `arrayBuffer()` has none. The club's file is ~40KB; fifteen megabytes
  // is three hundred times that and still far under the function's memory.
  const declared = Number(res.headers?.get?.("content-length") || 0);
  if (declared > maxBytes) throw new Error(`the file is ${Math.round(declared / 1048576)}MB — refusing to read it`);

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > maxBytes) {
    throw new Error(`the file is ${Math.round(buffer.length / 1048576)}MB — refusing to read it`);
  }

  const bad = validateSheet(buffer);
  if (bad) throw new Error(`the download was rejected: ${bad}`);
  return buffer;
}

// Exact host, or a subdomain of it — never a suffix match. "notibasketball.co.il" and
// "ibasketball.co.il.evil.test" both end with the string and neither is the federation.
export function isFederationHost(value, allowedHost = FEDERATION_HOST) {
  let host;
  try {
    host = new URL(String(value)).hostname.toLowerCase();
  } catch {
    return false;
  }
  const allowed = String(allowedHost).toLowerCase();
  return host === allowed || host.endsWith(`.${allowed}`);
}

// A hostname for an error message. The full URL carries the club id in its query string, and
// that string ends up in logs.
function safeHost(value) {
  try {
    return new URL(String(value)).hostname;
  } catch {
    return "an unreadable address";
  }
}
