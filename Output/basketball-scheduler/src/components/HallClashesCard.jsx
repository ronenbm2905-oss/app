import { useState, useRef } from "react";
import { seasonHallClashes, clashesByDate, formatDayMonth, clashKindLabel } from "../utils/hallClashes";
import { duplicateRowCount, withoutSessions, splitDuplicates } from "../utils/duplicateSessions";
import { accept, unaccept, splitAccepted, FIELD } from "../utils/acceptedChecks";
import { exportClashesXlsx } from "../utils/clashExport";
import { IconAlert, IconCheck, IconDownload } from "./ui/icons";
import {
  renderNodeCanvas, canvasToPdfBlob, shareOrDownloadBlob,
  AppUpdatedError, APP_UPDATED_MESSAGE,
} from "../utils/imageExport";
import clubLogo from "../assets/club-logo.jpg";

// Every double-booked hall in the season, on one screen.
//
// The weekly board already paints a clash red — but only for the week on screen, and the
// federation publishes a season at a time. Nobody pages through thirty weeks to check, so
// in practice these were found by a coach arriving at a gym that was already in use.
//
// Collapsed by default and showing only a count, like the transport editor: it is a check
// a manager runs after an import, not something to read every day. A clean season says so
// in one quiet line rather than disappearing — "no clashes" and "the check did not run"
// have to look different, the lesson the sync indicator was built on.

