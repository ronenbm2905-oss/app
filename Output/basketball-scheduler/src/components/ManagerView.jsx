import { useState, useMemo, useRef } from "react";
import { DAYS } from "../constants";
import { timeToMinutes } from "../utils/dates";
import { uid } from "../utils/dates";
import { colorFor, sessionTypeColor } from "../utils/colors";
import { findConflicts, findConstraintViolations } from "../utils/conflicts";
import { parseCSV, buildCsvTemplate, importCsvToData } from "../utils/csv";
import { Select } from "./ui/Select";
import { Pill } from "./ui/Pill";
import { SessionForm } from "./SessionForm";
import {
  IconUpload, IconPlus, IconTrash, IconAlert, IconX, IconDownload,
  IconMapPin, IconPencil, IconShield, IconBan,
} from "./ui/icons";

export function ManagerView({ data, save, canEdit }) {
  const [editingId, setEditingId] = useState(null);
  const [filterDay, setFilterDay] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterHall, setFilterHall] = useState("");
  const [filterCoach, setFilterCoach] = useState("");
  const fileInputRef = useRef(null);
  const [importMsg, setImportMsg] = useState(null);

  const conflicts = useMemo(() => findConflicts(data.sessions), [data.sessions]);
  const violations = useMemo(
    () => findConstraintViolations(data.sessions, data.constraints || []),
    [data.sessions, data.constraints]
  );

  const nameOf = (list, id) => list.find((x) => x.id === id)?.name || "—";

  const filtered = data.sessions
    .filter((s) => !filterDay || s.day === filterDay)
    .filter((s) => !filterTeam || s.teamId === filterTeam)
    .filter((s) => !filterHall || s.hallId === filterHall)
    .filter((s) => !filterCoach || s.coachId === filterCoach)
    .sort(
      (a, b) =>
        DAYS.indexOf(a.day) - DAYS.indexOf(b.day) ||
        timeToMinutes(a.start) - timeToMinutes(b.start)
    );

  const [nextSessionDefaults, setNextSessionDefaults] = useState(null);

  const handleSaveSession = (session) => {
    const exists = data.sessions.some((s) => s.id === session.id);
    const nextSessions = exists
      ? data.sessions.map((s) => (s.id === session.id ? session : s))
      : [...data.sessions, session];
    save({ ...data, sessions: nextSessions });
    setEditingId(null);
    setNextSessionDefaults(null);
  };

  const handleSaveAndAddNext = (session) => {
    const nextSessions = [...data.sessions, { ...session, id: uid() }];
    save({ ...data, sessions: nextSessions });
    setNextSessionDefaults({ coachId: session.coachId, type: session.type });
    setEditingId("new");
  };

  const handleDelete = (id) => {
    save({ ...data, sessions: data.sessions.filter((s) => s.id !== id) });
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length === 0) {
      setImportMsg({ type: "error", text: "לא נמצאו שורות תקינות בקובץ." });
      return;
    }
    const next = importCsvToData(rows, data);
    save({ ...data, ...next });
    setImportMsg({ type: "success", text: `יובאו ${rows.length} שורות בהצלחה.` });
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const blob = new Blob([buildCsvTemplate()], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "תבנית_מערכת_שעות.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalConflicts = Object.keys(conflicts).length;
  const totalViolations = Object.keys(violations).length;

  return (
    <div className="space-y-4" dir="rtl">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
            >
              <IconUpload size={15} /> ייבוא מקובץ CSV
            </button>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
            >
              <IconDownload size={15} /> הורד תבנית
            </button>
          </div>
          <button
            onClick={() => setEditingId("new")}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-orange-600 text-white hover:bg-orange-700"
          >
            <IconPlus size={15} /> אימון חדש
          </button>
        </div>
      )}

      {importMsg && (
        <div
          className={`text-xs rounded-lg p-2.5 flex items-center justify-between ${
            importMsg.type === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
        >
          <span>{importMsg.text}</span>
          <button onClick={() => setImportMsg(null)}>
            <IconX size={14} />
          </button>
        </div>
      )}

      {totalConflicts > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800">
          <IconShield size={18} className="shrink-0" />
          <span>
            יש {totalConflicts} אימונים עם התנגשות (אותו אולם או מאמן בשעה חופפת). הם מסומנים באדום למטה — אפשר להשאיר אותם כך.
          </span>
        </div>
      )}

      {totalViolations > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-300 rounded-lg p-3 text-sm text-red-800">
          <IconBan size={18} className="shrink-0" />
          <span>
            יש {totalViolations} אימונים שמפרים אילוץ חוסר-זמינות של מאמן או אולם. הם מסומנים למטה — אפשר להשאיר אותם כך.
          </span>
        </div>
      )}

      {canEdit && editingId === "new" && (
        <SessionForm
          data={data}
          initial={nextSessionDefaults}
          onSave={handleSaveSession}
          onSaveAndAddNext={handleSaveAndAddNext}
          onCancel={() => {
            setEditingId(null);
            setNextSessionDefaults(null);
          }}
        />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Select value={filterDay} onChange={setFilterDay} options={DAYS.map((d) => ({ id: d, name: d }))} placeholder="כל הימים" />
        <Select value={filterTeam} onChange={setFilterTeam} options={data.teams} placeholder="כל הקבוצות" />
        <Select value={filterCoach} onChange={setFilterCoach} options={data.coaches} placeholder="כל המאמנים" />
        <Select value={filterHall} onChange={setFilterHall} options={data.halls} placeholder="כל האולמות" />
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-sm">
            {data.sessions.length === 0
              ? canEdit
                ? "אין עדיין אימונים. ייבא קובץ CSV או הוסף אימון חדש."
                : "אין עדיין אימונים."
              : "אין אימונים שמתאימים לסינון הנוכחי."}
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {filtered.map((s) => {
              const hasConflict = !!conflicts[s.id];
              const hasViolation = !!violations[s.id];
              const isEditing = editingId === s.id;
              const isGameSession = !!s.fromGame;
              return (
                <div key={s.id}>
                  {canEdit && isEditing ? (
                    <div className="p-3">
                      <SessionForm
                        data={data}
                        initial={s}
                        onSave={handleSaveSession}
                        onSaveAndAddNext={handleSaveAndAddNext}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  ) : (
                    <div
                      className={`flex items-center gap-3 px-4 py-3 ${
                        hasViolation
                          ? "bg-red-50"
                          : hasConflict
                          ? "bg-amber-50"
                          : isGameSession
                          ? "bg-green-50/40"
                          : ""
                      }`}
                    >
                      <div className="w-16 text-sm font-medium text-stone-700 shrink-0">{s.day}</div>
                      <div className="w-28 text-sm text-stone-500 shrink-0 tabular-nums">
                        {s.start}–{s.end}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Pill color={colorFor(s.teamId, data.teams.map((t) => t.id))}>
                            {nameOf(data.teams, s.teamId)}
                          </Pill>
                          {s.type && s.type !== "אימון" && (
                            <Pill color={sessionTypeColor(s.type)}>{s.type}</Pill>
                          )}
                          {isGameSession && (
                            <span className="text-xs text-stone-400 italic">מייבוא משחקים</span>
                          )}
                          <span className="text-stone-300 text-xs">•</span>
                          <span className="text-sm text-stone-600">{nameOf(data.coaches, s.coachId)}</span>
                          {!isGameSession && (
                            <>
                              <span className="text-stone-300 text-xs">•</span>
                              <span className="text-sm text-stone-500 flex items-center gap-1">
                                <IconMapPin size={12} /> {nameOf(data.halls, s.hallId)}
                              </span>
                            </>
                          )}
                        </div>
                        {s.notes && <div className="text-xs text-stone-400 mt-0.5 truncate">{s.notes}</div>}
                      </div>
                      {hasViolation && (
                        <div className="flex items-center gap-1 text-red-600 text-xs font-medium shrink-0">
                          <IconBan size={14} /> הפרת אילוץ
                        </div>
                      )}
                      {hasConflict && !hasViolation && (
                        <div className="flex items-center gap-1 text-amber-700 text-xs font-medium shrink-0">
                          <IconAlert size={14} /> התנגשות
                        </div>
                      )}
                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          {!isGameSession && (
                            <>
                              <button
                                onClick={() => setEditingId(s.id)}
                                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
                                aria-label="ערוך"
                              >
                                <IconPencil size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(s.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-600"
                                aria-label="מחק"
                              >
                                <IconTrash size={14} />
                              </button>
                            </>
                          )}
                          {isGameSession && (
                            <span className="text-xs text-stone-300 px-1" title="ניתן לעריכה רק דרך טאב המשחקים">
                              🔒
                            </span>
                          )}
                        </div>
                      )}
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
