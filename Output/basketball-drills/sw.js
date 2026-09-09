const CACHE = "drills-v7";
const SHELL = ["./", "./index.html", "./manifest.webmanifest",
  "./icon-180.png", "./icon-192.png", "./icon-512.png",
  "./vendor/gif.js", "./vendor/gif.worker.js",
  "./vendor/rubik-hebrew.woff2", "./vendor/rubik-latin.woff2"];

self.addEventListener("install", e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", e=>{
  const req = e.request;
  if(req.method !== "GET") return;
  e.respondWith(
    caches.match(req).then(hit=>{
      if(hit) return hit;
      return fetch(req).then(res=>{
        const url = new URL(req.url);
        // origin בלבד. מטמון cache-first על מקור חיצוני צורב תשובה שהוחלפה לצמיתות.
        const cacheable = url.origin === location.origin;
        if(cacheable && res && (res.ok || res.type === "opaque")){
          const copy = res.clone();
          caches.open(CACHE).then(c=>c.put(req, copy));
        }
        return res;
      }).catch(()=> caches.match("./index.html"));
    })
  );
});
