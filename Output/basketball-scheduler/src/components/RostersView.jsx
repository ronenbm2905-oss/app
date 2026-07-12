import { useState } from "react";
import { colorFor } from "../utils/colors";
import { uid } from "../utils/dates";
import { Select } from "./ui/Select";
import {
  IconPlus, IconTrash, IconPencil, IconCheck, IconAlert, IconX,
  IconUsers, IconUserPlus, IconBuilding,
} from "./ui/icons";

function NameForm({ initial, label, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const valid = name.trim().length > 0;
  return (
    <div className="bg-white rounded-xl border border-stone-300 p-4 space-y-3" dir="rtl">
      <div>
        <label className="text-xs text-stone-500 mb-1 block">{label}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`שם ${label}`}
          className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          dir="rtl"
          autoFocus
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50">
          ביטול
        </button>
        <button
          disabled={!valid}
          onClick={() => onSave({ id: initial?.id || uid(), name: name.trim() })}
          className="px-3 py-1.5 text-sm rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-40 disabled:hover:bg-orange-600 flex items-center gap-1.5"
        >
          <IconCheck size={15} /> שמור
        </button>
      </div>
    </div>
  );
}

function RosterList({ title, icon, items, label, usageCount, onSave, onDelete, canEdit }) {
  const [editingId, setEditingId] = useState(null);

  const handleSave = (item) => {
    const exists = items.some((x) => x.id === item.id);
    onSave(item, exists);
    setEditingId(null);
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="bg-stone-50 px-4 py-2.5 border-b border-stone-200 flex items-center justify-between">
        <div className="flex items-center gap-2 text-stone-700 font-semibold text-sm">
          {icon} {title}
        </div>
        {canEdit && (
          <button
            onClick={() => setEditingId("new")}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-orange-600 text-white hover:bg-orange-700"
          >
            <IconPlus size={13} /> הוסף {label}
          </button>
        )}
      </div>

      {canEdit && editingId === "new" && (
        <div className="p-3 border-b border-stone-100">
          <NameForm label={label} onSave={handleSave} onCancel={() => setEditingId(null)} />
        </div>
      )}

      {items.length === 0 ? (
        <div className="p-6 text-center text-stone-400 text-sm">
          אין עדיין {label === "מאמן" ? "מאמנים" : "אולמות"} רשומים.
        </div>
      ) : (
        <div className="divide-y divide-stone-100">
          {items.map((item) => {
            const inUse = usageCount(item.id);
            const isEditing = editingId === item.id;
            return (
              <div key={item.id}>
                {canEdit && isEditing ? (
                  <div className="p-3">
                    <NameForm initial={item} label={label} onSave={handleSave} onCancel={() => setEditingId(null)} />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex-1 text-sm text-stone-700">{item.name}</span>
                    {inUse > 0 && <span className="text-xs text-stone-400">{inUse} אימונים</span>}
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setEditingId(item.id)} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" aria-label="ערוך">
                          <IconPencil size={14} />
                        </button>
                        <button
                          onClick={() => onDelete(item.id, inUse)}
                          className={`p-1.5 rounded-lg ${
                            inUse > 0 ? "text-stone-300 cursor-not-allowed" : "hover:bg-red-50 text-stone-400 hover:text-red-600"
                          }`}
                          aria-label="מחק"
                          title={inUse > 0 ? "לא ניתן למחוק - יש אימונים שמשתמשים בזה" : "מחק"}
                        >
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
  );
}

function TeamForm({ initial, coaches, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [coachId, setCoachId] = useState(initial?.coachId || "");
  const valid = name.trim().length > 0;
  return (
    <div className="bg-white rounded-xl border border-stone-300 p-4 space-y-3" dir="rtl">
      <div>
        <label className="text-xs text-stone-500 mb-1 block">שם קבוצה</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="שם קבוצה"
          className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          dir="rtl"
          autoFocus
        />
      </div>
      <div>
        <label className="text-xs text-stone-500 mb-1 block">מאמן הקבוצה (אופציונלי)</label>
        <Select value={coachId} onChange={setCoachId} options={coaches} placeholder="בחר מאמן" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50">
          ביטול
        </button>
        <button
          disabled={!valid}
          onClick={() => onSave({ id: initial?.id || uid(), name: name.trim(), coachId: coachId || null })}
          className="px-3 py-1.5 text-sm rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-40 disabled:hover:bg-orange-600 flex items-center gap-1.5"
        >
          <IconCheck size={15} /> שמור
        </button>
      </div>
    </div>
  );
}

function TeamRosterList({ items, coaches, usageCount, onSave, onDelete, canEdit }) {
  const [editingId, setEditingId] = useState(null);
  const coachName = (id) => coaches.find((c) => c.id === id)?.name || "—";

  const handleSave = (item) => {
    const exists = items.some((x) => x.id === item.id);
    onSave(item, exists);
    setEditingId(null);
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="bg-stone-50 px-4 py-2.5 border-b border-stone-200 flex items-center justify-between">
        <div className="flex items-center gap-2 text-stone-700 font-semibold text-sm">
          <IconUsers size={16} /> קבוצות
        </div>
        {canEdit && (
          <button
            onClick={() => setEditingId("new")}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-orange-600 text-white hover:bg-orange-700"
          >
            <IconPlus size={13} /> הוסף קבוצה
          </button>
        )}
      </div>

      {canEdit && editingId === "new" && (
        <div className="p-3 border-b border-stone-100">
          <TeamForm coaches={coaches} onSave={handleSave} onCancel={() => setEditingId(null)} />
        </div>
      )}

      {items.length === 0 ? (
        <div className="p-6 text-center text-stone-400 text-sm">אין עדיין קבוצות רשומות.</div>
      ) : (
        <div className="divide-y divide-stone-100">
          {items.map((item) => {
            const inUse = usageCount(item.id);
            const isEditing = editingId === item.id;
            return (
              <div key={item.id}>
                {canEdit && isEditing ? (
                  <div className="p-3">
                    <TeamForm initial={item} coaches={coaches} onSave={handleSave} onCancel={() => setEditingId(null)} />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorFor(item.id, items.map((t) => t.id)) }} />
                    <div className="flex-1">
                      <div className="text-sm text-stone-700">{item.name}</div>
                      {item.coachId && <div className="text-xs text-stone-400">מאמן: {coachName(item.coachId)}</div>}
                    </div>
                    {inUse > 0 && <span className="text-xs text-stone-400">{inUse} אימונים</span>}
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setEditingId(item.id)} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" aria-label="ערוך">
                          <IconPencil size={14} />
                        </button>
                        <button
                          onClick={() => onDelete(item.id, inUse)}
                          className={`p-1.5 rounded-lg ${
                            inUse > 0 ? "text-stone-300 cursor-not-allowed" : "hover:bg-red-50 text-stone-400 hover:text-red-600"
                          }`}
                          aria-label="מחק"
                          title={inUse > 0 ? "לא ניתן למחוק - יש אימונים שמשתמשים בזה" : "מחק"}
                        >
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
  );
}

export function RostersView({ data, save, canEdit }) {
  const [blockedMsg, setBlockedMsg] = useState(null);

  const coachUsage = (id) =>
    data.sessions.filter((s) => s.coachId === id).length +
    (data.constraints || []).filter((c) => c.type === "coach" && c.refId === id).length;
  const hallUsage = (id) =>
    data.sessions.filter((s) => s.hallId === id).length +
    (data.constraints || []).filter((c) => c.type === "hall" && c.refId === id).length;
  const teamUsage = (id) => data.sessions.filter((s) => s.teamId === id).length;

  const handleSaveCoach = (item, exists) => {
    const next = exists ? data.coaches.map((c) => (c.id === item.id ? item : c)) : [...data.coaches, item];
    save({ ...data, coaches: next });
  };
  const handleSaveHall = (item, exists) => {
    const next = exists ? data.halls.map((h) => (h.id === item.id ? item : h)) : [...data.halls, item];
    save({ ...data, halls: next });
  };
  const handleSaveTeam = (item, exists) => {
    const next = exists ? data.teams.map((t) => (t.id === item.id ? item : t)) : [...data.teams, item];
    save({ ...data, teams: next });
  };

  const handleDeleteCoach = (id, inUse) => {
    if (inUse > 0) {
      setBlockedMsg("לא ניתן למחוק מאמן שיש לו אימונים או אילוצים רשומים. ערוך או מחק אותם קודם.");
      return;
    }
    save({ ...data, coaches: data.coaches.filter((c) => c.id !== id) });
  };
  const handleDeleteHall = (id, inUse) => {
    if (inUse > 0) {
      setBlockedMsg("לא ניתן למחוק אולם שיש לו אימונים או אילוצים רשומים. ערוך או מחק אותם קודם.");
      return;
    }
    save({ ...data, halls: data.halls.filter((h) => h.id !== id) });
  };
  const handleDeleteTeam = (id, inUse) => {
    if (inUse > 0) {
      setBlockedMsg("לא ניתן למחוק קבוצה שיש לה אימונים רשומים. ערוך או מחק אותם קודם.");
      return;
    }
    save({ ...data, teams: data.teams.filter((t) => t.id !== id) });
  };

  return (
    <div className="space-y-4" dir="rtl">
      {blockedMsg && (
        <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800">
          <span className="flex items-center gap-2">
            <IconAlert size={16} className="shrink-0" /> {blockedMsg}
          </span>
          <button onClick={() => setBlockedMsg(null)}>
            <IconX size={14} />
          </button>
        </div>
      )}
      <div className="grid sm:grid-cols-3 gap-4">
        <TeamRosterList items={data.teams} coaches={data.coaches} usageCount={teamUsage} onSave={handleSaveTeam} onDelete={handleDeleteTeam} canEdit={canEdit} />
        <RosterList title="מאמנים" icon={<IconUserPlus size={16} />} items={data.coaches} label="מאמן" usageCount={coachUsage} onSave={handleSaveCoach} onDelete={handleDeleteCoach} canEdit={canEdit} />
        <RosterList title="אולמות" icon={<IconBuilding size={16} />} items={data.halls} label="אולם" usageCount={hallUsage} onSave={handleSaveHall} onDelete={handleDeleteHall} canEdit={canEdit} />
      </div>
    </div>
  );
}
