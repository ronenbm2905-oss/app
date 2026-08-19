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

// There was a `legalLooksInherited` here, to catch a club whose legal details were
// still verbatim the defaults while its name had been changed — the state in which a
// privacy policy names the wrong data controller. It existed only because the defaults
// held one real club's details. They are blank now, so "same as the defaults" means
// "not filled in yet", which `legalDetailsComplete` already reports without accusing a
// new club of carrying someone else's legal identity.

export const LEGAL_FIELD_LABELS = LABELS;
