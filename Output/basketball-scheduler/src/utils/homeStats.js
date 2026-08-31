import { weekStartOfDMY } from "./dates";
import { upcomingAbsences, subjectOf } from "./availability";
import { unreadCount } from "./gameNotes";

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

// `canEdit` shapes two lines: a coach's roster screen has no halls on it, so counting
// them would describe a screen they are not going to get, and unread game notes are the
// professional manager's inbox — the coach who wrote one is not waiting to read it.
export function homeStats(data, weekStart, canEdit = true, notes, videoCount) {
  const d = data || {};
  const sessions = arr(d.sessions).filter((s) => s && (s.weekOf || "") === weekStart);
  const games = arr(d.games).filter((g) => g && g.date && weekStartOfDMY(g.date) === weekStart);
  const notice = String(d.announcement?.text || "").trim();

  return {
    announcements: notice
      ? notice.replace(/\s+/g, " ").slice(0, 40) + (notice.length > 40 ? "…" : "")
      : "אין הודעות כרגע",
    rosters: canEdit
      ? `${plural(count(d.teams), "קבוצה אחת", "קבוצות")} · ${plural(count(d.halls), "אולם אחד", "אולמות")}`
      : `${plural(count(d.teams), "קבוצה אחת", "קבוצות")} · ${plural(count(d.coaches), "מאמן אחד", "מאמנים")}`,
    manager: plural(sessions.length, "אימון אחד השבוע", "אימונים השבוע"),
    constraints: plural(count(d.constraints), "אילוץ אחד", "אילוצים"),
    games: (() => {
      const waiting = canEdit ? unreadCount(notes) : 0;
      const fixtures = plural(games.length, "משחק אחד השבוע", "משחקים השבוע");
      // A manager with reports waiting is being asked to do something; the fixture
      // count is only background, so it steps aside rather than sharing the line.
      return waiting
        ? `${waiting === 1 ? "הערה אחת חדשה" : `${waiting} הערות חדשות`} · ${fixtures}`
        : fixtures;
    })(),
    weekly: d.schedulePublished?.weekOf === weekStart ? "הלו״ז פורסם" : "טרם פורסם",
    coach: "הלו״ז שלך, לשליחה בוואטסאפ",
    // The library lives in its own subcollection, so homeStats never sees it — the count
    // is passed in rather than counted here, and the line stays honest when it is absent.
    videos: typeof videoCount === "number"
      ? plural(videoCount, "סרטון אחד", "סרטונים")
      : "תרגילים ומהלכים, בקישור",
    // Named and dated, because the question this tile answers is "who is missing soon" —
    // a count of marked days tells you there is something to look at without telling you
    // whether it matters. Counted from the shown week, not from a clock, like every other
    // line here.
    availability: (() => {
      const next = upcomingAbsences(d.absences, weekStart, 1)[0];
      if (!next) return "כולם זמינים מכאן והלאה";
      const { kind, id } = subjectOf(next);
      const who =
        kind === "hall"
          ? `🏟 ${arr(d.halls).find((h) => h && h.id === id)?.name || "אולם"}`
          : arr(d.coaches).find((c) => c && c.id === id)?.name || "מאמן";
      const [, m, day] = String(next.date).split("-");
      const more = upcomingAbsences(d.absences, weekStart).length - 1;
      return `${who} · ${Number(day)}/${Number(m)}${more > 0 ? ` (+${more})` : ""}`;
    })(),
    players: plural(count(d.players), "שחקן אחד", "שחקנים"),
    report: "שעות לפי מאמן, לפי חודש",
  };
}
