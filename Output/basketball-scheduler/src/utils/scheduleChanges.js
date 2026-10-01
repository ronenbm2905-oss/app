// What changed in a coach's week, and when.
//
// The app has always updated live — a coach with the board open sees a time move the
// instant a manager saves it. What it never did was *say so*. A coach who was not looking
// at that moment had no way to know, and the club's answer was to re-send the whole board
// on WhatsApp and hope people spotted the difference.
//
// The log is built by diffing, in ONE place: `useClubData.save()` sees both the document
// as it was and as it is about to be. Detecting changes at each call site instead would
// mean remembering to do it in the session form, the board's drag, the delete, the week
// copy, the CSV import and the fixed-teams strip — and the one that gets forgotten is the
// one that matters.
//
// Bounded on purpose. It lives on the club document, which is already 78 KB of a 1 MB
// ceiling with `sessions` growing all season, so the log keeps a fixed recent window
// rather than a history.

import { DAYS } from "../constants.js";
import { sessionKey } from "./rowCopy.js";
import { pruneAccepted, FIELD as ACCEPTED } from "./acceptedChecks.js";
import { getWeekDates } from "./dates.js";
import { isNotifyPaused, markSilent } from "./notifyPause.js";

const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => String(v ?? "").trim();

export const MAX_CHANGES = 150;
export const CHANGE_TTL_DAYS = 30;
// Above this many additions for one coach in a single save, the entries collapse into one.
// A manager building next week from scratch is not making twenty announcements; a manager
// adding one training is making one. Nothing is dropped — it is summarised, and the count
// is kept.
export const BULK_ADD_THRESHOLD = 10;

// The fields a coach would notice. `type` is in here because "אימון" turning into "משחק
// בית" changes what they are showing up for.
//
// `weekOf` AND `cancelled` WERE MISSING, and both were measured as silent on 1.10.2026 when
// a single approved import produced four log entries out of twenty-six changes:
//
//   `weekOf` — a TRAINING lives in one week and carries an id of its own, so moving one is a
//   delete here and an add there and this list never needed the week. A GAME is the opposite:
//   its row is keyed `game-<federationCode>` and that id survives the whole season. The
//   federation moved קטסל א שחר from Saturday 17.10 to Saturday 24.10 — same weekday, same
//   hour, away fixture so no hall — and every field below was identical. No entry, no
//   notification, and a coach whose game moved by a week with no way to know.
//
//   `cancelled` — a cancelled fixture KEEPS its row on the board, struck through, which is
//   right: it is information, not an absence. But it meant cancellation changed nothing this
//   list looks at. Twelve fixtures were cancelled that morning and nobody was told. That is
//   the worse of the two: a coach who is not told about a move arrives at the wrong hour; a
//   coach who is not told about a cancellation brings children to an empty hall.
const WATCHED = ["day", "start", "end", "hallId", "type", "teamId", "weekOf", "cancelled", "venue"];

function shape(s) {
  return {
    day: str(s?.day),
    start: str(s?.start),
    end: str(s?.end),
    hallId: str(s?.hallId),
    type: str(s?.type),
    // Carried on BOTH sides, not just on the entry, because an entry's own `weekOf` is the
    // new one — so a date that moved across weeks could not be rendered, or even tested for
    // being in the past, from the old side.
    weekOf: str(s?.weekOf),
    // Carried only when the record HAS the key, so a row written before 1.10.2026 stays
    // distinguishable from one that simply has no venue — see `comparable` below.
    ...(s?.venue === undefined ? {} : { venue: str(s.venue) }),
    // A boolean, kept as one. `str(false)` is "false" and `str(undefined)` is "", and a
    // comparison between those two would report every ordinary training as newly uncancelled.
    cancelled: Boolean(s?.cancelled),
  };
}

// Compared field by field, and `cancelled` is compared as a BOOLEAN.
//
// This runs on raw sessions, not on `shape()` output, so the normalising there does not help
// it. `str(undefined)` is "" and `str(false)` is "false" — and every one of the club's 854
// trainings carries no `cancelled` key at all while anything written after this deploy may
// carry `false`. Compared as strings those differ, and the first save after the deploy would
// have announced a change on every training in the club at once, to every coach.
const normal = (s, k) => (k === "cancelled" ? Boolean(s?.[k]) : str(s?.[k]));

