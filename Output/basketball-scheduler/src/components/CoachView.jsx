import { useState } from "react";
import { DAYS } from "../constants";
import { timeToMinutes } from "../utils/dates";
import { colorFor, sessionTypeColor } from "../utils/colors";
import { sessionViolatesConstraints } from "../utils/conflicts";
import { Select } from "./ui/Select";
import { Pill } from "./ui/Pill";
import { IconUsers, IconCalendar, IconMapPin, IconBan } from "./ui/icons";

export function CoachView({ data, fixedCoachId }) {
  const [coachId, setCoachId] = useState(fixedCoachId || "");
  const [day, setDay] = useState("");

  const myFor = (d) =>
    data.sessions
      .filter((s) => s.coachId === coachId && (!d || s.day === d))
      .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || timeToMinutes(a.start) - timeToMinutes(b.start));

  const hallActivityFor = (d) =>
    data.halls.map((hall) => ({
      hall,
      sessions: data.sessions
        .filter((s) => s.hallId === hall.id && (!d || s.day === d))
        .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || timeToMinutes(a.start) - timeToMinutes(b.start)),
    }));

  const nameOf = (list, id) => list.find((x) => x.id === id)?.name || "—";

  if (!coachId) {
    return (
      <div className="space-y-4" dir="rtl">
        <div className="bg-white rounded-xl border border-stone-200 p-6 text-center space-y-3">
          <IconUsers size={28} className="mx-auto text-stone-400" />
          <p className="text-stone-600 text-sm">בחר את שמך כדי לראות את לוח האימונים שלך</p>
          <Select value={coachId} onChange={setCoachId} options={data.coaches} placeholder="בחר מאמן" className="max-w-xs mx-auto" />
        </div>
      </div>
    );
  }

  const myName = nameOf(data.coaches, coachId);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-stone-800">שלום, {myName}</h2>
          <p className="text-xs text-stone-500">להלן האימונים שלך, ולצידם כל הפעילות באולמות באותם זמנים</p>
        </div>
        {!fixedCoachId && (
          <button onClick={() => setCoachId("")} className="text-xs text-stone-500 underline hover:text-stone-700">
            החלף מאמן
          </button>
        )}
      </div>

      <Select value={day} onChange={setDay} options={DAYS.map((d) => ({ id: d, name: d }))} placeholder="כל הימים" className="max-w-xs" />

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
                    <p className="text-xs text-stone-400">אין לך אימון ביום זה.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {mySessions.map((s) => {
                        const violated = sessionViolatesConstraints(s, data.constraints || []);
                        return (
                          <div
                            key={s.id}
                            className={`flex flex-col gap-1 border rounded-lg px-3 py-2 ${
                              violated.length > 0 ? "bg-red-50 border-red-200" : "bg-orange-50 border-orange-200"
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-orange-800 tabular-nums w-24 shrink-0">
                                {s.start}–{s.end}
                              </span>
                              <Pill color={colorFor(s.teamId, data.teams.map((t) => t.id))}>{nameOf(data.teams, s.teamId)}</Pill>
                              {s.type && s.type !== "אימון" && <Pill color={sessionTypeColor(s.type)}>{s.type}</Pill>}
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
                          <p className="text-xs text-stone-400">אין אימונים</p>
                        ) : (
                          <div className="space-y-1">
                            {sessions.map((s) => (
                              <div key={s.id} className="text-xs flex items-center gap-1.5">
                                <span className="tabular-nums text-stone-500 w-20 shrink-0">
                                  {s.start}–{s.end}
                                </span>
                                <Pill color={colorFor(s.teamId, data.teams.map((t) => t.id))}>{nameOf(data.teams, s.teamId)}</Pill>
                                <span className="text-stone-400">{nameOf(data.coaches, s.coachId)}</span>
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
  );
}
