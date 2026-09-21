// Which fixtures the games screen shows, and what it shows when a coach opens it.
//
// The screen has always listed the whole club, all season, with a team filter that starts
// on "all". For a manager that is right — it is their list. For a coach it means opening a
// list of several hundred fixtures belonging mostly to other people and knowing to reach
// for a dropdown, and a coach who does not know to reach for it sees a screen that looks
// like somebody else's.
//
// WHY "MY TEAMS" AND NOT "MY TEAM". Eight of this club's coaches hold more than one squad
// and one holds three. Preselecting a single team would have hidden the other squads'
// fixtures from a third of the coaching staff — and hidden them in the way that reads as
// "the import did not work", which is worse than the problem being fixed.

// The sentinel for "my teams" in the same dropdown as the real team ids. Prefixed so it can
// never collide with an id from `uid()`, which is eight lower-case alphanumerics.
export const MY_TEAMS = "__mine__";

const arr = (list) => (Array.isArray(list) ? list : []);

// A coach's squads are the teams that name them as coach — the SAME test that decides whose
// fixtures they may write a note on (`isMyGame` in GamesView). One definition, so the list a
// coach sees and the rows they can act on cannot drift apart.
//
// Deliberately NOT including teams they merely run a session for. That is a wider net, it is
// the one `CoachView` uses for the weekly board, and it is right there — a stand-in who
// takes one training does not thereby own the squad's fixture list.
export function teamIdsForCoach(data, coachId) {
  if (!coachId) return [];
  return arr(data?.teams).filter((t) => t && t.coachId === coachId).map((t) => t.id);
}

// What the dropdown should open on. A coach with squads opens on their own; everyone else —
// managers, and a coach whose record is not linked to any team — opens on the whole club,
// exactly as before.
export function defaultTeamFilter(myTeamIds) {
  return arr(myTeamIds).length > 0 ? MY_TEAMS : "";
}

// The options list. "הקבוצות שלי" is offered only to someone who has some, so a manager's
// dropdown is untouched.
export function teamFilterOptions(teams, myTeamIds) {
  const mine = arr(myTeamIds);
  const rest = arr(teams);
  return mine.length > 0 ? [{ id: MY_TEAMS, name: "הקבוצות שלי" }, ...rest] : rest;
}

// ---------- order ----------
//
// The list had no order at all: it came out in the order the federation's file happened to
// list it, which for a season of several hundred fixtures is no order a person can use.
// Date is the default because "when are we playing" is the question the screen is open for;
// the other two exist because they answer questions that are actually asked — "what does
// this squad's season look like" (the sheet that goes to parents is built per squad), and
// "what exactly did that import bring", for which the file's own order is the answer.
export const GAME_SORTS = [
  { id: "date", name: "לפי תאריך" },
  { id: "team", name: "לפי קבוצה" },
  { id: "source", name: "לפי סדר הייבוא" },
];

// "DD-MM-YYYY" → sortable. A row whose date cannot be read sorts LAST rather than first:
// an unreadable date is usually a broken record, and broken records at the top of a list
// are how a manager concludes the whole screen is broken.
function dateKey(game) {
  const m = /^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/.exec(String(game?.date || "").trim());
  if (!m) return "9999-99-99";
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

const timeKey = (game) => String(game?.time || "99:99");

export function sortGames(games, sort, { teams = [] } = {}) {
  const list = arr(games).filter(Boolean);
  if (sort === "source") return list;

  const nameOf = (id) => arr(teams).find((t) => t && t.id === id)?.name || "￿";
  const byDate = (a, b) => dateKey(a).localeCompare(dateKey(b)) || timeKey(a).localeCompare(timeKey(b));

  // `slice` first: this list belongs to the club document, and sorting it in place would
  // reorder the stored data as a side effect of looking at a screen.
  if (sort === "team") {
    return list.slice().sort((a, b) => {
      const n = nameOf(a.teamId).localeCompare(nameOf(b.teamId), "he");
      // Within a squad, still by date — a squad's fixtures in file order is the same
      // problem one level down.
      return n || byDate(a, b);
    });
  }
  return list.slice().sort(byDate);
}

export function filterGames(games, { team = "", type = "", myTeamIds = [] } = {}) {
  const mine = new Set(arr(myTeamIds));
  return arr(games).filter((g) => {
    if (!g) return false;
    if (team === MY_TEAMS) {
      if (!mine.has(g.teamId)) return false;
    } else if (team && g.teamId !== team) {
      return false;
    }
    if (type === "home" && !g.isHome) return false;
    if (type === "away" && g.isHome) return false;
    return true;
  });
}
