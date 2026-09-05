// What the club still holds in a departing coach's name, and the one act that clears it.
//
// The privacy policy promises that a coach who leaves can have their name and address
// taken off what they wrote. Until now that promise had a mechanism for exactly one of the
// three record types: the video library, where a manager editing somebody else's entry can
// tick "release to the club". Game notes and training plans had neither a mechanism nor a
// sentence — and a training plan carries player names, some of them minors, in its lineups
// and its "missing" field. So a club could delete a departed coach from the roster and be
// left with documents about children that still carry that person's name and address, with
// no way to reach them from the app. The service operator has a Firebase console; a client
// club does not. That gap is what this module closes.
//
// Two shapes here on purpose. `releaseRecord` is the single act — one implementation, used
// by the video form and by the departure flow alike, because two would drift. And nothing
// here writes: `buildDeparturePlan` returns a PLAN and the screen executes it, the same
// separation `copyWeek.js` uses, so the interesting decisions can be asserted without a
// Firestore double.

import { normalizeEmail } from "./access.js";

const arr = (v) => (Array.isArray(v) ? v : []);
const map = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

// A record belongs to whoever `authorEmail` names. The display name beside it is never
// matched on — two coaches called דנה would take each other's records with them.
export function ownedBy(record, email) {
  const e = normalizeEmail(email);
  return Boolean(e) && normalizeEmail(record?.authorEmail) === e;
}

// The act itself: the content stays, the person comes off.
//
// Both fields, not just the address. `authorEmail` is what the security rules match, so
// blanking it is what actually ends the coach's access — but `author` is the name a manager
// reads on screen, and leaving it behind would keep the record pointing at a person while
// claiming it no longer does. After this the record answers to admins only, which is the
// intended end state: it is the club's record now.
export function releaseRecord(record) {
  if (!record || typeof record !== "object") return record;
  return { ...record, author: "", authorEmail: "" };
}

export function isReleased(record) {
  return Boolean(record) && !normalizeEmail(record?.authorEmail);
}

// Everything this club holds that is tied to one coach.
//
// Absences are matched by `coachId` and not by address, and that difference matters: an
// absence is the one record here written ABOUT the coach rather than BY them, so it exists
// even for a coach who never signed in.
//
// A coach with no address in their roster record therefore has no notes, plans or videos
// that can be found FROM THE ROSTER — but they may well have written some. This comment
// used to claim otherwise ("writing requires signing in, and the address is the identity"),
// and that was wrong in the way that matters: writing is gated on `isClubStaff`, which
// reads `admins[]`/`members[]`, and the roster's `email` field appears nowhere in the
// rules. The legal gate found the hole by checking the claim instead of believing it.
// `unclaimedAddresses` below is what covers the gap.
export function departureHoldings(coach, { notes, plans, videos, absences } = {}) {
  const email = normalizeEmail(coach?.email);
  const id = String(coach?.id || "");
  const owned = (m) => Object.keys(map(m)).filter((k) => ownedBy(map(m)[k], email)).sort();
  const found = {
    email,
    notes: owned(notes),
    plans: owned(plans),
    videos: arr(videos).filter((v) => ownedBy(v, email)).map((v) => String(v.id)),
    absences: id ? arr(absences).filter((a) => a && a.coachId === id).map((a) => String(a.id)) : [],
  };
  found.total = found.notes.length + found.plans.length + found.videos.length + found.absences.length;
  return found;
}

// The plan, in the order a person would describe it: release what the coach wrote, drop
// what was written about them.
//
// Releasing and deleting are deliberately not the same act. A note or a plan is a club
// record with professional value — next season's coach needs last season's work, and
// deleting it to protect a name would destroy the club's own documentation. An absence has
// no such value once the day it refers to has passed: it is a line about a person, kept for
// nothing, so on departure it goes rather than being anonymised into a mystery gap in the
// board.
export function buildDeparturePlan(coach, sources = {}) {
  const held = departureHoldings(coach, sources);
  const notes = map(sources.notes);
  const plans = map(sources.plans);
  const videos = arr(sources.videos);
  return {
    coachId: String(coach?.id || ""),
    email: held.email,
    releases: [
      ...held.notes.map((key) => ({ kind: "note", key, record: releaseRecord(notes[key]) })),
      ...held.plans.map((key) => ({ kind: "plan", key, record: releaseRecord(plans[key]) })),
      ...held.videos.map((key) => ({
        kind: "video", key,
        record: releaseRecord(videos.find((v) => String(v.id) === key)),
      })),
    ],
    absenceIds: held.absences,
    total: held.total,
  };
}