// A FIELD THAT DID NOT EXIST YET IS NOT A FIELD THAT CHANGED.
//
// `venue` arrived on 1.10.2026, and every game row written before it has no such key. That
// is NOT the same as a row with no venue: comparing "absent" against "תיכון ברנר, פתח
// תקווה" would have made all 251 away fixtures look as though their hall had moved — on the
// first save that rebuilt the board from the games, which is the next federation import, to
// every coach at once.
//
// Caught because a verification showed `venue` written on 0 rows after a save: the field is
// only written when the games are re-synced, so the save that was meant to prove the FIRST
// migration hazard was safe could not have shown this one. `cancelled` was the same shape a
// few hours earlier, and that one was caught by a test.
//
// The exemption is deliberately narrow — it ends the moment a row has been written once, and
// from then on an empty venue compares as an empty venue.
const comparable = (a, b, k) => !(k === "venue" && (a?.venue === undefined || b?.venue === undefined));

function differs(a, b) {
  return WATCHED.some((k) => comparable(a, b, k) && normal(a, k) !== normal(b, k));
}

// The raw diff between two session lists, keyed by session id. Pure, and unaware of who is
// looking — the caller decides what to keep.
// TIDYING UP IS NOT A SCHEDULE CHANGE, and the difference is invisible by row id.
//
// Deleting one of two IDENTICAL rows leaves the training exactly where it was — the twin is
// still on the board — but by id it is a row that vanished, which the diff reports as
// `removed` and the phone announces as **ביטול אימון**. The coach is told a training was
// cancelled while it is still happening, and the direction of that error is the bad one: a
// coach who believes it does not come, and children are in a hall without one.
//
// Measured on 1.10.2026 while building the "delete this duplicate" button — and it is the
// same fault as the archive of 22.9, which told six coaches that July trainings had been
// cancelled. Both are record-keeping passing through a diff that only understands rows.
//
// `sessionKey` is the definition by which a duplicate was identified in the first place
// (utils/duplicateSessions.js), so this covers exactly what that button removes and no more.
// Two rows that differ in ANY watched field are not twins and a deletion is reported.
const twinKey = (s) => `${str(s?.weekOf)}|${sessionKey(s || {})}`;

export function diffSessions(before, after, now) {
  const prev = new Map(arr(before).filter((s) => s && s.id).map((s) => [s.id, s]));
  const next = new Map(arr(after).filter((s) => s && s.id).map((s) => [s.id, s]));
  const survivors = new Set([...next.values()].map(twinKey));
  const out = [];
  const entry = (coachId, kind, s, extra) => ({
    id: `${s.id}-${kind}-${now}`,
    at: now,
    coachId: str(coachId),
    teamId: str(s.teamId),
    weekOf: str(s.weekOf),
    kind,
    ...extra,
  });

  next.forEach((s, id) => {
    const was = prev.get(id);
    if (!was) {
      // NO MIRROR GUARD ON THE ADDITION SIDE, and it was tried. Suppressing an addition
      // because an identical row already existed looks symmetrical and is not: a manager
      // building a week from scratch adds many rows, and one pre-existing twin would have
      // silenced ALL of them — a whole week's build announced as nothing. A pre-existing
      // test caught it. A duplicate that gets added is what the duplicate report is for.
      out.push(entry(s.coachId, "added", s, { after: shape(s) }));
      return;
    }
    // A session handed to another coach is a removal for one and an addition for the other.
    // Reporting it once, to whichever coach the record now names, would leave the coach who
    // lost the training with no notice at all.
    if (str(was.coachId) !== str(s.coachId)) {
      out.push(entry(was.coachId, "removed", was, { before: shape(was) }));
      out.push(entry(s.coachId, "added", s, { after: shape(s) }));
      return;
    }
    if (differs(was, s)) out.push(entry(s.coachId, "changed", s, { before: shape(was), after: shape(s) }));
  });

  prev.forEach((s, id) => {
    if (next.has(id)) return;
    if (survivors.has(twinKey(s))) return;
    out.push(entry(s.coachId, "removed", s, { before: shape(s) }));
  });

  return out;
}

