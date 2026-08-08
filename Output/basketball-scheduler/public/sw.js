// Service worker — deliberately minimal, and network-first everywhere.
//
// Its job is to let the portal be installed to a phone's home screen and to survive a
// dead spot in a sports hall. It is NOT a performance cache: a stale build served from
// a cache is the failure mode this club has already been burned by once, when a phone
// kept showing an old version after a deploy.
//
// Rules that keep that from happening again:
//   • network first, always — the cache answers only when the network does not.
//   • same-origin GET only. Firestore and Google sign-in traffic is never touched;
//     caching an API response here would show parents a schedule that no longer exists.
//   • the new worker takes over immediately (skipWaiting + claim) instead of waiting
//     for every tab to close, so a fix reaches people on the next load.

const CACHE = "bball-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Pre-cache the shell so a cold, offline start still renders something.
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest"]).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Firestore, Auth, fonts — hands off

  // A navigation must always try the network first: this is how a new build arrives.
  // Offline, fall back to whatever copy of the app shell we have.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/").then((r) => r || Response.error()))
    );
    return;
  }

  // Hashed assets are immutable, so a cached copy can never be the wrong version.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((r) => r || Response.error()))
  );
});
