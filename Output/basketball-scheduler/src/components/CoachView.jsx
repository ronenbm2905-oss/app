import { useState, useRef, useEffect } from "react";
import { DAYS } from "../constants";
import { timeToMinutes, getWeekDates, formatDate, formatWeekRange, toISODate } from "../utils/dates";
import { colorFor, sessionTypeColor } from "../utils/colors";
import { sessionViolatesConstraints } from "../utils/conflicts";
import { absencesOn, absenceLabel, absenceCoversSession, hallClosuresOn } from "../utils/availability";
import { secretaryDutiesFor, secretaryLabel, secretaryWhen, shortDate } from "../utils/secretary";
import { driverLine } from "../utils/transport";
import { Select } from "./ui/Select";
import { AddToCalendarButton } from "./AddToCalendarButton";
import { TrainingPlanForm } from "./TrainingPlanForm";
import { Pill } from "./ui/Pill";
import { WeekNav } from "./ui/WeekNav";
import { IconUsers, IconCalendar, IconMapPin, IconBan, IconDownload } from "./ui/icons";
import { captureNode, shareOrDownloadBlob, loadImageDataUrl } from "../utils/imageExport";
import clubLogo from "../assets/club-logo.jpg";

const CLUB_NAME = "קרית אונו – דור העתיד";

