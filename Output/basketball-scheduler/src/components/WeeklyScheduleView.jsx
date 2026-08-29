import { useState, useMemo, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { DAYS, SESSION_TYPES, DAY_BG_COLORS } from "../constants";
import { timeToMinutes, getWeekDates, formatDate, formatWeekRange, toISODate } from "../utils/dates";
import { colorFor, colorForTeamByCoach, sessionTypeColor } from "../utils/colors";
import { holidayNameOn } from "../utils/holidays";
import { findAbsenceHits, absenceLabel } from "../utils/availability";
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
import { GameTimeAdjuster } from "./GameTimeAdjuster";
import { syncGamesToSessions, defaultGameTimes } from "../utils/games";
import { AddToCalendarButton } from "./AddToCalendarButton";
import { FixedTeamsStrip } from "./FixedTeamsStrip";
import { fixedTeams } from "../utils/fixedTeams";
import { IconDownload, IconTrash, IconCheck, IconX } from "./ui/icons";
import clubLogo from "../assets/club-logo.jpg";

export function WeeklyScheduleView({ data, save, canEdit, weekStart, setWeekStart, myCoachId }) {
  const [filterDays, setFilterDays] = useState([...DAYS]);
  const [filterCoachIds, setFilterCoachIds] = useState([]); // empty = every coach
  // Rows folded away by hand, on top of whatever the coach filter is doing. Kept in
  // component state rather than saved anywhere: this is "not the row I need in front of me
  // right now", which is true for the next ten minutes and not for tomorrow. It survives
  // moving between weeks — the same board, a different week — and resets when the screen is
  // left, which is when the thought behind it has passed too.
  const [hiddenRows, setHiddenRows] = useState([]);
  const hideRow = (id) => setHiddenRows((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const showAllRows = () => setHiddenRows([]);
  // Hiding the basketball school is a decision about the club board, not a preference of
  // whoever happens to be looking — so it lives in the club document and every coach sees
  // the same board the manager sees. It began life in localStorage, which meant the manager
  // hid four rows and nobody else's screen changed.
  //
  // Only a manager can set it; the Firestore rules would refuse a coach anyway, and a
  // control that silently fails is worse than no control.
  const hideFixed = Boolean(data.hideFixedTeams);
  const toggleHideFixed = () => save({ ...data, hideFixedTeams: !hideFixed });
  const [title, setTitle] = useState("לוח אימונים שבועי");
  const [adjustingGame, setAdjustingGame] = useState(null); // an imported game whose hall slot is being nudged
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
  // The absence mark is not covered by the toggle above, and that is the point. A clash is
  // a scheduling note about the board; "מאמן X לא זמין" is a statement about a person's
  // week, and the exported board goes out to parents on WhatsApp. So it comes off every
  // capture and every print, whether or not the manager chose to keep the other marks.
  const [exporting, setExporting] = useState(false);
  const [editingSession, setEditingSession] = useState(null); // click a board cell to edit/move that session
  const [justPublished, setJustPublished] = useState(false);
  const [addingCell, setAddingCell] = useState(null); // click an empty cell → prefilled new-session initial
  const [shareBusy, setShareBusy] = useState(""); // "img" | "pdf" while producing that export
  const boardRef = useRef(null); // the team-mode <table> captured into the shared image/PDF
  const hallRef = useRef(null); // the hall report's card — same treatment, see shareBoard
  const [logoDataUrl, setLogoDataUrl] = useState(""); // inline logo so html2canvas paints it on mobile too

  // Inline the bundled logo once as a data URI (mobile browsers fail to paint a fetched <img>).
  useEffect(() => {
    let cancelled = false;
    loadImageDataUrl(clubLogo).then((url) => { if (!cancelled && url) setLogoDataUrl(url); });
    return () => { cancelled = true; };
  }, []);

  // Ctrl+P goes through the browser rather than our export buttons, so it needs the same
  // treatment. beforeprint fires before the page is snapshotted, and flushSync makes the
  // re-render land inside that window — a queued update would not.
  // No early return on `hideWarningMarks` any more: `exporting` has to flip even when the
  // manager has chosen to keep the warning marks in, because the absence mark comes off
  // regardless of that choice.
  useEffect(() => {
    const before = () => flushSync(() => {
      setExporting(true);
      if (hideWarningMarks) setSuppressWarnings(true);
    });
    const after = () => flushSync(() => {
      setExporting(false);
      if (hideWarningMarks) setSuppressWarnings(false);
    });
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
  // `node` and `heading` are passed in so the hall report can use the same path. It used to
  // have `window.print()` and nothing else — the very button the team board replaced,
  // because the browser print dialog forces portrait, mobile print engines drop the
  // repeated header row, and in an in-app browser it often does nothing at all.
  async function captureBoardCanvas(node, heading) {
    node.classList.add("capturing");
    // html2canvas renders the node's own box, so anything the node clips is clipped in the
    // image too. The team board is the <table> itself and its box always fits its content;
    // the hall report is a card with `overflow: hidden` around a table that is wider than
    // the card on a phone — measured 436px of table inside a 341px card, and the last two
    // columns simply were not in the picture. Widen the node to its content for the length
    // of the capture and put it back afterwards.
    const inner = node.querySelector("table");
    const full = Math.max(node.scrollWidth, inner ? inner.offsetWidth : 0);
    const prevWidth = node.style.width;
    const prevMaxWidth = node.style.maxWidth;
    const widened = full > node.clientWidth;
    if (widened) {
      node.style.width = `${full}px`;
      node.style.maxWidth = "none";
    }
    // flushSync, not a plain setState: html2canvas reads the DOM on the very next line, and
    // a normal React update would still be queued at that point — the markers would land in
    // the image anyway, intermittently, which is the worst kind of bug to chase.
    flushSync(() => {
      setExporting(true);
      if (hideWarningMarks) setSuppressWarnings(true);
    });
    try {
      return await renderNodeCanvas(node, {
        logoSrc: logoDataUrl || clubLogo,
        title: heading,
      });
    } finally {
      node.classList.remove("capturing"); // restore the interactive view immediately
      if (widened) {
        node.style.width = prevWidth;
        node.style.maxWidth = prevMaxWidth;
      }
      flushSync(() => {
        setExporting(false);
        if (hideWarningMarks) setSuppressWarnings(false);
      });
    }
  }

  // Export the board as a single landscape file for WhatsApp — sidesteps the browser print
  // dialog (which forced portrait) and mobile print engines (which don't repeat table headers).
  // kind: "img" → PNG, "pdf" → single-page PDF sized to the image (header on top, one long page).
  async function shareBoard(kind) {
    const hall = mode === "hall";
    const node = hall ? hallRef.current : boardRef.current;
    // Silence here is what a dead button looks like. If the node is missing the export
    // cannot run, and saying so beats a press that appears to do nothing.
    if (shareBusy) return;
    if (!node) {
      alert(hall ? "בחר אולם קודם." : "אין לוח להפקה.");
      return;
    }
    setShareBusy(kind);
    try {
      // Say so in the exported title when the board is filtered. The banner that warns
      // about it on screen sits outside the captured node, so without this a one-coach
      // board sent to the group would read as the whole week's schedule.
      const heading = hall
        ? `${title} · ${selectedHallName} · ${formatWeekRange(weekStart)}`
        : `${title} · ${formatWeekRange(weekStart)}` +
          (filterCoachIds.length
            ? ` · ${data.coaches.filter((c) => filterCoachIds.includes(c.id)).map((c) => c.name).join(" · ")} בלבד`
            : "") +
          // Same honesty as the coach filter: a board that is missing four rows should say
          // so on its face, or whoever receives it reads it as the whole week.
          (hideFixed && schoolTeams.length ? " · ללא בית הספר לכדורסל" : "") +
          (hiddenRowNames.length ? ` · ללא ${hiddenRowNames.join(" · ")}` : "");
      const canvas = await captureBoardCanvas(node, heading);
      const blob = kind === "pdf" ? await canvasToPdfBlob(canvas) : await canvasToPngBlob(canvas);
      const ext = kind === "pdf" ? "pdf" : "png";
      const name = hall ? `אולם-${selectedHallName}-${weekStart}.${ext}` : `לוז-שבועי-${weekStart}.${ext}`;
      await shareOrDownloadBlob(blob, name, heading);
    } catch (e) {
      alert("לא הצלחנו להפיק את הקובץ. נסה שוב.");
    } finally {
      setShareBusy("");
    }
  }

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
  // The basketball school is four rows of the same thing every week. When the board is
  // being read for the competitive teams — or sent out — they are noise, so they can be
  // folded away. A view filter only: nothing is deleted, and one press brings them back.
  const schoolTeams = useMemo(() => fixedTeams(data.teams), [data.teams]);
  const hiddenRowNames = data.teams.filter((t) => hiddenRows.includes(t.id)).map((t) => t.name);
  const visibleTeams = useMemo(() => {
    let list = data.teams;
    if (hideFixed) {
      const hidden = new Set(schoolTeams.map((t) => t.id));
      list = list.filter((t) => !hidden.has(t.id));
    }
    if (hiddenRows.length) list = list.filter((t) => !hiddenRows.includes(t.id));
    if (!filterCoachIds.length) return list;
    const ids = new Set([
      ...list.filter((t) => filterCoachIds.includes(t.coachId)).map((t) => t.id),
      ...weekSessions.filter((s) => filterCoachIds.includes(s.coachId)).map((s) => s.teamId),
    ]);
    return list.filter((t) => ids.has(t.id));
  }, [filterCoachIds, data.teams, weekSessions, hideFixed, schoolTeams, hiddenRows]);

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
  // Sessions whose coach is marked unavailable on that actual date → ⛔.
  //
  // Deliberately not folded into `violations`: a constraint says the slot is awkward, an
  // absence says nobody is coming. They are also dated differently — a constraint repeats
  // every week, this one lands on one square of the calendar — so the same Wednesday cell
  // is flagged this week and clean the next.
  const absenceHits = useMemo(
    () => findAbsenceHits(weekSessions, (s) => (weekDates[s.day] ? toISODate(weekDates[s.day]) : ""), data.absences || []),
    [weekSessions, weekStart, data.absences]
  );
  // The reason rides along only where a manager is already looking at an editable cell.
  // The hall report below is open to every coach, so it asks for the bare label.
  const absenceText = (id, withNote = false) =>
    (absenceHits[id] || []).map((a) => absenceLabel(a, withNote)).join(" · ");

  // Who is out this week, by day — independent of whether anything is scheduled yet, which
  // is the whole point: you mark someone out weeks ahead so you can see it while building
  // that week, and at that moment the week is still empty.
  //
  // One row per day rather than a badge per column: five names in a column header grow the
  // table's header row and squeeze the day it belongs to, and the same five on one
  // full-width line cost nothing. Honours the coach filter.
  const weekAbsences = useMemo(() => {
    const list = data.absences || [];
    if (!list.length) return [];
    return DAYS.filter((day) => filterDays.includes(day))
      .map((day) => {
        const date = weekDates[day];
        if (!date) return null;
        const iso = toISODate(date);
        const names = [
          ...new Set(
            list
              .filter((a) => a && a.date === iso)
              .filter((a) => !filterCoachIds.length || filterCoachIds.includes(a.coachId))
              .map((a) => nameOf(data.coaches, a.coachId))
          ),
        ].sort((x, y) => x.localeCompare(y, "he"));
        if (!names.length) return null;
        return {
          day,
          dateLabel: `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`,
          names: names.join(", "),
        };
      })
      .filter(Boolean);
  }, [data.absences, data.coaches, weekStart, filterDays, filterCoachIds]);

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
                {/* The board's own filters deliberately do NOT narrow this — a calendar with
                    a filter silently applied is a calendar that is quietly wrong. What does
                    narrow it is who is asking: a manager exports the club's week, a coach
                    exports their own. A coach pressing this wanted their trainings, not all
                    ninety of the club's. */}
                <AddToCalendarButton
                  sessions={myCoachId ? weekSessions.filter((s) => s.coachId === myCoachId) : weekSessions}
                  data={data}
                  label={myCoachId ? `${title} — האימונים שלי` : title}
                  calendarName={`${title} · ${formatWeekRange(weekStart)}`}
                  weekStart={weekStart}
                  title={myCoachId ? "האימונים שלך ליומן" : "כל אימוני השבוע ליומן"}
                />
              </>
            )}
            {/* Same two exports the team board has, for the same reason: an image goes
                everywhere, and the PDF is one landscape page with the header on top.
                `window.print()` used to be the only thing here. */}
            {mode === "hall" && (
              <>
                <button
                  onClick={() => shareBoard("img")}
                  disabled={!!shareBusy || !selectedHallId}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
                  title={selectedHallId ? "שמור/שתף את דוח האולם כתמונה — מומלץ לשליחה בווטאפ" : "בחר אולם קודם"}
                >
                  <IconDownload size={15} /> {shareBusy === "img" ? "מכין תמונה…" : "שיתוף / שמירת תמונה"}
                </button>
                <button
                  onClick={() => shareBoard("pdf")}
                  disabled={!!shareBusy || !selectedHallId}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-stone-300 text-stone-600 bg-white hover:bg-stone-50 disabled:opacity-40"
                  title={selectedHallId ? "שמור/שתף את דוח האולם כ-PDF — עמוד אחד עם הכותרת למעלה" : "בחר אולם קודם"}
                >
                  <IconDownload size={15} /> {shareBusy === "pdf" ? "מכין PDF…" : "שמירת PDF"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Only offered when there is something to hide — a control for a thing the club
            does not have is a control that has to be explained. */}
        {mode === "team" && schoolTeams.length > 0 && canEdit && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <button
              onClick={toggleHideFixed}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
                hideFixed
                  ? "bg-stone-200 text-stone-600 border-stone-300"
                  : "bg-brand-600 text-white border-brand-600"
              }`}
              title={hideFixed ? "החזר את שורות בית הספר ללוח" : "הסתר את שורות בית הספר מהלוח — אצלך ואצל המאמנים"}
            >
              🔁 {hideFixed ? "הצג בית ספר לכדורסל" : "הסתר בית ספר לכדורסל"}
              <span className={hideFixed ? "text-stone-500" : "text-brand-100"}>({schoolTeams.length})</span>
            </button>
            {hideFixed && (
              <span className="text-xs text-stone-500 self-center">
                {schoolTeams.length} שורות מוסתרות — <span className="font-medium text-stone-700">גם אצל המאמנים</span>,
                וגם בתמונה וב-PDF. שום דבר לא נמחק, ומאמני בית הספר עדיין רואים את האימונים שלהם ב"תצוגת מאמן".
              </span>
            )}
          </div>
        )}

        {/* A coach opening the board and not finding their team would reasonably think the
            week was never entered. Say it plainly instead. */}
        {mode === "team" && schoolTeams.length > 0 && !canEdit && hideFixed && (
          <p className="text-xs text-stone-500">
            שורות בית הספר לכדורסל מוסתרות בלוח הזה. האימונים שלך מופיעים כרגיל ב"תצוגת מאמן".
          </p>
        )}

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
        {/* Who is out this week — one line above the board, not inside it.
            Inside the day header it grew the whole table's header row with every extra
            name, and it announced people's days off to every coach who opened the board.
            Here it is a single wrapping line that no column has to make room for, and it
            is a manager's planning note: `canEdit` only. The ⛔ on a session cell stays as
            it was — that one says "this training has nobody", which is exactly what a
            coach needs to see. */}
        {/* Hidden rows are the one filter with no visible trace on the board itself — the
            row is simply gone — so the way back has to be stated, and it has to name what
            is missing. A count alone would leave you guessing which one you dropped. */}
        {hiddenRowNames.length > 0 && (
          <div className="text-xs rounded-lg border border-stone-300 bg-stone-50 text-stone-700 p-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold">
              {hiddenRowNames.length === 1 ? "שורה אחת מוסתרת" : `${hiddenRowNames.length} שורות מוסתרות`}:
            </span>
            <span className="text-stone-600">{hiddenRowNames.join(" · ")}</span>
            <button onClick={showAllRows} className="underline underline-offset-2 hover:text-stone-900 shrink-0">
              הצג הכל
            </button>
          </div>
        )}

        <FixedTeamsStrip data={data} save={save} canEdit={canEdit} weekStart={weekStart} />
        {canEdit && weekAbsences.length > 0 && (
          <div className="text-xs rounded-lg border border-red-200 bg-red-50 text-red-800 p-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-semibold shrink-0">⛔ לא זמינים השבוע:</span>
            {weekAbsences.map((d) => (
              <span key={d.day}>
                <span className="font-medium">{d.day} {d.dateLabel}</span>
                <span className="text-red-700"> — {d.names}</span>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-stone-600">לשליחה בווטאפ: "שיתוף / שמירת תמונה" (תמונה אחת לרוחב) או "שמירת PDF" (עמוד אחד לרוחב עם הכותרת למעלה). שניהם עובדים גם בנייד — בלי בעיות כיוון או כותרות שנעלמות בין עמודים.</p>
      </div>

      {/* TEAM MODE */}
      {mode === "team" && (
        <>
          <div className="print-only text-center mb-3">
            <img src={clubLogo} alt="" className="mx-auto h-16 object-contain mb-1" />
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
                            <span className="font-medium text-xs flex-1 min-w-0" style={{ color: rowColor }}>{team.name}</span>
                            {/* Drop one row from the view. The coach filter narrows to whole
                                people; this is for the row you simply do not need in front
                                of you right now. `no-print` because it is a control, and it
                                hides nothing that was not already hidden by the time the
                                board is captured. */}
                            <button
                              onClick={() => hideRow(team.id)}
                              className="no-print p-0.5 rounded text-stone-500 hover:text-stone-800 hover:bg-white/60 shrink-0"
                              aria-label={`הסתר את השורה של ${team.name}`}
                              title="הסתר שורה זו"
                            >
                              <IconX size={13} />
                            </button>
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
                                    // The coach is marked away on this date. Drawn in the clash red
                                    // rather than the constraint amber: a booking that breaks a
                                    // constraint still happens, this one has nobody to run it.
                                    const absent = !!absenceHits[s.id] && !suppressWarnings && !exporting;
                                    const alarm = clash || absent; // red treatment
                                    const cellStyle = {
                                      backgroundColor: alarm ? "#FEE2E2" : violates ? "#FEF3C7" : `${color}15`,
                                      borderRight: `3px solid ${alarm ? "#DC2626" : violates ? "#D97706" : color}`,
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
                                        {absent && (
                                          <div className="font-bold text-red-700 flex items-center gap-0.5">
                                            ⛔ {s.coachId ? `${nameOf(data.coaches, s.coachId)} ` : ""}לא זמין
                                          </div>
                                        )}
                                        {violates && <div className="font-bold text-amber-700 flex items-center gap-0.5">⚠ אילוץ {violationLabel(s.id)}</div>}
                                        <div className="font-semibold tabular-nums" style={{ color: alarm ? "#B91C1C" : violates ? "#B45309" : color }}><span dir="ltr">{s.start}–{s.end}</span></div>
                                        <div className={`mt-0.5 ${alarm ? "text-red-700 font-medium" : violates ? "text-amber-800 font-medium" : "text-stone-600"}`}>{nameOf(data.halls, s.hallId)}</div>
                                        {s.type && s.type !== "אימון" && <div className="font-medium mt-0.5" style={{ color }}>{s.type}</div>}
                                        {s.notes && <div className="text-stone-600 mt-0.5">{s.notes}</div>}
                                      </>
                                    );
                                    return editable ? (
                                      <button
                                        key={s.id}
                                        onClick={() => setEditingSession(s)}
                                        title={
                                          alarm
                                            ? [
                                                hallClash && "חפיפת אולם! שתי קבוצות באותו אולם באותו זמן",
                                                coachClash &&
                                                  `חפיפת מאמן! ${nameOf(data.coaches, s.coachId)} משובץ ליותר מקבוצה אחת באותו זמן`,
                                                absent && `${nameOf(data.coaches, s.coachId)}: ${absenceText(s.id, canEdit)}`,
                                              ]
                                                .filter(Boolean)
                                                .join(" · ") + " — לחץ לעריכה"
                                            : violates
                                            ? `אילוץ פעיל (${violationLabel(s.id)}) בזמן הזה — לחץ לעריכה`
                                            : "לחץ לעריכה / הזזת האימון"
                                        }
                                        className={`block w-full text-right rounded px-1.5 py-1 text-xs leading-tight cursor-pointer hover:ring-2 hover:ring-brand-400 ${alarm ? "ring-2 ring-red-500" : violates ? "ring-2 ring-amber-500" : ""}`}
                                        style={cellStyle}
                                      >
                                        {inner}
                                      </button>
                                    ) : canEdit && s.fromGame ? (
                                      // An imported game is not editable the way a training is — team,
                                      // opponent and tip-off all come from the federation. The one thing
                                      // that is ours is how much of the hall it takes, so that is the
                                      // only thing this opens.
                                      <button
                                        key={s.id}
                                        onClick={() => setAdjustingGame(s)}
                                        title="לחץ לשינוי הזמן שהמשחק תופס בלוח"
                                        className={`block w-full text-right rounded px-1.5 py-1 text-xs leading-tight cursor-pointer hover:ring-2 hover:ring-brand-400 ${alarm ? "ring-2 ring-red-500" : violates ? "ring-2 ring-amber-500" : ""}`}
                                        style={cellStyle}
                                      >
                                        {inner}
                                      </button>
                                    ) : (
                                      <div key={s.id} className={`rounded px-1.5 py-1 text-xs leading-tight ${alarm ? "ring-2 ring-red-500" : violates ? "ring-2 ring-amber-500" : ""}`} style={cellStyle}>
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
                            // The print-only twin two lines down already covers paper. Without
                            // `no-print` here a coach printing the board got the value TWICE in
                            // the cell; editors never saw it because their visible copy is the
                            // select, which does carry `no-print`.
                            <div className="no-print text-xs text-stone-700">{assignDisplay(assignment.playing, false)}</div>
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
                            <div className="no-print text-xs text-stone-700">{assignDisplay(assignment.secretary, false)}</div>
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
            <img src={clubLogo} alt="" className="mx-auto h-16 object-contain mb-1" />
            <div className="text-xl font-bold text-stone-800">{title} — אולם {selectedHallName}</div>
          </div>
          {!selectedHallId ? (
            <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-600 text-sm no-print">בחר אולם כדי להציג את הדוח.</div>
          ) : hallSessions.length === 0 ? (
            <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-600 text-sm">אין אימונים באולם זה בשבוע הנבחר.</div>
          ) : (
            <div ref={hallRef} className="bg-white rounded-xl border border-stone-200 overflow-hidden print-flow">
              {/* print-flow drops the rounding and the overflow clip when printing. A
                  container with `overflow: hidden` clips its content to the first printed
                  page — anything past it silently never comes out of the printer, which
                  is exactly what a busy hall's report runs into. */}
              <div className="px-4 py-2.5 bg-stone-700 text-white text-sm font-bold flex items-center justify-between">
                <span>אולם {selectedHallName}</span>
                {weekStart && (
                  <span className="text-stone-300 text-xs font-normal">
                    {formatDate(new Date(weekStart + "T00:00:00"))} — {formatDate(new Date(new Date(weekStart + "T00:00:00").setDate(new Date(weekStart + "T00:00:00").getDate() + 6)))}
                  </span>
                )}
              </div>
              {/* Same class as the board: repeats the header row on every printed page and
                  stops a session being split across a page break. The report never carried
                  it, so a hall with more sessions than fit on one page printed a headless
                  second page — if it printed at all. */}
              <table className="w-full border-collapse text-sm weekly-table">
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
                    const absent = !!absenceHits[s.id] && !suppressWarnings && !exporting; // the coach is away that date
                    const alarm = clash || absent;
                    // The day colour always wins the row background — it is what makes this
                    // report readable as bands of days. Warnings used to REPLACE it, which
                    // both broke a day into two colours and, worse, disguised the day: the
                    // constraint amber is a near-match for Sunday's yellow and the clash red
                    // for Friday's. A warning now shows as a stripe down the row's edge, so
                    // both signals are readable at once instead of competing.
                    const bg = DAY_BG_COLORS[dayIdx] || "#ffffff";
                    const stripe = alarm ? "#DC2626" : violates ? "#D97706" : "";
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
                        <td className={`border border-stone-200 px-3 py-2 text-sm ${absent ? "text-red-700 font-medium" : "text-stone-600"}`}>
                          {absent && <span title={absenceText(s.id)}>⛔ </span>}
                          {nameOf(data.coaches, s.coachId)}
                        </td>
                        <td className={`border border-stone-200 px-3 py-2 text-sm font-semibold tabular-nums ${alarm ? "text-red-700" : violates ? "text-amber-800" : "text-stone-700"}`}>
                          {clash && <span title="חפיפת אולם — שתי קבוצות באותו זמן">⚠ </span>}
                          {!alarm && violates && <span title={`אילוץ פעיל (${violationLabel(s.id)})`}>⚠ </span>}
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

      {adjustingGame && (() => {
        const game = (data.games || []).find((g) => String(g.federationCode) === String(adjustingGame.federationCode));
        // The session is drawn from the game, so a session without one is a leftover from
        // a game that has since been removed. Nothing to adjust, and nowhere to save it.
        if (!game) return null;
        return (
          <GameTimeAdjuster
            session={adjustingGame}
            game={game}
            teamName={nameOf(data.teams, adjustingGame.teamId)}
            dateLabel={game.date}
            defaultTimes={defaultGameTimes(game)}
            onClose={() => setAdjustingGame(null)}
            onSave={(times) => {
              const games = data.games.map((g) =>
                String(g.federationCode) === String(game.federationCode)
                  ? (() => {
                      const { timeOverride, ...rest } = g;
                      return times ? { ...rest, timeOverride: times } : rest;
                    })()
                  : g
              );
              // Rebuilt rather than patched in place: the session is a projection of the
              // games list, and letting the two drift is how they stop agreeing.
              save({ ...data, games, sessions: syncGamesToSessions(games, { ...data, games }) });
              setAdjustingGame(null);
            }}
          />
        );
      })()}
    </div>
  );
}
