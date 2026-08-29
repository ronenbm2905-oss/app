import { useState, useMemo } from "react";
import { DAYS } from "../constants";
import {
  currentMonth, shiftMonth, monthLabel, monthGrid, monthOf, toISODate, uid,
} from "../utils/dates";
import { holidayNameOn, formatISODate } from "../utils/holidays";
import {
  absencesOn, absencesInMonth, sessionsOnDate, absenceLabel, absenceChip,
  absenceValid, upsertAbsence, removeAbsence, absenceCoversSession, isAllDay,
} from "../utils/availability";
import { Select } from "./ui/Select";
import { IconChevronRight, IconChevronLeft, IconTrash, IconPencil, IconCheck, IconUserX, IconX } from "./ui/icons";

// The month a coach's absences are entered on.
//
// This screen exists because the constraints screen could not answer "he can't make it on
// the 9th". A constraint is a weekday rule; entering one for a single date blocks that
// weekday for the rest of the season. So absences are their own thing, and a month grid is
// how you look at them — a phone call about a date three weeks out is not something you
// want to page a week at a time to reach.

// Short column heads: the full day names do not fit seven columns on a phone.
const SHORT_DAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

const emptyDraft = (date) => ({ id: "", date, allDay: true, start: "16:00", end: "18:00", note: "" });

