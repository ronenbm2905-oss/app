import { weekStartOfDMY } from "./dates";

// One live line per tile on the home screen.
//
// A big button that only repeats its own name is a launcher; a big button that tells you
// something is worth the space it takes. Every line below answers the question you would
// have opened that screen to ask.
//
// Pure, and given the week rather than reading a clock, so each line can be tested.

// Every list is guarded by type, not just by truthiness. `(x || []).filter` throws on a
// string, and a club document that arrives with one bad field would take the whole home
// screen down rather than showing a zero.
const arr = (list) => (Array.isArray(list) ? list : []);
const count = (list) => arr(list).length;

function plural(n, one, many) {
  if (n === 0) return `אין ${many}`;
  if (n === 1) return one;
  return `${n} ${many}`;
}

export function homeStats(data, weekStart) {
  const d = data || {};
  const sessions = arr(d.sessions).filter((s) => s && (s.weekOf || "") === weekStart);
  const games = arr(d.games).filter((g) => g && g.date && weekStartOfDMY(g.date) === weekStart);
  const notice = String(d.announcement?.text || "").trim();

  return {
    announcements: notice
      ? notice.replace(/\s+/g, " ").slice(0, 40) + (notice.length > 40 ? "…" : "")
      : "אין הודעות כרגע",
    rosters: `${plural(count(d.teams), "קבוצה אחת", "קבוצות")} · ${plural(count(d.halls), "אולם אחד", "אולמות")}`,
    manager: plural(sessions.length, "אימון אחד השבוע", "אימונים השבוע"),
    constraints: plural(count(d.constraints), "אילוץ אחד", "אילוצים"),
    games: plural(games.length, "משחק אחד השבוע", "משחקים השבוע"),
    weekly: d.schedulePublished?.weekOf === weekStart ? "הלו״ז פורסם" : "טרם פורסם",
    coach: "הלו״ז שלך, לשליחה בוואטסאפ",
    players: plural(count(d.players), "שחקן אחד", "שחקנים"),
    report: "שעות לפי מאמן, לפי חודש",
    // Multi-club only: the settings tile does not exist on the single-club branch.
    settings: "מיתוג המועדון, מנהלים, קוד הצטרפות ומנוי",
  };
}
