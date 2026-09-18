import assert from "node:assert/strict";
import {
  normalizePayUrl, payHost, payFor, payUrlForTeam, withPayUrl, withPayUrlEverywhere,
  teamsWithPayUrl,
} from "../src/utils/payLink.js";
import { buildBoard } from "../src/utils/teamBoard.js";
import { boardChanges } from "../src/utils/boardChanges.js";

let count = 0;
const T = (name, fn) => { fn(); console.log("  ok  " + name); count++; };

// ── what a manager may paste ────────────────────────────────────────────────

T("a plain https link is kept as it is", () => {
  assert.equal(normalizePayUrl("https://pay.club.co.il/team/5"), "https://pay.club.co.il/team/5");
});

T("a link with no scheme gets https — that is a missing scheme, not an insecure one", () => {
  assert.equal(normalizePayUrl("pay.club.co.il/x"), "https://pay.club.co.il/x");
});

T("http is REFUSED and not silently upgraded", () => {
  // Upgrading guesses: if the provider has no https on that host the parent meets a dead
  // page and blames the club. Refusing puts it in front of the manager instead.
  assert.equal(normalizePayUrl("http://pay.club.co.il"), "");
});

T("javascript: and data: are refused — this string is rendered on a public page", () => {
  assert.equal(normalizePayUrl("javascript:alert(1)"), "");
  assert.equal(normalizePayUrl("data:text/html,<script>x</script>"), "");
  assert.equal(normalizePayUrl("JavaScript:alert(1)"), "");
});

T("a host with no dot is a typo or an intranet name, and neither goes to parents", () => {
  assert.equal(normalizePayUrl("https://localhost/pay"), "");
  assert.equal(normalizePayUrl("https://intranet"), "");
});

T("empty in, empty out — and nothing throws on rubbish", () => {
  assert.equal(normalizePayUrl(""), "");
  assert.equal(normalizePayUrl("   "), "");
  assert.equal(normalizePayUrl(null), "");
  assert.equal(normalizePayUrl("לשלם כאן"), "");
  assert.equal(normalizePayUrl("https://"), "");
});

T("the host is what a parent can check, without www", () => {
  assert.equal(payHost("https://www.pay.club.co.il/a/b?c=1"), "pay.club.co.il");
  assert.equal(payHost("not a url"), "");
});

// ── where it is stored ──────────────────────────────────────────────────────

const club = {
  teams: [{ id: "t1", name: "נערים א" }, { id: "t2", name: "קטסל ב" }, { id: "t3", name: "ילדים" }],
  halls: [],
  sessions: [],
  boards: {
    t1: { token: "aaaaaaaaaaaa", since: "2026-09-17" },
    t2: { token: "bbbbbbbbbbbb", since: "2026-09-17" },
  },
};

T("the link lives on the board entry, so unpublishing takes it down with the board", () => {
  const next = withPayUrl(club, "t1", "https://pay.co.il/x");
  assert.equal(payUrlForTeam(next, "t1"), "https://pay.co.il/x");
  assert.equal(next.boards.t1.token, "aaaaaaaaaaaa", "the token is not disturbed");
  assert.equal(payUrlForTeam(next, "t2"), "");
});

T("a team with no published board cannot hold a payment link", () => {
  const next = withPayUrl(club, "t3", "https://pay.co.il/x");
  assert.equal(payUrlForTeam(next, "t3"), "");
});

T("saving an empty value removes the link rather than storing an empty string", () => {
  const on = withPayUrl(club, "t1", "https://pay.co.il/x");
  const off = withPayUrl(on, "t1", "");
  assert.equal("payUrl" in off.boards.t1, false);
});

T("one link for every published team, and only the published ones", () => {
  const all = withPayUrlEverywhere(club, "https://pay.co.il/x");
  assert.equal(teamsWithPayUrl(all), 2);
  assert.equal(payUrlForTeam(all, "t1"), "https://pay.co.il/x");
  assert.equal(payUrlForTeam(all, "t2"), "https://pay.co.il/x");
  assert.equal(all.boards.t3, undefined);
});

T("clearing it everywhere clears it everywhere", () => {
  const cleared = withPayUrlEverywhere(withPayUrlEverywhere(club, "https://pay.co.il/x"), "");
  assert.equal(teamsWithPayUrl(cleared), 0);
});

// ── what reaches the published board ────────────────────────────────────────

T("no link means `pay: null`, NOT a missing field", () => {
  // The board is written with `merge: true`. An absent field would leave yesterday's link
  // in place on a document nobody is looking at — "I removed it" has to remove it.
  assert.equal(payFor(club, "t1"), null);
  const board = buildBoard(club, "t1", { now: new Date("2026-09-16T10:00:00") });
  assert.equal(board.pay, null);
  assert.equal("pay" in board, true);
});

T("the board carries the url and the host it will print", () => {
  const next = withPayUrl(club, "t1", "https://www.pay.co.il/team/1");
  const board = buildBoard(next, "t1", { now: new Date("2026-09-16T10:00:00") });
  assert.deepEqual(board.pay, { url: "https://www.pay.co.il/team/1", host: "pay.co.il" });
});

T("one team's link never reaches another team's board", () => {
  const next = withPayUrl(club, "t1", "https://pay.co.il/x");
  const other = buildBoard(next, "t2", { now: new Date("2026-09-16T10:00:00") });
  assert.equal(other.pay, null);
});

T("the board still carries no person's data — a payment link changes nothing there", () => {
  const next = withPayUrl(club, "t1", "https://pay.co.il/x");
  const board = buildBoard(next, "t1", { now: new Date("2026-09-16T10:00:00") });
  const json = JSON.stringify(board);
  assert.equal(/amount|sum|paid|סכום|שילם/.test(json), false);
});

// ── and the thing that must NOT happen ──────────────────────────────────────

T("adding a payment link wakes nobody's phone", () => {
  // It is not news. A notification for it would be the club using a channel parents opened
  // for schedule changes to ask them for money, which is how a channel gets muted.
  const before = buildBoard(club, "t1", { now: new Date("2026-09-16T10:00:00") });
  const after = buildBoard(withPayUrl(club, "t1", "https://pay.co.il/x"), "t1", {
    now: new Date("2026-09-16T11:00:00"),
  });
  const ch = boardChanges(before, after);
  assert.equal(ch.changed, false);
  assert.equal(ch.summary, "");
});

console.log(`\n${count} payment-link tests passed`);