// "This one is deliberate." Measured on the live board on 1.10.2026: twenty-two clashes in
// the rest of the season, and nearly all of them two squads sharing a gym on purpose — two
// קטסל groups, two נערים ב groups. Scrolling past the same twenty-two after every import is
// how a report stops being read, and then it is worth nothing on the day it finds a real one.
//
// There is no bulk "accept all" on purpose. Approving in one click is the same as not
// looking, and this report exists precisely so that somebody looks once.
function Row({ clash, onAccept, onUndo, canEdit }) {
  const tone = clash.duplicate
    ? "border-amber-300 bg-amber-50"
    : "border-red-200 bg-red-50";
  return (
    <div className={`rounded-lg border p-2 text-xs ${tone}`}>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="font-semibold text-stone-800">{clash.hall}</span>
        <span className={`font-medium ${clash.duplicate ? "text-amber-800" : "text-red-800"}`}>
          {clashKindLabel(clash)}
        </span>
      </div>
      {clash.rows.map((r, i) => (
        <div key={i} className="text-stone-700">
          <span className="font-semibold tabular-nums">{r.start}–{r.end}</span>
          {"  "}
          {r.team || "(ללא קבוצה)"}
          <span className="text-stone-500"> · {r.label}</span>
          {/* The club to phone. Without it the row says what is wrong and nothing about who
              can put it right, which for a fixture is the only question being asked. */}
          {r.opponent && <span className="text-stone-700"> · נגד {r.opponent}</span>}
        </div>
      ))}
      {canEdit && (onAccept || onUndo) && (
        <div className="mt-1.5">
          {onAccept ? (
            <button
              onClick={() => onAccept(clash)}
              title="לא תוצג שוב בבדיקה. אפשר להחזיר אותה בכל רגע"
              className="px-2.5 py-1 text-xs rounded-lg border border-stone-300 text-stone-600 bg-white hover:bg-stone-50"
            >
              שיתוף מכוון — לא להציג שוב
            </button>
          ) : (
            <button
              onClick={() => onUndo(clash)}
              className="px-2.5 py-1 text-xs rounded-lg border border-stone-300 text-stone-600 bg-white hover:bg-stone-50"
            >
              להחזיר לבדיקה
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// The other question a manager asks after an import, and a DIFFERENT one: not "are two
// squads booked into one gym" but "is this row here twice".
//
// It reports zero out loud. A check that is silent when it finds nothing is
// indistinguishable from a check that never ran — the lesson the sync indicator was built
// on, one screen over.
function DupeLine({ g }) {
  return (
    <>
      <span className="font-semibold tabular-nums">{formatDayMonth(g.date)}</span>
      <span className="text-stone-500"> · {g.day} · </span>
      <span className="font-semibold tabular-nums">{g.start}–{g.end}</span>
      {"  "}
      {g.team}
      <span className="text-stone-500"> · {g.label}</span>
      {g.count > 2 && <span className="text-amber-800 font-medium"> ×{g.count}</span>}
    </>
  );
}

function DuplicateRows({ data, save, canEdit }) {
  const [confirming, setConfirming] = useState(false);
  const [showAccepted, setShowAccepted] = useState(false);
  const now = new Date();
  const { open, accepted } = splitDuplicates(data, { from: now });
  const extra = duplicateRowCount(open);

  // "This one is deliberate." Ronen, 1.10.2026: a duplicate is not always a fault — a squad
  // can genuinely train twice in one slot — and a report that can only be obeyed or ignored
  // gets ignored. Deciding once is what keeps the check worth opening on the day it finds
  // something real.
  const acceptOne = (g) => save(accept(data, g, now));
  const dropOne = (g) => save(withoutSessions(data, g.dropIds));

  // The approved ones are never hidden outright — a count, and one click to see them. A
  // check that quietly suppresses part of what it found is the same fault as one that says
  // nothing when it finds nothing.
  const AcceptedBlock = accepted.length > 0 && (
    <div className="pt-1">
      <button
        onClick={() => setShowAccepted((v) => !v)}
        className="text-xs text-stone-600 hover:text-stone-800 underline decoration-dotted py-0.5"
      >
        {accepted.length === 1 ? "כפילות אחת שאישרת" : `${accepted.length} כפילויות שאישרת`}
        {showAccepted ? " — הסתר" : " — הצג"}
      </button>
      {showAccepted && (
        <div className="space-y-1 mt-1">
          {accepted.map((g) => (
            <div key={g.key} className="text-xs text-stone-500 flex items-center gap-2 flex-wrap">
              <span><DupeLine g={g} /></span>
              {canEdit && (
                <button
                  onClick={() => save(unaccept(data, g))}
                  className="px-2.5 py-1 rounded border border-stone-300 text-stone-600 hover:bg-stone-50"
                >
                  להחזיר לבדיקה
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const hasSetAside = accepted.length > 0;
  if (extra === 0) {
    return (
      <div className="text-xs text-stone-500 space-y-1">
        <div className="flex items-center gap-1.5">
          {hasSetAside ? <IconAlert size={13} className="opacity-70" /> : <IconCheck size={13} className="opacity-60" />}
          אין שורות כפולות פתוחות בלוח בהמשך העונה.
        </div>
        {AcceptedBlock}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-stone-800">
          {extra === 1 ? "שורה אחת כפולה בלוח" : `${extra} שורות כפולות בלוח`}
        </h3>
        <p className="text-xs text-stone-600 mt-0.5">
          אותה קבוצה, אותו מאמן, אותו אולם, אותן שעות, באותו שבוע — כלומר אותה שורה נכנסה פעמיים.
        </p>
      </div>
      <div className="space-y-1.5">
        {open.map((g) => (
          <div key={g.key} className="text-xs text-stone-700 flex items-start gap-2 flex-wrap">
            <span className="flex-1 min-w-0"><DupeLine g={g} /></span>
            {canEdit && (
              <span className="flex items-center gap-1.5 shrink-0">
                {/* Deleting one row needs no confirmation step the way deleting all of them
                    does: the line it belongs to is on screen, and one row is undoable by
                    re-entering it. The bulk button keeps its question. */}
                <button
                  onClick={() => dropOne(g)}
                  title={g.count > 2 ? `מוחק ${g.count - 1} שורות ומשאיר אחת` : "מוחק את העותק הכפול ומשאיר שורה אחת"}
                  className="px-2.5 py-1 rounded-lg border border-red-300 text-red-700 bg-white hover:bg-red-50"
                >
                  {g.count > 2 ? `מחיקת ${g.count - 1} העותקים` : "מחיקת העותק הכפול"}
                </button>
                <button
                  onClick={() => acceptOne(g)}
                  title="לא תוצג שוב בבדיקה. אפשר להחזיר אותה בכל רגע"
                  className="px-2.5 py-1 rounded-lg border border-stone-300 text-stone-600 bg-white hover:bg-stone-50"
                >
                  מכוון — לא להציג שוב
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        // Deleting rows, so it asks — and the question says how many and what survives,
        // because "האם אתה בטוח" is a question nobody reads.
        confirming ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-stone-700">
              למחוק {extra === 1 ? "שורה אחת" : `${extra} שורות`}? מכל כפילות נשארת שורה אחת.
            </span>
            <button
              onClick={() => {
                setConfirming(false);
                save(withoutSessions(data, open.flatMap((g) => g.dropIds)));
              }}
              className="px-2.5 py-1 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700"
            >
              אישור — מחק
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-2.5 py-1 text-xs rounded-lg border border-stone-300 text-stone-600"
            >
              ביטול
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="px-3 py-1.5 text-xs rounded-lg border border-amber-400 bg-white text-amber-900 hover:bg-amber-100"
          >
            מחיקת כל הכפילויות
          </button>
        )
      )}
      {AcceptedBlock}
    </div>
  );
}

export function HallClashesCard({ data, save, canEdit }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showAcceptedClashes, setShowAcceptedClashes] = useState(false);
  const sheetRef = useRef(null);
  if (!canEdit) return null;

  const now = new Date();
  const all = seasonHallClashes(data);
  // HOW MANY ROWS THIS FINDING ACTUALLY INVOLVES — not the constant 2.
  //
  // A clash is reported per PAIR. Three identical rows produce three pairs that all share one
  // key, so a fixed count meant one click approved all three; a fourth row produces six, and
  // every one of them would have been approved in silence. That is the "approve all" button
  // this card deliberately does not have, arriving through the back door.
  //
  // Counting the pairs that share a key makes the stored value grow with the finding, so a
  // row added later brings it back for a second look — which is what the duplicate report
  // already does, and the two must not disagree about the same rows.
  const perKey = new Map();
  all.forEach((c) => perKey.set(c.key, (perKey.get(c.key) || 0) + 1));
  const withCount = all.map((c) => ({ ...c, count: (perKey.get(c.key) || 1) + 1 }));
  const { open: clashes, accepted: acceptedClashes } = splitAccepted(withCount, data?.[FIELD]);
  const days = clashesByDate(clashes);
  const acceptClash = (c) => save(accept(data, c, now));
  const undoClash = (c) => save(unaccept(data, c));
  // Counted separately because they are dealt with differently: one is a booking to move,
  // the other is a row to delete.
  const dupes = clashes.filter((c) => c.duplicate).length;
  const real = clashes.length - dupes;

  // No off-screen render and no canvas, so nothing here can fail the way the PDF can: the
  // sheet is built from the same `clashes` array the screen is showing. It still reports a
  // failure rather than going quiet — a download that produces no file and no message is
  // the one the manager tries four times.
  //
  // It does NOT set `busy`. The work is synchronous and over before a repaint, so a spinner
  // would be a flicker — but the button still reads `busy`, so it greys out while the PDF
  // is rendering. Two downloads at once is not a state worth having.
  const handleXlsx = () => {
    if (busy) return;
    setMsg("");
    try {
      exportClashesXlsx(clashes, days.length);
    } catch {
      setMsg("לא הצלחנו להפיק את קובץ האקסל. נסו שוב.");
    }
  };

  const handlePdf = async () => {
    if (!sheetRef.current || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const canvas = await renderNodeCanvas(sheetRef.current, {
        logoSrc: clubLogo,
        title: "התנגשויות אולם — לבדיקה",
      });
      const blob = await canvasToPdfBlob(canvas);
      const d = new Date();
      await shareOrDownloadBlob(
        blob,
        `התנגשויות-אולם-${d.getDate()}.${d.getMonth() + 1}.pdf`,
        "התנגשויות אולם"
      );
    } catch (err) {
      setMsg(err instanceof AppUpdatedError ? APP_UPDATED_MESSAGE : "לא הצלחנו להפיק את הקובץ. נסו שוב.");
    } finally {
      setBusy(false);
    }
  };

  const hasSetAside = acceptedClashes.length > 0;
  if (clashes.length === 0) {
    return (
      <div className="space-y-2" dir="rtl">
        <div className="text-xs text-stone-500 flex items-center gap-1.5 flex-wrap">
          {hasSetAside ? <IconAlert size={13} className="opacity-70" /> : <IconCheck size={13} className="opacity-60" />}
          אין התנגשויות אולם פתוחות בהמשך העונה.
          {/* "None left" and "none, because you approved all of them" are different
              sentences, and the second one has to say so — the same reason the sync
              indicator reports a quiet night differently from a night that never ran. */}
          {acceptedClashes.length > 0 && (
            <button
              onClick={() => setShowAcceptedClashes((v) => !v)}
              className="text-stone-600 hover:text-stone-800 underline decoration-dotted"
            >
              ({acceptedClashes.length} שאישרת — {showAcceptedClashes ? "הסתר" : "הצג"})
            </button>
          )}
        </div>
        {acceptedClashes.length > 0 && showAcceptedClashes && (
          <div className="space-y-1.5">
            {acceptedClashes.map((c, i) => (
              <div key={c.key || i}>
                <div className="text-xs font-semibold text-stone-600">
                  {formatDayMonth(c.date)} · יום {c.day}
                </div>
                <Row clash={c} canEdit={canEdit} onUndo={undoClash} />
              </div>
            ))}
          </div>
        )}
        <DuplicateRows data={data} save={save} canEdit={canEdit} />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 space-y-2" dir="rtl">
      <div className="flex items-start gap-2 flex-wrap">
        <IconAlert size={16} className="text-red-700 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-[14rem]">
          <h3 className="text-sm font-semibold text-stone-800">
            {real > 0 && `${real} התנגשויות אולם`}
            {real > 0 && dupes > 0 && " · "}
            {dupes > 0 && `${dupes} כפילויות`}
          </h3>
          <p className="text-xs text-stone-600 mt-0.5">
            ב-{days.length} ימים בהמשך העונה. כולל אימונים, לא רק משחקים — אותו אולם, שעות חופפות.
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="px-3 py-1.5 text-xs rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
        >
          {open ? "סגור" : "הצג"}
        </button>
        {/* Because this list is worked through away from the screen — against the hall's
            own diary, or on the phone to the federation — and forty-one lines is not
            something anyone holds in their head.

            TWO FORMATS, TWO USES. The PDF is the page taken to the meeting: read once, top
            to bottom. The spreadsheet is the one sorted by hall to phone one caretaker
            about everything at once, or filtered down to a single week. Neither replaces
            the other, and what goes IN them is identical — see `clashExport.js` for the one
            place they differ and why. */}
        <button
          onClick={handlePdf}
          disabled={busy}
          className="px-3 py-1.5 text-xs rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-40 flex items-center gap-1.5"
        >
          <IconDownload size={13} />
          {busy ? "מכין..." : "PDF"}
        </button>
        <button
          onClick={handleXlsx}
          disabled={busy}
          title={`${clashes.length} ממצאים · ${clashes.length * 2} שורות`}
          className="px-3 py-1.5 text-xs rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-40 flex items-center gap-1.5"
        >
          <IconDownload size={13} />
          אקסל
        </button>
      </div>
      <p role="status" aria-live="polite" className="text-[11px] text-red-700 min-h-[0.75rem]">{msg}</p>

      {open && (
        <div className="space-y-2.5 pt-1">
          {days.map((d) => (
            <div key={d.date} className="space-y-1.5">
              <div className="text-xs font-semibold text-stone-600">
                {formatDayMonth(d.date)} · יום {d.day}
              </div>
              {d.items.map((c, i) => (
                <Row key={c.key || i} clash={c} canEdit={canEdit} onAccept={acceptClash} />
              ))}
            </div>
          ))}
          {/* Approved findings are shown, not hidden: a check that quietly suppresses part of
              what it found is the same fault as one that says nothing when it finds nothing,
              and a decision made in a hurry a month ago has to be reversible. */}
          {acceptedClashes.length > 0 && (
            <div className="pt-1">
              <button
                onClick={() => setShowAcceptedClashes((v) => !v)}
                className="text-xs text-stone-600 hover:text-stone-800 underline decoration-dotted py-0.5"
              >
                {acceptedClashes.length === 1 ? "התנגשות אחת שאישרת" : `${acceptedClashes.length} התנגשויות שאישרת`}
                {showAcceptedClashes ? " — הסתר" : " — הצג"}
              </button>
              {showAcceptedClashes && (
                <div className="space-y-1.5 mt-1.5">
                  {acceptedClashes.map((c, i) => (
                    <div key={c.key || i}>
                      <div className="text-xs font-semibold text-stone-600">
                        {formatDayMonth(c.date)} · יום {c.day}
                      </div>
                      <Row clash={c} canEdit={canEdit} onUndo={undoClash} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* What the screen cannot do for them, said plainly rather than implied by the
              absence of a button. Moving a fixture is a phone call to the federation; this
              only finds them. */}
          <p className="text-[11px] text-stone-500">
            השינוי עצמו נעשה בלוח השבועי או מול האיגוד — כאן רק מאתרים.
          </p>
        </div>
      )}
      <DuplicateRows data={data} save={save} canEdit={canEdit} />

      {/* The printable version, off-screen. Rendered whether or not the list above is
          expanded: the button must not depend on someone having pressed "הצג" first. */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden="true">
        <div ref={sheetRef} className="bg-white p-6 w-[1000px]" dir="rtl">
          <table className="w-full text-[14px] text-stone-800 border-collapse">
            <thead>
              <tr className="border-b-2 border-stone-300 text-stone-500 text-[12px]">
                <th className="py-2 px-2 text-right font-medium">תאריך</th>
                <th className="py-2 px-2 text-right font-medium">יום</th>
                <th className="py-2 px-2 text-right font-medium">אולם</th>
                <th className="py-2 px-2 text-right font-medium">שעות</th>
                <th className="py-2 px-2 text-right font-medium">קבוצה · מאמן</th>
                <th className="py-2 px-2 text-right font-medium">סוג</th>
                {/* The two columns a manager needs in order to ACT: who the other club is,
                    and the number the league identifies the fixture by. */}
                <th className="py-2 px-2 text-right font-medium">יריבה</th>
                <th className="py-2 px-2 text-right font-medium">מס' משחק</th>
                <th className="py-2 px-2 text-right font-medium">הממצא</th>
              </tr>
            </thead>
            <tbody>
              {clashes.map((c, i) =>
                c.rows.map((r, j) => (
                  <tr
                    key={`${i}-${j}`}
                    className={j === 1 ? "border-b border-stone-300" : "border-b border-stone-100"}
                  >
                    {/* The date, day, hall and finding are written once per pair and left
                        blank on its second line — a sheet that repeats them four times a
                        night is a sheet nobody can scan down. */}
                    <td className="py-1.5 px-2 whitespace-nowrap font-semibold">
                      {j === 0 ? formatDayMonth(c.date) : ""}
                    </td>
                    <td className="py-1.5 px-2 whitespace-nowrap text-stone-600">{j === 0 ? c.day : ""}</td>
                    <td className="py-1.5 px-2 whitespace-nowrap">{j === 0 ? c.hall : ""}</td>
                    <td className="py-1.5 px-2 whitespace-nowrap font-semibold">{r.start}–{r.end}</td>
                    <td className="py-1.5 px-2">{r.team || "(ללא קבוצה)"}</td>
                    <td className="py-1.5 px-2 text-stone-600 whitespace-nowrap">{r.label}</td>
                    <td className="py-1.5 px-2">{r.opponent || ""}</td>
                    <td className="py-1.5 px-2 text-stone-600 tabular-nums whitespace-nowrap">{r.code || ""}</td>
                    <td className="py-1.5 px-2 text-stone-600">{j === 0 ? clashKindLabel(c) : ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p className="text-[12px] text-stone-500 mt-4">
            {clashes.length} ממצאים ב-{days.length} ימים, מהיום ועד סוף העונה. כולל אימונים ומשחקים.
            שתי שורות רצופות הן ממצא אחד.
          </p>
        </div>
      </div>
    </div>
  );
}