// ---------- a training that has already happened cannot be "changed" ----------
//
// THE BUG THIS EXISTS TO STOP. Archiving July on 22.9.2026 removed that month's sessions
// from the club document, the diff below saw eleven deletions, and six coaches were told —
// on their phones — that a training had been cancelled. A training in July. Archiving is a
// storage move, not a schedule change, and nobody can act on a Sunday two months gone.
//
// Filtered here rather than inside `diffSessions`, which is deliberately a raw diff that
// knows nothing about who is looking. And filtered at the point of RECORDING, not of
// sending: an entry about the past is not a notification worth holding back, it is not
// worth keeping — and the log is capped at 150, so writing it evicts something real.
//
// The date is the session's own day, not the week. Suppressing the whole of the current
// week would hide a change to Friday's training made on Wednesday, which is exactly the
// notice the log exists for.
function dateOfDay(weekOf, day) {
  const d = getWeekDates(str(weekOf))[str(day)];
  return d instanceof Date && !isNaN(d.getTime()) ? d : null;
}

const startOfDay = (iso) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

// An entry survives if ANY date it refers to is today or later. A training moved from
// Monday to Friday is still news on Wednesday — the old date has gone, the new one has not.
//
// When the date cannot be worked out at all, the entry is KEPT. The cost of a stale notice
// is a confused coach; the cost of a swallowed one is a coach who turns up to a training
// that moved. Same reasoning as the archive refusing to file a session whose month it
// cannot derive.
export function stillAhead(entry, now = new Date().toISOString()) {
  const today = startOfDay(now);
  if (!today || !entry) return true;
  // Each side against ITS OWN week. The entry's `weekOf` is the new one, so measuring the
  // old day against it was right only while a session could not move between weeks — true
  // of a training, never true of a game, whose row keeps one id all season. A fixture pulled
  // forward from December to November was being judged on the November week on both sides.
  // `entry.weekOf` stays as the fallback: the 150 entries already in the log have no
  // `weekOf` inside before/after.
  const sides = [entry.before, entry.after]
    .filter((s) => s && s.day)
    .map((s) => dateOfDay(str(s.weekOf) || entry.weekOf, s.day))
    .filter(Boolean);
  if (sides.length === 0) return true;
  return sides.some((d) => d.getTime() >= today.getTime());
}

// Collapse a coach's flood of additions from one save into a single entry.
export function collapseBulk(entries, now) {
  const byCoach = new Map();
  arr(entries).forEach((e) => {
    if (!byCoach.has(e.coachId)) byCoach.set(e.coachId, []);
    byCoach.get(e.coachId).push(e);
  });
  const out = [];
  byCoach.forEach((list, coachId) => {
    const added = list.filter((e) => e.kind === "added");
    if (added.length > BULK_ADD_THRESHOLD) {
      out.push({
        id: `bulk-${coachId}-${now}`,
        at: now,
        coachId,
        teamId: "",
        weekOf: added[0].weekOf,
        kind: "bulk",
        count: added.length,
      });
      out.push(...list.filter((e) => e.kind !== "added"));
    } else {
      out.push(...list);
    }
  });
  return out;
}

export function trimChanges(changes, now) {
  const cutoff = new Date(new Date(now).getTime() - CHANGE_TTL_DAYS * 86400000).toISOString();
  return arr(changes)
    .filter((c) => c && c.at && c.at >= cutoff)
    .slice(-MAX_CHANGES);
}

