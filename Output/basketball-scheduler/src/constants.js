// ---------- Constants ----------
export const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const STORAGE_KEY = "bball-schedule-v1";

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

// Shape of an empty club dataset
export const EMPTY = {
  teams: [],
  coaches: [],
  halls: [],
  sessions: [],
  constraints: [],
  games: [],
  gameMapping: [],
  players: [],  // { id, teamId, name, phone, birthDate, shirtSize, pantsSize, sweaterSize, jerseyNumber }
  announcement: { text: "", updatedAt: null }, // single notice board shown to all coaches
  weeklyAssignments: {},
  admins: [],   // emails with edit rights (read + write)
  members: [],  // emails with view-only rights (read); admins also read via the rules
};
