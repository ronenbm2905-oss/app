// ---------- Constants ----------
export const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const STORAGE_KEY = "bball-schedule-v1";
// Local-mode store for the weeks published to the parent portal (cloud mode uses the
// clubs/{id}/published subcollection instead).
export const PUBLISHED_STORAGE_KEY = "bball-published-v1";

// Club home base — the pickup point for away-game transportation.
export const CLUB_PICKUP_POINT = "אולם עלומים, הכפר 2, קריית אונו";
// Vehicle-size options for transport (seats).
export const VEHICLE_TYPES = ["16", "20"];

export const SESSION_TYPES = [
  { id: "אימון", name: "אימון", color: "#57534E" },
  { id: "משחק בית", name: "משחק בית", color: "#16A34A" },
  { id: "משחק חוץ", name: "משחק חוץ", color: "#0EA5E9" },
  { id: "ספורטתרפיה", name: "ספורטתרפיה", color: "#9333EA" },
  { id: "יורם", name: "יורם", color: "#CA8A04" },
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
export const DEFAULT_SETTINGS = {
  name: "קרית אונו – דור העתיד",
  shortName: "קרית אונו",
  logoUrl: "", // empty → the logo bundled at build time (src/assets/club-logo.jpg)
  primaryColor: "#2355A5", // drives every brand-* class at runtime (utils/theme.js)
  accentColor: "#F58634",
  pickupPoint: CLUB_PICKUP_POINT,
  // Deliberately EMPTY, and the first of these defaults to be neutralised.
  //
  // There is no such thing as a sensible default here: the list must match how the
  // federation's file spells THIS club's name. Any non-empty value is one club's names
  // handed to another, and a club document created without a `settings` object of its
  // own reads straight through to these defaults — so a stray value here reaches
  // exactly the clubs least equipped to notice. Empty makes the import refuse and say
  // what to fill in. The single-club branch keeps its own list; this one serves nobody
  // in particular.
  homeKeywords: [],
  // Substituted into the privacy / terms / accessibility documents at render time.
  // These are the legacy values for the existing deployment; a club that leaves a
  // field empty gets a visible "to be filled" marker rather than someone else's
  // legal entity, which would be a misrepresentation.
  legal: {
    operator: "קרית אונו – דור העתיד",
    address: "הכפר 2, קרית אונו",
    email: "ronenbm2905@gmail.com",
    a11yContact: "רונן בן מאיר",
    a11yPhone: "054-6696288",
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
  games: [],
  gameMapping: [],
  players: [],  // { id, teamId, name, phone, birthDate, shirtSize, pantsSize, sweaterSize, jerseyNumber }
  holidays: [], // { id, date: "YYYY-MM-DD", name } — special days shown on the weekly board
  announcement: { text: "", updatedAt: null }, // single notice board shown to all coaches
  schedulePublished: null, // { weekOf, at } — set when a manager marks a week's schedule as published
  weeklyAssignments: {},
  admins: [],   // emails with edit rights (read + write)
  members: [],  // emails with view-only rights (read); admins also read via the rules
};
