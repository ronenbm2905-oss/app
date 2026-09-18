import { useCallback, useState } from "react";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { db, CLUB_ID, isFirebaseConfigured } from "../firebase";
import {
  buildBoard, newToken, tokenForTeam, withBoardToken, withoutBoardToken,
} from "../utils/teamBoard";
import { normalizePayUrl, withPayUrl, withPayUrlEverywhere } from "../utils/payLink";

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

  // `from` exists for the one caller that has newer data than this closure does: setting a
  // payment link changes the club document and the board in the same breath, and building
  // from `data` would publish the link the manager typed a moment ago instead of this one.
  const writeBoard = useCallback(
    async (teamId, token, from) => {
      const built = buildBoard(from || data, teamId);
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

  // The payment link, for one team or for all of them.
  //
  // The club document and the published board are written TOGETHER, and the board first.
  // The board is the thing parents actually read; a club document that remembers a link no
  // board is showing is a manager who pressed save and was told nothing happened, which is
  // recoverable. The other order puts a live link in front of several hundred people that
  // the manager's own screen does not know about.
  //
  // A board is NOT re-published for a team that has none — there is nowhere to show it —
  // and `withPayUrl` refuses to record one for the same reason.
  const writePay = useCallback(
    async (nextData, teamIds, url) => {
      setBusy(teamIds.length === 1 ? teamIds[0] : "all");
      setMsg("");
      try {
        for (const teamId of teamIds) {
          const token = tokenForTeam(nextData, teamId);
          if (token) await writeBoard(teamId, token, nextData);
        }
        save(nextData);
        setMsg(url ? "קישור התשלום מופיע עכשיו בלוח." : "קישור התשלום הוסר מהלוח.");
      } catch {
        setMsg("העדכון נכשל. נסה/י שוב.");
      } finally {
        setBusy("");
      }
    },
    [save, writeBoard]
  );

  const setPay = useCallback(
    async (teamId, raw) => {
      if (!isFirebaseConfigured || busy) return;
      const url = normalizePayUrl(raw);
      // A link that was typed and refused must say so. Silently storing nothing is how a
      // manager ends up telling parents to use a button that is not there.
      if (String(raw || "").trim() && !url) {
        setMsg("הקישור אינו תקין. צריך כתובת אינטרנט מלאה ומאובטחת (https).");
        return;
      }
      await writePay(withPayUrl(data, teamId, url), [teamId], url);
    },
    [data, busy, writePay]
  );

  const setPayEverywhere = useCallback(
    async (raw) => {
      if (!isFirebaseConfigured || busy) return;
      const url = normalizePayUrl(raw);
      if (String(raw || "").trim() && !url) {
        setMsg("הקישור אינו תקין. צריך כתובת אינטרנט מלאה ומאובטחת (https).");
        return;
      }
      const next = withPayUrlEverywhere(data, url);
      await writePay(next, Object.keys(next.boards || {}), url);
    },
    [data, busy, writePay]
  );

  return { publish, refreshAll, unpublish, rotate, setPay, setPayEverywhere, busy, msg };
}
