import { useState, useRef, useEffect } from "react";
import { DAYS, DEFAULT_SESSION_TYPE } from "../constants";
import { timeToMinutes, getWeekDates, formatDate, formatWeekRange } from "../utils/dates";
import { colorFor } from "../utils/colors";
import { clubSessionTypes, sessionTypeColor } from "../utils/sessionTypes";
import { sessionViolatesConstraints } from "../utils/conflicts";
import { Select } from "./ui/Select";
import { Pill } from "./ui/Pill";
import { WeekNav } from "./ui/WeekNav";
import { IconUsers, IconCalendar, IconMapPin, IconBan, IconDownload } from "./ui/icons";
import { captureNode, shareOrDownloadBlob, loadImageDataUrl } from "../utils/imageExport";
import { clubName as clubNameOf } from "../utils/club";
import { clubLogoSrc } from "../utils/clubLogo";

export function CoachView({ data, fixedCoachId, weekStart, setWeekStart }) {
  const sessionTypes = clubSessionTypes(data);
  const [coachId, setCoachId] = useState(fixedCoachId || "");
  const [day, setDay] = useState("");
  const [teamId, setTeamId] = useState(""); // team filter / report scope
  const [reportBusy, setReportBusy] = useState(false);
  const reportRef = useRef(null); // off-screen node captured into the shareable image
  const [logoDataUrl, setLogoDataUrl] = useState(""); // inline the logo so html2canvas renders it on mobile too

  const CLUB_NAME = clubNameOf(data);
  const clubLogo = clubLogoSrc(data);

  // Convert the club logo to a data URI. As an inline image it needs no fetch at capture
  // time, which is what mobile browsers were failing to paint into the html2canvas snapshot.
  // A club-uploaded logo lives on another origin (Storage), so this also depends on CORS
  // being configured there; loadImageDataUrl resolves empty on failure and we fall back to
  // the URL, which at worst means the exported image has no logo rather than no image.
  useEffect(() => {
    let cancelled = false;
    setLogoDataUrl("");
    if (!clubLogo) return; // club has no logo of its own — export renders without one
    loadImageDataUrl(clubLogo).then((url) => { if (!cancelled && url) setLogoDataUrl(url); });
    return () => { cancelled = true; };
  }, [clubLogo]);

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
        </div>

        {/* Player-facing weekly PDF report */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-emerald-900">
            <span className="font-semibold">דוח אימונים לקבוצה (תמונה)</span>
            <span className="text-emerald-700"> — לשליחה לשחקנים בוואטסאפ. {reportTeamId ? `${reportTeamName} · ${formatWeekRange(weekStart)}` : "בחר קבוצה כדי להפיק דוח."}</span>
          </div>
          <button
            onClick={shareOrDownloadReport}
            disabled={!reportTeamId || reportSessions.length === 0 || reportBusy}
            className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600"
            title={!reportTeamId ? "בחר קבוצה" : reportSessions.length === 0 ? "אין אימונים לקבוצה זו בשבוע הנבחר" : "שיתוף / הורדת דוח"}
          >
            <IconDownload size={15} /> {reportBusy ? "מכין דוח..." : "שיתוף / הורדת דוח"}
          </button>
        </div>

        <div className="space-y-5">
          {DAYS.filter((d) => !day || d === day).map((d) => {
            const mySessions = myFor(d);
            if (mySessions.length === 0 && day !== d) return null;
            const hallRows = hallActivityFor(d);
            const anyActivity = mySessions.length > 0 || hallRows.some((h) => h.sessions.length > 0);
            if (!anyActivity) return null;

            return (
              <div key={d} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                <div className="bg-stone-50 px-4 py-2 border-b border-stone-200 flex items-center gap-2">
                  <IconCalendar size={14} className="text-stone-500" />
                  <h3 className="text-sm font-semibold text-stone-700">יום {d}</h3>
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
                          return (
                            <div
                              key={s.id}
                              className={`flex flex-col gap-1 border rounded-lg px-3 py-2 ${
                                violated.length > 0 ? "bg-red-50 border-red-200" : "bg-brand-50 border-brand-200"
                              }`}
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-brand-800 tabular-nums w-24 shrink-0">
                                  <span dir="ltr">{s.start}–{s.end}</span>
                                </span>
                                <Pill color={colorFor(s.teamId, data.teams.map((t) => t.id))}>{nameOf(data.teams, s.teamId)}</Pill>
                                {s.type && s.type !== DEFAULT_SESSION_TYPE && <Pill color={sessionTypeColor(s.type, sessionTypes)}>{s.type}</Pill>}
                                <span className="text-sm text-stone-600 flex items-center gap-1">
                                  <IconMapPin size={12} /> {nameOf(data.halls, s.hallId)}
                                </span>
                                {violated.length > 0 && (
                                  <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                                    <IconBan size={12} /> מתנגש עם אילוץ
                                  </span>
                                )}
                              </div>
                              {s.notes && <div className="text-xs text-stone-500 pr-1">{s.notes}</div>}
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
        {reportSessions.length === 0 ? (
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
              {reportSessions.map((s) => (
                <tr key={s.id}>
                  <td style={{ border: "1px solid #D6D3D1", padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>{s.day}</td>
                  <td style={{ border: "1px solid #D6D3D1", padding: "6px 8px", textAlign: "center" }}>{formatDate(weekDates[s.day])}</td>
                  <td style={{ border: "1px solid #D6D3D1", padding: "6px 8px", textAlign: "center" }}><span dir="ltr">{s.start}–{s.end}</span></td>
                  <td style={{ border: "1px solid #D6D3D1", padding: "6px 8px", textAlign: "right" }}>{nameOf(data.halls, s.hallId)}</td>
                  <td style={{ border: "1px solid #D6D3D1", padding: "6px 8px", textAlign: "right" }}>
                    {[s.type && s.type !== DEFAULT_SESSION_TYPE ? s.type : "", s.notes || ""].filter(Boolean).join(" · ") || DEFAULT_SESSION_TYPE}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
