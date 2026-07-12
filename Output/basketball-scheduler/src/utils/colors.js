import { COLORS, SESSION_TYPES } from "../constants";

export function colorFor(id, list) {
  const idx = list.indexOf(id);
  return COLORS[idx % COLORS.length];
}

// Color by coach: teams with same coach get same color
export function colorForTeamByCoach(team, teams) {
  // Group by coachId: same coachId = same color slot
  const key = team.coachId || team.id; // fallback to own id if no coach
  const seen = [];
  teams.forEach((t) => {
    const k = t.coachId || t.id;
    if (!seen.includes(k)) seen.push(k);
  });
  const idx = seen.indexOf(key);
  return COLORS[idx % COLORS.length];
}

export function sessionTypeColor(type) {
  return SESSION_TYPES.find((t) => t.id === type)?.color || "#57534E";
}
