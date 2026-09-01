import assert from "node:assert/strict";
import {
  normalizeVideoUrl, buildVideo, matchesSearch, sortVideos, providerLabel,
} from "../src/utils/videoLinks.js";

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("  ok  " + name); };
const ok = (s) => normalizeVideoUrl(s);

console.log("- THE SECURITY LINE: what must never become an href -");
t("javascript: is rejected", () => assert.equal(ok("javascript:alert(1)").ok, false));
t("javascript: dressed as a youtube path is rejected", () =>
  assert.equal(ok("javascript://youtube.com/%0aalert(1)").ok, false));
t("data: is rejected", () => assert.equal(ok("data:text/html,<script>alert(1)</script>").ok, false));
t("plain http is rejected", () => assert.equal(ok("http://youtube.com/watch?v=abc").ok, false));
t("file: is rejected", () => assert.equal(ok("file:///C:/secret.txt").ok, false));
t("a lookalike host is rejected — this is why it is an allowlist", () => {
  assert.equal(ok("https://youtube.evil.com/watch?v=abc").ok, false);
  assert.equal(ok("https://notyoutube.com/watch?v=abc").ok, false);
  assert.equal(ok("https://facebook.com.evil.net/x").ok, false);
});
t("any other site is rejected, however reasonable", () => {
  assert.equal(ok("https://vimeo.com/12345").ok, false);
  assert.equal(ok("https://drive.google.com/file/d/abc/view").ok, false);
});
t("nothing throws on garbage", () => {
  ["", "   ", "???", "https://", "::::"].forEach((s) => assert.equal(ok(s).ok, false));
});
t("every rejection carries a sentence a person can act on", () => {
  ["javascript:alert(1)", "http://youtube.com/x", "https://vimeo.com/1", ""].forEach((s) => {
    const r = ok(s);
    assert.equal(r.ok, false);
    assert.ok(r.reason && r.reason.length > 5, `no usable reason for ${s}`);
  });
});