export function AvailabilityView({ data, save, canEdit }) {
  const [coachId, setCoachId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [openDate, setOpenDate] = useState(""); // the day whose panel is open
  const [draft, setDraft] = useState(null);

  const absences = data.absences || [];
  const todayIso = toISODate(new Date());

  const weeks = useMemo(() => monthGrid(month), [month]);

  // Everything the grid needs, in one pass, keyed by date: this coach's absences, their
  // sessions, and the club's special days. Recomputed per month rather than per cell —
  // a 35-cell grid doing three filters each over a season of sessions is 105 scans.
  const byDate = useMemo(() => {
    const map = {};
    if (!coachId) return map;
    weeks.flat().forEach((cell) => {
      map[cell.iso] = {
        absences: absencesOn(absences, coachId, cell.iso),
        sessions: sessionsOnDate(data.sessions, coachId, cell.iso),
        holiday: holidayNameOn(data.holidays, cell.date),
      };
    });
    return map;
  }, [weeks, coachId, absences, data.sessions, data.holidays]);

  const monthAbsences = useMemo(
    () => absencesInMonth(absences, coachId, month),
    [absences, coachId, month]
  );

  const nameOf = (list, id) => (list || []).find((x) => x.id === id)?.name || "—";
  const coachName = nameOf(data.coaches, coachId);

  const openDay = (iso) => {
    setOpenDate(iso);
    setDraft(emptyDraft(iso));
  };

  const closePanel = () => {
    setOpenDate("");
    setDraft(null);
  };

  const editExisting = (a) => {
    setDraft({
      id: a.id,
      date: a.date,
      allDay: isAllDay(a),
      start: a.start || "16:00",
      end: a.end || "18:00",
      note: a.note || "",
    });
  };

  const asAbsence = (d) => ({
    id: d.id || uid(),
    coachId,
    date: d.date,
    start: d.allDay ? "" : d.start,
    end: d.allDay ? "" : d.end,
    note: d.note,
  });

  const saveDraft = () => {
    const entry = asAbsence(draft);
    if (!absenceValid(entry)) return;
    save({ ...data, absences: upsertAbsence(absences, entry) });
    // Straight back to a blank form on the same day: a coach who is out 09:00–11:00 and
    // again in the evening is two entries, and the second one should not need a re-click.
    setDraft(emptyDraft(draft.date));
  };

  const del = (id) => save({ ...data, absences: removeAbsence(absences, id) });

  // Sessions of the open day that this draft would actually cover. Shown while the form is
  // still open, because "he's out on the 9th" is only half the sentence — the half that
  // matters is which trainings now have nobody to run them.
  const openInfo = openDate ? byDate[openDate] || { absences: [], sessions: [], holiday: null } : null;
  const draftEntry = draft ? asAbsence(draft) : null;
  const affected = openInfo && draftEntry
    ? openInfo.sessions.filter((s) => absenceCoversSession(draftEntry, s))
    : [];
  const draftOk = draftEntry ? absenceValid(draftEntry) : false;

  if (!coachId) {
    return (
      <div className="space-y-4" dir="rtl">
        <div className="bg-white rounded-xl border border-stone-200 p-6 text-center space-y-3">
          <IconUserX size={28} className="mx-auto text-stone-600" />
          <p className="text-stone-600 text-sm">בחר מאמן כדי לראות את החודש שלו ולסמן ימים שהוא לא זמין</p>
          <Select value={coachId} onChange={setCoachId} options={data.coaches} placeholder="בחר מאמן" className="max-w-xs mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={coachId} onChange={setCoachId} options={data.coaches} placeholder="בחר מאמן" className="min-w-[12rem]" />
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setMonth(shiftMonth(month, -1)); closePanel(); }}
            aria-label="חודש קודם"
            className="p-1.5 rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
          >
            <IconChevronRight size={16} />
          </button>
          <span className="text-sm font-semibold text-stone-700 min-w-[7.5rem] text-center">{monthLabel(month)}</span>
          <button
            onClick={() => { setMonth(shiftMonth(month, 1)); closePanel(); }}
            aria-label="חודש הבא"
            className="p-1.5 rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
          >
            <IconChevronLeft size={16} />
          </button>
          <button
            onClick={() => { setMonth(currentMonth()); closePanel(); }}
            disabled={month === currentMonth()}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:hover:bg-white"
          >
            החודש
          </button>
        </div>
      </div>

      <p className="text-sm text-stone-500">
        {canEdit
          ? <>לחץ על יום בלוח של <span className="font-medium text-stone-700">{coachName}</span> כדי לסמן שהוא לא זמין. יום מסומן יופיע כאזהרה על האימונים שלו בלוח השבועי.</>
          : <>הימים ש<span className="font-medium text-stone-700">{coachName}</span> לא זמין בהם. רק מנהל יכול לסמן.</>}
      </p>

      {/* The month */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              {SHORT_DAYS.map((d, i) => (
                <th key={d} className="border-b border-stone-200 bg-stone-50 px-1 py-2 text-center text-xs font-semibold text-stone-600">
                  <span className="sm:hidden">{d}</span>
                  <span className="hidden sm:inline">{DAYS[i]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0].iso}>
                {week.map((cell) => {
                  const info = byDate[cell.iso] || { absences: [], sessions: [], holiday: null };
                  const away = info.absences.length > 0;
                  const isOpen = openDate === cell.iso;
                  const isToday = cell.iso === todayIso;
                  const body = (
                    <>
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-sm font-semibold tabular-nums ${cell.inMonth ? (away ? "text-rose-700" : "text-stone-700") : "text-stone-500 font-normal"}`}>
                          {cell.dayNum}
                        </span>
                        {isToday && <span className="text-[9px] font-bold text-brand-600">היום</span>}
                      </div>
                      {info.holiday && (
                        <div className="text-[10px] text-amber-700 truncate leading-tight" title={info.holiday}>🎉 {info.holiday}</div>
                      )}
                      {info.absences.map((a) => (
                        <div key={a.id} className="text-[10px] font-bold text-rose-700 leading-tight truncate" title={absenceLabel(a, true)}>
                          ⛔ {absenceChip(a)}
                        </div>
                      ))}
                      {/* The session count is what makes a date decidable: "he's out" costs
                          nothing on a day he wasn't working anyway. */}
                      {info.sessions.length > 0 && (
                        <div className={`text-[10px] leading-tight ${away ? "text-rose-600" : "text-stone-500"}`}>
                          {info.sessions.length === 1 ? "אימון אחד" : `${info.sessions.length} אימונים`}
                        </div>
                      )}
                    </>
                  );
                  const tone = away
                    ? "bg-rose-50"
                    : info.holiday
                    ? "bg-amber-50/60"
                    : cell.inMonth
                    ? "bg-white"
                    : "bg-stone-50/60";
                  const ring = isOpen ? "ring-2 ring-inset ring-brand-500" : isToday ? "ring-1 ring-inset ring-brand-300" : "";
                  return (
                    <td key={cell.iso} className={`border border-stone-100 p-0 align-top h-[74px] ${tone} ${ring}`}>
                      {canEdit ? (
                        <button
                          onClick={() => (isOpen ? closePanel() : openDay(cell.iso))}
                          title={away ? info.absences.map((a) => absenceLabel(a, true)).join(" · ") : "לחץ לסימון חוסר זמינות"}
                          className="w-full h-full text-right px-1.5 py-1 space-y-0.5 hover:bg-brand-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                        >
                          {body}
                        </button>
                      ) : (
                        <div className="w-full h-full px-1.5 py-1 space-y-0.5">{body}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* The open day */}
      {canEdit && openDate && draft && (
        <div className="bg-white rounded-xl border-2 border-brand-300 overflow-hidden">
          <div className="bg-brand-50 px-4 py-2.5 border-b border-brand-200 flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-stone-800">
              {coachName} · {formatISODate(openDate)}
              <span className="font-normal text-stone-600"> ({DAYS[new Date(openDate + "T00:00:00").getDay()]})</span>
              {openInfo.holiday && <span className="text-amber-700 font-normal"> · 🎉 {openInfo.holiday}</span>}
            </div>
            <button onClick={closePanel} className="p-1 rounded-lg hover:bg-white/70 text-stone-500" aria-label="סגור">
              <IconX size={16} />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Already marked */}
            {openInfo.absences.length > 0 && (
              <div className="divide-y divide-stone-100 border border-stone-200 rounded-lg">
                {openInfo.absences.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="text-rose-600 shrink-0"><IconUserX size={15} /></span>
                    <span className="flex-1 text-sm text-stone-800">{absenceLabel(a, true)}</span>
                    <button onClick={() => editExisting(a)} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" aria-label="ערוך">
                      <IconPencil size={14} />
                    </button>
                    <button onClick={() => del(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-stone-600 hover:text-red-600" aria-label="מחק">
                      <IconTrash size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* The form */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={draft.allDay}
                  onChange={(e) => setDraft({ ...draft, allDay: e.target.checked })}
                  className="w-4 h-4 accent-brand-600"
                />
                לא זמין כל היום
              </label>

              {!draft.allDay && (
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">משעה</label>
                    <input
                      type="time"
                      value={draft.start}
                      onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                      className="bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">עד שעה</label>
                    <input
                      type="time"
                      value={draft.end}
                      onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                      className="bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              )}

              {/* No medical reasons. The club's own terms already say a free-text field must
                  not carry a diagnosis or a treatment, and this one is read by anyone who can
                  open a coach's board — so the placeholder must not be the thing that invites
                  it. "לא זמין" is a complete answer; the reason is a convenience. */}
              <div>
                <label className="text-xs text-stone-500 mb-1 block">סיבה (אופציונלי)</label>
                <input
                  type="text"
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  placeholder="לדוגמה: מילואים, אירוע משפחתי, נסיעה"
                  dir="rtl"
                  className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-xs text-stone-600 mt-1">
                  אפשר להשאיר ריק. אין לרשום סיבה רפואית, אבחנה או פרטי טיפול.
                </p>
              </div>

              {!draft.allDay && !draftOk && (
                <p className="text-xs text-red-600">שעת הסיום צריכה להיות אחרי שעת ההתחלה.</p>
              )}

              {/* What this costs */}
              {openInfo.sessions.length === 0 ? (
                <p className="text-xs text-stone-500">אין לו אימונים ביום הזה.</p>
              ) : (
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-stone-600">האימונים שלו ביום הזה:</p>
                  {openInfo.sessions.map((s) => {
                    const hit = affected.some((x) => x.id === s.id);
                    return (
                      <div key={s.id} className={`text-xs flex flex-wrap items-center gap-1.5 ${hit ? "text-rose-700 font-medium" : "text-stone-600"}`}>
                        <span className="tabular-nums" dir="ltr">{s.start}–{s.end}</span>
                        <span>{nameOf(data.teams, s.teamId)}</span>
                        <span className="text-stone-500" aria-hidden="true">·</span>
                        <span>{nameOf(data.halls, s.hallId)}</span>
                        {hit && <span className="font-bold">⛔ ללא מאמן</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={saveDraft}
                  disabled={!draftOk}
                  className="px-4 py-2 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:hover:bg-brand-600 flex items-center gap-1.5"
                >
                  <IconCheck size={15} /> {draft.id ? "עדכן" : "סמן כלא זמין"}
                </button>
                {draft.id && (
                  <button
                    onClick={() => setDraft(emptyDraft(draft.date))}
                    className="px-3 py-2 text-sm rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50"
                  >
                    ביטול עריכה
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* The month in a list — the form the manager reads back to himself */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="bg-stone-50 px-4 py-2.5 border-b border-stone-200 text-sm font-semibold text-stone-700">
          חוסר זמינות ב{monthLabel(month)}
        </div>
        {monthAbsences.length === 0 ? (
          <div className="p-6 text-center text-sm text-stone-500">
            {coachName} זמין בכל החודש.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {monthAbsences.map((a) => {
              const hitCount = sessionsOnDate(data.sessions, coachId, a.date).filter((s) =>
                absenceCoversSession(a, s)
              ).length;
              return (
                <div key={a.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                  <span className="w-24 text-sm tabular-nums text-stone-600 shrink-0">{formatISODate(a.date)}</span>
                  <span className="flex-1 min-w-[8rem] text-sm text-stone-800">{absenceLabel(a, true)}</span>
                  {hitCount > 0 && (
                    <span className="text-xs font-medium text-rose-600 shrink-0">
                      ⛔ {hitCount === 1 ? "אימון אחד ללא מאמן" : `${hitCount} אימונים ללא מאמן`}
                    </span>
                  )}
                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setMonth(monthOf(a.date)); openDay(a.date); editExisting(a); }}
                        className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
                        aria-label="ערוך"
                      >
                        <IconPencil size={14} />
                      </button>
                      <button onClick={() => del(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-stone-600 hover:text-red-600" aria-label="מחק">
                        <IconTrash size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
