// Did the nightly federation sync actually run?
//
// THE PROBLEM THIS ANSWERS, and it is worth stating plainly because the bug had no symptom:
// between 18.9 and 21.9.2026 the machine slept through 03:00 three nights running. The sync
// never ran, the federation published a full season of fixtures on the 20th, and the app
// showed exactly what it shows on a quiet week — nothing at all. It was found because
// someone went to the federation's website and wondered.
//
// A proposal is filed only when something changed. So the absence of a proposal carried two
// completely different meanings, and no way to tell them apart:
//
//     "the federation published nothing"      ← normal, most weeks
//     "nothing has checked for three days"    ← broken
//
// `record-sync.mjs` now writes one heartbeat per run, whatever the run found. This turns
// that heartbeat into a sentence, and — the part that matters — turns its ABSENCE into a
// sentence too.

// The hour the job is scheduled for, and the only thing this file needs to know about it.
export const RUN_HOUR = 3;

// How long after 03:00 a night is allowed to be silent before the night counts as missed.
// The run itself takes about a minute; this covers a slow federation server and a machine
// that woke a little late, and it is what keeps the line quiet between 03:00 and 03:45 on a
// night that is running normally.
export const GRACE_MINUTES = 45;

// WHY THIS IS NOT A NUMBER OF HOURS ANY MORE.
//
// It was 36 hours since the last heartbeat, chosen so that one missed night would show and
// three would not be needed. It does show one missed night — starting at 15:00. On
// 23.9.2026 the machine slept through 03:00, and at 08:50 the line still read
// "סונכרן מהאיגוד: אתמול ב-03:00" in quiet grey, because 29 hours is less than 36. **A
// twelve-hour window every morning in which a missed night looks healthy** — and the
// morning is exactly when this line is read.
//
// The job is nightly, so the question is a nightly one: HAS IT RUN SINCE THE LAST 03:00
// THAT HAS PASSED. That has no blind window and no arbitrary constant, and it makes the
// sentence "לא רץ הלילה" literally true rather than approximately so.

// The most recent scheduled run that is already DUE — 03:00 today once the grace has
// elapsed, otherwise 03:00 yesterday.
export function lastDueRun(now = new Date()) {
  const due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), RUN_HOUR, 0, 0, 0);
  if (now.getTime() < due.getTime() + GRACE_MINUTES * 60000) due.setDate(due.getDate() - 1);
  return due;
}

