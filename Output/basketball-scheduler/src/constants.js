// ---------- Constants ----------
export const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const STORAGE_KEY = "bball-schedule-v1";
// Local-mode store for the weeks published to the parent portal (cloud mode uses the
// clubs/{id}/published subcollection instead).
export const PUBLISHED_STORAGE_KEY = "bball-published-v1";

// Vehicle-size options for transport (seats).
export const VEHICLE_TYPES = ["16", "20"];

// The three types the app itself depends on, in every club.
//
// These ids are STRUCTURAL, not labels: the federation import writes "משחק בית" /
// "משחק חוץ" when it turns a fixture into a session (utils/games), and "אימון" is the
// ordinary case that several screens check for in order to NOT draw a type pill. A club
// renaming them would break its own game sync, so they are fixed and every club gets
// exactly these three.
//
// Anything beyond them — a club's therapy slot, a session named after the coach who
// runs it — is that club's own, and lives in settings.sessionTypes. See
// utils/sessionTypes.
export const BASE_SESSION_TYPES = [
  { id: "אימון", name: "אימון", color: "#57534E" },
  { id: "משחק בית", name: "משחק בית", color: "#16A34A" },
  { id: "משחק חוץ", name: "משחק חוץ", color: "#0EA5E9" },
];

// The type a session gets when none was chosen, and the one the screens treat as
// "nothing worth labelling".
export const DEFAULT_SESSION_TYPE = "אימון";

// A colour for a type nobody recognises — a session still carrying a custom type the
// club has since deleted, or the parent portal, which is served the type name but not
// the club's palette.
export const UNKNOWN_TYPE_COLOR = "#57534E";

// Drill-video categories. A shared constant rather than a club setting, unlike
// SESSION_TYPES: those had to move to the club document because two of the five entries
// were one club's own ("ספורטתרפיה", and a coach's name). These are the vocabulary of the
// sport, not of a club — every customer means the same thing by "הגנה".
export const VIDEO_CATEGORIES = [
  "התקפה",
  "הגנה",
  "מסירות וכדרור",
  "קליעה",
  "מהלכים",
  "כושר וחימום",
  "אחר",
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

// ---------- Per-club settings ----------
// Everything that used to be hardcoded to Kiryat Ono lives here, so one build can
// serve any club. These specific values are the LEGACY FALLBACK: the live
// `clubs/main` document predates this field, and without them it would lose its
// name, colors and home/away detection. A newly created club always writes its
// own `settings` explicitly (see the club-creation flow), so it never inherits these.
// What a club document falls back to for anything it has not set itself.
//
// These belong to NO club. They used to be the original club's — its name, crest,
// colours, address and legal entity — because its document has no `settings` of its
// own and read straight through to here. That made every value in this object a piece
// of one association's identity handed to every other, shipped inside the same build.
//
// The multi-club product is built around new clubs; the original stays on the
// single-club branch, which keeps its own values. So nothing here has to flatter any
// existing document, and the rule is simple: a default may describe what a field IS,
// never who a club is. Identity fields are blank or obviously unset, and the screens
// that show them say what to fill in rather than quietly borrowing someone else's.
export const DEFAULT_SETTINGS = {
  // The club's training-plan form. The shape of a plan is fixed; what its table's columns
  // are called, and whether it carries a lineup block at all, is the club's own sheet.
  // `lineups.enabled` is false by default — a lineup block of groups, quads and fives is
  // one club's paper form, not a fact about coaching.
  trainingPlan: {
    columns: [
      { id: "drill", label: "תרגיל" },
      { id: "detail", label: "פירוט" },
      { id: "focus", label: "דגשים" },
      { id: "time", label: "זמן" },
    ],
    lineups: { enabled: false, groups: 2, quads: 4, fives: 3 },
    startingRows: 4,
  },
  // Minutes before tip-off the scorer's table crew is asked to arrive. A convention, not
  // an identity — so unlike the name, logo and colours it carries a real default.
  secretaryLeadMin: 15,
  // Visibly unset rather than "" — this reaches the header and the browser tab title,
  // where an empty string reads as a broken app instead of an unfinished one.
  name: "מועדון ללא שם",
  shortName: "",
  logoUrl: "", // empty → no logo is shown at all; see utils/clubLogo
  primaryColor: "#1F6FEB", // drives every brand-* class at runtime (utils/theme.js)
  accentColor: "#F5A524",
  // Appears in the transport sheet sent to the bus company. Blank by default: guessing
  // an address here would send someone to another club's gym.
  pickupPoint: "",
  // Session types this club adds on top of BASE_SESSION_TYPES — [{ id, name, color }].
  // Empty by default: the original club's "ספורטתרפיה" and "יורם" (a coach's name) were
  // in the shared list, so every other association saw them in its own session form.
  sessionTypes: [],
  // There is no such thing as a sensible default here: the list must match how the
  // federation's file spells THIS club's name. Empty makes the game import refuse and
  // say what to fill in, which beats matching a season of fixtures against the wrong
  // association and filing every one of them as an away game.
  homeKeywords: [],
  // Substituted into the privacy / terms / accessibility documents at render time.
  //
  // Blank on purpose, and this is the one field group where a default would do real
  // harm: a privacy policy naming the wrong data controller is a misrepresentation,
  // not a cosmetic bug. An unfilled field renders as ⟨… — למילוי⟩, so the document is
  // obviously unfinished instead of quietly wrong. See legal/fillTemplate.
  legal: {
    operator: "",
    address: "",
    email: "",
    a11yContact: "",
    a11yPhone: "",
    // Form of incorporation — "עמותה", "בע״מ", or nothing. Optional, and blank by
    // default: the documents used to hard-code "(עמותה)", which is a false statement
    // about the controller for any customer that is a company. Renders to nothing when
    // unset rather than a "to be filled" marker — see legal/fillTemplate.
    entityType: "",
  },
  subscription: { plan: "", validUntil: "" }, // display only — no billing in the app
};

// Shape of an empty club dataset
export const EMPTY = {
  settings: DEFAULT_SETTINGS,
  teams: [],
  coaches: [],
  halls: [],
  sessions: [],
  constraints: [],
  // Dated unavailability — one-off, unlike `constraints`, which repeat by weekday.
  // { id, coachId? | hallId?, date: "YYYY-MM-DD", start?, end?, note? }
  absences: [],
  games: [],
  gameMapping: [],
  players: [],  // { id, teamId, name, phone, birthDate, shirtSize, pantsSize, sweaterSize, jerseyNumber }
  holidays: [], // { id, date: "YYYY-MM-DD", name } — special days shown on the weekly board
  announcement: { text: "", updatedAt: null }, // single notice board shown to all coaches
  schedulePublished: null, // { weekOf, at } — set when a manager marks a week's schedule as published
  // Board-level, not per-viewer: hiding the fixed teams is a decision about the CLUB's
  // board, so every coach sees the same board the manager does.
  hideFixedTeams: false,
  // Weeks a manager dismissed the "fill the fixed teams" offer for, so it stops asking.
  fixedWeekSkips: [],
  weeklyAssignments: {},
  admins: [],   // emails with edit rights (read + write)
  members: [],  // emails with view-only rights (read); admins also read via the rules
};
