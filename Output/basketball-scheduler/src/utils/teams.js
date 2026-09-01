// Team options labelled with their coach, for the places where picking the right team is
// the whole point and the names alone are not enough to tell them apart — "נערים א" and
// "נערים ב" look nearly identical in a dropdown, but "נערים א · דני כהן" does not.
//
// A team with no coach assigned keeps its plain name rather than trailing a separator
// into nothing.
// The squads a coach is responsible for: the ones formally assigned to them, plus any team
// they actually have a session with. Both halves are needed — a stand-in who takes a squad
// all season is never written into `team.coachId`, and a newly-formed squad has a coach
// before it has a session.
//
// Lifted out of CoachView, which computed it inline, so the progress screen asks the same
// question in the same words rather than growing a second answer that drifts.
export function teamsOfCoach(data, coachId) {
  if (!coachId) return [];
  const teams = Array.isArray(data?.teams) ? data.teams : [];
  const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
  const ids = new Set([
    ...teams.filter((t) => t && t.coachId === coachId).map((t) => t.id),
    ...sessions.filter((s) => s && s.coachId === coachId).map((s) => s.teamId),
  ]);
  ids.delete(undefined);
  ids.delete(null);
  ids.delete("");
  return teams.filter((t) => t && ids.has(t.id));
}

export function teamsWithCoach(teams, coaches) {
  return (teams || [])
    .filter(Boolean)
    .map((t) => {
      const coach = (coaches || []).find((c) => c && c.id === t.coachId);
      const coachName = String(coach?.name || "").trim();
      return { ...t, name: coachName ? `${t.name} · ${coachName}` : t.name };
    });
}
