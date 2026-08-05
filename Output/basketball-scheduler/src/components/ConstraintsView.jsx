import { useState, useEffect } from "react";
import { DAYS } from "../constants";
import { timeToMinutes, overlaps, uid } from "../utils/dates";
import { formatHolidayRange, parseHolidaysText } from "../utils/holidays";
import { Select } from "./ui/Select";
import { IconPlus, IconTrash, IconPencil, IconCheck, IconUserX, IconBuilding, IconBan } from "./ui/icons";

// Register club-wide special days (holidays, breaks) — single days or date ranges, plus bulk paste-import.
// They surface on the weekly board's day headers.
function HolidaysCard({ data, save, canEdit }) {
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [name, setName] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const holidays = (data.holidays || []).slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const valid = date && name.trim() && (!endDate || endDate >= date);

  const add = () => {
    if (!valid) return;
    const entry = { id: uid(), date, endDate: endDate && endDate !== date ? endDate : "", name: name.trim() };
    save({ ...data, holidays: [...(data.holidays || []), entry] });
    setDate("");
    setEndDate("");
    setName("");
  };
  const del = (id) => save({ ...data, holidays: (data.holidays || []).filter((h) => h.id !== id) });

  const runImport = () => {
    const parsed = parseHolidaysText(pasteText);
    if (parsed.length === 0) {
      setImportMsg("לא זוהו תאריכים ברשימה. ודא שכל שורה מתחילה בתאריך (למשל 11/09/2026).");
      return;
    }
    const existing = data.holidays || [];
    const key = (h) => `${h.date}__${h.endDate || h.date}`;
    const seen = new Set(existing.map(key));
    const toAdd = [];
    parsed.forEach((h) => {
      const k = key(h);
      if (seen.has(k)) return;
      seen.add(k);
      toAdd.push({ id: uid(), date: h.date, endDate: h.endDate && h.endDate !== h.date ? h.endDate : "", name: h.name });
    });
    if (toAdd.length > 0) save({ ...data, holidays: [...existing, ...toAdd] });
    const skipped = parsed.length - toAdd.length;
    setImportMsg(`נוספו ${toAdd.length} ימים${skipped ? `, דולגו ${skipped} כפילויות` : ""}.`);
    setPasteText("");
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="bg-stone-50 px-4 py-2.5 border-b border-stone-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-stone-700 font-semibold text-sm">
          <span aria-hidden="true">🎉</span> חגים וימים מיוחדים
        </div>
        {canEdit && (
          <button
            onClick={() => { setShowImport((v) => !v); setImportMsg(""); }}
            className="text-xs text-orange-600 hover:text-orange-700 underline underline-offset-2"
          >
            {showImport ? "סגור ייבוא" : "ייבוא מרשימה"}
          </button>
        )}
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs text-stone-500">
          רשום כאן חגים, חופשות או ימים מיוחדים (יום בודד או טווח). הם יופיעו מסומנים בכותרת היום בלוח השבועי.
        </p>

        {canEdit && showImport && (
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-2">
            <p className="text-xs text-stone-600">
              הדבק שורה לכל חג — תאריך (או טווח, שני תאריכים) ואז השם. לדוגמה:
            </p>
            <pre className="text-[11px] text-stone-500 bg-white border border-stone-200 rounded p-2 overflow-x-auto" dir="ltr">{`11/09/2026-13/09/2026 ראש השנה
23/03/2027-24/03/2027 פורים
04/05/2027 יום הזיכרון לשואה`}</pre>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={5}
              dir="rtl"
              placeholder="הדבק כאן את רשימת החגים..."
              className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={runImport}
                disabled={!pasteText.trim()}
                className="px-3 py-2 text-sm rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-40 disabled:hover:bg-orange-600"
              >
                ייבא רשימה
              </button>
              {importMsg && <span className="text-xs text-stone-600">{importMsg}</span>}
            </div>
          </div>
        )}

        {canEdit && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-xs text-stone-500 mb-1 block">תאריך</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                dir="ltr"
                className="bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1 block">עד (אופציונלי)</label>
              <input
                type="date"
                value={endDate}
                min={date}
                onChange={(e) => setEndDate(e.target.value)}
                dir="ltr"
                className="bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="flex-1 min-w-[10rem]">
              <label className="text-xs text-stone-500 mb-1 block">שם היום</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: ראש השנה"
                dir="rtl"
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <button
              disabled={!valid}
              onClick={add}
              className="px-3 py-2 text-sm rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-40 disabled:hover:bg-orange-600 flex items-center gap-1.5"
            >
              <IconPlus size={15} /> הוסף
            </button>
          </div>
        )}

        {holidays.length === 0 ? (
          <p className="text-sm text-stone-500">אין ימים מיוחדים רשומים.</p>
        ) : (
          <div className="divide-y divide-stone-100 border border-stone-100 rounded-lg">
            {holidays.map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-36 text-sm tabular-nums text-stone-600 shrink-0">{formatHolidayRange(h)}</span>
                <span className="flex-1 text-sm text-stone-800">{h.name}</span>
                {canEdit && (
                  <button onClick={() => del(h.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-stone-600 hover:text-red-600" aria-label="מחק">
                    <IconTrash size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConstraintForm({ data, initial, onSave, onCancel, onSaveAndAddNext }) {
  const [type, setType] = useState(initial?.type || "coach");
  const [refId, setRefId] = useState(initial?.refId || "");
  const [day, setDay] = useState(initial?.day || DAYS[0]);
  const [start, setStart] = useState(initial?.start || "08:00");
  const [end, setEnd] = useState(initial?.end || "10:00");
  const [note, setNote] = useState(initial?.note || "");

  // Re-sync when `initial` changes (e.g. "save and add another" reopens the form
  // carrying the same hall/type forward, or when switching to edit a row).
  useEffect(() => {
    setType(initial?.type || "coach");
    setRefId(initial?.refId || "");
    setDay(initial?.day || DAYS[0]);
    setStart(initial?.start || "08:00");
    setEnd(initial?.end || "10:00");
    setNote(initial?.note || "");
  }, [initial]);

  const valid = refId && day && start && end && timeToMinutes(start) < timeToMinutes(end);
  const options = type === "coach" ? data.coaches : data.halls;

  return (
    <div className="bg-white rounded-xl border border-stone-300 p-4 space-y-3" dir="rtl">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-stone-500 mb-1 block">סוג אילוץ</label>
          <Select
            value={type}
            onChange={(v) => {
              setType(v);
              setRefId("");
            }}
            options={[{ id: "coach", name: "מאמן" }, { id: "hall", name: "אולם" }]}
            placeholder="בחר סוג"
          />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">{type === "coach" ? "מאמן" : "אולם"}</label>
          <Select value={refId} onChange={setRefId} options={options} placeholder={type === "coach" ? "בחר מאמן" : "בחר אולם"} />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">יום חסום</label>
          <Select value={day} onChange={setDay} options={DAYS.map((d) => ({ id: d, name: d }))} placeholder="בחר יום" />
        </div>
        <div />
        <div>
          <label className="text-xs text-stone-500 mb-1 block">משעה</label>
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">עד שעה</label>
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-stone-500 mb-1 block">הערה (אופציונלי)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="לדוגמה: עבודה אחרת, אחזקת אולם"
          className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          dir="rtl"
        />
      </div>

      {!valid && start && end && timeToMinutes(start) >= timeToMinutes(end) && (
        <p className="text-xs text-red-600">שעת הסיום צריכה להיות אחרי שעת ההתחלה.</p>
      )}

      <div className="flex flex-wrap justify-between gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50">
          ביטול
        </button>
        <div className="flex gap-2">
          {onSaveAndAddNext && (
            <button
              disabled={!valid}
              onClick={() => onSaveAndAddNext({ id: uid(), type, refId, day, start, end, note })}
              className="px-3 py-1.5 text-sm rounded-lg border border-orange-500 text-orange-600 hover:bg-orange-50 disabled:opacity-40 flex items-center gap-1.5"
            >
              <IconPlus size={15} /> שמור והוסף טווח נוסף {type === "coach" ? "למאמן" : "לאולם"} זה
            </button>
          )}
          <button
            disabled={!valid}
            onClick={() => onSave({ id: initial?.id || uid(), type, refId, day, start, end, note })}
            className="px-3 py-1.5 text-sm rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-40 disabled:hover:bg-orange-600 flex items-center gap-1.5"
          >
            <IconCheck size={15} /> שמור אילוץ
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConstraintsView({ data, save, canEdit }) {
  const [editingId, setEditingId] = useState(null);
  const [nextDefaults, setNextDefaults] = useState(null); // carry hall/coach forward
  const nameOf = (list, id) => list.find((x) => x.id === id)?.name || "—";
  const constraints = data.constraints || [];

  const affectedSessionsCount = (constraint) =>
    data.sessions.filter(
      (s) =>
        s.day === constraint.day &&
        overlaps(constraint.start, constraint.end, s.start, s.end) &&
        ((constraint.type === "coach" && constraint.refId === s.coachId) ||
          (constraint.type === "hall" && constraint.refId === s.hallId))
    ).length;

  const handleSave = (constraint) => {
    const exists = constraints.some((c) => c.id === constraint.id);
    const next = exists ? constraints.map((c) => (c.id === constraint.id ? constraint : c)) : [...constraints, constraint];
    save({ ...data, constraints: next });
    setEditingId(null);
    setNextDefaults(null);
  };

  // Save this constraint and reopen a fresh form with the same hall/coach selected,
  // so several time ranges can be added in a row.
  const handleSaveAndAddNext = (constraint) => {
    save({ ...data, constraints: [...constraints, constraint] });
    setNextDefaults({ type: constraint.type, refId: constraint.refId });
    setEditingId("new");
  };

  const handleDelete = (id) => {
    save({ ...data, constraints: constraints.filter((c) => c.id !== id) });
  };

  return (
    <div className="space-y-4" dir="rtl">
      <HolidaysCard data={data} save={save} canEdit={canEdit} />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-stone-500">
          רשום כאן זמנים בהם מאמן או אולם <span className="font-medium text-stone-700">לא זמינים</span>. הכלי יתריע אם אימון נקבע בתוך טווח חסום.
        </p>
        {canEdit && (
          <button
            onClick={() => { setNextDefaults(null); setEditingId("new"); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-orange-600 text-white hover:bg-orange-700 shrink-0"
          >
            <IconPlus size={15} /> אילוץ חדש
          </button>
        )}
      </div>

      {canEdit && editingId === "new" && (
        <ConstraintForm
          data={data}
          initial={nextDefaults}
          onSave={handleSave}
          onSaveAndAddNext={handleSaveAndAddNext}
          onCancel={() => { setEditingId(null); setNextDefaults(null); }}
        />
      )}

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        {constraints.length === 0 ? (
          <div className="p-8 text-center text-stone-600 text-sm">
            אין אילוצים רשומים.{canEdit ? " הוסף אילוץ כדי שהכלי יתריע על אימונים שמתנגשים בזמני חוסר-זמינות." : ""}
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {constraints.map((c) => {
              const affected = affectedSessionsCount(c);
              const isEditing = editingId === c.id;
              return (
                <div key={c.id}>
                  {canEdit && isEditing ? (
                    <div className="p-3">
                      <ConstraintForm data={data} initial={c} onSave={handleSave} onCancel={() => setEditingId(null)} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="shrink-0 text-stone-600">
                        {c.type === "coach" ? <IconUserX size={16} /> : <IconBuilding size={16} />}
                      </div>
                      <div className="w-16 text-sm font-medium text-stone-700 shrink-0">{c.day}</div>
                      <div className="w-28 text-sm text-stone-500 shrink-0 tabular-nums">
                        {c.start}–{c.end}
                      </div>
                      <div className="flex-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-sm text-stone-700 font-medium">
                          {c.type === "coach" ? nameOf(data.coaches, c.refId) : nameOf(data.halls, c.refId)}
                        </span>
                        {c.note && <span className="text-xs text-stone-600">— {c.note}</span>}
                      </div>
                      {affected > 0 && (
                        <div className="flex items-center gap-1 text-red-600 text-xs font-medium shrink-0">
                          <IconBan size={14} /> {affected} אימונים מפרים
                        </div>
                      )}
                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => setEditingId(c.id)} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" aria-label="ערוך">
                            <IconPencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-stone-600 hover:text-red-600" aria-label="מחק">
                            <IconTrash size={14} />
                          </button>
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
