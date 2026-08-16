// ============================================================================
// routes.js — טבלת המסלולים והפרסור, **טהורים** (בלי React), כדי שה-smoke
// יבדוק את הראוטר בלי DOM ובלי חבילות.
//
// **hash ולא History API** — עובד זהה תחת `file://` של Capacitor, בלי
// rewrites בשרת ובלי base path.
// ============================================================================

export const ROUTES = [
  { name: "home", pattern: [] },
  { name: "vehicles", pattern: ["vehicles"] },
  { name: "vehicleNew", pattern: ["vehicles", "new"] },
  { name: "vehicle", pattern: ["vehicle", ":id"] },
  { name: "taskNew", pattern: ["vehicle", ":id", "task", "new"] },
  { name: "task", pattern: ["task", ":id"] },
  { name: "docs", pattern: ["docs"] },
  { name: "emergency", pattern: ["emergency"] },
  { name: "settings", pattern: ["settings"] },
  { name: "accessibility", pattern: ["settings", "accessibility"] },
  { name: "notice", pattern: ["settings", "notice"] },
];

export function parseHash(hash) {
  const raw = String(hash || "").replace(/^#/, "");
  const [pathPart] = raw.split("?");
  const segments = pathPart.split("/").filter(Boolean);

  for (const route of ROUTES) {
    if (route.pattern.length !== segments.length) continue;
    const params = {};
    const match = route.pattern.every((p, i) => {
      if (p.startsWith(":")) {
        params[p.slice(1)] = decodeURIComponent(segments[i]);
        return true;
      }
      return p === segments[i];
    });
    if (match) return { name: route.name, params, path: `/${segments.join("/")}`, segments };
  }
  return { name: "notFound", params: {}, path: `/${segments.join("/")}`, segments };
}

export function hrefFor(path) {
  return `#${path.startsWith("/") ? path : `/${path}`}`;
}
