// ============================================================================
// routes.js — טבלת המסלולים + פרסור hash. פונקציות טהורות בלבד (נבדקות ב-smoke).
//
// למה hash ולא react-router: אין שרת, Hosting מגיש SPA, ואנחנו רוצים שקישור
// לקונפיגורציה (`#/model/m1?metal=rose&karat=18k&diamond=d7`) יהיה **שיתופי** —
// לקוח שולח לשלומי בוואטסאפ בדיוק את מה שהוא ראה. State ב-React לא נשלח בקישור.
// ============================================================================

export const ROUTES = {
  home: "/",
  catalog: "/catalog",
  model: "/model/:id",
  diamonds: "/diamonds",
  about: "/about",
  contact: "/contact",
  privacy: "/privacy",
  accessibility: "/accessibility",
  admin: "/admin",
};

function parseQuery(qs) {
  const out = {};
  if (!qs) return out;
  for (const pair of qs.split("&")) {
    if (!pair) continue;
    const idx = pair.indexOf("=");
    const rawK = idx === -1 ? pair : pair.slice(0, idx);
    const rawV = idx === -1 ? "" : pair.slice(idx + 1);
    try {
      out[decodeURIComponent(rawK)] = decodeURIComponent(rawV.replace(/\+/g, " "));
    } catch {
      out[rawK] = rawV;
    }
  }
  return out;
}

export function buildQuery(obj) {
  const parts = [];
  for (const [k, v] of Object.entries(obj || {})) {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    const val = Array.isArray(v) ? v.join(",") : String(v);
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(val)}`);
  }
  return parts.join("&");
}

// "#/model/m1?metal=rose" → { name:"model", params:{id:"m1"}, query:{metal:"rose"} }
export function parseHash(hash) {
  const raw = String(hash || "").replace(/^#/, "");
  const [pathRaw, qs] = raw.split("?");
  const query = parseQuery(qs);
  const path = pathRaw || "/";
  const segs = path.split("/").filter(Boolean);

  if (segs.length === 0) return { name: "home", params: {}, query, path: "/" };

  const [head, second] = segs;
  switch (head) {
    case "catalog":
      return { name: "catalog", params: {}, query, path };
    case "model":
      return second
        ? { name: "model", params: { id: second }, query, path }
        : { name: "catalog", params: {}, query, path };
    case "diamonds":
      return { name: "diamonds", params: {}, query, path };
    case "about":
      return { name: "about", params: {}, query, path };
    case "contact":
      return { name: "contact", params: {}, query, path };
    case "privacy":
      return { name: "privacy", params: {}, query, path };
    case "accessibility":
      return { name: "accessibility", params: {}, query, path };
    case "admin":
      return { name: "admin", params: { tab: second || "models" }, query, path };
    default:
      return { name: "notFound", params: {}, query, path };
  }
}

export function hrefFor(path, query) {
  const q = buildQuery(query);
  const clean = String(path || "/").replace(/^#/, "");
  return `#${clean.startsWith("/") ? clean : `/${clean}`}${q ? `?${q}` : ""}`;
}

export const href = {
  home: () => hrefFor("/"),
  catalog: (query) => hrefFor("/catalog", query),
  model: (id, query) => hrefFor(`/model/${id}`, query),
  diamonds: (query) => hrefFor("/diamonds", query),
  about: () => hrefFor("/about"),
  contact: () => hrefFor("/contact"),
  privacy: () => hrefFor("/privacy"),
  accessibility: () => hrefFor("/accessibility"),
  admin: (tab) => hrefFor(`/admin${tab ? `/${tab}` : ""}`),
};
