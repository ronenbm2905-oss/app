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
  PRIVACY_POLICY_DATE,
  TERMS_OF_USE_DATE,
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

// ---- The product's own constants ----
assert.equal(fillLegalTemplate("{{a11yDate}}", FULL), A11Y_STATEMENT_DATE);
assert.equal(fillLegalTemplate("{{privacyDate}}", FULL), PRIVACY_POLICY_DATE);
assert.equal(fillLegalTemplate("{{termsDate}}", FULL), TERMS_OF_USE_DATE);
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
for (const token of ["a11yDate", "privacyDate", "termsDate"]) {
  assert.ok(!(token in LEGAL_FIELD_LABELS), `the product constant ${token} leaked into the club form`);
}
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

// No document may carry a hand-written date. This started as a guard on the accessibility
// statement alone — and within a day the privacy policy changed nine sections while its own
// date sat unchanged at 20.8, breaking the promise §9 makes in the same file. A guard that
// covers one of three documents covers none of the failure.
const DATE_TOKEN = { "privacy-policy.md": "privacyDate", "terms-of-use.md": "termsDate", "accessibility-statement.md": "a11yDate" };
for (const [name, token] of Object.entries(DATE_TOKEN)) {
  const text = read(name);
  assert.ok(!/[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{4}/.test(text), `${name}: a hand-written date is back`);
  assert.ok(new RegExp(`\\{\\{${token}\\}\\}`).test(text), `${name}: no date token at all`);
  // The filled document says a date and not a marker, whatever the club supplied.
  assert.ok(/[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{4}/.test(fillLegalTemplate(text, {})),
    `${name}: the date did not render for a club that filled nothing in`);
}
// Why the date is load-bearing, asserted from the documents' own text so the reason cannot
// quietly be edited out. The policy promises a new date on every update (§9). The terms do
// something different and, for a stale date, worse: they infer agreement from continued use
// after an update (§7) — with no promise of a date at all, the date printed at the top is
// the only thing telling a coach that what they are agreeing to has changed.
assert.ok(/תאריך עדכון חדש/.test(read("privacy-policy.md")),
  "the policy no longer promises a new date on update — the guard above loses its reason");
assert.ok(/המשך השימוש לאחר עדכון מהווה הסכמה/.test(read("terms-of-use.md")),
  "the terms no longer infer agreement from continued use — check whether the date still carries that weight");

const a11y = read("accessibility-statement.md");
assert.equal((a11y.match(/\{\{a11yDate\}\}/g) || []).length, 2,
  "the statement should carry the date token exactly twice — header and closing section");
// The limitation that has no keyboard path must be declared. An undeclared limitation is
// a breach; a declared one is a limitation.
assert.ok(/שרטוט המגרש/.test(a11y), "the sketch editor is missing from the known limitations");
assert.ok(/מקלדת/.test(a11y));

// Every token used anywhere in the documents must be one the filler knows, or a club
// reads a raw {{placeholder}} in its own privacy policy.
const known = new Set([...Object.keys(LEGAL_FIELD_LABELS), "entitySuffix", ...Object.values(DATE_TOKEN)]);
for (const name of ["accessibility-statement.md", "privacy-policy.md", "terms-of-use.md"]) {
  for (const m of read(name).matchAll(/\{\{(\w+)\}\}/g)) {
    assert.ok(known.has(m[1]), `${name}: unknown placeholder {{${m[1]}}}`);
  }
  assert.ok(!/\{\{/.test(fillLegalTemplate(read(name), FULL)),
    `${name}: a placeholder survived filling`);
}

console.log("legal template: 67 assertions passed");
