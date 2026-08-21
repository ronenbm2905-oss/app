import { useState } from "react";
import { buildIcs, icsFileName } from "../utils/calendar";
import { shareOrDownloadBlob } from "../utils/imageExport";
import { IconCalendarDays } from "./ui/icons";

// Hands the week's sessions to whatever calendar the person already uses.
//
// Goes through the same share sheet as the image exports, so on a phone the file lands
// straight in the calendar app rather than in Downloads. No account to connect and no
// server in the middle — a calendar file is the format every calendar already speaks.
// `label` names the file; `calendarName` is what the calendar app shows as the source.
// They differ because a week range reads well inside a calendar and turns to mush in a
// filename once the slashes are stripped out of it.
export function AddToCalendarButton({
  sessions, data, label, calendarName, weekStart, className = "", title,
}) {
  const [busy, setBusy] = useState(false);
  const count = (sessions || []).length;

  const run = async () => {
    if (busy || count === 0) return;
    setBusy(true);
    try {
      const ics = buildIcs(sessions, data, { calendarName: calendarName || label });
      // text/calendar is what makes a phone offer the calendar app instead of a text editor.
      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      await shareOrDownloadBlob(blob, icsFileName(label, weekStart), label);
    } catch {
      alert("לא הצלחנו להפיק את קובץ היומן. נסה שוב.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={run}
      disabled={busy || count === 0}
      title={title || (count === 0 ? "אין אימונים בשבוע הנבחר" : `${count} אימונים ליומן`)}
      className={`flex items-center gap-1.5 px-4 min-h-11 text-sm rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:hover:bg-white ${className}`}
    >
      <IconCalendarDays size={15} /> {busy ? "מכין…" : "הוסף ליומן"}
    </button>
  );
}
