// Substitutes {{key}} placeholders in the legal documents with the club's own details,
// so one set of documents serves every club.
//
// A missing value renders a visible "to be filled" marker rather than falling back to
// another club's details: a privacy policy or accessibility statement naming the wrong
// legal entity is a misrepresentation, and an obviously unfinished document is the
// safer failure. The legal gate is expected to catch these before a club goes live.

// The date the accessibility statement was last reviewed and updated.
//
// A product constant, NOT a club field, and deliberately so on both counts. It is not a
// club field because nothing in the statement's substance is the club's — the screens, the
// keyboard paths and the known limitations are the product's, and asking every club to
// supply a date would produce a date nobody measured. And it is a single constant because
// the statement used to carry the date twice, hand-written in two places: the pair drifted
// apart every time a screen was added, which is how a club that went live in September
// ended up publishing a statement dated before half its screens existed.
//
// Update it in the same commit that changes what the statement claims — never on its own.
export const A11Y_STATEMENT_DATE = "4.9.2026";

const CONSTANTS = { a11yDate: A11Y_STATEMENT_DATE };

const LABELS = {
  operator: "שם המפעיל",
  address: "כתובת",
  email: 'דוא"ל',
  a11yContact: "רכז/ת נגישות",
  a11yPhone: "טלפון רכז/ת נגישות",
};

// Tokens that render to nothing when unset, instead of a "to be filled" marker.
//
// entitySuffix is the club's form of incorporation, and the documents used to hard-code
// "(עמותה)" — telling every customer's readers that the controller of their data is a
// non-profit, which for a company is simply untrue. It is genuinely optional: a club
// that leaves it blank reads "**שם המועדון** ("המפעיל")", which is correct, whereas a
// ⟨… — למילוי⟩ here would make a finished document look unfinished.
const OPTIONAL = {
  entitySuffix: (legal) => {
    const type = legal && typeof legal.entityType === "string" ? legal.entityType.trim() : "";
    return type ? ` (${type})` : "";
  },
};

export function fillLegalTemplate(source, legal) {
  return String(source || "").replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    if (key in CONSTANTS) return CONSTANTS[key];
    if (OPTIONAL[key]) return OPTIONAL[key](legal);
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
