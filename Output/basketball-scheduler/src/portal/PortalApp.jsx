import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { usePublishedWeek } from "../hooks/usePublishedWeek";
import { todayWeekStart, shiftWeek, formatWeekRange } from "../utils/dates";
import { formatHolidayRange } from "../utils/holidays";
// The portal is served a session's type NAME but not the club's palette, so a club-
// specific type shows in the neutral colour. See utils/sessionTypes.
import { sessionTypeColor } from "../utils/sessionTypes";
import { applyTheme } from "../utils/theme";
import { DEFAULT_SETTINGS } from "../constants";
import { PortalJoin, loadMembership, clearMembership } from "./PortalJoin";
import { LegalFooter } from "../legal/LegalFooter";

// Parent / player portal: the training schedule for one team, and nothing else.
// It reads only the published projection (see utils/publish.js) — never the club
// document that holds players' personal details.

function Chevron({ dir }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d={dir === "next" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SessionRow({ s }) {
  return (
    <li className="flex items-start gap-3 py-3 border-b border-stone-100 last:border-0">
      <div className="shrink-0 text-center w-16">
        <div className="text-lg font-bold text-stone-900 leading-tight">{s.start}</div>
        {s.end && <div className="text-xs text-stone-500">עד {s.end}</div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-semibold px-2 py-0.5 rounded"
            style={{ backgroundColor: `${sessionTypeColor(s.type)}1A`, color: sessionTypeColor(s.type) }}
          >
            {s.type || "אימון"}
          </span>
          {s.hallName && <span className="text-sm text-stone-700">{s.hallName}</span>}
        </div>
        {s.notes && <p className="text-xs text-stone-600 mt-1 break-words">{s.notes}</p>}
      </div>
    </li>
  );
}

function GameRow({ g }) {
  return (
    <li className="flex items-start gap-3 py-3 border-b border-stone-100 last:border-0">
      <div className="shrink-0 text-center w-16">
        <div className="text-lg font-bold text-stone-900 leading-tight">{g.time}</div>
        <div className="text-xs text-stone-500">{g.date}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${g.isHome ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"}`}>
            {g.isHome ? "משחק בית" : "משחק חוץ"}
          </span>
          <span className="text-sm font-medium text-stone-900">מול {g.opponent || "יריבה"}</span>
        </div>
        {g.venue && <p className="text-xs text-stone-600 mt-1 break-words">📍 {g.venue}</p>}
      </div>
    </li>
  );
}

export default function PortalApp() {
  const { clubSlug } = useParams();
  const clubId = String(clubSlug || "").toLowerCase();

  const [membership, setMembership] = useState(() => loadMembership(clubId));
  const [weekStart, setWeekStart] = useState(todayWeekStart());
  const { week, loading, error } = usePublishedWeek(clubId, weekStart);

  // The portal is branded like the club, but it cannot read the club's settings (that
  // document is closed to parents). The published week carries the name; colours fall
  // back to the defaults until a public branding document exists.
  useEffect(() => {
    applyTheme(DEFAULT_SETTINGS);
    if (week?.clubName) document.title = `${week.clubName} — לו״ז`;
  }, [week?.clubName]);

  if (!membership) {
    return <PortalJoin clubId={clubId} onJoined={setMembership} />;
  }

  const team = week?.teams?.[membership.teamId] || null;
  const isThisWeek = weekStart === todayWeekStart();

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col" dir="rtl">
      <div className="h-1.5 bg-brand-600 flex" aria-hidden="true">
        <span className="h-full w-24 bg-accent-500" />
      </div>

      <div className="max-w-lg w-full mx-auto px-4 py-5 flex-1">
        <header className="mb-4">
          <p className="text-xs text-stone-500">{week?.clubName || ""}</p>
          <h1 className="text-2xl font-bold text-brand-700 tracking-tight">
            {membership.teamName || team?.name || "הקבוצה שלי"}
          </h1>
          {team?.coachName && <p className="text-sm text-stone-600 mt-0.5">מאמן: {team.coachName}</p>}
        </header>

        <div className="flex items-center justify-between gap-2 bg-white rounded-xl border border-stone-200 p-2 mb-4">
          <button
            onClick={() => setWeekStart((w) => shiftWeek(w, -1))}
            aria-label="שבוע קודם"
            className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-stone-600 hover:bg-stone-100"
          >
            <Chevron dir="prev" />
          </button>
          <div className="text-center">
            <div className="text-sm font-semibold text-stone-800">{formatWeekRange(weekStart)}</div>
            {!isThisWeek && (
              <button onClick={() => setWeekStart(todayWeekStart())} className="text-xs text-brand-600 underline underline-offset-2">
                חזרה לשבוע הנוכחי
              </button>
            )}
          </div>
          <button
            onClick={() => setWeekStart((w) => shiftWeek(w, 1))}
            aria-label="שבוע הבא"
            className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-stone-600 hover:bg-stone-100"
          >
            <Chevron dir="next" />
          </button>
        </div>

        {error && <div className="mb-4 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">{error}</div>}

        {loading ? (
          <p className="text-center text-stone-500 text-sm py-10">טוען...</p>
        ) : !week ? (
          <div className="bg-white rounded-xl border border-stone-200 p-8 text-center">
            <p className="text-stone-700 font-medium">הלו״ז לשבוע הזה טרם פורסם</p>
            <p className="text-sm text-stone-500 mt-1">המאמן מפרסם את הלו״ז בדרך כלל לקראת תחילת השבוע.</p>
          </div>
        ) : !team ? (
          <div className="bg-white rounded-xl border border-stone-200 p-8 text-center">
            <p className="text-stone-700 font-medium">הקבוצה לא נמצאה בלו״ז של השבוע</p>
            <p className="text-sm text-stone-500 mt-1">ייתכן שהקבוצה שונתה. בקש מהמאמן קוד הצטרפות מעודכן.</p>
          </div>
        ) : (
          <>
            {week.holidays?.length > 0 && (
              <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3">
                <p className="text-sm font-semibold text-rose-800 mb-1">🎉 ימים מיוחדים השבוע</p>
                <ul className="text-sm text-rose-900 space-y-0.5">
                  {week.holidays.map((h, i) => (
                    <li key={i}>{h.name} · <span className="text-xs">{formatHolidayRange(h)}</span></li>
                  ))}
                </ul>
              </div>
            )}

            <section className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-4">
              <h2 className="bg-stone-50 px-4 py-2.5 border-b border-stone-200 text-stone-700 font-semibold text-sm">אימונים</h2>
              <div className="px-4">
                {team.sessions?.length ? (
                  <ul>{team.sessions.map((s, i) => <SessionRow key={i} s={s} />)}</ul>
                ) : (
                  <p className="text-sm text-stone-500 py-6 text-center">אין אימונים בשבוע הזה.</p>
                )}
              </div>
            </section>

            {team.games?.length > 0 && (
              <section className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-4">
                <h2 className="bg-stone-50 px-4 py-2.5 border-b border-stone-200 text-stone-700 font-semibold text-sm">משחקים</h2>
                <div className="px-4">
                  <ul>{team.games.map((g, i) => <GameRow key={i} g={g} />)}</ul>
                </div>
              </section>
            )}
          </>
        )}

        <div className="text-center mt-6">
          <button
            onClick={() => { clearMembership(clubId); setMembership(null); }}
            className="text-xs text-stone-500 underline underline-offset-2 hover:text-stone-700"
          >
            החלפת קבוצה
          </button>
        </div>

        <LegalFooter className="mt-8 pt-6 border-t border-stone-200" />
      </div>
    </div>
  );
}
