import { overlaps } from "./dates";

// ---------- Coaches who run groups side by side ----------
// Some coaches take two squads at the same hour, every single week. Left alone, every one
// of those sessions is reported as a coach clash, and a board that is permanently half red
// teaches everyone to ignore the colour — which is how the one real clash gets missed.
//
// Flagged on the coach (`parallelGroups`) rather than on each session: it is a fact about
// how that coach works, not about a particular week, so it survives duplicating a week —
// and it keeps the coach's name out of the code, unlike the hardcoding this replaces.
//
// The flag suppresses the COACH warning only, in every hall, by explicit instruction. The
// trade-off is real and accepted: a genuine impossible booking for this coach — two gyms
// at the same hour — will no longer be flagged either. Hall clashes and constraint
// violations are untouched, so two teams in one gym still shows up as before.
export function parallelCoachIdSet(coaches) {
  return new Set((coaches || []).filter((c) => c && c.parallelGroups).map((c) => c.id));
}

// ---------- Conflict detection ----------
// Two sessions conflict if: same day + overlapping times + (same hall OR same coach)
export function findConflicts(sessions) {
  const conflicts = {};
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i];
      const b = sessions[j];
      if (a.day !== b.day) continue;
      if ((a.weekOf || "") !== (b.weekOf || "")) continue; // only within the same week
      if (!overlaps(a.start, a.end, b.start, b.end)) continue;
      const sameHall = a.hallId === b.hallId;
      const sameCoach = a.coachId === b.coachId;
      if (sameHall || sameCoach) {
        conflicts[a.id] = conflicts[a.id] || [];
        conflicts[b.id] = conflicts[b.id] || [];
        conflicts[a.id].push({ withId: b.id });
        conflicts[b.id].push({ withId: a.id });
      }
    }
  }
  return conflicts;
}

// Session ids that share a hall with another session at an overlapping time (same day + week).
// A hard double-booking — two teams in one gym at once — highlighted boldly on the board.
export function findHallClashes(sessions) {
  const clash = new Set();
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i];
      const b = sessions[j];
      if (!a.hallId || a.hallId !== b.hallId) continue;
      if (a.day !== b.day) continue;
      if ((a.weekOf || "") !== (b.weekOf || "")) continue;
      if (!overlaps(a.start, a.end, b.start, b.end)) continue;
      clash.add(a.id);
      clash.add(b.id);
    }
  }
  return clash;
}

// Session ids where the same coach is booked twice at an overlapping time (same day +
// week). The counterpart to findHallClashes: a hall clash is two teams in one gym, this
// is one coach in two places. It shows up while assigning a coach to a second team —
// exactly when it is cheapest to fix, and easiest to miss on a board of a dozen rows.
//
// Sessions with no coach are skipped: "not yet assigned" twice over is not a clash.
// Coaches marked `parallelGroups` are skipped too — see the note at the top of this file.
export function findCoachClashes(sessions, parallelIds) {
  const clash = new Set();
  const skip = parallelIds || new Set();
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i];
      const b = sessions[j];
      if (!a.coachId || a.coachId !== b.coachId) continue;
      if (skip.has(a.coachId)) continue;
      if (a.day !== b.day) continue;
      if ((a.weekOf || "") !== (b.weekOf || "")) continue;
      if (!overlaps(a.start, a.end, b.start, b.end)) continue;
      clash.add(a.id);
      clash.add(b.id);
    }
  }
  return clash;
}

// ---------- Constraint violation detection ----------
export function findConstraintViolations(sessions, constraints) {
  const violations = {};
  sessions.forEach((s) => {
    constraints.forEach((c) => {
      if (c.day !== s.day) return;
      if (!overlaps(c.start, c.end, s.start, s.end)) return;
      const matches =
        (c.type === "coach" && c.refId === s.coachId) ||
        (c.type === "hall" && c.refId === s.hallId);
      if (matches) {
        violations[s.id] = violations[s.id] || [];
        violations[s.id].push(c);
      }
    });
  });
  return violations;
}

export function sessionViolatesConstraints(session, constraints) {
  return constraints.filter(
    (c) =>
      c.day === session.day &&
      overlaps(c.start, c.end, session.start, session.end) &&
      ((c.type === "coach" && c.refId === session.coachId) ||
        (c.type === "hall" && c.refId === session.hallId))
  );
}