// The one call the write path makes. Returns `next` untouched when nothing a coach would
// notice has moved, so an edit to teams, players or the allowlist writes no log at all.
export function withScheduleChanges(prev, next, now = new Date().toISOString()) {
  if (!next || !Array.isArray(next.sessions)) return next;

  // Trim on EVERY save, not only on one that produced an entry.
  //
  // Tying the purge to "a training moved" makes deletion a function of activity rather
  // than of the clock — and the case that breaks is exactly the one the deletion procedure
  // gives as its example: a coach leaving at the end of the season. Nobody moves a training
  // during the summer break, so nothing would be trimmed until August, while the log still
  // held dated records about people who no longer work here. Costs nothing: `save` writes
  // the whole document either way.
  // Existing entries are put through the same test, not only new ones. Two reasons: a
  // notice about Friday is not worth a line on Sunday, and — the immediate one — the eleven
  // July cancellations already written on 22.9 clear themselves out on the next save
  // instead of sitting in six coaches' banners until they are evicted by volume.
  // The manager's "this one is deliberate" decisions are pruned HERE, on every save, and
  // not only when one is made. Tying a purge to the activity that creates it is the mistake
  // this very function already carries a comment about: nobody approves a clash during the
  // summer break, and the keys carry a `coachId`, so a coach who left in June would still be
  // named in the document in August. Same clock, same place, one rule.
  const trimmedAccepted = pruneAccepted(next[ACCEPTED], new Date(now));
  const acceptedChanged =
    Array.isArray(next[ACCEPTED]) && trimmedAccepted.length !== next[ACCEPTED].length;
  const withAccepted = (doc) => (acceptedChanged ? { ...doc, [ACCEPTED]: trimmedAccepted } : doc);

  const kept = trimChanges(next.changes, now).filter((e) => stillAhead(e, now));
  const found = (
    prev?.sessions === next.sessions ? [] : diffSessions(prev?.sessions, next.sessions, now)
  ).filter((e) => stillAhead(e, now));

  if (found.length === 0) {
    // Still return the object untouched when there was nothing to expire, so a save that
    // touches neither sessions nor stale entries stays a no-op.
    return withAccepted(arr(next.changes).length === kept.length ? next : { ...next, changes: kept });
  }

  // The entry is WRITTEN either way — what the pause withholds is the phone call, not the
  // record. Marked here, at the moment of the save, rather than read by the cloud function
  // later: by the time that function runs the pause may have expired, and entries written
  // while it was on would go out after all.
  const fresh = markSilent(collapseBulk(found, now), isNotifyPaused(next, now));
  return { ...next, changes: trimChanges([...kept, ...fresh], now) };
}

// ---------- reading ----------

export function changesForCoach(changes, coachId, sinceIso) {
  const id = str(coachId);
  if (!id) return [];
  return arr(changes)
    .filter((c) => c && c.coachId === id)
    .filter((c) => !sinceIso || String(c.at || "") > sinceIso)
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
}

export function changesForWeek(changes, weekOf) {
  const w = str(weekOf);
  if (!w) return [];
  return arr(changes)
    .filter((c) => c && c.weekOf === w)
    .sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
}

const slot = (s) => (s && s.start && s.end ? `${s.start}–${s.end}` : "");

// ---------- WHAT it is, and WHEN ----------
//
// Ronen, 1.10.2026: "when I move a game the coach is told the hour went from 18 to 19 — not
// that it is a GAME, and not WHICH DATE. Same for a cancellation."
//
// Both facts were already in the record and neither was being said. `type` holds
// "משחק בית"/"משחק חוץ" but was printed only when the type ITSELF changed, which for a
// fixture moving an hour is never. And the date is `weekOf` plus the weekday — the very
// calculation `dateOfDay` above already does, forty lines up, for another purpose.
//
// It matters more than wording: a coach reading "יום רביעי: 19:00 (במקום 18:00)" cannot tell
// whether it is this Wednesday or one in December, and the log holds a month of entries.

// "משחק בית" / "משחק חוץ" / "אימון". `type` also carries "יורם" and "חד״כ" — training
// variants in this club — so the test is what the row IS, not an equality against a list
// that will grow.
//
// HOME OR AWAY IS KEPT, not flattened to "משחק": privacy policy §2ז already promises the
// coach "וסוג המפגש", and saying less than the document says we say is the wrong direction
// to be imprecise in. It is also the single most useful word here — "ביטול משחק חוץ" and
// "ביטול משחק בית" are different afternoons.
const isGame = (s) => str(s?.type).startsWith("משחק");
const noun = (entry) => {
  const side = isGame(entry?.after) ? entry.after : isGame(entry?.before) ? entry.before : null;
  return side ? str(side.type) : "אימון";
};

