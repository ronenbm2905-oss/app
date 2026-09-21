import { buildBoard, boardsIndex } from "./teamBoard.js";
import { boardChanges } from "./boardChanges.js";

// Keeping every published board in step with the schedule, without anyone remembering to.
//
// A published board is a PROJECTION of the club's sessions and games, and a projection that
// a person has to refresh by hand is a projection that will be stale. It was stale within
// an hour of the first real use: the manager moved a training, saved, and the families kept
// a board from before the change — with nothing on any screen to say so.
//
// WHY THIS RUNS IN THE BROWSER AND NOT IN THE CLOUD FUNCTION
//
// The obvious home for this is the trigger that already sees every club save. It cannot go
// there. The published privacy policy says of that process, in as many words, that it
// "אינו כותב לשום מקום" beyond deleting a dead device row, and that it "קורא מתוכו את
// רשומות השינוי בלבד". Rebuilding boards would read teams, halls, games and sessions, and
// would write documents — breaking both sentences. The rule in this project is that the
// document and the system say the same thing; making the code quietly do more is the same
// failure as making the document promise more, pointed the other way.
//
// The manager's own browser already holds the club document legitimately and is already
// writing it. Doing the rebuild there adds no new process, no new access, and nothing to
// declare.
//
// Only boards that ACTUALLY changed are written. Not for cost — because every write wakes
// the notification function, and a write with nothing in it is how families learn to ignore
// the alert.

// `now` is injectable, and it is not a convenience. Without it this read the wall clock
// while its test built the "current" boards at a fixed date — so the two agreed only during
// the week the test was written, and the suite went green on a comparison that had quietly
// stopped comparing anything. Found on 21.9.2026, when the fixture week fell out of range
// and the test failed for a reason that had nothing to do with the change being made.
export function boardsToRefresh(data, current, { now } = {}) {
  const index = boardsIndex(data);
  const out = [];
  Object.entries(index).forEach(([teamId, row]) => {
    const token = row?.token;
    if (!token) return;
    const built = buildBoard(data, teamId, now ? { now } : undefined);
    if (!built) return; // the team was deleted; the board is left for the manager to unpublish
    if (!boardChanges(current?.[token] || null, built).changed && current?.[token]) return;
    out.push({ teamId, token, board: built });
  });
  return out;
}
