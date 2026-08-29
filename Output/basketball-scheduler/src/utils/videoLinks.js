// Validating a pasted video link.
//
// This is the first place in the app that takes a URL from a person and renders it into an
// `href`. That is a `javascript:` URL waiting to happen: a coach pastes something, it is
// stored in Firestore, and every other coach's browser runs it on click. Nothing else in
// the app has needed this, so there is no existing guard to lean on — this module is the
// guard.
//
// Three rules, in order of how much they matter:
//   1. Parse with `new URL`, never a regular expression. A regex over URLs is a long list
//      of near-misses; the browser already has the parser.
//   2. `https:` only. This is the security line, not a style preference.
//   3. An ALLOWLIST of hosts, never a blocklist. "Not obviously bad" is not a policy.
//
// The club has decided the videos open in YouTube/Facebook rather than in an embedded
// player, so nothing here ever loads third-party code — see the note in VideosView.

// Exact hosts. `youtube.evil.com` ends with "youtube.com" under a naive check and is not
// YouTube, so the comparison is equality against this list and nothing looser.
const HOSTS = {
  "youtube.com": "youtube",
  "www.youtube.com": "youtube",
  "m.youtube.com": "youtube",
  "music.youtube.com": "youtube",
  "youtu.be": "youtube",
  "facebook.com": "facebook",
  "www.facebook.com": "facebook",
  "m.facebook.com": "facebook",
  "web.facebook.com": "facebook",
  "fb.watch": "facebook",
};

export const VIDEO_PROVIDERS = { youtube: "יוטיוב", facebook: "פייסבוק" };

// Share links carry a tracking id that has no business being stored in the club's records
// and no effect on where the link goes. `si` is YouTube's, `fbclid` is Meta's.
const TRACKING_PARAMS = ["si", "fbclid", "gclid", "mc_cid", "mc_eid"];

export function providerLabel(provider) {
  return VIDEO_PROVIDERS[provider] || "";
}

// A pasted string -> { ok: true, url, provider } | { ok: false, reason }
//
// `reason` is the sentence shown under the field. It says what is wrong rather than that
// something is wrong — the same tone as `isValidEmail` in utils/access.js: enough to catch
// a mistake before it becomes a phone call, without pretending to be a full validator.
export function normalizeVideoUrl(raw) {
  const text = String(raw || "").trim();
  if (!text) return { ok: false, reason: "הדבק קישור לסרטון." };

  // A person who copies from the address bar of a mobile browser sometimes gets a bare
  // host. Give that one case a chance rather than refusing it on a technicality.
  const candidate = /^[a-z]+:\/\//i.test(text) ? text : `https://${text}`;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, reason: "זה לא נראה כמו קישור. העתק את הכתובת המלאה מהדפדפן." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "מותרים רק קישורי https." };
  }

  const provider = HOSTS[parsed.hostname.toLowerCase()];
  if (!provider) {
    return { ok: false, reason: "כרגע אפשר לקשר רק ליוטיוב או לפייסבוק." };
  }

  // A host and nothing else is the front page, not a video.
  if (parsed.pathname === "/" && !parsed.search) {
    return { ok: false, reason: "הקישור מוביל לעמוד הבית ולא לסרטון מסוים." };
  }

  TRACKING_PARAMS.forEach((p) => parsed.searchParams.delete(p));
  // Deleting the last parameter leaves a trailing "?" behind; drop it so the stored string
  // is the link a person would have copied.
  const search = parsed.searchParams.toString();
  const url = `https://${parsed.hostname}${parsed.pathname}${search ? `?${search}` : ""}${parsed.hash}`;

  return { ok: true, url, provider };
}

// Everything the form needs in one call, so the component holds no parsing logic of its own.
export function buildVideo({ id, url, title, category, note, author, authorEmail, now }) {
  const parsed = normalizeVideoUrl(url);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };
  const clean = String(title || "").trim();
  if (!clean) return { ok: false, reason: "תן לסרטון שם, כדי שאפשר יהיה למצוא אותו." };
  return {
    ok: true,
    video: {
      id,
      title: clean,
      url: parsed.url,
      provider: parsed.provider,
      category: String(category || "").trim(),
      note: String(note || "").trim(),
      author: String(author || "").trim(),
      // Lower-cased for the same reason as everywhere else: the Firestore rule compares it
      // to the signed-in address exactly, and a capital letter locks a coach out of their
      // own entry with nothing on screen to explain it.
      authorEmail: String(authorEmail || "").trim().toLowerCase(),
      createdAt: now,
    },
  };
}

// Free-text search over the fields a person would actually remember.
export function matchesSearch(video, term) {
  const q = String(term || "").trim().toLowerCase();
  if (!q) return true;
  return ["title", "note", "category", "author"].some((k) =>
    String(video?.[k] || "").toLowerCase().includes(q)
  );
}

// Newest first: a library is browsed from what was added recently, not alphabetically.
export function sortVideos(list) {
  return (Array.isArray(list) ? [...list] : []).sort((a, b) =>
    String(b?.createdAt || "").localeCompare(String(a?.createdAt || ""))
  );
}
