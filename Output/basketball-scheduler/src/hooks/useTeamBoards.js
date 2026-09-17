import { useCallback, useState } from "react";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { db, CLUB_ID, isFirebaseConfigured } from "../firebase";
import {
  buildBoard, newToken, tokenForTeam, withBoardToken, withoutBoardToken,
} from "../utils/teamBoard";

// Publishing one team's board, and taking it back.
//
// Order is the whole design here, and it is the same rule the archive and the push-token
// cleanup already follow: do the thing that can strand someone LAST when publishing, and
// FIRST when revoking.
//
//   Publishing  → the board document is written, THEN the token is stored on the club.
//                 A failure between the two leaves a document nobody has a link to.
//                 The other order hands the manager a link that opens nothing.
//   Unpublishing → the document is deleted, THEN the token is dropped.
//                 A failure between the two leaves a dead link, which fails closed.
//
// A coach never writes the board itself; the rules let a club member change `message` only.
export function useTeamBoards(data, save) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const boardRef = (token) => doc(db, "clubs", CLUB_ID, "boards", token);

  const writeBoard = useCallback(
    async (teamId, token) => {
      const built = buildBoard(data, teamId);
      if (!built) return false;
      // The message is left alone: it belongs to the coach and is rewritten only by them.
      // `merge` is what keeps a publish from wiping what a coach wrote five minutes ago.
      await setDoc(boardRef(token), built, { merge: true });
      return true;
    },
    [data]
  );

  const publish = useCallback(
    async (teamId) => {
      if (!isFirebaseConfigured || busy) return;
      setBusy(teamId);
      setMsg("");
      try {
        const token = tokenForTeam(data, teamId) || newToken();
        const ok = await writeBoard(teamId, token);
        if (!ok) { setMsg("לא נמצאה קבוצה כזו."); return; }
        if (!tokenForTeam(data, teamId)) save(withBoardToken(data, teamId, token));
        setMsg("הלוח פורסם. אפשר להעתיק את הקישור.");
      } catch {
        setMsg("הפרסום נכשל. נסה/י שוב.");
      } finally {
        setBusy("");
      }
    },
    [data, save, busy, writeBoard]
  );

  // One button for the whole club, because a manager who has to remember to press publish
  // per team will forget one, and a board nobody refreshed is worse than no board: it is
  // last week's times, presented as this week's.
  const refreshAll = useCallback(async () => {
    if (!isFirebaseConfigured || busy) return;
    const entries = Object.entries(data?.boards || {});
    if (entries.length === 0) return;
    setBusy("all");
    setMsg("");
    let done = 0;
    try {
      for (const [teamId, row] of entries) {
        if (await writeBoard(teamId, row.token)) done++;
      }
      setMsg(done === 1 ? "לוח אחד עודכן." : `${done} לוחות עודכנו.`);
    } catch {
      setMsg(`עודכנו ${done} לוחות, ואז משהו נכשל. נסה/י שוב.`);
    } finally {
      setBusy("");
    }
  }, [data, busy, writeBoard]);

  const unpublish = useCallback(
    async (teamId) => {
      const token = tokenForTeam(data, teamId);
      if (!token || busy) return;
      setBusy(teamId);
      setMsg("");
      try {
        await deleteDoc(boardRef(token));
        save(withoutBoardToken(data, teamId));
        setMsg("הפרסום בוטל. הקישור הישן כבר לא נפתח.");
      } catch {
        setMsg("ביטול הפרסום נכשל. נסה/י שוב.");
      } finally {
        setBusy("");
      }
    },
    [data, save, busy]
  );

  // For a link that spread further than it should have. The new one is live before the old
  // one dies, so nobody sees a broken page in between.
  const rotate = useCallback(
    async (teamId) => {
      const old = tokenForTeam(data, teamId);
      if (!old || busy) return;
      setBusy(teamId);
      setMsg("");
      try {
        const token = newToken();
        await writeBoard(teamId, token);
        save(withBoardToken(data, teamId, token));
        await deleteDoc(boardRef(old));
        setMsg("נוצר קישור חדש. הישן הפסיק לעבוד — שלח/י את החדש לקבוצה.");
      } catch {
        setMsg("החלפת הקישור נכשלה. נסה/י שוב.");
      } finally {
        setBusy("");
      }
    },
    [data, save, busy, writeBoard]
  );

  return { publish, refreshAll, unpublish, rotate, busy, msg };
}