// "4.11" — day and month, no year. The log keeps thirty days and nothing in it is ever a
// year away; a year would be noise on a lock screen.
function dateLabel(side, fallbackWeek) {
  const d = dateOfDay(str(side?.weekOf) || fallbackWeek, str(side?.day));
  return d ? `${d.getDate()}.${d.getMonth() + 1}` : "";
}

// "יום רביעי 4.11" — and just "יום רביעי" when the week cannot be worked out, which is the
// case for every entry written before this existed.
function whenLabel(side, fallbackWeek) {
  const day = str(side?.day) ? `יום ${side.day}` : "";
  const date = dateLabel(side, fallbackWeek);
  return [day, date].filter(Boolean).join(" ");
}

// The headline: "ביטול משחק" · "שינוי אימון" · "משחק חדש".
//
// Its own function because the phone needs it apart from the rest. A notification shows a
// title and a body, and until now the title was "שינוי בלו״ז שלך" for everything — a
// cancellation and a hall change wore the same words on the lock screen, which is where
// most of these are read and often the only place.
export function changeKindLabel(entry) {
  if (!entry) return "";
  // "מפגשים" AND NOT "אימונים", because a bulk entry is the one kind that cannot know.
  // `collapseBulk` fires on a big batch of additions — exactly what the first federation
  // import of a season is — and the entry carries no before/after at all, so there is
  // nothing to read a type from. Saying "אימונים" over a hundred new FIXTURES is the same
  // complaint Ronen raised, one notch worse: not an omission but a false statement.
  // "מפגש" is already the word §2ז and §6ב of the privacy policy use for both.
  if (entry.kind === "bulk") return "מפגשים נוספו";
  if (entry.kind === "added") return `${noun(entry)} חדש`;
  if (entry.kind === "removed") return `ביטול ${noun(entry)}`;
  // A fixture the federation cancelled keeps its row and gains a flag, so it arrives here as
  // a change. To the coach it is a cancellation and nothing else, and it is said that way.
  if (entry.after?.cancelled && !entry.before?.cancelled) return `ביטול ${noun(entry)}`;
  // "חזר ללו״ז" and not "חזר". On its own, "חזר" carries both readings — came back, and was
  // put off — and the wrong one lands the coach in exactly the state this was built to get
  // them out of.
  if (entry.before?.cancelled && !entry.after?.cancelled) return `${noun(entry)} חזר ללו״ז`;
  return `שינוי ${noun(entry)}`;
}

