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

export const STALE_HOURS = 36;

// Why 36 and not 24: the job runs daily at 03:00, so a healthy heartbeat is up to ~24 hours
// old just before the next one. 36 leaves room for a late run or one caught up after a
// reboot, while still going off after a single missed night rather than after three.

export function hoursSince(at, now = new Date()) {
  const t = Date.parse(at || "");
  if (!t) return null;
  const ms = now.getTime() - t;
  return ms < 0 ? 0 : ms / 3600000;
}

const pad = (n) => String(n).padStart(2, "0");

// Calendar days between two moments, not elapsed hours divided by 24. The job runs at 03:00,
// so "how many nights were missed" is a question about dates — and hours/24 answers a
// different one: it called a run 42 hours ago "2 days", which is true and useless, while the
// sentence a manager needs is "it did not run last night".
const midnight = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
function daysBetween(at, now) {
  const d = new Date(at);
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.round((midnight(now) - midnight(d)) / 86400000));
}

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
function foundLabel({ cups, league }) {
  if (cups === FAILED && league === FAILED) return "שני החלקים נכשלו";
  if (cups === FAILED) return "סריקת הגביע נכשלה";
  if (league === FAILED) return "משיכת קובץ הליגה נכשלה";
  if (cups === "ok" || league === "ok") return "נמצאו עדכונים";
  return "אין שינויים";
}

// `level` drives the colour, and nothing else does. Four states, each of which a manager can
// act on differently:
//
//   ok       ran recently, nothing broke                  → a quiet grey line
//   warn     ran recently but one half failed             → worth a look, not an emergency
//   bad      has not run at all for more than a night      → THE case this was built for
//   unknown  no heartbeat has ever been recorded          → true right after the deploy
export function syncState(doc, now = new Date()) {
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

  const hours = hoursSince(doc.at, now);
  const when = whenLabel(doc.at, now);

  if (hours !== null && hours > STALE_HOURS) {
    const nights = Math.max(1, daysBetween(doc.at, now) ?? 1);
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
    detail: foundLabel(doc),
    when,
  };
}