console.log("- what a coach actually pastes -");
t("a desktop YouTube link", () => {
  const r = ok("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(r.ok, true);
  assert.equal(r.provider, "youtube");
  assert.equal(r.url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});
t("the share link from the phone (youtu.be)", () => {
  const r = ok("https://youtu.be/dQw4w9WgXcQ");
  assert.equal(r.ok, true);
  assert.equal(r.provider, "youtube");
});
t("the mobile site", () => assert.equal(ok("https://m.youtube.com/watch?v=abc").provider, "youtube"));
t("a Facebook video post", () =>
  assert.equal(ok("https://www.facebook.com/watch/?v=123456").provider, "facebook"));
t("fb.watch short link", () => assert.equal(ok("https://fb.watch/aBc123/").provider, "facebook"));
t("a Facebook reel", () =>
  assert.equal(ok("https://www.facebook.com/reel/987654321").provider, "facebook"));
t("pasted without the scheme, as a phone address bar gives it", () => {
  const r = ok("youtu.be/dQw4w9WgXcQ");
  assert.equal(r.ok, true);
  assert.equal(r.url.startsWith("https://"), true);
});
t("surrounding whitespace is forgiven", () =>
  assert.equal(ok("  https://youtu.be/abc  ").ok, true));
t("the host on its own is not a video", () => {
  assert.equal(ok("https://www.youtube.com").ok, false);
  assert.equal(ok("https://www.youtube.com/").ok, false);
});

console.log("- tracking parameters do not get stored -");
t("YouTube's share id is dropped", () => {
  const r = ok("https://youtu.be/dQw4w9WgXcQ?si=Xy7QpLm2AbCdEf");
  assert.equal(r.url, "https://youtu.be/dQw4w9WgXcQ");
});
t("fbclid is dropped", () => {
  const r = ok("https://www.facebook.com/watch/?v=123&fbclid=IwAR0abc");
  assert.ok(!r.url.includes("fbclid"));
  assert.ok(r.url.includes("v=123"));
});
t("the parameters that matter are kept", () => {
  const r = ok("https://www.youtube.com/watch?v=abc&t=90s&si=xyz");
  assert.ok(r.url.includes("v=abc"));
  assert.ok(r.url.includes("t=90s"), "a timestamp is the whole point of some links");
  assert.ok(!r.url.includes("si="));
});
t("stripping the only parameter leaves no dangling ?", () =>
  assert.equal(ok("https://youtu.be/abc?si=x").url, "https://youtu.be/abc"));

console.log("- buildVideo -");
const NOW = "2026-08-29T10:00:00.000Z";
t("a complete entry", () => {
  const r = buildVideo({
    id: "v1", url: "https://youtu.be/abc?si=x", title: "  מסירת חזה  ",
    category: "מסירות", note: " לגילאי ילדים ", author: "ירון רימון",
    authorEmail: "Yaron@Example.COM", now: NOW,
  });
  assert.equal(r.ok, true);
  assert.equal(r.video.title, "מסירת חזה");
  assert.equal(r.video.url, "https://youtu.be/abc");
  assert.equal(r.video.provider, "youtube");
  assert.equal(r.video.note, "לגילאי ילדים");
  assert.equal(r.video.createdAt, NOW);
});
t("authorEmail is lower-cased — the rule compares it exactly", () => {
  const r = buildVideo({ id: "v", url: "https://youtu.be/abc", title: "x", authorEmail: "Yaron@Example.COM", now: NOW });
  assert.equal(r.video.authorEmail, "yaron@example.com");
});
t("a bad link stops the whole thing, and carries the link's own reason", () => {
  // `javascript:alert(1)` has no "//", so it is not treated as having a scheme at all and
  // becomes `https://javascript:alert(1)` — which fails to parse. Rejected either way; the
  // wording just comes from the parser rather than from the protocol check.
  const r = buildVideo({ id: "v", url: "javascript:alert(1)", title: "x", now: NOW });
  assert.equal(r.ok, false);
  assert.ok(r.reason && r.reason.length > 5);
  assert.equal(r.video, undefined, "nothing is built from a rejected link");
});
t("a scheme that DOES parse is caught by the https check, not by luck", () => {
  const r = buildVideo({ id: "v", url: "javascript://youtube.com/%0aalert(1)", title: "x", now: NOW });
  assert.equal(r.ok, false);
  assert.ok(r.reason.includes("https"));
});
t("a link with no name is refused — an unnamed entry is unfindable", () => {
  const r = buildVideo({ id: "v", url: "https://youtu.be/abc", title: "   ", now: NOW });
  assert.equal(r.ok, false);
});

console.log("- search and order -");
const lib = [
  { title: "מסירת חזה", note: "", category: "מסירות", author: "ירון", createdAt: "2026-08-01" },
  { title: "הגנת אזור 2-3", note: "לנוער", category: "הגנה", author: "איתי", createdAt: "2026-08-20" },
];
t("finds by title", () => assert.equal(matchesSearch(lib[0], "חזה"), true));
t("finds by note, category and author too", () => {
  assert.equal(matchesSearch(lib[1], "לנוער"), true);
  assert.equal(matchesSearch(lib[1], "הגנה"), true);
  assert.equal(matchesSearch(lib[1], "איתי"), true);
});
t("an empty search matches everything", () => assert.equal(matchesSearch(lib[0], "  "), true));
t("no match is no match", () => assert.equal(matchesSearch(lib[0], "כדרור"), false));
t("newest first", () =>
  assert.deepEqual(sortVideos(lib).map((v) => v.title), ["הגנת אזור 2-3", "מסירת חזה"]));
t("sortVideos does not mutate its input", () => {
  const before = lib.map((v) => v.title);
  sortVideos(lib);
  assert.deepEqual(lib.map((v) => v.title), before);
});
t("provider labels are Hebrew", () => {
  assert.equal(providerLabel("youtube"), "יוטיוב");
  assert.equal(providerLabel("facebook"), "פייסבוק");
  assert.equal(providerLabel("nonsense"), "");
});

console.log("\n" + pass + " tests passed");

// ---- appended after Adi's gate #8 (M4) ----
// The stored document is not trustworthy. `buildVideo` runs only in the browser, only on
// write, and the Firestore rules check `authorEmail` and nothing else — so a club member
// writing through the SDK, or a coach whose Google account is taken over, can store any
// string at all. The card therefore re-parses at render, and BOTH the target and the
// "יוטיוב" label come from that parse. These lock the property the UI now depends on.
console.log("- M4: a poisoned record cannot become a trusted link -");
const poisoned = [
  { url: "https://phishing.example/login", provider: "youtube" },
  { url: "javascript:alert(document.cookie)", provider: "youtube" },
  { url: "http://youtube.com/watch?v=x", provider: "youtube" },
  { url: "https://youtube.evil.com/watch?v=x", provider: "youtube" },
  { url: "", provider: "facebook" },
];
t("every poisoned url fails the render-time parse", () => {
  poisoned.forEach((v) => {
    const link = normalizeVideoUrl(v.url);
    assert.equal(link.ok, false, `${v.url} was accepted at render time`);
  });
});
t("the stored `provider` never decides the label — the parse does", () => {
  // A record claiming to be YouTube while pointing at a phishing host must not print "יוטיוב".
  const v = { url: "https://phishing.example/login", provider: "youtube" };
  const link = normalizeVideoUrl(v.url);
  assert.equal(link.ok, false);
  assert.equal(providerLabel(link.provider), "", "a failed parse has no provider to label");
});
t("an honest record still parses to the same provider it stored", () => {
  const link = normalizeVideoUrl("https://youtu.be/abc");
  assert.equal(link.ok, true);
  assert.equal(providerLabel(link.provider), "יוטיוב");
});

console.log("\n" + pass + " tests passed (incl. gate #8)");
