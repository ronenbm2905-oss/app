/* Firebase Cloud Messaging service worker.
 *
 * It must sit at the site ROOT with exactly this filename — the SDK looks for
 * `/firebase-messaging-sw.js` by convention. Vite copies `public/` to the root, which is
 * why it lives there and not in `src/`.
 *
 * THE CONFIG ARRIVES IN THE REGISTRATION URL, and that is not a trick — it is the one way
 * to keep it out of this file. A service worker is not part of the bundle: the browser
 * fetches it standalone, long after the page is gone, so `import.meta.env` does not exist
 * here. The alternative is hardcoding the project's config — and this repository is
 * PUBLIC. The values are not secret (they ship inside the built app either way, and the
 * security rules are what actually protect the data), but a repo-wide rule that says "no
 * keys in the tree" stops being a rule the first time it is bent for a good reason.
 *
 * This file must stay as small as it looks. It runs when the app is CLOSED, `npm test`
 * cannot reach it, and a failure here is silent — no notification arrives and nobody
 * learns why. Everything decidable before the send is decided in the Cloud Function and
 * in `utils/pushTargets.js`, where it can be tested.
 */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

const params = new URL(self.location).searchParams;
const cfg = {
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("senderId"),
  appId: params.get("appId"),
};

// No config, no worker. Registering with missing values would install a worker that looks
// alive and never delivers — the worst failure shape for something this invisible.
if (cfg.projectId && cfg.messagingSenderId && cfg.appId) {
  firebase.initializeApp(cfg);
  const messaging = firebase.messaging();

  // The Cloud Function sends a DATA-only message on purpose. A `notification` payload is
  // rendered by the browser itself: the title and body could not be shaped here, and on
  // some platforms a second, duplicate notification appears alongside this one. Data-only
  // puts exactly one on the screen — ours.
  messaging.onBackgroundMessage((payload) => {
    const d = (payload && payload.data) || {};
    self.registration.showNotification(d.title || "שינוי בלו״ז", {
      body: d.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      dir: "rtl",
      lang: "he",
      // Replaced rather than stacked: a second change while the first is still on the lock
      // screen should update it, not queue behind it.
      tag: "schedule-change",
      renotify: true,
      data: { url: "/" },
    });
  });
}

// Tapping it focuses the app instead of opening a new tab every time.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow ? self.clients.openWindow("/") : undefined;
    })
  );
});
