import { useState, useMemo, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { DAYS, SESSION_TYPES, DAY_BG_COLORS } from "../constants";
import { timeToMinutes, getWeekDates, formatDate, formatWeekRange } from "../utils/dates";
import { colorFor, colorForTeamByCoach, sessionTypeColor } from "../utils/colors";
import { holidayNameOn } from "../utils/holidays";
import {
  findHallClashes,
  findCoachClashes,
  findConstraintViolations,
  parallelCoachIdSet,
} from "../utils/conflicts";
import { renderNodeCanvas, canvasToPngBlob, canvasToPdfBlob, shareOrDownloadBlob, loadImageDataUrl } from "../utils/imageExport";
import { Select } from "./ui/Select";
import { WeekNav } from "./ui/WeekNav";
import { SessionForm } from "./SessionForm";
import { IconDownload, IconTrash, IconCheck } from "./ui/icons";
import { clubLogoSrc } from "../utils/clubLogo";

export function WeeklyScheduleView({ data, save, publish, canEdit, weekStart, setWeekStart }) {
  const clubLogo = clubLogoSrc(data);
  const [filterDays, setFilterDays] = useState([...DAYS]);
  const [filterCoachIds, setFilterCoachIds] = useState([]); // empty = every coach
  const [title, setTitle] = useState("לוח אימונים שבועי");
  const [mode, setMode] = useState("team"); // "team" | "hall"
  const [selectedHallId, setSelectedHallId] = useState("");
  const [printTotals, setPrintTotals] = useState(false); // editors only; keep the totals column out of print by default
  // Warning marks — constraint violations AND hall/coach clashes — are a scheduling aid for
  // whoever builds the board, and they stay fully visible here. The printed copy goes to
  // coaches who do not use the app: they cannot act on a warning, so it reads to them as a
  // schedule nobody finished checking. The manager resolves or accepts each one on screen;
  // what leaves the building is the decision, not the working notes.
  const [hideWarningMarks, setHideWarningMarks] = useState(true);
  const [suppressWarnings, setSuppressWarnings] = useState(false); // on only while exporting/printing
  const [editingSession, setEditingSession] = useState(null); // click a board cell to edit/move that session
  const [justPublished, setJustPublished] = useState(false);
  const [addingCell, setAddingCell] = useState(null); // click an empty cell → prefilled new-session initial
  const [shareBusy, setShareBusy] = useState(""); // "img" | "pdf" while producing that export
  const boardRef = useRef(null); // the team-mode <table> captured into the shared image/PDF
  const [logoDataUrl, setLogoDataUrl] = useState(""); // inline logo so html2canvas paints it on mobile too

  // Inline the club logo as a data URI (mobile browsers fail to paint a fetched <img>).
  // Re-runs if the club swaps its logo; falls back to the URL when the fetch is blocked
  // (a Storage-hosted logo needs CORS configured on the bucket).
  useEffect(() => {
    let cancelled = false;
    setLogoDataUrl("");
    if (!clubLogo) return; // club has no logo of its own — export renders without one
    loadImageDataUrl(clubLogo).then((url) => { if (!cancelled && url) setLogoDataUrl(url); });
    return () => { cancelled = true; };
  }, [clubLogo]);

  // Ctrl+P goes through the browser rather than our export buttons, so it needs the same
  // treatment. beforeprint fires before the page is snapshotted, and flushSync makes the
  // re-render land inside that window — a queued update would not.
  useEffect(() => {
    if (!hideWarningMarks) return;
    const before = () => flushSync(() => setSuppressWarnings(true));
    const after = () => flushSync(() => setSuppressWarnings(false));
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [hideWarningMarks]);

  // Capture the whole board to a canvas with the logo + title composited on top. We flip the
  // table into its print-style read-only view during capture via the `capturing` class, so the
  // exported image is clean (no dropdowns/＋ buttons/totals; playing+secretary values shown).
  async function captureBoardCanvas() {
    const node = boardRef.current;
    node.classList.add("capturing");
    // flushSync, not a plain setState: html2canvas reads the DOM on the very next line, and
    // a normal React update would still be queued at that point — the markers would land in
    // the image anyway, intermittently, which is the worst kind of bug to chase.
    if (hideWarningMarks) flushSync(() => setSuppressWarnings(true));
    try {
      return await renderNodeCanvas(node, {
        logoSrc: logoDataUrl || clubLogo,
        // Say so in the exported title when the board is filtered. The banner that warns
        // about it on screen sits outside the captured node, so without this a one-coach
        // board sent to the group would read as the whole week's schedule.
        title:
          `${title} · ${formatWeekRange(weekStart)}` +
          (filterCoachIds.length
            ? ` · ${data.coaches.filter((c) => filterCoachIds.includes(c.id)).map((c) => c.name).join(" · ")} בלבד`
            : ""),
      });
    } finally {
      node.classList.remove("capturing"); // restore the interactive view immediately
      if (hideWarningMarks) flushSync(() => setSuppressWarnings(false));
    }
  }

  // Export the board as a single landscape file for WhatsApp — sidesteps the browser print
  // dialog (which forced portrait) and mobile print engines (which don't repeat table headers).
  // kind: "img" → PNG, "pdf" → single-page PDF sized to the image (header on top, one long page).
  async function shareBoard(kind) {
    if (!boardRef.current || shareBusy) return;
    setShareBusy(kind);
    try {
      const canvas = await captureBoardCanvas();
      const blob = kind === "pdf" ? await canvasToPdfBlob(canvas) : await canvasToPngBlob(canvas);
      const ext = kind === "pdf" ? "pdf" : "png";
      await shareOrDownloadBlob(blob, `לוז-שבועי-${weekStart}.${ext}`, title);
    } catch (e) {
      alert("לא הצלחנו להפיק את הקובץ. נסה שוב.");
    } finally {
      setShareBusy("");
    }
  }

  // Publishing does two things: stamps the week so coaches see the banner, and writes
  // the parent-facing projection (schedule only — no player or contact data).
  const publishSchedule = async () => {
    save({ ...data, schedulePublished: { weekOf: weekStart, at: new Date().toISOString() } });
    if (publish) await publish(weekStart);
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

  // With a coach selected the board narrows to that coach's own sessions, so the row for
  // a team they share with someone else shows only the slots they are actually in — which
  // is what makes a double booking visible at a glance.
  const cellSessions = (teamId, day) =>
    data.sessions
      .filter(
        (s) =>
          s.teamId === teamId &&
          s.day === day &&
          (s.weekOf || "") === weekStart &&
          (!filterCoachIds.length || filterCoachIds.includes(s.coachId))
      )
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

  const weekSessions = useMemo(
    () => data.sessions.filter((s) => (s.weekOf || "") === weekStart),
    [data.sessions, weekStart]
  );
  // Hard double-bookings: sessions sharing a hall at an overlapping time this week → bold red.
  const hallClashes = useMemo(() => findHallClashes(weekSessions), [weekSessions]);
  // The same coach booked in two places at once. Computed over the WHOLE week, never over
  // the filtered view — a clash must not disappear because the board is showing one coach.
  // Coaches marked as running groups in parallel are excluded — otherwise their board is
  // permanently red and the colour stops meaning anything.
  const parallelCoaches = useMemo(() => parallelCoachIdSet(data.coaches), [data.coaches]);
  const coachClashes = useMemo(
    () => findCoachClashes(weekSessions, parallelCoaches),
    [weekSessions, parallelCoaches]
  );

  // Rows to show. Filtering by coach keeps a team if the coach is its assigned coach OR
  // runs any of its sessions this week — a coach often covers a team that is not formally
  // theirs, and those are exactly the sessions that cause the overlap.
  const visibleTeams = useMemo(() => {
    if (!filterCoachIds.length) return data.teams;
    const ids = new Set([
      ...data.teams.filter((t) => filterCoachIds.includes(t.coachId)).map((t) => t.id),
      ...weekSessions.filter((s) => filterCoachIds.includes(s.coachId)).map((s) => s.teamId),
    ]);
    return data.teams.filter((t) => ids.has(t.id));
  }, [filterCoachIds, data.teams, weekSessions]);

  // How many of this coach's sessions collide, so the toolbar can say so out loud rather
  // than relying on the manager spotting red cells across a wide board.
  const filteredCoachClashCount = useMemo(() => {
    if (!filterCoachIds.length) return 0;
    return weekSessions.filter((s) => filterCoachIds.includes(s.coachId) && coachClashes.has(s.id))
      .length;
  }, [filterCoachIds, weekSessions, coachClashes]);

  const toggleCoach = (id) =>
    setFilterCoachIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  // Selected coaches in the order they appear in the club's list, not the order they were
  // clicked — so the same selection always reads the same way in the banner and the export.
  const selectedCoachNames = data.coaches
    .filter((c) => filterCoachIds.includes(c.id))
    .map((c) => c.name);
  // Sessions colliding with a coach/hall constraint → bold amber. { sessionId: [constraint,...] }
  const violations = useMemo(
    () => findConstraintViolations(weekSessions, data.constraints || []),
    [weekSessions, data.constraints]
  );
  // Which constraint kinds a session violates, as a Hebrew label ("מאמן", "אולם", "מאמן ואולם").
  const violationLabel = (id) => {
    const list = violations[id];
    if (!list || !list.length) return "";
    const types = new Set(list.map((c) => c.type));
    const parts = [];
    if (types.has("coach")) parts.push("מאמן");
    if (types.has("hall")) parts.push("אולם");
    return parts.join(" ו");
  };

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
              className="bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-48"
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
            {mode === "team" && (
              <>
                <button
                  onClick={() => shareBoard("img")}
                  disabled={!!shareBusy}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60"
                  title="שמור/שתף את הלוז כתמונה לרוחב — מומלץ לשליחה בווטאפ"
                >
                  <IconDownload size={15} /> {shareBusy === "img" ? "מכין תמונה…" : "שיתוף / שמירת תמונה"}
                </button>
                <button
                  onClick={() => shareBoard("pdf")}
                  disabled={!!shareBusy}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-stone-300 text-stone-600 bg-white hover:bg-stone-50 disabled:opacity-60"
                  title="שמור/שתף את הלוז כקובץ PDF — עמוד אחד לרוחב עם הכותרת למעלה (עובד גם בנייד)"
                >
                  <IconDownload size={15} /> {shareBusy === "pdf" ? "מכין PDF…" : "שמירת PDF"}
                </button>
              </>
            )}
            {mode === "hall" && (
              <button onClick={() => window.print()} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-stone-300 text-stone-600 bg-white hover:bg-stone-50">
                <IconDownload size={15} /> הדפסה / PDF
              </button>
            )}
          </div>
        </div>

        {mode === "team" && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-stone-500 self-center">ימים:</span>
            {DAYS.map((day) => (
              <button key={day} onClick={() => toggleDay(day)} className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${filterDays.includes(day) ? "bg-brand-600 text-white border-brand-600" : "bg-white text-stone-500 border-stone-300 hover:bg-stone-50"}`}>
                {day}
              </button>
            ))}
          </div>
        )}

        {/* Same chip idiom as the day filter above, which is what makes it obvious that
            several can be on at once — a dropdown would have implied "pick one". */}
        {mode === "team" && data.coaches.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-stone-500 self-center">מאמנים:</span>
            <button
              onClick={() => setFilterCoachIds([])}
              className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                filterCoachIds.length === 0
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-stone-500 border-stone-300 hover:bg-stone-50"
              }`}
            >
              כולם
            </button>
            {data.coaches.map((c) => (
              <button
                key={c.id}
                onClick={() => toggleCoach(c.id)}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                  filterCoachIds.includes(c.id)
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-stone-500 border-stone-300 hover:bg-stone-50"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        {canEdit && (
          <div className="flex flex-col gap-1.5">
            {mode === "team" && (
              <label className="flex items-center gap-1.5 text-xs text-stone-600 w-fit cursor-pointer">
                <input
                  type="checkbox"
                  checked={printTotals}
                  onChange={(e) => setPrintTotals(e.target.checked)}
                  className="accent-brand-600"
                />
                כלול את עמודת "סה״כ שבוע" גם בהדפסה
              </label>
            )}
            {/* Offered in both modes: the hall report is printed and handed out too. */}
            <label className="flex items-center gap-1.5 text-xs text-stone-600 w-fit cursor-pointer">
              <input
                type="checkbox"
                checked={hideWarningMarks}
                onChange={(e) => setHideWarningMarks(e.target.checked)}
                className="accent-brand-600"
              />
              דוח נקי בהדפסה ובתמונה
              <span className="text-stone-400">— בלי סימוני אילוץ וחפיפה</span>
            </label>
          </div>
        )}
        {/* Say plainly that the board is showing a slice. The export captures whatever is on
            screen, and a filtered board sent to the coaches would look like the full week. */}
        {mode === "team" && filterCoachIds.length > 0 && (
          <div
            className={`text-xs rounded-lg border p-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 ${
              filteredCoachClashCount
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            {/* Phrased without a pronoun on purpose — the app has no way to know a coach's
                gender, and Hebrew would force a guess. */}
            <span>
              מוצגים רק האימונים ששובצו ל<strong>{selectedCoachNames.join(" · ")}</strong>
              {visibleTeams.length ? ` — ${visibleTeams.length} קבוצות` : ""}.
            </span>
            <span className="font-semibold">
              {filteredCoachClashCount
                ? `⚠ ${filteredCoachClashCount} אימונים בחפיפה.`
                : "✓ אין חפיפות השבוע."}
            </span>
            <button onClick={() => setFilterCoachIds([])} className="underline underline-offset-2">
              הצג את כולם
            </button>
          </div>
        )}
        <p className="text-xs text-stone-600">לשליחה בווטאפ: "שיתוף / שמירת תמונה" (תמונה אחת לרוחב) או "שמירת PDF" (עמוד אחד לרוחב עם הכותרת למעלה). שניהם עובדים גם בנייד — בלי בעיות כיוון או כותרות שנעלמות בין עמודים.</p>
      </div>

      {/* TEAM MODE */}
      {mode === "team" && (
        <>
          <div className="print-only text-center mb-3">
            {clubLogo && <img src={clubLogo} alt="" className="mx-auto h-16 object-contain mb-1" />}
            <div className="text-xl font-bold text-stone-800">{title}</div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 overflow-auto weekly-table-wrap">
            {data.teams.length === 0 ? (
              <div className="p-8 text-center text-stone-600 text-sm">אין קבוצות רשומות עדיין.</div>
            ) : (
              <table ref={boardRef} className="w-full border-collapse text-sm weekly-table" style={{ minWidth: activeDays.length * 108 + 360 }}>
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
                    {canEdit && (
                      <th className={`border border-stone-200 bg-stone-100 px-2 py-2 text-center text-xs font-semibold text-stone-600 w-16 ${printTotals ? "" : "no-print"}`}>סה״כ שבוע</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleTeams.length === 0 && (
                    <tr>
                      <td
                        colSpan={1 + activeDays.length + 2 + (canEdit ? 1 : 0)}
                        className="border border-stone-200 px-3 py-6 text-center text-sm text-stone-500"
                      >
                        אין קבוצות ל{selectedCoachNames.join(" · ")} בשבוע הזה.
                      </td>
                    </tr>
                  )}
                  {visibleTeams.map((team) => {
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
                                      className="no-print w-full flex items-center justify-center py-1 text-stone-300 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
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
                                    // All three are suppressed together during export/print when
                                    // the manager has asked for it — one flag clears every tint,
                                    // ring, ⚠ line and coloured word, in the place they are decided.
                                    const hallClash = hallClashes.has(s.id) && !suppressWarnings; // two teams in one gym
                                    const coachClash = coachClashes.has(s.id) && !suppressWarnings; // one coach, two places
                                    const clash = hallClash || coachClash;
                                    const violates = !!violations[s.id] && !suppressWarnings;
                                    const cellStyle = {
                                      backgroundColor: clash ? "#FEE2E2" : violates ? "#FEF3C7" : `${color}15`,
                                      borderRight: `3px solid ${clash ? "#DC2626" : violates ? "#D97706" : color}`,
                                    };
                                    const inner = (
                                      <>
                                        {hallClash && <div className="font-bold text-red-700 flex items-center gap-0.5">⚠ חפיפת אולם</div>}
                                        {/* Name the coach: without the filter on, the row's own coach
                                            may not be the one taking this session. */}
                                        {coachClash && (
                                          <div className="font-bold text-red-700 flex items-center gap-0.5">
                                            ⚠ חפיפת מאמן{s.coachId ? ` — ${nameOf(data.coaches, s.coachId)}` : ""}
                                          </div>
                                        )}
                                        {violates && <div className="font-bold text-amber-700 flex items-center gap-0.5">⚠ אילוץ {violationLabel(s.id)}</div>}
                                        <div className="font-semibold tabular-nums" style={{ color: clash ? "#B91C1C" : violates ? "#B45309" : color }}><span dir="ltr">{s.start}–{s.end}</span></div>
                                        <div className={`mt-0.5 ${clash ? "text-red-700 font-medium" : violates ? "text-amber-800 font-medium" : "text-stone-600"}`}>{nameOf(data.halls, s.hallId)}</div>
                                        {s.type && s.type !== "אימון" && <div className="font-medium mt-0.5" style={{ color }}>{s.type}</div>}
                                        {s.notes && <div className="text-stone-600 mt-0.5">{s.notes}</div>}
                                      </>
                                    );
                                    return editable ? (
                                      <button
                                        key={s.id}
                                        onClick={() => setEditingSession(s)}
                                        title={
                                          clash
                                            ? [
                                                hallClash && "חפיפת אולם! שתי קבוצות באותו אולם באותו זמן",
                                                coachClash &&
                                                  `חפיפת מאמן! ${nameOf(data.coaches, s.coachId)} משובץ ליותר מקבוצה אחת באותו זמן`,
                                              ]
                                                .filter(Boolean)
                                                .join(" · ") + " — לחץ לעריכה"
                                            : violates
                                            ? `אילוץ פעיל (${violationLabel(s.id)}) בזמן הזה — לחץ לעריכה`
                                            : "לחץ לעריכה / הזזת האימון"
                                        }
                                        className={`block w-full text-right rounded px-1.5 py-1 text-xs leading-tight cursor-pointer hover:ring-2 hover:ring-brand-400 ${clash ? "ring-2 ring-red-500" : violates ? "ring-2 ring-amber-500" : ""}`}
                                        style={cellStyle}
                                      >
                                        {inner}
                                      </button>
                                    ) : (
                                      <div key={s.id} className={`rounded px-1.5 py-1 text-xs leading-tight ${clash ? "ring-2 ring-red-500" : violates ? "ring-2 ring-amber-500" : ""}`} style={cellStyle}>
                                        {inner}
                                      </div>
                                    );
                                  })}
                                  {canEdit && (
                                    <button
                                      onClick={() => setAddingCell({ teamId: team.id, coachId: team.coachId || "", day, weekOf: weekStart })}
                                      title="הוסף אימון נוסף"
                                      className="no-print w-full flex items-center justify-center py-0.5 text-[10px] text-stone-400 hover:text-brand-600 rounded"
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
                        {/* Weekly total — editors only; optionally excluded from print */}
                        {canEdit && (
                          <td className={`border border-stone-200 px-2 py-1.5 text-center bg-stone-50 ${printTotals ? "" : "no-print"}`}>
                            <span className="text-sm font-semibold tabular-nums text-stone-700">{teamWeekCount(team.id)}</span>
                          </td>
                        )}
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
          <div className="print-only text-center mb-2">
            {clubLogo && <img src={clubLogo} alt="" className="mx-auto h-16 object-contain mb-1" />}
            <div className="text-xl font-bold text-stone-800">{title} — אולם {selectedHallName}</div>
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
                    // Same suppression as the team board: the hall report is printed and handed
                    // out too, and a stripe means nothing to someone who cannot act on it.
                    const clash = hallClashes.has(s.id) && !suppressWarnings; // two teams here at once
                    const violates = !!violations[s.id] && !suppressWarnings; // collides with a constraint
                    // The day colour always wins the row background — it is what makes this
                    // report readable as bands of days. Warnings used to REPLACE it, which
                    // both broke a day into two colours and, worse, disguised the day: the
                    // constraint amber is a near-match for Sunday's yellow and the clash red
                    // for Friday's. A warning now shows as a stripe down the row's edge, so
                    // both signals are readable at once instead of competing.
                    const bg = DAY_BG_COLORS[dayIdx] || "#ffffff";
                    const stripe = clash ? "#DC2626" : violates ? "#D97706" : "";
                    const date = weekDates[s.day];
                    return (
                      <tr key={s.id || i} style={{ backgroundColor: bg }}>
                        {/* The stripe lives on the first and last cells rather than the row:
                            with border-collapse a <tr> cannot reliably paint its own border
                            or shadow, so a row-level rule would silently render nothing. */}
                        <td
                          className="border border-stone-200 px-3 py-2 text-sm tabular-nums font-medium text-stone-700"
                          style={stripe ? { borderInlineStartWidth: "4px", borderInlineStartColor: stripe } : undefined}
                        >
                          {date ? formatDate(date) : "—"}
                        </td>
                        <td className="border border-stone-200 px-3 py-2 text-sm text-stone-600">{s.day}</td>
                        <td className="border border-stone-200 px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorFor(s.teamId, data.teams.map((t) => t.id)) }} />
                            <span className="text-sm font-medium text-stone-700">{nameOf(data.teams, s.teamId)}</span>
                          </div>
                        </td>
                        <td className="border border-stone-200 px-3 py-2 text-sm text-stone-600">{nameOf(data.coaches, s.coachId)}</td>
                        <td className={`border border-stone-200 px-3 py-2 text-sm font-semibold tabular-nums ${clash ? "text-red-700" : violates ? "text-amber-800" : "text-stone-700"}`}>
                          {clash && <span title="חפיפת אולם — שתי קבוצות באותו זמן">⚠ </span>}
                          {!clash && violates && <span title={`אילוץ פעיל (${violationLabel(s.id)})`}>⚠ </span>}
                          <span dir="ltr">{s.start}–{s.end}</span>
                        </td>
                        <td
                          className="border border-stone-200 px-3 py-2 text-xs text-stone-500"
                          style={stripe ? { borderInlineEndWidth: "4px", borderInlineEndColor: stripe } : undefined}
                        >
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
