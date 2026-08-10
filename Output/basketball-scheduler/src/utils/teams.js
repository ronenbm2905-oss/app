// Team options labelled with their coach, for the places where picking the right team is
// the whole point and the names alone are not enough to tell them apart — "נערים א" and
// "נערים ב" look nearly identical in a dropdown, but "נערים א · דני כהן" does not.
//
// A team with no coach assigned keeps its plain name rather than trailing a separator
// into nothing.
export function teamsWithCoach(teams, coaches) {
  return (teams || [])
    .filter(Boolean)
    .map((t) => {
      const coach = (coaches || []).find((c) => c && c.id === t.coachId);
      const coachName = String(coach?.name || "").trim();
      return { ...t, name: coachName ? `${t.name} · ${coachName}` : t.name };
    });
}
