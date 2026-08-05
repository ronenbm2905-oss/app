import { useState, useMemo } from "react";
import { DAYS, SESSION_TYPES, DAY_BG_COLORS } from "../constants";
import { timeToMinutes, getWeekDates, formatDate } from "../utils/dates";
import { colorFor, colorForTeamByCoach, sessionTypeColor } from "../utils/colors";
import { holidayNameOn } from "../utils/holidays";
import { Select } from "./ui/Select";
import { WeekNav } from "./ui/WeekNav";
import { SessionForm } from "./SessionForm";
import { IconDownload, IconTrash, IconCheck } from "./ui/icons";

export function WeeklyScheduleView({ data, save, canEdit, weekStart, setWeekStart }) {
  const [filterDays, setFilterDays] = useState([...DAYS]);
  const [title, setTitle] = useState("לוח אימונים שבועי");
  const [mode, setMode] = useState("team"); // "team" | "hall"
  const [selectedHallId, setSelectedHallId] = useState("");
  const [editingSession, setEditingSession] = useState(null); // click a board cell to edit/move that session
  const [justPublished, setJustPublished] = useState(false);
  const [addingCell, setAddingCell] = useState(null); // click an empty cell → prefilled new-session initial

  // MVP "notification": stamp this week as published → every coach sees the banner live.
  const publishSchedule = () => {
    save({ ...data, schedulePublished: { weekOf: weekStart, at: new Date().toISOString() } });
    setJustPublished(true);
    setTimeout(() => setJustPublished(false), 2500);
  };

  // Add or edit straight from the board — append a new training or replace an edited one (same as ManagerView).
  const handleSaveSession = (session) => {
    const exists = data.sessions.some((s) => s.id === session.id);
    const nextSessions = exists
      ? data.sessions.map((s) => (s.id === session.id ? session : s))
      : [...data.sessions, session];
    save({ ...data, sessions: nextSessions });
    setEditingSession(null);
    setAddingCell(null);
  };
  const handleDeleteSession = (id) => {
    save({ ...data, sessions: data.sessions.filter((s) => s.id !== id) });
    setEditingSession(null);
  };

  // The modal shows either the clicked session (edit) or a prefilled draft (new). Kept as a stable
  // object (not recomputed each render) so SessionForm's initial-sync effect doesn't reset typing.
  const modalInitial = editingSession || addingCell;
  const closeModal = () => { setEditingSession(null); setAddingCell(null); };

  const nameOf = (list, id) => list.find((x) => x.id === id)?.name || "—";

  // Coach name of a team (empty string if none) — used for the "coach on its own line" display.
  const coachOfTeam = (teamId) => {
    const team = data.teams.find((t) => t.id === teamId);
    return team?.coachId ? nameOf(data.coaches, team.coachId) : "";
  };

  // Playing/secretary cell display: team name on top, coach name on the line below.
  const assignDisplay = (teamId, printMode) => {
    if (!teamId) return "—";
    const coach = coachOfTeam(teamId);
    return (
      <>
        <div>{nameOf(data.teams, teamId)}</div>
        {coach && (
          <div className={`text-[10px] ${printMode ? "text-stone-600" : "text-stone-500"}`}>{coach}</div>
        )}
      </>
    );
  };

  const toggleDay = (day) => {
    setFilterDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...DAYS.filter((d) => prev.includes(d) || d === day)]));
  };

  const activeDays = DAYS.filter((d) => filterDays.includes(d));
  const weekDates = getWeekDates(weekStart);

  const typeColor = (type) => sessionTypeColor(type);

  const cellSessions = (teamId, day) =>
    data.sessions
      .filter((s) => s.teamId === teamId && s.day === day && (s.weekOf || "") === weekStart)
      .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  const teamWeekCount = (teamId) =>
    activeDays.reduce((n, day) => n + cellSessions(teamId, day).length, 0);

  const hallSessions = useMemo(() => {
    if (!selectedHallId) return [];
    return data.sessions
      .filter((s) => s.hallId === selectedHallId && (s.weekOf || "") === weekStart)
      .sort((a, b) => {
        const di = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
        if (di !== 0) return di;
        return timeToMinutes(a.start) - timeToMinutes(b.start);
      });
  }, [selectedHallId, data.sessions, weekStart]);

  const selectedHallName = nameOf(data.halls, selectedHallId);

  return (
    <div className="space-y-4" dir="rtl">
      {/* Controls */}
      <div className="no-print space-y-3">
        <WeekNav value={weekStart} onChange={setWeekStart} />
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-48"
              placeholder="כותרת הלוח"
              dir="rtl"
            />
            <div className="flex gap-1 bg-stone-200/70 rounded-lg p-0.5">
              <button onClick={() => setMode("team")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${mode === "team" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}>
                לפי קבוצה
              </button>
              <button onClick={() => setMode("hall")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${mode === "hall" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}>
                דוח אולם
              </button>
            </div>
            {mode === "hall" && (
              <Select value={selectedHallId} onChange={setSelectedHallId} options={data.halls} placeholder="בחר אולם" className="w-40" />
            )}
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={publishSchedule}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-emerald-500 text-emerald-700 bg-white hover:bg-emerald-50"
                title="סמן שהלו״ז לשבוע זה מוכן — יופיע באנר לכל המאמנים"
              >
                <IconCheck size={15} /> {justPublished ? "פורסם ✓" : "פרסם לו״ז לשבוע"}
              </button>
            )}
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-orange-600 text-white hover:bg-orange-700">
              <IconDownload size={15} /> הדפסה / שמור PDF
            </button>
          </div>
        </div>

        {mode === "team" && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-stone-500 self-center">ימים:</span>
            {DAYS.map((day) => (
              <button key={day} onClick={() => toggleDay(day)} className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${filterDays.includes(day) ? "bg-orange-600 text-white border-orange-600" : "bg-white text-stone-500 border-stone-300 hover:bg-stone-50"}`}>
                {day}
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-stone-600">לחץ "הדפסה / שמור PDF" ובחלון ההדפסה בחר "שמור כ-PDF". מומלץ: כיוון דף לרוחב (Landscape).</p>
      </div>

      {/* TEAM MODE */}
      {mode === "team" && (
        <>
          <div className="print-only text-center mb-3 text-xl font-bold text-stone-800">{title}</div>
          <div className="bg-white rounded-xl border border-stone-200 overflow-auto weekly-table-wrap">
            {data.teams.length === 0 ? (
              <div className="p-8 text-center text-stone-600 text-sm">אין קבוצות רשומות עדיין.</div>
            ) : (
              <table className="w-full border-collapse text-sm weekly-table" style={{ minWidth: activeDays.length * 108 + 360 }}>
                <thead>
                  <tr>
                    <th className="border border-stone-200 bg-stone-50 px-3 py-2 text-right text-xs font-semibold text-stone-600 w-28">קבוצה</th>
                    {activeDays.map((day) => {
                      const holiday = holidayNameOn(data.holidays, weekDates[day]);
                      return (
                        <th key={day} className={`border border-stone-200 px-3 py-2 text-center text-xs font-semibold text-stone-600 ${holiday ? "bg-rose-50" : "bg-stone-50"}`}>
                          יום {day}
                          {weekDates[day] && <div className="font-normal text-stone-600">{formatDate(weekDates[day])}</div>}
                          {holiday && <div className="font-semibold text-rose-600 mt-0.5">🎉 {holiday}</div>}
                        </th>
                      );
                    })}
                    <th className="border border-stone-200 bg-blue-50 px-3 py-2 text-center text-xs font-semibold text-blue-700 w-32" style={{ borderInlineStartWidth: "3px", borderInlineStartColor: "#57534E" }}>קבוצה משחקת</th>
                    <th className="border border-stone-200 bg-purple-50 px-3 py-2 text-center text-xs font-semibold text-purple-700 w-32">קבוצה מזכירות</th>
                    <th className="border border-stone-200 bg-stone-100 px-2 py-2 text-center text-xs font-semibold text-stone-600 w-16">סה״כ שבוע</th>
                  </tr>
                </thead>
                <tbody>
                  {data.teams.map((team) => {
                    const assignKey = `${weekStart}__${team.id}`;
                    const assignment = (data.weeklyAssignments || {})[assignKey] || { playing: "", secretary: "" };
                    const rowColor = colorForTeamByCoach(team, data.teams);
                    return (
                      <tr key={team.id} style={{ backgroundColor: `${rowColor}12` }}>
                        <td className="border border-stone-200 px-3 py-2" style={{ backgroundColor: `${rowColor}20` }}>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: rowColor }} />
                            <span className="font-medium text-xs" style={{ color: rowColor }}>{team.name}</span>
                          </div>
                          {team.coachId && <div className="text-xs text-stone-500 mt-0.5 pr-4">{nameOf(data.coaches, team.coachId)}</div>}
                        </td>
                        {activeDays.map((day) => {
                          const sessions = cellSessions(team.id, day);
                          return (
                            <td key={day} className="border border-stone-200 px-2 py-1.5 align-top">
                              {sessions.length === 0 ? (
                                canEdit ? (
                                  <>
                                    <button
                                      onClick={() => setAddingCell({ teamId: team.id, coachId: team.coachId || "", day, weekOf: weekStart })}
                                      title="הוסף אימון"
                                      className="no-print w-full flex items-center justify-center py-1 text-stone-300 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                                    >
                                      <span className="text-base leading-none">＋</span>
                                    </button>
                                    <span className="print-only text-stone-200 text-xs">—</span>
                                  </>
                                ) : (
                                  <span className="text-stone-200 text-xs">—</span>
                                )
                              ) : (
                                <div className="space-y-1.5">
                                  {sessions.map((s) => {
                                    const color = typeColor(s.type || "אימון");
                                    const editable = canEdit && !s.fromGame;
                                    const inner = (
                                      <>
                                        <div className="font-semibold tabular-nums" style={{ color }}>{s.start}–{s.end}</div>
                                        <div className="text-stone-600 mt-0.5">{nameOf(data.halls, s.hallId)}</div>
                                        {s.type && s.type !== "אימון" && <div className="font-medium mt-0.5" style={{ color }}>{s.type}</div>}
                                        {s.notes && <div className="text-stone-600 mt-0.5">{s.notes}</div>}
                                      </>
                                    );
                                    return editable ? (
                                      <button
                                        key={s.id}
                                        onClick={() => setEditingSession(s)}
                                        title="לחץ לעריכה / הזזת האימון"
                                        className="block w-full text-right rounded px-1.5 py-1 text-xs leading-tight cursor-pointer hover:ring-2 hover:ring-orange-400"
                                        style={{ backgroundColor: `${color}15`, borderRight: `3px solid ${color}` }}
                                      >
                                        {inner}
                                      </button>
                                    ) : (
                                      <div key={s.id} className="rounded px-1.5 py-1 text-xs leading-tight" style={{ backgroundColor: `${color}15`, borderRight: `3px solid ${color}` }}>
                                        {inner}
                                      </div>
                                    );
                                  })}
                                  {canEdit && (
                                    <button
                                      onClick={() => setAddingCell({ teamId: team.id, coachId: team.coachId || "", day, weekOf: weekStart })}
                                      title="הוסף אימון נוסף"
                                      className="no-print w-full flex items-center justify-center py-0.5 text-[10px] text-stone-400 hover:text-orange-600 rounded"
                                    >
                                      ＋ הוסף
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                        {/* Playing team column */}
                        <td className="border border-stone-200 px-2 py-1.5 align-top bg-blue-50/30" style={{ borderInlineStartWidth: "3px", borderInlineStartColor: "#57534E" }}>
                          {canEdit ? (
                            <select
                              value={assignment.playing}
                              onChange={(e) => {
                                const next = { ...(data.weeklyAssignments || {}), [assignKey]: { ...assignment, playing: e.target.value } };
                                save({ ...data, weeklyAssignments: next });
                              }}
                              className="no-print w-full text-xs bg-transparent border border-stone-200 rounded px-1 py-1 focus:outline-none focus:border-blue-400"
                              dir="rtl"
                            >
                              <option value="">—</option>
                              {data.teams.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="text-xs text-stone-700">{assignDisplay(assignment.playing, false)}</div>
                          )}
                          {canEdit && assignment.playing && coachOfTeam(assignment.playing) && (
                            <div className="no-print text-[10px] text-stone-500 mt-0.5 truncate">{coachOfTeam(assignment.playing)}</div>
                          )}
                          <div className="print-only text-xs text-stone-700">{assignDisplay(assignment.playing, true)}</div>
                        </td>
                        {/* Secretary team column */}
                        <td className="border border-stone-200 px-2 py-1.5 align-top bg-purple-50/30">
                          {canEdit ? (
                            <select
                              value={assignment.secretary}
                              onChange={(e) => {
                                const next = { ...(data.weeklyAssignments || {}), [assignKey]: { ...assignment, secretary: e.target.value } };
                                save({ ...data, weeklyAssignments: next });
                              }}
                              className="no-print w-full text-xs bg-transparent border border-stone-200 rounded px-1 py-1 focus:outline-none focus:border-purple-400"
                              dir="rtl"
                            >
                              <option value="">—</option>
                              {data.teams.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="text-xs text-stone-700">{assignDisplay(assignment.secretary, false)}</div>
                          )}
                          {canEdit && assignment.secretary && coachOfTeam(assignment.secretary) && (
                            <div className="no-print text-[10px] text-stone-500 mt-0.5 truncate">{coachOfTeam(assignment.secretary)}</div>
                          )}
                          <div className="print-only text-xs text-stone-700">{assignDisplay(assignment.secretary, true)}</div>
                        </td>
                        {/* Weekly total */}
                        <td className="border border-stone-200 px-2 py-1.5 text-center bg-stone-50">
                          <span className="text-sm font-semibold tabular-nums text-stone-700">{teamWeekCount(team.id)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="no-print flex flex-wrap gap-3 text-xs text-stone-500">
            {SESSION_TYPES.map((t) => (
              <span key={t.id} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: t.color }} />
                {t.name}
              </span>
            ))}
          </div>
        </>
      )}

      {/* HALL MODE */}
      {mode === "hall" && (
        <>
          <div className="print-only text-center mb-2 text-xl font-bold text-stone-800">
            {title} — אולם {selectedHallName}
          </div>
          {!selectedHallId ? (
            <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-600 text-sm no-print">בחר אולם כדי להציג את הדוח.</div>
          ) : hallSessions.length === 0 ? (
            <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-600 text-sm">אין אימונים באולם זה בשבוע הנבחר.</div>
          ) : (
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-stone-700 text-white text-sm font-bold flex items-center justify-between">
                <span>אולם {selectedHallName}</span>
                {weekStart && (
                  <span className="text-stone-300 text-xs font-normal">
                    {formatDate(new Date(weekStart + "T00:00:00"))} — {formatDate(new Date(new Date(weekStart + "T00:00:00").setDate(new Date(weekStart + "T00:00:00").getDate() + 6)))}
                  </span>
                )}
              </div>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-stone-50">
                    <th className="border border-stone-200 px-3 py-2 text-right text-xs font-semibold text-stone-600">תאריך</th>
                    <th className="border border-stone-200 px-3 py-2 text-right text-xs font-semibold text-stone-600">יום</th>
                    <th className="border border-stone-200 px-3 py-2 text-right text-xs font-semibold text-stone-600">קבוצה</th>
                    <th className="border border-stone-200 px-3 py-2 text-right text-xs font-semibold text-stone-600">מאמן</th>
                    <th className="border border-stone-200 px-3 py-2 text-right text-xs font-semibold text-stone-600">שעות</th>
                    <th className="border border-stone-200 px-3 py-2 text-right text-xs font-semibold text-stone-600">סוג / הערות</th>
                  </tr>
                </thead>
                <tbody>
                  {hallSessions.map((s, i) => {
                    const dayIdx = DAYS.indexOf(s.day);
                    const bg = DAY_BG_COLORS[dayIdx] || "#ffffff";
                    const date = weekDates[s.day];
                    return (
                      <tr key={s.id || i} style={{ backgroundColor: bg }}>
                        <td className="border border-stone-200 px-3 py-2 text-sm tabular-nums font-medium text-stone-700">{date ? formatDate(date) : "—"}</td>
                        <td className="border border-stone-200 px-3 py-2 text-sm text-stone-600">{s.day}</td>
                        <td className="border border-stone-200 px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorFor(s.teamId, data.teams.map((t) => t.id)) }} />
                            <span className="text-sm font-medium text-stone-700">{nameOf(data.teams, s.teamId)}</span>
                          </div>
                        </td>
                        <td className="border border-stone-200 px-3 py-2 text-sm text-stone-600">{nameOf(data.coaches, s.coachId)}</td>
                        <td className="border border-stone-200 px-3 py-2 text-sm font-semibold tabular-nums text-stone-700">{s.start}–{s.end}</td>
                        <td className="border border-stone-200 px-3 py-2 text-xs text-stone-500">
                          {s.type && s.type !== "אימון" && <span className="font-medium" style={{ color: typeColor(s.type) }}>{s.type} </span>}
                          {s.notes || ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Board modal — click a training cell to edit/move it, or an empty cell to add one, without leaving this view */}
      {modalInitial && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4 no-print"
          dir="rtl"
          onClick={closeModal}
        >
          <div className="w-full max-w-lg my-8" onClick={(e) => e.stopPropagation()}>
            <div className="bg-stone-50 rounded-t-xl border border-stone-300 border-b-0 px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-800">{editingSession ? "עריכת אימון" : "אימון חדש"}</h3>
              {editingSession && (
                <button
                  onClick={() => handleDeleteSession(editingSession.id)}
                  className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                >
                  <IconTrash size={14} /> מחק אימון
                </button>
              )}
            </div>
            <SessionForm
              data={data}
              initial={modalInitial}
              weekStart={weekStart}
              onSave={handleSaveSession}
              onCancel={closeModal}
            />
          </div>
        </div>
      )}
    </div>
  );
}
