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
// even for a coach who never signed in. A coach with no address on file therefore has no
// notes, plans or videos to find — writing one requires signing in, and the address is the
// identity — but may still have absences waiting to be cleared.
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
export function describeHoldings(held) {
  const parts = [];
  const line = (n, one, many) => (n === 1 ? one : `${n} ${many}`);
  if (held.notes.length) parts.push(line(held.notes.length, "הערת משחק אחת", "הערות משחק"));
  if (held.plans.length) parts.push(line(held.plans.length, "מערך אימון אחד", "מערכי אימון"));
  if (held.videos.length) parts.push(line(held.videos.length, "סרטון אחד", "סרטונים"));
  if (held.absences.length) parts.push(line(held.absences.length, "סימון היעדרות אחד", "סימוני היעדרות"));
  return parts.join(" · ");
}
