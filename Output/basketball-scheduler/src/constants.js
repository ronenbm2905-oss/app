// ---------- Constants ----------
export const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const STORAGE_KEY = "bball-schedule-v1";

// Club home base — the pickup point for away-game transportation.
export const CLUB_PICKUP_POINT = "אולם עלומים, הכפר 2, קריית אונו";
// Vehicle-size options for transport (seats).
export const VEHICLE_TYPES = ["16", "20"];

// Session types, each carrying its own colour on the board. Edited here rather than in
// the app — see the note in the vault: this list, and the club-specific entries in it,
// belong in club settings. Until then, adding a type is a one-line change here.
//
// `id` doubles as the stored value on a session, so renaming an entry orphans every
// session already using it. Add new ones; do not rename in place.
export const SESSION_TYPES = [
  { id: "אימון", name: "אימון", color: "#57534E" },
  { id: "משחק בית", name: "משחק בית", color: "#16A34A" },
  { id: "משחק חוץ", name: "משחק חוץ", color: "#0EA5E9" },
  { id: "ספורטתרפיה", name: "ספורטתרפיה", color: "#9333EA" },
  { id: "יורם", name: "יורם", color: "#CA8A04" },
  { id: "חד\"כ", name: "חד\"כ", color: "#0D9488" },
];

export const COLORS = [
  "#EA580C", "#0EA5E9", "#16A34A", "#9333EA", "#DC2626",
  "#0D9488", "#CA8A04", "#DB2777", "#4F46E5", "#65A30D",
];

// Day background colors for hall report (cycling through days)
export const DAY_BG_COLORS = [
  "#FEF9C3", // ראשון - yellow
  "#DCFCE7", // שני - green
  "#DBEAFE", // שלישי - blue
  "#FCE7F3", // רביעי - pink
  "#F3E8FF", // חמישי - purple
  "#FFE4E6", // שישי - red
  "#F1F5F9", // שבת - slate
];

// Shape of an empty club dataset
// Categories for the shared drill-video library. Add to the end; the value is what is
// stored on each video, so renaming one orphans the videos already filed under it.
export const VIDEO_CATEGORIES = [
  "התקפה",
  "הגנה",
  "מסירות וכדרור",
  "קליעה",
  "מהלכים",
  "כושר וחימום",
  "אחר",
];

export const EMPTY = {
  teams: [],
  coaches: [],
  halls: [],
  sessions: [],
  constraints: [],
  games: [],
  gameMapping: [],
  players: [],  // { id, teamId, name, phone, birthDate, shirtSize, pantsSize, sweaterSize, jerseyNumber }
  holidays: [], // { id, date: "YYYY-MM-DD", name } — special days shown on the weekly board
  // { id, coachId, date: "YYYY-MM-DD", start?, end?, note? } — a coach out on one date.
  // The dated counterpart to `constraints`, which repeat every week; see utils/availability.js.
  absences: [],
  // Weeks where the manager answered "לא השבוע" to the fixed-teams strip. See utils/fixedTeams.js.
  fixedWeekSkips: [],
  // Fold the fixed teams away on the weekly board — club-wide, set by a manager.
  hideFixedTeams: false,
  announcement: { text: "", updatedAt: null }, // single notice board shown to all coaches
  schedulePublished: null, // { weekOf, at } — set when a manager marks a week's schedule as published
  weeklyAssignments: {},
  admins: [],   // emails with edit rights (read + write)
  members: [],  // emails with view-only rights (read); admins also read via the rules
};
