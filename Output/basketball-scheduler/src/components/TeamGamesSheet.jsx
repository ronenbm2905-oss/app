import { useRef, useState } from "react";
import { teamGameRows, teamNameOf, sheetFileName } from "../utils/gameSheet";
import {
  renderNodeCanvas, canvasToPdfBlob, shareOrDownloadBlob,
  AppUpdatedError, APP_UPDATED_MESSAGE,
} from "../utils/imageExport";
import clubLogo from "../assets/club-logo.jpg";
import { IconDownload } from "./ui/icons";

// One team's fixtures as a PDF, for a coach to send to that team's parents.
//
// ONE TEAM, NAMED. The button asks for a specific squad and refuses to work on "my teams"
// or "all teams", and that is not a limitation — a sheet headed with one squad's name that
// silently carried another squad's fixtures is exactly the kind of thing that gets
// forwarded and believed. What goes on the page is decided in `gameSheet.js`, by naming
// what belongs there rather than by filtering out what does not.
//
// Rendered off-screen rather than shown: html2canvas needs the node in the document and
// laid out, but nobody needs a second copy of the table on screen. Fixed width, because a
// capture that inherits the phone's width produces a sheet nobody can read.

function SheetRow({ row }) {
  const struck = row.cancelled ? "line-through opacity-60" : "";
  return (
    <tr className="border-b border-stone-200">
      <td className={`py-2 px-2 whitespace-nowrap ${struck}`}>
        <span className="font-semibold">{row.date}</span>
        {row.day ? <span className="text-stone-500"> · {row.day}</span> : null}
      </td>
      <td className={`py-2 px-2 font-semibold whitespace-nowrap ${struck}`}>{row.time}</td>
      <td className={`py-2 px-2 whitespace-nowrap ${struck}`}>{row.home ? "בית" : "חוץ"}</td>
      <td className={`py-2 px-2 ${struck}`}>
        {row.opponent || "—"}
        {row.cancelled && <span className="ms-2 text-red-700 font-semibold no-underline">מבוטל</span>}
      </td>
      <td className={`py-2 px-2 text-stone-600 ${struck}`}>{row.where}</td>
      <td className="py-2 px-2 whitespace-nowrap">
        {/* The one line a parent has to act on. Away games only — a home fixture has
            nowhere to gather for, and an invented time would be worse than none. */}
        {!row.cancelled && row.assembly ? (
          <span className="text-amber-800 font-semibold">{row.assembly}</span>
        ) : (
          <span className="text-stone-400">—</span>
        )}
      </td>
    </tr>
  );
}

export function TeamGamesSheet({ data, teamId }) {
  const sheetRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const teamName = teamNameOf(data, teamId);
  const rows = teamId ? teamGameRows(data, teamId) : [];

  // No squad chosen, so there is nothing honest to put in the heading.
  if (!teamId) {
    return (
      <p className="text-xs text-stone-500">
        לשליחת לוח משחקים להורים — בחרו קבוצה אחת בסנן שלמעלה.
      </p>
    );
  }

  const handle = async () => {
    if (!sheetRef.current || busy || rows.length === 0) return;
    setBusy(true);
    setMsg("");
    try {
      const canvas = await renderNodeCanvas(sheetRef.current, {
        logoSrc: clubLogo,
        title: `לוח משחקים — ${teamName}`,
      });
      const blob = await canvasToPdfBlob(canvas);
      await shareOrDownloadBlob(blob, sheetFileName(teamName), `לוח משחקים — ${teamName}`);
    } catch (err) {
      // A chunk that is gone and a render that failed are different problems, and only one
      // of them is fixed by trying again. Saying "try again" about the first one sends a
      // person round a loop that cannot end.
      setMsg(err instanceof AppUpdatedError ? APP_UPDATED_MESSAGE : "לא הצלחנו להפיק את הקובץ. נסו שוב.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        onClick={handle}
        disabled={busy || rows.length === 0}
        className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-40"
      >
        <IconDownload size={15} />
        {busy ? "מכין..." : `PDF להורים — ${teamName}`}
      </button>
      <p className="text-[11px] text-stone-500">
        {rows.length === 0
          ? "אין משחקים קרובים לקבוצה הזו."
          : `${rows.length} משחקים קרובים · בלי שמות שחקנים ובלי פרטי נהג.`}
      </p>
      <p role="status" aria-live="polite" className="text-[11px] text-red-600 min-h-[1rem]">{msg}</p>

      {/* Off-screen, not hidden: `display:none` has no layout and html2canvas captures
          nothing from it. */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden="true">
        <div ref={sheetRef} className="bg-white p-6 w-[900px]" dir="rtl">
          <table className="w-full text-[15px] text-stone-800 border-collapse">
            <thead>
              <tr className="border-b-2 border-stone-300 text-stone-500 text-[13px]">
                <th className="py-2 px-2 text-right font-medium">תאריך</th>
                <th className="py-2 px-2 text-right font-medium">שעה</th>
                <th className="py-2 px-2 text-right font-medium">בית/חוץ</th>
                <th className="py-2 px-2 text-right font-medium">יריבה</th>
                <th className="py-2 px-2 text-right font-medium">מיקום</th>
                <th className="py-2 px-2 text-right font-medium">התייצבות</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => <SheetRow key={i} row={r} />)}
            </tbody>
          </table>
          {/* The same sentence the parent board and the notification carry. A parent who
              drove somewhere on the strength of this page has to know what it is. */}
          <p className="text-[12px] text-stone-500 mt-4 text-center">
            שעת ההתייצבות היא למשחקי חוץ. זו תצוגה בלבד ואינה מחליפה את ההודעה הרשמית של המועדון.
          </p>
        </div>
      </div>
    </div>
  );
}
