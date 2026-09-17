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

export function boardsToRefresh(data, current) {
  const index = boardsIndex(data);
  const out = [];
  Object.entries(index).forEach(([teamId, row]) => {
    const token = row?.token;
    if (!token) return;
    const built = buildBoard(data, teamId);
    if (!built) return; // the team was deleted; the board is left for the manager to unpublish
    if (!boardChanges(current?.[token] || null, built).changed && current?.[token]) return;
    out.push({ teamId, token, board: built });
  });
  return out;
}
