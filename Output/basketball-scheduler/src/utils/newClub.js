// Building a new club document.
//
// Creating a club used to mean hand-typing this shape into the Firebase console, and
// it failed five times in a row on things a form cannot get wrong: a sub-collection
// created instead of a field, `setting` for `settings`, an array typed as a string,
// and a mistyped admin address. Everything here exists to make those unrepresentable.
//
// Pure on purpose — no Firestore imports — so the document shape can be exercised
// without a network or a project.

import { EMPTY, DEFAULT_SETTINGS } from "../constants";
import { isValidClubSlug } from "./clubId";

// Deliberately permissive: this rejects "not an address at all", not unusual-but-valid
// mailboxes. The real protection against a typo is that the creator keeps their own
// access — see buildNewClubDoc.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// The rules compare against the STORED list and cannot lowercase it, so an entry like
// "Ronen@Gmail.com" would never match — the club would show edit buttons to nobody and
// reject every write. Lowercasing here is not tidiness; it is the whole contract.
export function parseEmails(text) {
  const seen = new Set();
  const emails = [];
  const invalid = [];
  for (const raw of String(text || "").split(/[\n,;]+/)) {
    const value = raw.trim().toLowerCase();
    if (!value) continue;
    if (!EMAIL.test(value)) {
      if (!invalid.includes(value)) invalid.push(value);
      continue;
    }
    if (seen.has(value)) continue;
    seen.add(value);
    emails.push(value);
  }
  return { emails, invalid };
}

export function parseLines(text) {
  const seen = new Set();
  const out = [];
  for (const raw of String(text || "").split("\n")) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

// Field-by-field, so the form can point at what is wrong rather than refusing as a whole.
export function validateNewClub({ slug, name, adminsText, membersText, keywordsText }) {
  const errors = {};

  if (!slug) errors.slug = "חובה לבחור מזהה.";
  else if (!isValidClubSlug(slug))
    errors.slug = "מזהה חוקי: אותיות אנגליות קטנות, ספרות ומקפים, 3–64 תווים, ומתחיל ומסתיים באות או ספרה.";

  if (!String(name || "").trim()) errors.name = "חובה למלא את שם המועדון.";

  const admins = parseEmails(adminsText);
  const members = parseEmails(membersText);

  if (admins.invalid.length)
    errors.admins = `לא נראה כמו כתובת דוא"ל: ${admins.invalid.join(", ")}`;
  else if (!admins.emails.length)
    errors.admins = "חובה מנהל אחד לפחות — בלעדיו אף אחד לא יוכל לפתוח את המועדון.";

  if (members.invalid.length)
    errors.members = `לא נראה כמו כתובת דוא"ל: ${members.invalid.join(", ")}`;

  const overlap = members.emails.filter((e) => admins.emails.includes(e));
  if (overlap.length)
    errors.members = `${overlap.join(", ")} כבר מנהל/ת. מנהל רואה הכול ממילא — אין צורך להוסיף גם כצופה.`;

  return {
    errors,
    ok: Object.keys(errors).length === 0,
    admins: admins.emails,
    members: members.emails,
    homeKeywords: parseLines(keywordsText),
  };
}

// The document itself. Built from EMPTY so a field added to the club shape elsewhere
// cannot be silently missing here, and so no key is ever spelled by hand.
export function buildNewClubDoc({ name, admins, members, homeKeywords, creatorEmail }) {
  // The creator is added as an admin unless they are already listed. A mistyped admin
  // address otherwise produces a club nobody can open — including the person who just
  // created it, since editing an existing club requires being one of ITS admins. That
  // is unrecoverable from the app and was one of the five console failures.
  const creator = String(creatorEmail || "").trim().toLowerCase();
  const adminList = [...admins];
  if (creator && EMAIL.test(creator) && !adminList.includes(creator)) adminList.push(creator);

  return {
    // Deep copy, not `...EMPTY`: a shallow spread hands the new document the very same
    // arrays the module-level constant holds, so anything that later pushed into
    // doc.teams would be pushing into EMPTY.teams for the whole app. Harmless while
    // this object is written straight to Firestore, and a trap the moment it is not.
    ...structuredClone(EMPTY),
    settings: {
      ...DEFAULT_SETTINGS,
      name: String(name).trim(),
      homeKeywords: [...homeKeywords],
      // Left blank on purpose. Copying another club's operator, address or accessibility
      // contact into a privacy policy is a misrepresentation, so the documents render
      // ⟨… — למילוי⟩ until this club fills its own in.
      legal: { ...DEFAULT_SETTINGS.legal },
    },
    admins: adminList,
    members: [...members],
  };
}