export function CoachView({ data, fixedCoachId, canEdit, weekStart, setWeekStart, plans, savePlan, authorName, authorEmail }) {
  const [coachId, setCoachId] = useState(fixedCoachId || "");
  const [day, setDay] = useState("");
  const [teamId, setTeamId] = useState(""); // team filter / report scope
  const [reportBusy, setReportBusy] = useState(false);
  const reportRef = useRef(null); // off-screen node captured into the shareable image
  const [logoDataUrl, setLogoDataUrl] = useState(""); // inline the logo so html2canvas renders it on mobile too

  // Convert the bundled logo to a data URI once. As an inline image it needs no fetch at capture
  // time, which is what mobile browsers were failing to paint into the html2canvas snapshot.
  useEffect(() => {
    let cancelled = false;
    loadImageDataUrl(clubLogo).then((url) => { if (!cancelled && url) setLogoDataUrl(url); });
    return () => { cancelled = true; };
  }, []);

  const inWeek = (s) => (s.weekOf || "") === weekStart;

  const myFor = (d) =>
    data.sessions
      .filter(
        (s) =>
          s.coachId === coachId &&
          inWeek(s) &&
          (!d || s.day === d) &&
          (!teamId || s.teamId === teamId)
      )
      .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || timeToMinutes(a.start) - timeToMinutes(b.start));

  const hallActivityFor = (d) =>
    data.halls.map((hall) => ({
      hall,
      sessions: data.sessions
        .filter((s) => s.hallId === hall.id && inWeek(s) && (!d || s.day === d))
        .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || timeToMinutes(a.start) - timeToMinutes(b.start)),
    }));

  const nameOf = (list, id) => list.find((x) => x.id === id)?.name || "—";

  // Is this screen the viewer's own board? A coach whose sign-in address the club has
  // filled in gets `fixedCoachId` and cannot switch away from it; a manager sees everyone.
  // Anyone else — a viewer with no coach record — can pick any coach from the list, so they
  // get the schedule and none of the personal detail attached to it.
  const isOwnBoard = canEdit || (Boolean(fixedCoachId) && coachId === fixedCoachId);

  // The driver of the bus to an away game, for the coach travelling on it.
  //
  // The games tab already carries this, but that tab is the club's whole fixture list — not
  // the screen anyone opens on the morning of a match. This is: it is the coach's own week.
  // The number is shown on the same rule as everywhere else — own board only.
  const driverForSession = (s) => {
    if (!s || !s.fromGame) return "";
    const game = (data.games || []).find((g) => String(g.federationCode) === String(s.federationCode));
    return driverLine(game, isOwnBoard);
  };

  if (!coachId) {
    return (
      <div className="space-y-4" dir="rtl">
        <div className="bg-white rounded-xl border border-stone-200 p-6 text-center space-y-3">
          <IconUsers size={28} className="mx-auto text-stone-600" />
          <p className="text-stone-600 text-sm">בחר את שמך כדי לראות את לוח האימונים שלך</p>
          <Select value={coachId} onChange={setCoachId} options={data.coaches} placeholder="בחר מאמן" className="max-w-xs mx-auto" />
        </div>
      </div>
    );
  }

  const myName = nameOf(data.coaches, coachId);

  // Teams this coach is responsible for: formally assigned (team.coachId) + any team they have sessions with.
  const coachTeamIds = [
    ...new Set([
      ...data.teams.filter((t) => t.coachId === coachId).map((t) => t.id),
      ...data.sessions.filter((s) => s.coachId === coachId).map((s) => s.teamId),
    ]),
  ].filter(Boolean);
  const coachTeams = data.teams.filter((t) => coachTeamIds.includes(t.id));

  // The team the weekly PDF report is about. With a single team it's implicit; with 2+ the coach picks.
  const reportTeamId = teamId || (coachTeams.length === 1 ? coachTeams[0].id : "");
  const reportTeamName = nameOf(data.teams, reportTeamId);

  const weekDates = getWeekDates(weekStart);
  const reportSessions = data.sessions
    .filter((s) => s.teamId === reportTeamId && inWeek(s))
    .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || timeToMinutes(a.start) - timeToMinutes(b.start));

  // Scorer's-table duty at another team's home game.
  //
  // Two scopes on purpose. The REPORT is about one team, so its rows follow `reportTeamId`.
  // The BANNER is about the coach's week — and a coach with two teams who has not picked
  // one has no `reportTeamId` at all, so scoping the banner the same way would have hidden
  // the duty from exactly the coach most likely to be double-booked.
  const reportDuties = secretaryDutiesFor(data, reportTeamId, weekStart);
  const screenDuties = (teamId ? [teamId] : coachTeamIds).flatMap((id) =>
    secretaryDutiesFor(data, id, weekStart).map((d) => ({ ...d, forTeamId: id, forTeamName: nameOf(data.teams, id) }))
  );

  // The report's rows are the trainings AND the duties, interleaved by day — a duty on
  // Monday belongs between Sunday's training and Tuesday's, not in a footnote. Duties with
  // no fixture on record have no day, so they fall to the end.
  const reportRows = [
    ...reportSessions.map((s) => ({
      key: s.id,
      duty: false,
      day: s.day,
      dayIdx: DAYS.indexOf(s.day),
      sortTime: timeToMinutes(s.start || "00:00"),
      date: formatDate(weekDates[s.day]),
      time: `${s.start}–${s.end}`,
      where: nameOf(data.halls, s.hallId),
      what: [s.type && s.type !== "אימון" ? s.type : "", s.notes || ""].filter(Boolean).join(" · ") || "אימון",
    })),
    ...reportDuties.map((d, i) => ({
      key: `duty-${d.gameKey || i}`,
      duty: true,
      day: d.day,
      dayIdx: d.day ? DAYS.indexOf(d.day) : 99,
      sortTime: d.time ? timeToMinutes(d.time) : 9999,
      // Same format as the training rows above. Two date formats in one small table is the
      // kind of thing that makes a sheet look assembled rather than written.
      date: d.day && weekDates[d.day] ? formatDate(weekDates[d.day]) : d.date ? shortDate(d.date) : "",
      time: d.time || "",
      where: d.venue || "",
      what: secretaryLabel(d),
    })),
  ].sort((a, b) => a.dayIdx - b.dayIdx || a.sortTime - b.sortTime);

  // Produce the weekly report as a PNG image and hand it to the OS share sheet
  // (mobile → WhatsApp) or, when sharing files isn't supported (desktop), download it.
  // window.print() was unreliable on iPhone / in-app browsers — an image shares everywhere.
  async function shareOrDownloadReport() {
    if (!reportRef.current || !reportTeamId || reportBusy) return;
    setReportBusy(true);
    try {
      const fileName = `לוח-אימונים-${reportTeamName}-${weekStart}.png`;
      const blob = await captureNode(reportRef.current, { logoSrc: logoDataUrl || clubLogo });
      await shareOrDownloadBlob(blob, fileName, `לוח אימונים — ${reportTeamName}`);
    } catch (e) {
      alert("לא הצלחנו להפיק את הדוח. נסה שוב, או הפק אותו מהמחשב.");
    } finally {
      setReportBusy(false);
    }
  }

  return (
    <div dir="rtl">
      {/* ---------- On-screen (hidden when printing) ---------- */}
      <div className="no-print space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold text-stone-800">שלום, {myName}</h2>
            <p className="text-xs text-stone-500">להלן האימונים שלך, ולצידם כל הפעילות באולמות באותם זמנים</p>
          </div>
          {!fixedCoachId && (
            <button onClick={() => { setCoachId(""); setTeamId(""); }} className="text-xs text-stone-500 underline hover:text-stone-700">
              החלף מאמן
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <WeekNav value={weekStart} onChange={setWeekStart} />
          {coachTeams.length > 1 && (
            <Select
              value={teamId}
              onChange={setTeamId}
              options={coachTeams}
              placeholder="כל הקבוצות שלי"
              className="max-w-xs"
            />
          )}
          <Select value={day} onChange={setDay} options={DAYS.map((d) => ({ id: d, name: d }))} placeholder="כל הימים" className="max-w-xs" />
          {/* The coach's own week, not the club's — whatever the filters above are
              showing is what goes into their calendar. */}
          <AddToCalendarButton
            sessions={DAYS.flatMap((d) => myFor(d))}
            data={data}
            label={`אימונים — ${myName}`}
            weekStart={weekStart}
          />
        </div>

        {/* Player-facing weekly PDF report */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-emerald-900">
            <span className="font-semibold">דוח אימונים לקבוצה (תמונה)</span>
            <span className="text-emerald-700"> — לשליחה לשחקנים בוואטסאפ. {reportTeamId ? `${reportTeamName} · ${formatWeekRange(weekStart)}` : "בחר קבוצה כדי להפיק דוח."}</span>
          </div>
          {/* Gated on the ROWS, not on the trainings. A team with no training this week but
              a table duty on Thursday still has something to send — and the old condition
              disabled the button on exactly that week. */}
          <button
            onClick={shareOrDownloadReport}
            disabled={!reportTeamId || reportRows.length === 0 || reportBusy}
            className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600"
            title={!reportTeamId ? "בחר קבוצה" : reportRows.length === 0 ? "אין אימונים או מזכירות לקבוצה זו בשבוע הנבחר" : "שיתוף / הורדת דוח"}
          >
            <IconDownload size={15} /> {reportBusy ? "מכין דוח..." : "שיתוף / הורדת דוח"}
          </button>
        </div>

        {/* A banner rather than a mark inside the day's card: the duty often falls on a day
            with no training of yours, and that day's card is not rendered at all — so the
            mark would vanish in exactly the case it matters most. */}
        {screenDuties.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 space-y-1">
            <div className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
              🪑 מזכירות השבוע
            </div>
            {screenDuties.map((d, i) => (
              <div key={`${d.forTeamId}-${d.gameKey || i}`} className="text-sm text-amber-800 flex flex-wrap items-center gap-x-2">
                {/* Named only when the coach has more than one team — otherwise it is obvious. */}
                {coachTeams.length > 1 && <span className="font-semibold">{d.forTeamName}:</span>}
                <span className="font-medium">{secretaryWhen(d) || "השבוע"}</span>
                <span>· משחק של {d.hostTeamName || "קבוצה אחרת"}</span>
                {d.venue && <span className="text-amber-700">· {d.venue}</span>}
              </div>
            ))}
            {screenDuties.some((d) => !d.date) && (
              <p className="text-xs text-amber-700">
                המשחק עדיין לא בלוח, אז אין שעה. השעה תופיע לבד כשהוא ייובא.
              </p>
            )}
          </div>
        )}

        <div className="space-y-5">
          {DAYS.filter((d) => !day || d === day).map((d) => {
            const mySessions = myFor(d);
            if (mySessions.length === 0 && day !== d) return null;
            const hallRows = hallActivityFor(d);
            // Days the manager has marked this coach as unavailable. Read-only here — the
            // coach is a viewer — but shown on their own board, because a day marked in the
            // office that the coach never sees is a day everyone still expects them at.
            const dayIso = weekDates[d] ? toISODate(weekDates[d]) : "";
            const dayAbsences = absencesOn(data.absences, coachId, dayIso);
            // A hall taken for the evening empties this coach's training exactly as his own
            // absence does, and he is the one who would otherwise drive to a locked door.
            // Matched per session rather than per day: the club has several halls and only
            // the one his training stands in is his problem.
            const dayClosures = hallClosuresOn(data.absences, dayIso);
            const closuresFor = (s) =>
              dayClosures.filter((a) => a.hallId === s.hallId && absenceCoversSession(a, s));
            const myClosures = [
              ...new Map(mySessions.flatMap(closuresFor).map((a) => [a.id, a])).values(),
            ];
            const anyActivity = mySessions.length > 0 || dayAbsences.length > 0 || hallRows.some((h) => h.sessions.length > 0);
            if (!anyActivity) return null;

            return (
              <div key={d} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                <div className={`px-4 py-2 border-b flex items-center gap-2 flex-wrap ${dayAbsences.length ? "bg-rose-50 border-rose-200" : "bg-stone-50 border-stone-200"}`}>
                  <IconCalendar size={14} className={dayAbsences.length ? "text-rose-500" : "text-stone-500"} />
                  <h3 className="text-sm font-semibold text-stone-700">יום {d}</h3>
                  {/* The reason only when you are looking at your OWN board. This screen lets
                      a viewer pick any coach from the list, so without the guard one coach's
                      "מילואים" would be readable by every other coach in the club. Seeing your
                      own is the point — it is how you find out something was written about you
                      and can ask for it to be fixed. */}
                  {dayAbsences.map((a) => (
                    <span key={a.id} className="text-xs font-medium text-rose-700">
                      ⛔ {absenceLabel(a, canEdit || (Boolean(fixedCoachId) && coachId === fixedCoachId))}
                    </span>
                  ))}
                  {/* No such guard here: a closure is a fact about a building, so the reason
                      rides along for everyone — see the note on `absenceLabel`. */}
                  {myClosures.map((a) => (
                    <span key={a.id} className="text-xs font-medium text-amber-800">
                      🏟 {nameOf(data.halls, a.hallId)} — {absenceLabel(a)}
                    </span>
                  ))}
                </div>

                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-xs font-medium text-stone-500 mb-1.5">האימונים שלך</p>
                    {mySessions.length === 0 ? (
                      <p className="text-xs text-stone-600">אין לך אימון ביום זה.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {mySessions.map((s) => {
                          const violated = sessionViolatesConstraints(s, data.constraints || []);
                          const away =
                            dayAbsences.some((a) => absenceCoversSession(a, s)) || closuresFor(s).length > 0;
                          return (
                            <div
                              key={s.id}
                              className={`flex flex-col gap-1 border rounded-lg px-3 py-2 ${
                                away || violated.length > 0 ? "bg-red-50 border-red-200" : "bg-brand-50 border-brand-200"
                              }`}
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-brand-800 tabular-nums w-24 shrink-0">
                                  <span dir="ltr">{s.start}–{s.end}</span>
                                </span>
                                <Pill color={colorFor(s.teamId, data.teams.map((t) => t.id))}>{nameOf(data.teams, s.teamId)}</Pill>
                                {s.type && s.type !== "אימון" && <Pill color={sessionTypeColor(s.type)}>{s.type}</Pill>}
                                <span className="text-sm text-stone-600 flex items-center gap-1">
                                  <IconMapPin size={12} /> {nameOf(data.halls, s.hallId)}
                                </span>
                                {away && (
                                  <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                                    <IconBan size={12} /> סומנת כלא זמין
                                  </span>
                                )}
                                {violated.length > 0 && (
                                  <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                                    <IconBan size={12} /> מתנגש עם אילוץ
                                  </span>
                                )}
                              </div>
                              {s.notes && <div className="text-xs text-stone-500 pr-1">{s.notes}</div>}
                              {/* On the away game itself, where a coach looks on the morning
                                  of the match — not buried in the club's full fixture list. */}
                              {(() => {
                                const driver = driverForSession(s);
                                return driver ? (
                                  <div className="text-xs font-medium text-stone-700 pr-1">🚌 נהג: {driver}</div>
                                ) : null;
                              })()}
                              {/* The paper form the club already uses, filled here instead. It sits
                                  on the training it belongs to, so nothing is looked up twice. */}
                              <TrainingPlanForm
                                session={s}
                                teamName={nameOf(data.teams, s.teamId)}
                                hallName={nameOf(data.halls, s.hallId)}
                                dateLabel={formatDate(weekDates[s.day])}
                                plans={plans}
                                savePlan={savePlan}
                                authorName={authorName}
                                authorEmail={authorEmail}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-medium text-stone-500 mb-1.5">פעילות באולמות</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {hallRows.map(({ hall, sessions }) => (
                        <div key={hall.id} className="border border-stone-200 rounded-lg p-2.5">
                          <p className="text-xs font-semibold text-stone-600 flex items-center gap-1 mb-1.5">
                            <IconMapPin size={12} /> {hall.name}
                          </p>
                          {sessions.length === 0 ? (
                            <p className="text-xs text-stone-600">אין אימונים</p>
                          ) : (
                            <div className="space-y-1">
                              {sessions.map((s) => (
                                <div key={s.id} className="text-xs flex items-center gap-1.5">
                                  <span className="tabular-nums text-stone-500 w-20 shrink-0">
                                    <span dir="ltr">{s.start}–{s.end}</span>
                                  </span>
                                  <Pill color={colorFor(s.teamId, data.teams.map((t) => t.id))}>{nameOf(data.teams, s.teamId)}</Pill>
                                  <span className="text-stone-600">{nameOf(data.coaches, s.coachId)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- Off-screen capture target: rendered (not display:none) so html2canvas can
           snapshot it into a shareable PNG, but positioned off-screen so it never shows on screen. ---------- */}
      <div
        ref={reportRef}
        dir="rtl"
        aria-hidden="true"
        style={{ position: "fixed", top: 0, left: "-10000px", width: "720px", background: "#fff", padding: "24px" }}
      >
        <div style={{ textAlign: "center", marginBottom: "10px" }}>
          <div style={{ fontSize: "13px", color: "#57534E" }}>{CLUB_NAME}</div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "4px 0" }}>לוח אימונים שבועי — {reportTeamName}</h1>
          <div style={{ fontSize: "14px", color: "#57534E" }}>{formatWeekRange(weekStart)}</div>
        </div>
        {reportRows.length === 0 ? (
          <p style={{ textAlign: "center" }}>אין אימונים לקבוצה זו בשבוע הנבחר.</p>
        ) : (
          <table style={{ width: "100%", maxWidth: "700px", margin: "0 auto", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#F5F5F4" }}>
                <th style={{ border: "1px solid #D6D3D1", padding: "6px 8px", textAlign: "right" }}>יום</th>
                <th style={{ border: "1px solid #D6D3D1", padding: "6px 8px", textAlign: "center" }}>תאריך</th>
                <th style={{ border: "1px solid #D6D3D1", padding: "6px 8px", textAlign: "center" }}>שעה</th>
                <th style={{ border: "1px solid #D6D3D1", padding: "6px 8px", textAlign: "right" }}>אולם</th>
                <th style={{ border: "1px solid #D6D3D1", padding: "6px 8px", textAlign: "right" }}>פרטים</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map((r) => {
                // A duty is not a training, and the sheet a parent reads should not need a
                // second look to tell them apart.
                const cell = {
                  border: "1px solid #D6D3D1",
                  padding: "6px 8px",
                  background: r.duty ? "#FEF3C7" : "transparent",
                  color: r.duty ? "#92400E" : "inherit",
                };
                return (
                  <tr key={r.key}>
                    <td style={{ ...cell, textAlign: "right", fontWeight: 600 }}>{r.day || "—"}</td>
                    <td style={{ ...cell, textAlign: "center" }}>{r.date || "—"}</td>
                    <td style={{ ...cell, textAlign: "center" }}>
                      {r.time ? <span dir="ltr">{r.time}</span> : "—"}
                    </td>
                    <td style={{ ...cell, textAlign: "right" }}>{r.where || "—"}</td>
                    <td style={{ ...cell, textAlign: "right", fontWeight: r.duty ? 700 : 400 }}>
                      {r.duty ? `🪑 ${r.what}` : r.what}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