// The sentence a manager reads before confirming. Built here rather than in the screen so
// the counts and the wording are asserted together: a dialog that says "2 רשומות" and then
// clears three is worse than no dialog.
// Author addresses that belong to no coach on the roster.
//
// The roster's `email` field is optional — the privacy policy says so in as many words, and
// nothing validates it — while WRITING is gated on `members[]`. So a coach can fill in
// training plans, with players' names in them, whose author address the roster never learns.
// Searching from the roster finds nothing, the departure card shows no row, the delete guard
// sees a clean coach, and the records outlive the person with their name still on them: the
// exact failure the departure action was built to end.
//
// So the card searches from BOTH directions. This is the second one: every address that
// actually wrote something and matches no coach. It also catches the cases a required field
// would not — an address changed after the fact, or a coach deleted before this existed.
export function unclaimedAddresses({ notes, plans, videos, coaches, admins, members } = {}) {
  const known = new Set(arr(coaches).map((c) => normalizeEmail(c?.email)).filter(Boolean));
  // Still authorised in this club — a manager, or a coach whose address is on the access
  // list but not on their roster row. Their records are NOT a departure: a manager writes
  // game notes under their own address and fills in a training plan for a coach who did not
  // get to it, and they need not appear in the coach list at all. Without this the club's
  // own manager would see a permanent "unassigned records" row inviting them to strip their
  // name from documents about children — and a row that is wrong every day is a row nobody
  // reads on the day it is right.
  const active = new Set(
    [...arr(admins), ...arr(members)].map((e) => normalizeEmail(e)).filter(Boolean)
  );
  const found = new Map();
  const add = (record, kind) => {
    const email = normalizeEmail(record?.authorEmail);
    // A released record is nobody's by design, and must never be offered for release again.
    if (!email || known.has(email)) return;
    if (!found.has(email)) {
      found.set(email, { email, notes: 0, plans: 0, videos: 0, total: 0, authorized: active.has(email) });
    }
    const row = found.get(email);
    row[kind] += 1;
    row.total += 1;
  };
  Object.values(map(notes)).forEach((n) => add(n, "notes"));
  Object.values(map(plans)).forEach((p) => add(p, "plans"));
  arr(videos).forEach((v) => add(v, "videos"));
  return [...found.values()].sort((a, b) => a.email.localeCompare(b.email));
}

// Rows the club should actually act on: an address that wrote something and belongs to
// nobody who is still authorised here.
//
// Kept as a separate function rather than a flag the caller filters on, because the
// difference matters in one place where filtering would be a bug: the guard that blocks
// deleting a coach who has no address on their roster row. That coach IS on the access
// list, so they come back `authorized: true` — filtering them out of the guard would let
// the roster row be deleted and strand what they wrote, which is exactly the hole this
// module was written to close. The guard reads `unclaimedAddresses`; the screen reads this.
export const releasableAddresses = (sources) => unclaimedAddresses(sources).filter((r) => !r.authorized);

// Coaches the club can record but the departure action cannot search for. Shown as a
// warning rather than blocked: a coach who never signs in genuinely has no address, and
// refusing to store them would be inventing a requirement the product does not have.
export function coachesMissingEmail(coaches) {
  return arr(coaches).filter((c) => c && c.name && !normalizeEmail(c.email));
}

// Takes either shape: the id lists `departureHoldings` returns, or the plain counts
// `unclaimedAddresses` returns. One summary function rather than two, so the sentence a
// manager reads before pressing is worded the same wherever the row came from.
const count = (v) => (Array.isArray(v) ? v.length : Number(v) || 0);

export function describeHoldings(held) {
  const parts = [];
  const line = (n, one, many) => (n === 1 ? one : `${n} ${many}`);
  const notes = count(held?.notes), plans = count(held?.plans);
  const videos = count(held?.videos), absences = count(held?.absences);
  if (notes) parts.push(line(notes, "הערת משחק אחת", "הערות משחק"));
  if (plans) parts.push(line(plans, "מערך אימון אחד", "מערכי אימון"));
  if (videos) parts.push(line(videos, "סרטון אחד", "סרטונים"));
  if (absences) parts.push(line(absences, "סימון היעדרות אחד", "סימוני היעדרות"));
  return parts.join(" · ");
}
