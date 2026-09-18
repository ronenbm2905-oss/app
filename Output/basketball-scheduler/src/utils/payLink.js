// The club's payment link, as it appears on the board a parent opens from WhatsApp.
//
// THE SERVICE NEVER TOUCHES MONEY. What is stored here is a URL and nothing else: no
// amount, no due date, no who-has-paid and no card data ever. The payment happens on the
// club's own payment page, under that provider's terms, and this is a link to it in the
// same sense that the video library is a link to YouTube.
//
// Two rules below are not cosmetic, and both exist because of who reads this page:
//
//   1. HTTPS ONLY. A parent is being asked to type card details at the other end. `http:`
//      is refused rather than silently upgraded — an upgrade that guesses wrong sends
//      someone to a page that will not load, and they will blame the club, not the link.
//      `javascript:` and `data:` are refused for the obvious reason: this URL is set by a
//      manager and rendered inside a page anyone with the token can open.
//
//   2. THE DESTINATION IS SHOWN IN WORDS. `payHost` exists so the board can print where
//      the button goes, beside the button. A link arriving in a WhatsApp group, opening a
//      page with a logo, asking for payment, is the exact shape of a scam — and the club's
//      own message must not be indistinguishable from one. A parent who can read the host
//      can check it; one who cannot, cannot.

const clean = (raw) => String(raw == null ? "" : raw).trim();

export function normalizePayUrl(raw) {
  const text = clean(raw);
  if (!text) return "";
  // A manager pasting from a browser bar often brings "pay.example.co.il" with no scheme.
  // That is a missing scheme, not an insecure one, so it is completed rather than refused.
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(text) ? text : "https://" + text;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return "";
  }
  if (url.protocol !== "https:") return "";
  // A host with no dot is an intranet name or a typo; neither belongs on a page sent to
  // several hundred parents.
  if (!url.hostname || !url.hostname.includes(".")) return "";
  return url.href;
}

export function payHost(url) {
  try {
    return new URL(String(url || "")).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const index = (data) => {
  const raw = data?.boards;
  return raw && typeof raw === "object" ? raw : {};
};

export function payUrlForTeam(data, teamId) {
  return index(data)[teamId]?.payUrl || "";
}

// What gets copied into the published board. `null` rather than absent, because the board
// is written with `merge: true` — an absent field would leave yesterday's link in place,
// and "I removed it" has to actually remove it.
export function payFor(data, teamId) {
  const url = payUrlForTeam(data, teamId);
  return url ? { url, host: payHost(url) } : null;
}

// Stored on the board index entry rather than on the team: a team with no published board
// has nowhere to show a link, and keeping the two together means unpublishing takes the
// payment link down with it.
export function withPayUrl(data, teamId, url) {
  const rows = index(data);
  const row = rows[teamId];
  if (!row) return data;
  const next = { ...row };
  if (url) next.payUrl = url;
  else delete next.payUrl;
  return { ...data, boards: { ...rows, [teamId]: next } };
}

// One link for every published team. Fourteen teams is thirteen chances to paste it wrong,
// and a link typed once per team is a link that is right in nine of them.
export function withPayUrlEverywhere(data, url) {
  const rows = index(data);
  const next = {};
  Object.entries(rows).forEach(([teamId, row]) => {
    const copy = { ...row };
    if (url) copy.payUrl = url;
    else delete copy.payUrl;
    next[teamId] = copy;
  });
  return { ...data, boards: next };
}

export function teamsWithPayUrl(data) {
  return Object.values(index(data)).filter((r) => r && r.payUrl).length;
}
