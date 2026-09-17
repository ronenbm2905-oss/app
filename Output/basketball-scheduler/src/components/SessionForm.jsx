import { useState, useEffect, useMemo, useRef } from "react";
import { DAYS, SESSION_TYPES } from "../constants";
import { timeToMinutes, overlaps, toISODate } from "../utils/dates";
import { colorFor } from "../utils/colors";
import { sessionViolatesConstraints } from "../utils/conflicts";
import { absencesOn, absenceCoversSession, absenceLabel } from "../utils/availability";
import { copyToDay, targetDays } from "../utils/dayCopy";
import { HallFreeSlots } from "./HallFreeSlots";
import { Select } from "./ui/Select";
import { Pill } from "./ui/Pill";
import { IconAlert, IconBan, IconPlus, IconCheck } from "./ui/icons";
import { uid } from "../utils/dates";

export function SessionForm({ data, initial, onSave, onCancel, onSaveAndAddNext, onCopyToDay, weekStart }) {
  const weekOf = initial?.weekOf || weekStart;
  const [teamId, setTeamId] = useState(initial?.teamId || "");
  const [coachId, setCoachId] = useState(initial?.coachId || "");
  const [hallId, setHallId] = useState(initial?.hallId || "");
  const [day, setDay] = useState(initial?.day || DAYS[0]);
  const [start, setStart] = useState(initial?.start || "16:00");
  const [end, setEnd] = useState(initial?.end || "17:00");
  const [type, setType] = useState(initial?.type || "אימון");
  const [notes, setNotes] = useState(initial?.notes || "");
  const sessionIdRef = useRef(initial?.id || uid());
  const [copyMsg, setCopyMsg] = useState("");

  useEffect(() => {
    sessionIdRef.current = initial?.id || uid();
    setTeamId(initial?.teamId || "");
    setCoachId(initial?.coachId || "");
    setHallId(initial?.hallId || "");
    setDay(initial?.day || DAYS[0]);
    setStart(initial?.start || "16:00");
    setEnd(initial?.end || "17:00");
    setType(initial?.type || "אימון");
    setNotes(initial?.notes || "");
  }, [initial]);

  const valid =
    teamId && coachId && hallId && day && start && end && timeToMinutes(start) < timeToMinutes(end);

  const nameOf = (list, id) => list.find((x) => x.id === id)?.name || "—";

  // Team dropdown labels show the coach too ("קבוצה – מאמן"), so the manager sees who runs each team.
  const teamOptions = data.teams.map((t) => {
    const coach = t.coachId ? nameOf(data.coaches, t.coachId) : "";
    return { id: t.id, name: coach && coach !== "—" ? `${t.name} – ${coach}` : t.name };
  });

  // Picking a team auto-fills its coach (each team has a fixed coach); still editable for substitutes.
  const handleTeamChange = (newTeamId) => {
    setTeamId(newTeamId);
    const team = data.teams.find((t) => t.id === newTeamId);
    if (team?.coachId) setCoachId(team.coachId);
  };

  const wouldConflict = useMemo(() => {
    if (!valid) return null;
    const others = data.sessions.filter((s) => s.id !== initial?.id && (s.weekOf || "") === (weekOf || ""));
    const hits = others.filter(
      (s) =>
        s.day === day &&
        overlaps(s.start, s.end, start, end) &&
        (s.hallId === hallId || s.coachId === coachId)
    );
    return hits.length > 0 ? hits : null;
  }, [teamId, coachId, hallId, day, start, end, valid, data.sessions, initial, weekOf]);

  const wouldViolateConstraints = useMemo(() => {
    if (!valid) return null;
    const hits = sessionViolatesConstraints(
      { day, start, end, coachId, hallId },
      data.constraints || []
    );
    return hits.length > 0 ? hits : null;
  }, [coachId, hallId, day, start, end, valid, data.constraints]);

  // The coach is marked away on this exact date. Constraints repeat every week and this
  // does not, so it is computed from weekOf + the weekday rather than from the weekday
  // alone — and it is the moment the warning is worth most: while you are choosing who
  // takes the session, not after the board is built.
  // Not gated on `valid` like the two warnings below it, deliberately: those need a hall to
  // mean anything, this needs only a coach and a date. Waiting for the form to be complete
  // would hold the warning back until after the choice it is warning about was made.
  const coachIsAway = useMemo(() => {
    if (!coachId || !weekOf || !start || !end) return null;
    const i = DAYS.indexOf(day);
    if (i < 0) return null;
    const d = new Date(weekOf + "T00:00:00");
    d.setDate(d.getDate() + i);
    const hits = absencesOn(data.absences, coachId, toISODate(d)).filter((a) =>
      absenceCoversSession(a, { start, end })
    );
    return hits.length > 0 ? hits : null;
  }, [coachId, day, start, end, weekOf, data.absences]);

  // The same question about the room. Kept separate from `coachIsAway` rather than merged
  // into one "something is wrong" flag, because they are fixed by different actions: one
  // needs another coach, the other needs another hall.
  const hallIsTaken = useMemo(() => {
    if (!hallId || !weekOf || !start || !end) return null;
    const i = DAYS.indexOf(day);
    if (i < 0) return null;
    const d = new Date(weekOf + "T00:00:00");
    d.setDate(d.getDate() + i);
    const hits = absencesOn(data.absences, hallId, toISODate(d), "hall").filter((a) =>
      absenceCoversSession(a, { start, end })
    );
    return hits.length > 0 ? hits : null;
  }, [hallId, day, start, end, weekOf, data.absences]);

  // Copying this training onto another day of the same week.
  //
  // Offered only for a training that is already ON the board: a draft has nothing to copy
  // from yet, and an imported fixture is never copied at all.
  const isSaved = Boolean(initial?.id) && data.sessions.some((x) => x.id === initial.id);
  const dirty =
    isSaved &&
    (teamId !== (initial.teamId || "") ||
      coachId !== (initial.coachId || "") ||
      hallId !== (initial.hallId || "") ||
      day !== (initial.day || DAYS[0]) ||
      start !== (initial.start || "16:00") ||
      end !== (initial.end || "17:00") ||
      type !== (initial.type || "אימון") ||
      notes.trim() !== (initial.notes || "").trim());
  const canCopy = Boolean(onCopyToDay) && isSaved && !initial?.fromGame && valid;

  const nTimes = (n) => (n === 1 ? "אימון אחד" : n + " אימונים");

  const doCopy = (targetDay) => {
    const result = copyToDay(data.sessions, { ...currentSession, fromGame: initial?.fromGame }, targetDay);
    if (!result.ok) {
      setCopyMsg(
        result.reason === "duplicate"
          ? "כבר קיים אימון זהה ביום " + targetDay + ". לא נוסף דבר."
          : "לא ניתן להעתיק את האימון הזה."
      );
      return;
    }
    onCopyToDay(result.session);
    setCopyMsg(
      result.clashes.length === 0
        ? "נוסף אימון ביום " + targetDay + "."
        : "נוסף אימון ביום " + targetDay + " — שימו לב: התנגשות עם " + nTimes(result.clashes.length) + " באותה שעה."
    );
  };

  const currentSession = {
    id: sessionIdRef.current,
    teamId,
    coachId,
    hallId,
    day,
    start,
    end,
    type,
    notes: notes.trim(),
    weekOf,
  };

  return (
    <div className="bg-white rounded-xl border border-stone-300 p-4 space-y-3" dir="rtl">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-stone-500 mb-1 block">קבוצה</label>
          <Select value={teamId} onChange={handleTeamChange} options={teamOptions} placeholder="בחר קבוצה" />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">מאמן</label>
          <Select value={coachId} onChange={setCoachId} options={data.coaches} placeholder="בחר מאמן" />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">אולם</label>
          <Select value={hallId} onChange={setHallId} options={data.halls} placeholder="בחר אולם" />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">יום</label>
          <Select
            value={day}
            onChange={setDay}
            options={DAYS.map((d) => ({ id: d, name: d }))}
            placeholder="בחר יום"
          />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">שעת התחלה</label>
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">שעת סיום</label>
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">סוג</label>
          <Select value={type} onChange={setType} options={SESSION_TYPES} placeholder="בחר סוג" />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">הערות (אופציונלי)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="לדוגמה: משחק נגד הפועל, משחק חוץ"
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            dir="rtl"
          />
        </div>
      </div>

      {/* The hall's day, under the fields that ask about it. Choosing a slot is a search,
          and until now the app made the manager guess an hour and then scored the guess. */}
      <HallFreeSlots
        data={data}
        hallId={hallId}
        day={day}
        weekOf={weekOf}
        excludeId={initial?.id}
        start={start}
        end={end}
        onPick={(slot) => {
          if (!slot) return;
          setStart(slot.start);
          setEnd(slot.end);
        }}
      />

      {!valid && (start || end) && timeToMinutes(start) >= timeToMinutes(end) && (
        <p className="text-xs text-red-600">שעת הסיום צריכה להיות אחרי שעת ההתחלה.</p>
      )}

      {wouldConflict && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-2.5 text-xs text-amber-800 space-y-1.5">
          <div className="flex items-center gap-1.5 font-medium">
            <IconAlert size={14} className="shrink-0" />
            התנגשות עם {wouldConflict.length} אימון{wouldConflict.length > 1 ? "ים" : ""} — אפשר לשמור בכל זאת:
          </div>
          {wouldConflict.map((s) => {
            const reasons = [];
            if (s.hallId === hallId) reasons.push("אותו אולם");
            if (s.coachId === coachId) reasons.push("אותו מאמן");
            return (
              <div key={s.id} className="flex items-center gap-2 bg-amber-100/60 rounded px-2 py-1 flex-wrap">
                <span className="tabular-nums font-medium">
                  <span dir="ltr">{s.start}–{s.end}</span>
                </span>
                <Pill color={colorFor(s.teamId, data.teams.map((t) => t.id))}>
                  {nameOf(data.teams, s.teamId)}
                </Pill>
                <span className="text-amber-700">{nameOf(data.coaches, s.coachId)}</span>
                <span className="text-amber-600">• {nameOf(data.halls, s.hallId)}</span>
                <span className="text-amber-500 mr-auto">({reasons.join(", ")})</span>
              </div>
            );
          })}
        </div>
      )}

      {coachIsAway && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-300 rounded-lg p-2.5 text-xs text-red-800">
          <IconBan size={15} className="shrink-0 mt-0.5" />
          <span>
            <span className="font-semibold">{nameOf(data.coaches, coachId)}</span> מסומן/ת כלא זמין/ה בתאריך הזה
            {" "}({coachIsAway.map((a) => absenceLabel(a, true)).join(" · ")}). אפשר לשמור בכל זאת — אבל יהיה צריך מחליף.
          </span>
        </div>
      )}

      {hallIsTaken && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-lg p-2.5 text-xs text-amber-900">
          <IconBan size={15} className="shrink-0 mt-0.5" />
          <span>
            <span className="font-semibold">{nameOf(data.halls, hallId)}</span> מסומן כתפוס בתאריך הזה
            {" "}({hallIsTaken.map((a) => absenceLabel(a)).join(" · ")}). אפשר לשמור בכל זאת — אבל יהיה צריך אולם אחר.
          </span>
        </div>
      )}

      {wouldViolateConstraints && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-300 rounded-lg p-2.5 text-xs text-red-800">
          <IconBan size={15} className="shrink-0 mt-0.5" />
          <span>
            האימון נופל בתוך טווח חסום:{" "}
            {wouldViolateConstraints
              .map(
                (c) =>
                  `${c.type === "coach" ? "מאמן" : "אולם"} ${c.start}–${c.end}${
                    c.note ? ` (${c.note})` : ""
                  }`
              )
              .join(", ")}
            . אפשר לשמור בכל זאת.
          </span>
        </div>
      )}

      {canCopy && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-2.5 space-y-2">
          <div className="text-xs font-medium text-stone-700">אותו אימון גם ביום אחר באותו שבוע</div>
          {/* Saving first is required, and this is the reason rather than a technicality: the
              buttons below copy what is ON SCREEN. With an unsaved edit in the form, the copy
              would carry the new hours and the training on the board would keep the old ones —
              two trainings that look like one move and are not. */}
          {dirty ? (
            <p className="text-xs text-stone-600">
              יש שינוי שטרם נשמר. שמרו את האימון קודם, ואז אפשר להעתיק אותו ליום אחר.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {targetDays(day).map((d) => (
                  <button
                    key={d}
                    onClick={() => doCopy(d)}
                    aria-label={`העתק את האימון גם ליום ${d}`}
                    className="px-2.5 py-1 text-xs rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-brand-50 hover:border-brand-400"
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="text-xs text-stone-500">
                נוסף מיד כאימון נוסף. האימון הזה נשאר במקומו.
              </p>
            </>
          )}
          {/* The outcome is text and it is announced — a copy that was skipped as a duplicate
              looks exactly like one that was made, if nothing says otherwise. */}
          <p role="status" aria-live="polite" className="text-xs text-stone-700 min-h-[1rem]">
            {copyMsg}
          </p>
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50"
        >
          ביטול
        </button>
        <div className="flex gap-2">
          {onSaveAndAddNext && (
            <button
              disabled={!valid}
              onClick={() => onSaveAndAddNext(currentSession)}
              className="px-3 py-1.5 text-sm rounded-lg border border-brand-500 text-brand-600 hover:bg-brand-50 disabled:opacity-40 flex items-center gap-1.5"
            >
              <IconPlus size={15} /> שמור והוסף אימון נוסף לקבוצה זו
            </button>
          )}
          <button
            disabled={!valid}
            onClick={() => onSave(currentSession)}
            className="px-3 py-1.5 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:hover:bg-brand-600 flex items-center gap-1.5"
          >
            <IconCheck size={15} /> שמור אימון
          </button>
        </div>
      </div>
    </div>
  );
}
