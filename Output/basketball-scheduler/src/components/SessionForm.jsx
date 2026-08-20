import { useState, useEffect, useMemo, useRef } from "react";
import { DAYS, DEFAULT_SESSION_TYPE } from "../constants";
import { timeToMinutes, overlaps } from "../utils/dates";
import { colorFor } from "../utils/colors";
import { sessionTypeOptions } from "../utils/sessionTypes";
import { sessionViolatesConstraints } from "../utils/conflicts";
import { Select } from "./ui/Select";
import { Pill } from "./ui/Pill";
import { IconAlert, IconBan, IconPlus, IconCheck } from "./ui/icons";
import { uid } from "../utils/dates";

export function SessionForm({ data, initial, onSave, onCancel, onSaveAndAddNext, weekStart }) {
  const weekOf = initial?.weekOf || weekStart;
  const [teamId, setTeamId] = useState(initial?.teamId || "");
  const [coachId, setCoachId] = useState(initial?.coachId || "");
  const [hallId, setHallId] = useState(initial?.hallId || "");
  const [day, setDay] = useState(initial?.day || DAYS[0]);
  const [start, setStart] = useState(initial?.start || "16:00");
  const [end, setEnd] = useState(initial?.end || "17:00");
  const [type, setType] = useState(initial?.type || DEFAULT_SESSION_TYPE);
  const [notes, setNotes] = useState(initial?.notes || "");
  const sessionIdRef = useRef(initial?.id || uid());

  // Includes the session's current type even if the club has since deleted it, so
  // opening an old session and saving it cannot silently retype it.
  const typeOptions = sessionTypeOptions(data, initial?.type);

  useEffect(() => {
    sessionIdRef.current = initial?.id || uid();
    setTeamId(initial?.teamId || "");
    setCoachId(initial?.coachId || "");
    setHallId(initial?.hallId || "");
    setDay(initial?.day || DAYS[0]);
    setStart(initial?.start || "16:00");
    setEnd(initial?.end || "17:00");
    setType(initial?.type || DEFAULT_SESSION_TYPE);
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
          <Select value={type} onChange={setType} options={typeOptions} placeholder="בחר סוג" />
        </div>
        <div>
          {/* The label carries the warning because this field is published verbatim to
              every parent in the portal (utils/publish.js), and nothing here used to say
              so. A note like "חוזרת מפציעה" is medical information about an identified
              minor — the one category the law treats as specially sensitive — and it was
              being written by a coach who reasonably believed it was an internal remark. */}
          <label className="text-xs text-stone-500 mb-1 block">
            הערות (אופציונלי) — <span className="text-amber-700 font-medium">מוצג להורים בפורטל</span>
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="לדוגמה: משחק נגד הפועל, להביא חולצה כהה"
            aria-describedby="notes-visibility"
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            dir="rtl"
          />
          <span id="notes-visibility" className="text-[11px] text-stone-500 mt-1 block">
            כשהלו״ז מפורסם, ההערה נראית לכל הורה בקבוצה. אל תכתבו כאן מידע רפואי או אישי על
            שחקן/ית.
          </span>
        </div>
      </div>

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