// One readable Hebrew line. `names` supplies the lookups the log deliberately does not
// store — a hall renamed after the fact should read by its new name, not by the old one
// frozen into the record.
// Everything after the headline: when it is, and what moved. Kept apart from
// `changeKindLabel` so a notification can put one in the title and one in the body without
// saying "שינוי משחק" twice on the same lock screen.
export function changeDetail(entry, names = {}) {
  if (!entry) return "";
  const hall = (id) => (names.halls || []).find((h) => h && h.id === id)?.name || "";
  const week = entry.weekOf;

  if (entry.kind === "bulk") return `${entry.count} מפגשים`;
  if (entry.kind === "added") {
    const a = entry.after;
    return [whenLabel(a, week), slot(a), hall(a?.hallId)].filter(Boolean).join(" · ");
  }
  if (entry.kind === "removed") {
    const b = entry.before;
    return [whenLabel(b, week), slot(b), hall(b?.hallId)].filter(Boolean).join(" · ");
  }

  const { before: b, after: a } = entry;

  // A cancellation says WHEN the fixture was, and nothing else. Whether the hall also
  // changed in the same save is of no interest to someone who is no longer going.
  if (a?.cancelled !== b?.cancelled) {
    const side = a?.cancelled ? b : a;
    return [whenLabel(side, week), slot(side)].filter(Boolean).join(" · ");
  }

  // The date first, always — and both dates when it moved, because "it moved" with one date
  // on screen is the question "from when?" left open.
  const fromDate = whenLabel(b, week);
  const toDate = whenLabel(a, week);
  const moved = (now, was) => `${now} (במקום ${was})`;
  const parts = [];
  if (fromDate !== toDate) {
    // When only the week moved — Saturday to Saturday — repeating "יום שבת" in the bracket
    // says nothing and buries the two numbers that are the entire message. And a week move
    // is precisely the case this whole change was opened for.
    const sameWeekday = str(b?.day) === str(a?.day);
    parts.push(moved(toDate, sameWeekday ? dateLabel(b, week) || fromDate : fromDate));
  }
  if (slot(b) !== slot(a)) parts.push(moved(slot(a), slot(b)));
  // WHERE IT IS PLAYED — one line, from whichever field holds it.
  //
  // `hallId` names one of the club's own halls; `venue` is the text the federation gives for
  // anywhere else, and `games.js` writes it exactly when `hallId` is empty. So one reading
  // covers both, and the two can never produce two lines about one move — which they would
  // on a fixture flipping between home and away, where both fields change at once.
  const place = (s) => hall(s?.hallId) || str(s?.venue);
  // One line, but the two halves are tested separately: a hall id that moved is always worth
  // saying, while a `venue` is only comparable when BOTH sides carry the key — otherwise an
  // entry raised by some other field would carry a line claiming the hall moved, on a fixture
  // that never left it. Guarding the whole line on the venue instead would have silenced
  // every ordinary hall change, which a test caught immediately.
  const hallMoved = str(b?.hallId) !== str(a?.hallId);
  const venueMoved =
    b?.venue !== undefined && a?.venue !== undefined && str(b.venue) !== str(a.venue);
  if (hallMoved || venueMoved) parts.push(moved(place(a) || "—", place(b) || "—"));
  if (str(b?.type) !== str(a?.type)) parts.push(moved(a?.type || "אימון", b?.type || "אימון"));
  // When the date did not move it is still said, because the coach has to know WHICH
  // Wednesday — the log holds a month.
  const where = fromDate === toDate ? toDate : "";
  return [where, parts.join(" · ")].filter(Boolean).join(": ");
}

// One readable Hebrew line, headline and all: what happened, when, and what moved.
export function changeLabel(entry, names = {}) {
  if (!entry) return "";
  const detail = changeDetail(entry, names);
  const head = changeKindLabel(entry);
  if (detail) return head ? `${head} · ${detail}` : detail;
  // AN ENTRY WITH NOTHING TO SAY STILL HAS TO SAY NOTHING. `changesByCoach` drops a coach
  // whose lines all came out empty, and that guard is what keeps a malformed record out of
  // the WhatsApp message and off a lock screen. A headline is cheap to produce — every entry
  // has a `kind` — so returning one unconditionally would turn every broken record into a
  // notification reading "שינוי אימון" and nothing else.
  const substance = entry.kind === "bulk" || Boolean(entry.before) || Boolean(entry.after);
  return substance ? head : "";
}

// Grouped for the WhatsApp message: one block per coach, in the order a person reads.
export function changesByCoach(changes, names = {}) {
  const groups = new Map();
  arr(changes).forEach((c) => {
    if (!groups.has(c.coachId)) groups.set(c.coachId, []);
    groups.get(c.coachId).push(c);
  });
  return [...groups.entries()]
    .map(([coachId, list]) => ({
      coachId,
      name: (names.coaches || []).find((x) => x && x.id === coachId)?.name || "ללא מאמן",
      lines: list.map((c) => changeLabel(c, names)).filter(Boolean),
    }))
    .filter((g) => g.lines.length)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
}

// The message the manager pastes into WhatsApp.
//
// Text and not an image, deliberately: it is short, it is searchable in the chat, and a
// coach can quote one line back to ask about it. The board is already shared as a picture —
// this is the part a picture does worst.
export function changesMessage(changes, weekOf, weekLabel, names = {}) {
  const groups = changesByCoach(changesForWeek(changes, weekOf), names);
  if (!groups.length) return "";
  const head = `עדכון לו״ז — ${weekLabel}`;
  const body = groups.map((g) => [`${g.name}:`, ...g.lines.map((l) => `• ${l}`)].join("\n")).join("\n\n");
  return `${head}\n\n${body}`;
}

export const DAY_ORDER = DAYS;
