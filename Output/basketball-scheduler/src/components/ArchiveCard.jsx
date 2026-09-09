import { useState, useMemo } from "react";
import { archivableMonths, ARCHIVE_KEEP_MONTHS } from "../utils/archive";
import { documentBytes, DOC_LIMIT_BYTES } from "../utils/access";
import { monthLabel } from "../utils/dates";
import { useArchive } from "../hooks/useArchive";
import { IconAlert, IconCheck, IconDownload } from "./ui/icons";

const KB = (b) => `${Math.round(b / 1024)} KB`;

// Moving a finished month out of the club document.
//
// It sits directly under the storage meter, because the meter is where a manager learns
// there is a problem and this is the only thing they can do about it. A warning with no
// adjacent action is how the 1 MiB ceiling arrives as a surprise anyway.
//
// One button per month, and the months are offered oldest first. Not a single "archive
// everything old" button: the manager is moving payroll history out of the screen they
// read it on, and doing that a month at a time — seeing the count before and the size
// after — is what makes it something they can check rather than trust.
export function ArchiveCard({ data, save }) {
  const { archiveMonths } = useArchive(data, save);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);

  const months = useMemo(() => archivableMonths(data), [data]);
  const done = data.archivedMonths || [];
  const bytes = documentBytes(data);
  const pct = Math.round((bytes / DOC_LIMIT_BYTES) * 100);

  const run = async (month, count) => {
    if (
      !window.confirm(
        `לארכב את ${monthLabel(month)}?\n\n` +
          `${count} אימונים יעברו לארכיון ויוצאו ממסמך המועדון.\n` +
          "דוח השעות לחודש הזה ימשיך לעבוד — הוא ייטען מהארכיון.\n" +
          "הלוח השבועי של אותם שבועות יופיע ריק."
      )
    )
      return;
    setBusy(month);
    setMsg(null);
    try {
      const moved = await archiveMonths([month]);
      setMsg({ type: "success", text: `${moved} אימונים מ${monthLabel(month)} הועברו לארכיון.` });
    } catch {
      // Said out loud rather than swallowed: the archive document is written before the
      // club document is trimmed, so a failure here leaves the month in both places —
      // recoverable, but only by someone who knows it happened.
      setMsg({
        type: "error",
        text: "הארכוב נכשל ולא הושלם. בדוק/בדקי את החיבור ונסה/י שוב — ייתכן שהחודש נשמר בארכיון ועדיין מופיע בלוח.",
      });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3" dir="rtl">
      <div>
        <h3 className="text-sm font-semibold text-stone-800">ארכוב חודשים שהסתיימו</h3>
        <p className="text-xs text-stone-600 mt-1">
          כל נתוני המועדון יושבים במסמך אחד שמוגבל ל-1 MB, והאימונים הם רובו. ארכוב מוציא
          חודש שהסתיים למסמך נפרד — <span className="font-medium">דוח השעות לאותו חודש ימשיך
          לעבוד</span> וייטען מהארכיון בעת הצורך.
        </p>
        <p className="text-xs text-stone-500 mt-1">
          החודש הנוכחי ו{ARCHIVE_KEEP_MONTHS === 2 ? "החודש שלפניו" : "החודשים שלפניו"} אינם ניתנים לארכוב — עדיין עובדים איתם.
        </p>
      </div>

      <div className="text-xs text-stone-600 tabular-nums">
        כרגע: <span className="font-medium">{KB(bytes)}</span> מתוך 1 MB ({pct}%)
      </div>

      {msg && (
        <div
          role="status"
          className={`text-xs rounded-lg p-2.5 flex items-start gap-1.5 ${
            msg.type === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
        >
          {msg.type === "error" ? <IconAlert size={13} className="mt-0.5 shrink-0" /> : <IconCheck size={13} className="mt-0.5 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {months.length === 0 ? (
        <p className="text-xs text-stone-500">אין כרגע חודשים שאפשר לארכב.</p>
      ) : (
        <ul className="space-y-1.5">
          {months.map((m) => (
            <li key={m.month} className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm text-stone-700">
                {monthLabel(m.month)}
                <span className="text-xs text-stone-500 tabular-nums">
                  {" "}· {m.count} אימונים · {KB(m.bytes)}
                </span>
              </span>
              <button
                onClick={() => run(m.month, m.count)}
                disabled={Boolean(busy)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-40"
              >
                <IconDownload size={13} /> {busy === m.month ? "מארכב..." : "ארכב"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <p className="text-xs text-stone-500">
          כבר בארכיון: {done.map(monthLabel).join(" · ")}
        </p>
      )}
    </div>
  );
}
