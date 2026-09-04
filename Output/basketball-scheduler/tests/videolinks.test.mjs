// A pasted video link, on its way into an `href`.
//
// This is the only place in the app that turns text a person typed into a link every other
// coach's browser will follow. The suite is weighted accordingly: most of it is about what
// must be REFUSED, and the sharpest assertions are the ones that would still pass if the
// parser were replaced by something naive.

import assert from "node:assert/strict";
import {
  normalizeVideoUrl, buildVideo, matchesSearch, sortVideos, providerLabel, VIDEO_PROVIDERS,
} from "../src/utils/videoLinks.js";

const ok = (raw) => {
  const r = normalizeVideoUrl(raw);
  assert.equal(r.ok, true, `expected to accept: ${raw} — ${r.reason || ""}`);
  return r;
};
const no = (raw) => {
  const r = normalizeVideoUrl(raw);
  assert.equal(r.ok, false, `expected to REFUSE: ${raw}`);
  assert.ok(String(r.reason || "").length > 0, `refusal without a reason: ${raw}`);
  return r;
};

// ---- The security line ----
// `javascript:` is the whole reason this module exists.
no("javascript:alert(1)");
no("javascript:alert(document.cookie)//youtube.com/watch?v=1");
no("data:text/html,<script>alert(1)</script>");
no("vbscript:msgbox(1)");
no("http://www.youtube.com/watch?v=abc");            // plain http, right host
no("file:///etc/passwd");

// ---- The allowlist is equality, not "ends with" ----
// The assertion that catches a naive rewrite: these all contain a permitted host as a
// substring and none of them is that host.
no("https://youtube.com.evil.example/watch?v=abc");
no("https://evil-youtube.com/watch?v=abc");
no("https://notyoutu.be/abc");
no("https://youtube.com.br/watch?v=abc");
no("https://vimeo.com/12345");                        // real video site, not on the list
// A userinfo prefix is the classic way to make a bad host read as a good one.
no("https://www.youtube.com@evil.example/watch?v=abc");

// ---- Accepted, and normalised ----
assert.equal(ok("https://www.youtube.com/watch?v=abc").provider, "youtube");
assert.equal(ok("https://youtu.be/abc").provider, "youtube");
assert.equal(ok("https://m.youtube.com/watch?v=abc").provider, "youtube");
assert.equal(ok("https://music.youtube.com/watch?v=abc").provider, "youtube");
assert.equal(ok("https://fb.watch/xyz/").provider, "facebook");
assert.equal(ok("https://web.facebook.com/watch/?v=1").provider, "facebook");
// Host casing is not a difference.
assert.equal(ok("https://WWW.YouTube.COM/watch?v=abc").provider, "youtube");
// A bare host pasted from a phone's address bar gets the one benefit of the doubt.
assert.equal(ok("youtu.be/abc").url, "https://youtu.be/abc");
assert.equal(ok("  https://youtu.be/abc  ").url, "https://youtu.be/abc", "surrounding space");

// The share id is a tracker with no effect on where the link goes, so it is not stored.
assert.equal(ok("https://youtu.be/abc?si=TRACKER").url, "https://youtu.be/abc");
assert.equal(ok("https://www.facebook.com/watch/?v=1&fbclid=X").url, "https://www.facebook.com/watch/?v=1");
// ...and stripping the last parameter must not leave a bare "?" behind.
assert.ok(!ok("https://youtu.be/abc?si=X").url.endsWith("?"));
// A timestamp is part of the link and must survive.
assert.equal(ok("https://youtu.be/abc?t=42&si=X").url, "https://youtu.be/abc?t=42");
assert.ok(ok("https://www.youtube.com/watch?v=abc#t=1").url.endsWith("#t=1"), "the fragment survives");

// ---- Not a video ----
no("https://www.youtube.com/");
no("https://youtu.be/");
no("");
no("   ");
no(null);
no("not a link at all");

// ---- buildVideo ----
{
  const r = buildVideo({
    id: "v1", url: "https://youtu.be/abc?si=X", title: "  תרגיל מסירות  ",
    category: "מסירות וכדרור", note: " הדגש על יד שמאל ", author: "דנה",
    authorEmail: "  Dana@Gmail.COM ", now: "2026-09-01T00:00:00.000Z",
  });
  assert.equal(r.ok, true);
  assert.equal(r.video.title, "תרגיל מסירות", "title is trimmed");
  assert.equal(r.video.note, "הדגש על יד שמאל");
  assert.equal(r.video.url, "https://youtu.be/abc", "the tracker was stripped on the way in");
  assert.equal(r.video.provider, "youtube");
  // The rules compare this exactly; a capital letter would lock the coach out of their own entry.
  assert.equal(r.video.authorEmail, "dana@gmail.com");
}
assert.equal(buildVideo({ id: "v", url: "https://youtu.be/abc", title: "   ", now: "x" }).ok, false, "a nameless link is unfindable");
assert.equal(buildVideo({ id: "v", url: "javascript:alert(1)", title: "רע", now: "x" }).ok, false);

// ---- Labels, search, order ----
assert.equal(providerLabel("youtube"), VIDEO_PROVIDERS.youtube);
assert.equal(providerLabel("nonsense"), "", "an unknown provider gets no label to vouch for it");
assert.equal(providerLabel(undefined), "");

const v = { title: "תרגיל מסירות", note: "יד שמאל", category: "הגנה", author: "דנה", url: "https://youtu.be/abc" };
assert.equal(matchesSearch(v, ""), true);
assert.equal(matchesSearch(v, "מסירות"), true);
assert.equal(matchesSearch(v, "דנה"), true);
assert.equal(matchesSearch(v, "הגנה"), true);
assert.equal(matchesSearch(v, "קליעה"), false);
assert.equal(matchesSearch(v, "youtu.be"), false, "the URL is not searched — it is not what anyone remembers");

assert.deepEqual(
  sortVideos([{ id: "a", createdAt: "2026-01-01" }, { id: "b", createdAt: "2026-05-01" }]).map((x) => x.id),
  ["b", "a"], "newest first"
);
assert.deepEqual(sortVideos(null), []);
assert.deepEqual(sortVideos("nope"), []);

console.log("video-links: 52 assertions passed");
