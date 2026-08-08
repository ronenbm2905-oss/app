// Substitutes {{key}} placeholders in the legal documents with the club's own details,
// so one set of documents serves every club.
//
// A missing value renders a visible "to be filled" marker rather than falling back to
// another club's details: a privacy policy or accessibility statement naming the wrong
// legal entity is a misrepresentation, and an obviously unfinished document is the
// safer failure. The legal gate is expected to catch these before a club goes live.

const LABELS = {
  operator: "שם המפעיל",
  address: "כתובת",
  email: 'דוא"ל',
  a11yContact: "רכז/ת נגישות",
  a11yPhone: "טלפון רכז/ת נגישות",
};

export function fillLegalTemplate(source, legal) {
  return String(source || "").replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const raw = legal && typeof legal[key] === "string" ? legal[key].trim() : "";
    return raw || `⟨${LABELS[key] || key} — למילוי⟩`;
  });
}

// True when every placeholder the documents rely on has a value. Used to warn an
// admin (and, later, to block go-live) while the legal details are still incomplete.
export function legalDetailsComplete(legal) {
  return Object.keys(LABELS).every(
    (k) => legal && typeof legal[k] === "string" && legal[k].trim() !== ""
  );
}

// Detects a club that carries someone else's legal identity.
//
// The default settings intentionally hold the original club's details so the existing
// deployment keeps working. The side effect is that a NEW club which never fills the
// legal section inherits them — and its privacy policy would name the wrong data
// controller, which is a misrepresentation rather than a cosmetic bug. A club whose
// name has been changed but whose legal details are still verbatim the defaults is
// almost certainly in that state.
export function legalLooksInherited(settings, defaults) {
  if (!settings || !defaults) return false;
  const nameChanged = (settings.name || "") !== (defaults.name || "");
  if (!nameChanged) return false;
  const a = settings.legal || {};
  const b = defaults.legal || {};
  return Object.keys(LABELS).every((k) => (a[k] || "") === (b[k] || ""));
}

export const LEGAL_FIELD_LABELS = LABELS;
