// The legal documents are templates, and a club's own details fill them in.
//
// Written for the accessibility statement's date. It used to be typed twice into the
// markdown by hand, and the two lines drifted apart every time a screen was added — the
// legal gate flagged the same stale date three rounds running. It is now one product
// constant, and this suite is what keeps it one: a token that renders a "to be filled"
// marker, or a date that has to be typed into the document again, is the failure coming
// back.

import assert from "node:assert/strict";
import {
  fillLegalTemplate,
  legalDetailsComplete,
  A11Y_STATEMENT_DATE,
  LEGAL_FIELD_LABELS,
} from "../src/legal/fillTemplate.js";

const FULL = {
  operator: "מכבי בדיקה",
  address: "הרצל 1, תל אביב",
  email: "office@club.org",
  a11yContact: "דנה",
  a11yPhone: "050-1111111",
};

// ---- The club's own details ----
assert.equal(fillLegalTemplate("המפעיל: {{operator}}", FULL), "המפעיל: מכבי בדיקה");
assert.equal(fillLegalTemplate('דוא"ל: {{email}}', FULL), 'דוא"ל: office@club.org');

// A missing value is visibly unfinished rather than silently wrong — a policy naming the
// wrong legal entity is a misrepresentation, an obviously blank one is only unfinished.
assert.equal(fillLegalTemplate("{{operator}}", {}), "⟨שם המפעיל — למילוי⟩");
assert.equal(fillLegalTemplate("{{operator}}", null), "⟨שם המפעיל — למילוי⟩");
assert.equal(fillLegalTemplate("{{operator}}", { operator: "   " }), "⟨שם המפעיל — למילוי⟩",
  "whitespace is not a filled-in value");

// The one token that renders to nothing when unset: a club that is not an עמותה must not
// be described as one, and a blank here is correct rather than unfinished.
assert.equal(fillLegalTemplate("{{operator}}{{entitySuffix}}", FULL), "מכבי בדיקה");
assert.equal(fillLegalTemplate("{{operator}}{{entitySuffix}}", { ...FULL, entityType: "עמותה" }),
  "מכבי בדיקה (עמותה)");

// ---- The product's own constant ----
assert.equal(fillLegalTemplate("{{a11yDate}}", FULL), A11Y_STATEMENT_DATE);
// ...and it fills in for a club that has entered nothing at all. This is the whole point:
// the date describes the product's screens, not the club, so no club can leave it blank.
assert.equal(fillLegalTemplate("{{a11yDate}}", {}), A11Y_STATEMENT_DATE);
assert.equal(fillLegalTemplate("{{a11yDate}}", null), A11Y_STATEMENT_DATE);
// A club cannot override it either, deliberately — a club-supplied date would be a date
// nobody measured.
assert.equal(fillLegalTemplate("{{a11yDate}}", { ...FULL, a11yDate: "1.1.1970" }),
  A11Y_STATEMENT_DATE, "a club field overrode the product constant");
assert.ok(/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(A11Y_STATEMENT_DATE),
  "the statement date is not a readable Hebrew-format date");

// ...and it is NOT one of the fields a club is asked to complete, or every club would be
// blocked from going live by a value it cannot know.
assert.ok(!("a11yDate" in LEGAL_FIELD_LABELS), "the product constant leaked into the club form");
assert.ok(legalDetailsComplete(FULL), "a fully filled club was reported incomplete");
for (const key of Object.keys(LEGAL_FIELD_LABELS)) {
  const missing = { ...FULL, [key]: "" };
  assert.ok(!legalDetailsComplete(missing), `a club missing ${key} was reported complete`);
}
assert.ok(!legalDetailsComplete({}));
assert.ok(!legalDetailsComplete(null));

// ---- The documents themselves ----
// Reading the shipped markdown, because the bug this suite exists for was in the markdown
// and not in the substitution.
import { readFileSync } from "node:fs";
const read = (name) =>
  readFileSync(new URL(`../src/legal/content/${name}`, import.meta.url), "utf8");

const a11y = read("accessibility-statement.md");
assert.ok(!/28\.7\.2026/.test(a11y), "a hand-written date is back in the accessibility statement");
assert.equal((a11y.match(/\{\{a11yDate\}\}/g) || []).length, 2,
  "the statement should carry the date token exactly twice — header and closing section");
// The limitation that has no keyboard path must be declared. An undeclared limitation is
// a breach; a declared one is a limitation.
assert.ok(/שרטוט המגרש/.test(a11y), "the sketch editor is missing from the known limitations");
assert.ok(/מקלדת/.test(a11y));

// Every token used anywhere in the documents must be one the filler knows, or a club
// reads a raw {{placeholder}} in its own privacy policy.
const known = new Set([...Object.keys(LEGAL_FIELD_LABELS), "entitySuffix", "a11yDate"]);
for (const name of ["accessibility-statement.md", "privacy-policy.md", "terms-of-use.md"]) {
  for (const m of read(name).matchAll(/\{\{(\w+)\}\}/g)) {
    assert.ok(known.has(m[1]), `${name}: unknown placeholder {{${m[1]}}}`);
  }
  assert.ok(!/\{\{/.test(fillLegalTemplate(read(name), FULL)),
    `${name}: a placeholder survived filling`);
}

console.log("legal template: 30 assertions passed");