// How many scheduled runs have come and gone since the heartbeat. 0 = up to date.
export function nightsMissed(at, now = new Date()) {
  const t = Date.parse(at || "");
  if (!t) return null;
  const due = lastDueRun(now);
  if (t >= due.getTime()) return 0;
  const from = new Date(t);
  const firstMissed = new Date(from.getFullYear(), from.getMonth(), from.getDate(), RUN_HOUR, 0, 0, 0);
  if (firstMissed.getTime() <= t) firstMissed.setDate(firstMissed.getDate() + 1);
  const midday = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.max(1, Math.round((midday(due) - midday(firstMissed)) / 86400000) + 1);
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// IS THE FILE THE FEDERATION HANDED US ACTUALLY A NEW ONE?
//
// The bug of 1.10.2026, in one sentence: between 24.9 and 1.10 the nightly sync ran every
// single night, reached the federation, downloaded the league file, hashed it, and correctly
// reported "unchanged" — over a file generated on 23.9 at 17:32 and served from a cache ever
// since. Twenty-six changes sat behind it, three of them fixtures moved to another date, and
// this line said the sync was healthy every morning. It was found because a coach's game
// appeared on the federation's website and not in the app.
//
// It is the same shape as the two faults this file already carries scars from — "the sync
// did not run" looking like "the federation published nothing" (18-21.9), and "no
// competition answered" looking like "a quiet night" (26.9). Three times now the healthy
// sentence and the broken one have been the same sentence.
//
// WHAT MAKES THIS MEASURABLE RATHER THAN A GUESS: the federation GENERATES the export when
// it is asked for it. Fourteen downloads kept in `federation-inbox/` were checked one by
// one, and every one up to 23.9 carries a `dcterms:created` equal to the second of the
// request. So the file's own timestamp is supposed to be minutes old. When it is hours or
// days old we are reading a photograph, and "אין שינויים" is not a finding about the
// federation at all.
//
// THE AGE IS MEASURED AT THE MOMENT OF THE DOWNLOAD, not against the clock now. It is a
// fact about that run; measuring it from `now` would make a perfectly good run look worse
// every hour that passed after it, which is what `nightsMissed` is already for.
//
// Two thresholds, because the certainty differs and the manager's next move differs with it:
// a day-old "freshly generated" file cannot be anything but a cache, while a few hours could
// still be a clock that disagrees with ours or an offset written wrong at their end.
export const SOURCE_SUSPECT_HOURS = 6;
export const SOURCE_STALE_HOURS = 24;

// How far ahead of us the federation's clock may be before we stop believing its timestamp.
//
// THE HOLE THIS CLOSES, found in the gate on this very change: a file stamped in the future
// was clamped to an age of 0 and read as fresh. That is fine for a few minutes of drift and
// catastrophic beyond it — a clock running a day ahead at their end would make EVERY file
// read as freshly generated, for ever, and would hide exactly the fault this was built to
// show. It also contradicted the rule this module states out loud two screens up: an unknown
// age must read as unknown, never as fresh.
//
// So: a small lead is drift and still counts as fresh; a large one is a timestamp we cannot
// use, and the honest answer is that we do not know.
export const SOURCE_FUTURE_HOURS = 2;

export function sourceAgeHours(doc) {
  const made = Date.parse(doc?.sourceAt || "");
  const got = Date.parse(doc?.at || "");
  if (!made || !got) return null;
  const ms = got - made;
  if (ms < -SOURCE_FUTURE_HOURS * 3600000) return null;
  return ms < 0 ? 0 : ms / 3600000;
}

export function sourceFreshness(doc) {
  const hours = sourceAgeHours(doc);
  // No timestamp at all is the state right after the deploy, and on any run recorded before
  // this existed. It must not colour the line — an unknown age is not a fault.
  if (hours === null) return { state: "unknown", hours: null };
  if (hours >= SOURCE_STALE_HOURS) return { state: "stale", hours };
  if (hours >= SOURCE_SUSPECT_HOURS) return { state: "suspect", hours };
  return { state: "ok", hours };
}

// "שעה" · "שעתיים" · "7 שעות" · "יום" · "יומיים" · "9 ימים"
//
// Its own function and not `humanLeft` from notifyPause.js, which covers minutes and hours
// because a pause is capped at two of them. This one covers hours and days and never
// minutes. Sharing would mean one function whose range is the union of two things neither
// caller wants — and the duals are the entire point of both.
export function humanAgo(hours) {
  const h = Math.max(0, Math.round(Number(hours) || 0));
  if (h < 24) {
    // Zero reads as "שעה" rather than "0 שעות": by the time this label is reached the file
    // is already past a threshold measured in hours, so zero can only be rounding.
    if (h <= 1) return "שעה";
    if (h === 2) return "שעתיים";
    return `${h} שעות`;
  }
  const d = Math.round(h / 24);
  if (d === 1) return "יום";
  if (d === 2) return "יומיים";
  return `${d} ימים`;
}

export function hoursSince(at, now = new Date()) {
  const t = Date.parse(at || "");
  if (!t) return null;
  const ms = now.getTime() - t;
  return ms < 0 ? 0 : ms / 3600000;
}

const pad = (n) => String(n).padStart(2, "0");

// "היום ב-03:04" · "אתמול ב-03:00" · "לפני 3 ימים (18.9)"
export function whenLabel(at, now = new Date()) {
  const d = new Date(at || "");
  if (isNaN(d.getTime())) return "";
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const midnight = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((midnight(now) - midnight(d)) / 86400000);
  if (days <= 0) return `היום ב-${time}`;
  if (days === 1) return `אתמול ב-${time}`;
  // "לפני 2 ימים" is not Hebrew, and it is the same slip as "עוד 1 שעות" caught on screen on
  // 29.9. Noticed here only because `humanAgo` was written next door and got it right.
  if (days === 2) return `לפני יומיים (${d.getDate()}.${d.getMonth() + 1})`;
  return `לפני ${days} ימים (${d.getDate()}.${d.getMonth() + 1})`;
}

const FAILED = "failed";

// "The half ran, but it did not see everything it claims to see."
//
// Added 27.9.2026. A cup scan that could not reach a single one of the seventeen competitions
// used to record `none` — the same value as a night when the federation genuinely published
// nothing — so this line read "אין שינויים" over a scan that had seen nothing at all. It is
// its own state because the manager's next move differs: `none` means carry on, `partial`
// means the fixture list behind the screen is not the whole list.
const PARTIAL = "partial";

// What the two halves of the run found, in words. They are reported separately because they
// fail separately: the cup scan can break on a night the league file imports perfectly.
// `pending` is whether a proposal is STILL WAITING for a decision — not whether the run
// filed one.
//
// "נמצאו עדכונים" described the run and read like the present state of the screen. On
// 23.9.2026 the line said it on a morning when there was nothing to see, because the
// proposal it referred to had been filed the previous night and approved the previous
// morning. The sentence was true about a run and false about the screen, which is the worst
// combination: it sends someone looking for something that is not there, and the next time
// it appears they will not look.
//
// So the two cases are said apart. What was found is past tense; what is waiting says where
// it is.
// An incomplete half is reported BEFORE a pending proposal and before "אין שינויים", because
// it changes how both of those should be read: a proposal from a partial scan is not the whole
// picture, and "no changes" drawn from a partial scan is not a finding.
function foundLabel({ cups, league }, pending, source = { state: "unknown" }) {
  if (cups === FAILED && league === FAILED) return "שני החלקים נכשלו";
  if (cups === FAILED) return "סריקת הגביע נכשלה";
  if (league === FAILED) return "משיכת קובץ הליגה נכשלה";
  if (cups === PARTIAL) return "סריקת הגביע לא הגיעה לכל המפעלים — התמונה חלקית";
  if (league === PARTIAL) return "קובץ הליגה נקרא חלקית — התמונה חלקית";
  // Said before "אין שינויים" and before a pending proposal, because it changes how both of
  // those should be read. A file that is not fresh makes "no changes" a statement about the
  // file and not about the federation.
  if (source.state === "suspect") {
    // "מטמון", not "זיכרון מתווך" — which sends a reader towards an intermediary BODY. The
    // whole job of this sentence is that someone understands why "אין שינויים" is not a
    // finding, so the one term in it has to be the one they know.
    return `הקובץ שהתקבל אינו טרי — הופק לפני ${humanAgo(source.hours)}. ייתכן שהוא מוגש מזיכרון מטמון (cache) ולא מופק מחדש`;
  }
  if (pending) return "יש הצעה שממתינה לאישור — בכרטיס שלמעלה";
  if (cups === "ok" || league === "ok") return "נמצאו עדכונים, וההצעה כבר טופלה";
  return "אין שינויים";
}

// `level` drives the colour, and nothing else does. Four states, each of which a manager can
// act on differently:
//
//   ok       ran recently, nothing broke                  → a quiet grey line
//   warn     ran recently but one half failed             → worth a look, not an emergency
//   bad      has not run at all for more than a night      → THE case this was built for
//   unknown  no heartbeat has ever been recorded          → true right after the deploy
export function syncState(doc, now = new Date(), { pending = false } = {}) {
  // A timestamp that cannot be parsed counts as no timestamp. Anything else lets a broken
  // value fall through to the healthy branch and render "סונכרן מהאיגוד: " with nothing
  // after it — a clean bill of health backed by a date nobody could read, which is the one
  // outcome worse than saying nothing.
  if (!doc || !doc.at || hoursSince(doc.at, now) === null) {
    return {
      level: "unknown",
      title: "טרם נרשם סנכרון מהאיגוד",
      detail: "השורה הזו תתמלא אחרי הריצה הלילית הבאה.",
    };
  }

  const when = whenLabel(doc.at, now);
  const missed = nightsMissed(doc.at, now);

  if (missed !== null && missed > 0) {
    const nights = missed;
    return {
      level: "bad",
      // Nights, not days, because that is what the job does and what was missed.
      title: nights === 1 ? "הסנכרון מהאיגוד לא רץ הלילה" : `הסנכרון מהאיגוד לא רץ ${nights} לילות`,
      // The instruction, not just the diagnosis. But the instruction has to be a TRUE one:
      // this said "הרץ scripts\run-nightly.cmd" until 1.10.2026, and that stopped being the
      // fix on 27.9 when both halves moved to the cloud — the laptop script no longer runs
      // the league sync at all, and its cup line was removed. Telling a manager to run it on
      // a missed night would have them watch it do nothing and conclude the screen is wrong.
      // AND IT HAS TO BE AN INSTRUCTION THE READER CAN CARRY OUT. The first attempt at this
      // fix said "run it manually from Cloud Scheduler" — true, and useless: that is a GCP
      // console behind an account and a role. It reads as actionable today only because the
      // manager and the developer are the same person, and in the second club it would be
      // the same defect this edit set out to remove — an instruction aimed at someone who
      // cannot follow it. So the screen escalates to a human, and HOW to run it by hand
      // lives in docs/nightly-federation-sync.md with the function's name.
      detail: `הריצה האחרונה: ${when}. משחקים שפורסמו מאז לא נמשכו — יש לדווח למי שמתחזק/ת את המערכת.`,
      when,
    };
  }

  // A STALE SOURCE IS `bad`, AND IT OUTRANKS A HALF THAT FAILED.
  //
  // Both of those orderings are the lesson of 1.10. `bad` because functionally nothing
  // checked the federation — the same condition as a night the job never ran, which this
  // file already calls `bad`; the run happening is no comfort if it compared a photograph.
  // And ahead of `failed`/`partial` because a failure announces itself while this
  // masquerades as a healthy night, which is the more dangerous of the two.
  const source = sourceFreshness(doc);
  if (source.state === "stale") {
    return {
      level: "bad",
      // "התקבל קובץ" and not "האיגוד מגיש": what was measured is that a cache served an old
      // copy. Saying the federation is doing it attributes a CDN's behaviour to a person at
      // the other end, and the next sentence already has enough work to do.
      title: `התקבל קובץ מלפני ${humanAgo(source.hours)}`,
      // The diagnosis, why it is a diagnosis, and what to do — in that order.
      //
      // The middle clause is the one the whole message exists for: "the file is old" invites
      // "so the federation published nothing", which is the exact wrong conclusion and the
      // one that cost the week. And "כל שינוי ... אינו נראה" rather than "שינויים ... אינם
      // נראים", because the second reads as a claim that changes are definitely being
      // hidden. What is known is the conditional, and stating it as one costs no force.
      //
      // The last clause exists because a red line with nothing to do about it stops being
      // read after the second time. The missed-nights branch has had an instruction since
      // the day it was written; this one was shipped with a diagnosis and nothing else.
      detail:
        `הסנכרון רץ (${when}) והשווה מול אותו קובץ, ולכן כל שינוי שהאיגוד פרסם מאז אינו נראה. ` +
        `הקובץ מופק בעת הבקשה, ולכן גיל כזה אינו מעיד ש"לא התפרסם כלום" — אלא שהתקבל עותק שמור. ` +
        `עד לבירור — יש להשוות את הלוח מול אתר האיגוד ולא להסתמך על האפליקציה.`,
      when,
    };
  }

  // `partial` colours the line amber for the same reason `failed` does: in both cases what the
  // screen shows is not what the federation holds. Only the sentence differs.
  const broke =
    doc.cups === FAILED || doc.league === FAILED || doc.cups === PARTIAL || doc.league === PARTIAL ||
    source.state === "suspect";
  return {
    level: broke ? "warn" : "ok",
    title: `סונכרן מהאיגוד: ${when}`,
    detail: foundLabel(doc, pending, source),
    when,
  };
}
