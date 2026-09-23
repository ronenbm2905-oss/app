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
  return `לפני ${days} ימים (${d.getDate()}.${d.getMonth() + 1})`;
}

const FAILED = "failed";

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
function foundLabel({ cups, league }, pending) {
  if (cups === FAILED && league === FAILED) return "שני החלקים נכשלו";
  if (cups === FAILED) return "סריקת הגביע נכשלה";
  if (league === FAILED) return "משיכת קובץ הליגה נכשלה";
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
      // The instruction, not just the diagnosis. The cause was a sleeping machine every
      // time it has happened, and the fix is a command — so it says so.
      detail: `הריצה האחרונה: ${when}. משחקים שפורסמו מאז לא נמשכו. הרץ scripts\\run-nightly.cmd`,
      when,
    };
  }

  const broke = doc.cups === FAILED || doc.league === FAILED;
  return {
    level: broke ? "warn" : "ok",
    title: `סונכרן מהאיגוד: ${when}`,
    detail: foundLabel(doc, pending),
    when,
  };
}
