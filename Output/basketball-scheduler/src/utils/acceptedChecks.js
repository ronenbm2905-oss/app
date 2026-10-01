// "I have looked at this one and it is fine."
//
// Ronen, 1.10.2026: "let me delete it or approve that it is fine, so I do not have to go
// through it again and again." Measured on the live board that day: twenty-two hall clashes
// in the rest of the season, and nearly every one of them two squads sharing a gym on
// purpose — two קטסל groups, two נערים ב groups. A report that can only be obeyed or
// ignored gets ignored, and then it is worth nothing on the day it finds something real.
//
// SHARED BY BOTH CHECKS DELIBERATELY. The duplicate-rows report and the hall-clash report
// ask different questions, but the manager's answer to each is the same shape, and two
// stores would mean two pruning rules, two field names in the deletion procedure, and a
// decision recorded in one place that the other screen never hears about.
//
// WHAT IS STORED IS A KEY, NEVER A ROW. Every key begins with the date and is otherwise
// built from ids and clock times — team id, coach id, hall id, hours — plus the row's TYPE.
//
// AND THE TYPE IS WHERE AN HONEST DESCRIPTION MATTERS. "No names" was the first version of
// this sentence and it was wrong: `SESSION_TYPES` in constants.js includes `יורם`, so a type
// can be an instructor's first name, and the day is a Hebrew word. What is NOT in a key is a
// child, a coach's full name, a phone number or any free text — and the type cannot be
// dropped, because the key has to be the same definition the duplicate check uses or the
// decision would attach to a different finding than the one that was shown.
//
// The test that guards this asserts what a key CONTAINS. Asserting what it does not contain
// passed for a day against fixtures that had no `type` at all — the segment with the problem
// in it was never exercised.
//
// The count rides along on purpose: approving two rows that collide is not approving a
// third that appears later, and anything that grows comes back for a second look.

const arr = (list) => (Array.isArray(list) ? list : []);
const str = (v) => String(v ?? "").trim();

export const FIELD = "acceptedChecks";

// The stored form. `count` is part of it on purpose — a finding that grows is a finding
// nobody has answered yet — and `Math.max(2, …)` is a floor and not a state: anything that
// reaches here involves at least two rows by definition.
export function acceptKeyOf(item) {
  if (!item?.key) return "";
  return `${item.key}|x${Math.max(2, Math.trunc(Number(item.count) || 2))}`;
}

// WHEN the decision was taken, appended after the key and NOT part of the comparison.
//
// Without it a decision taken in a hurry a month ago is indistinguishable from one taken
// this morning — reversible, and unreviewable. Eleven bytes buy a list somebody can audit.
//
// WHO decided is deliberately NOT stored: an email address is personal data, it is not
// needed to review the list, and the date does all the work. A minimisation decision, and
// it is recorded here rather than left as an omission somebody later "fixes".
const stamp = (from) => {
  const d = from instanceof Date ? from : new Date();
  return `@${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// The key as it is compared: everything before the decision date.
const keyPart = (stored) => String(stored ?? "").split("@")[0];

export const isAccepted = (accepted, item) => {
  const k = acceptKeyOf(item);
  return Boolean(k) && arr(accepted).map(str).map(keyPart).includes(k);
};

// A decision about a week that has passed is dead weight on a document with a size ceiling,
// and it can never match anything again — the date is part of the key.
//
// Pruned from `withScheduleChanges`, which runs on EVERY save — not only when a decision is
// made. Tying the purge to the act of approving would make deletion a function of activity,
// and these keys carry a `coachId`: a coach who leaves in June would still be named in the
// document in August, because nobody approves a clash during the summer break.
//
// Seven days of slack, so a decision made about this week does not vanish mid-week.
export function pruneAccepted(accepted, from = null) {
  // Date arithmetic through a Date object, never by subtracting from the day number: on the
  // 3rd of the month that produces the string "2026-11--4", which sorts below every real key
  // and would throw away every decision the manager has ever made.
  let cutoff = "";
  if (from) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() - 7);
    cutoff = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return arr(accepted)
    .map(str)
    .filter(Boolean)
    // A key that does not start with a date is kept rather than dropped: unreadable is not
    // evidence that a decision was stale.
    .filter((k) => !cutoff || !/^\d{4}-\d{2}-\d{2}/.test(k) || k.slice(0, 10) >= cutoff);
}

export function accept(data, item, from = null) {
  const k = acceptKeyOf(item);
  if (!k) return data;
  const kept = arr(data?.[FIELD]).map(str).filter((x) => keyPart(x) !== k);
  const next = pruneAccepted([...kept, `${k}${stamp(from)}`], from);
  return { ...data, [FIELD]: [...new Set(next)] };
}

export function unaccept(data, item) {
  const k = acceptKeyOf(item);
  if (!k) return data;
  return { ...data, [FIELD]: arr(data?.[FIELD]).map(str).filter((x) => keyPart(x) !== k) };
}

// When a decision was taken, for the screen. "" when the entry predates the stamp.
export function acceptedOn(accepted, item) {
  const k = acceptKeyOf(item);
  const row = arr(accepted).map(str).find((x) => keyPart(x) === k);
  const at = String(row || "").split("@")[1] || "";
  return /^d{4}-d{2}-d{2}$/.test(at) ? at : "";
}

// Split a report in two: what still needs an answer, and what has already had one.
//
// The approved ones are RETURNED, not dropped. A check that silently hides part of what it
// found is the same failure as one that says nothing when it finds nothing — and a decision
// made in a hurry a month ago has to be reversible.
export function splitAccepted(items, accepted) {
  const list = arr(items);
  return {
    open: list.filter((x) => !isAccepted(accepted, x)),
    accepted: list.filter((x) => isAccepted(accepted, x)),
  };
}
