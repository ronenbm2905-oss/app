import { useState } from "react";
import { VEHICLE_TYPES } from "../constants";
import { colorFor } from "../utils/colors";
import { uid } from "../utils/dates";
import { looksIndoor } from "../utils/indoorBalance";
import { AccessCard } from "./AccessCard";
import { sortByName } from "../utils/names";
import { Select } from "./ui/Select";
import {
  IconPlus, IconTrash, IconPencil, IconCheck, IconAlert, IconX,
  IconUsers, IconUserPlus, IconBuilding, IconChevronUp, IconChevronDown,
} from "./ui/icons";

// Short DD/MM label for a stored ISO birth date (YYYY-MM-DD). Year is intentionally dropped in the list.
function birthLabel(iso) {
  if (!iso) return "";
  const p = String(iso).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}` : "";
}

// `withPhone` adds a phone field (used for coaches — feeds the transport export's contact column).
// `withBirthDate` adds a birthday field (used for coaches — feeds the birthday reminder on the notice board).
// `withEmail` adds the Google address the coach signs in with — the only key that ties a
// signed-in account to a coach record, so the app can greet them by the name the club uses.
function NameForm({ initial, label, withPhone, withBirthDate, withEmail, withParallelGroups, withIndoor, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [birthDate, setBirthDate] = useState(initial?.birthDate || "");
  const [parallelGroups, setParallelGroups] = useState(!!initial?.parallelGroups);
  const [indoor, setIndoor] = useState(!!initial?.indoor);
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
          className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          dir="rtl"
          autoFocus
        />
      </div>
      {withPhone && (
        <div>
          <label className="text-xs text-stone-500 mb-1 block">טלפון (להסעות)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="050-0000000"
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            dir="ltr"
          />
        </div>
      )}
      {withEmail && (
        <div>
          <label className="text-xs text-stone-500 mb-1 block">דוא"ל Google (לזיהוי בכניסה למערכת)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="coach@gmail.com"
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            dir="ltr"
          />
          <span className="block text-xs text-stone-500 mt-1">
            הכתובת שאיתה המאמן/ת מתחבר/ת. משמשת כדי לפנות בשם שהמועדון מכיר במסך הבית — לא נשלחת אליה דבר.
          </span>
        </div>
      )}
      {withBirthDate && (
        <div>
          <label className="text-xs text-stone-500 mb-1 block">תאריך לידה (לתזכורת יום הולדת)</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            dir="ltr"
          />
        </div>
      )}
      {withIndoor && (
        <label className="flex items-start gap-2 text-sm text-stone-700 cursor-pointer">
          <input
            type="checkbox"
            checked={indoor}
            onChange={(e) => setIndoor(e.target.checked)}
            className="accent-brand-600 mt-0.5"
          />
          <span>
            אולם מקורה
            <span className="block text-xs text-stone-500">
              משמש לדוח חלוקת המקורה בין המאמנים. מסומן על האולם ולא לפי שמו, כדי ששינוי שם לא ישבש את הדוח.
            </span>
          </span>
        </label>
      )}
      {withParallelGroups && (
        <label className="flex items-start gap-2 text-sm text-stone-700 cursor-pointer">
          <input
            type="checkbox"
            checked={parallelGroups}
            onChange={(e) => setParallelGroups(e.target.checked)}
            className="accent-brand-600 mt-0.5"
          />
          <span>
            מאמן/ת כמה קבוצות במקביל
            <span className="block text-xs text-stone-500">
              לא יסומן כ״חפיפת מאמן״ כששתי קבוצות שלו רשומות באותה שעה. חפיפת אולם ואילוצים ימשיכו להופיע כרגיל.
            </span>
          </span>
        </label>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50">
          ביטול
        </button>
        <button
          disabled={!valid}
          onClick={() =>
            onSave({
              id: initial?.id || uid(),
              name: name.trim(),
              ...(withPhone ? { phone: phone.trim() } : {}),
              // Lower-cased on the way in: the address is matched against the signed-in
              // account, and Google hands that back lower-case.
              ...(withEmail ? { email: email.trim().toLowerCase() } : {}),
              ...(withBirthDate ? { birthDate } : {}),
              ...(withParallelGroups ? { parallelGroups } : {}),
              ...(withIndoor ? { indoor } : {}),
            })
          }
          className="px-3 py-1.5 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:hover:bg-brand-600 flex items-center gap-1.5"
        >
          <IconCheck size={15} /> שמור
        </button>
      </div>
    </div>
  );
}

function RosterList({ title, icon, items, label, usageCount, onSave, onDelete, canEdit, withPhone, withBirthDate, withEmail, withParallelGroups, withIndoor, headerExtra }) {
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
        <div className="flex items-center gap-2">
          {canEdit && headerExtra}
          {canEdit && (
            <button
              onClick={() => setEditingId("new")}
              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-brand-600 text-white hover:bg-brand-700"
            >
              <IconPlus size={13} /> הוסף {label}
            </button>
          )}
        </div>
      </div>

      {canEdit && editingId === "new" && (
        <div className="p-3 border-b border-stone-100">
          <NameForm label={label} withPhone={withPhone} withBirthDate={withBirthDate} withEmail={withEmail} withParallelGroups={withParallelGroups} withIndoor={withIndoor} onSave={handleSave} onCancel={() => setEditingId(null)} />
        </div>
      )}

      {items.length === 0 ? (
        <div className="p-6 text-center text-stone-600 text-sm">
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
                    <NameForm initial={item} label={label} withPhone={withPhone} withBirthDate={withBirthDate} withEmail={withEmail} withParallelGroups={withParallelGroups} withIndoor={withIndoor} onSave={handleSave} onCancel={() => setEditingId(null)} />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex-1 text-sm text-stone-700">
                      {item.name}
                      {withPhone && item.phone && (
                        <span className="text-xs text-stone-500 mr-2" dir="ltr">{item.phone}</span>
                      )}
                      {withEmail && item.email && (
                        <span className="text-xs text-stone-500 mr-2 break-all" dir="ltr">{item.email}</span>
                      )}
                      {withIndoor && item.indoor && (
                        <span className="text-[11px] text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-2 py-0.5 mr-2">
                          מקורה
                        </span>
                      )}
                      {withBirthDate && item.birthDate && (
                        <span className="text-xs text-stone-500 mr-2">🎂 {birthLabel(item.birthDate)}</span>
                      )}
                      {/* Visible in the list, not just inside the editor: it changes which
                          warnings the board shows, and that should not be a hidden setting. */}
                      {withParallelGroups && item.parallelGroups && (
                        <span
                          className="text-[11px] text-stone-600 bg-stone-100 border border-stone-200 rounded-full px-2 py-0.5 mr-2"
                          title="לא מסומן כחפיפת מאמן כששתי קבוצות שלו באותה שעה"
                        >
                          קבוצות במקביל
                        </span>
                      )}
                    </span>
                    {canEdit && inUse > 0 && <span className="text-xs text-stone-600">{inUse} אימונים</span>}
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setEditingId(item.id)} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" aria-label="ערוך">
                          <IconPencil size={14} />
                        </button>
                        <button
                          onClick={() => onDelete(item.id, inUse)}
                          className={`p-1.5 rounded-lg ${
                            inUse > 0 ? "text-stone-300 cursor-not-allowed" : "hover:bg-red-50 text-stone-600 hover:text-red-600"
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
  const [vehicleType, setVehicleType] = useState(initial?.vehicleType || "");
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
          className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          dir="rtl"
          autoFocus
        />
      </div>
      <div>
        <label className="text-xs text-stone-500 mb-1 block">מאמן הקבוצה (אופציונלי)</label>
        <Select value={coachId} onChange={setCoachId} options={coaches} placeholder="בחר מאמן" />
      </div>
      <div>
        <label className="text-xs text-stone-500 mb-1 block">סוג רכב להסעות (אופציונלי)</label>
        <Select
          value={vehicleType}
          onChange={setVehicleType}
          options={VEHICLE_TYPES.map((v) => ({ id: v, name: `${v} מקומות` }))}
          placeholder="בחר סוג רכב"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50">
          ביטול
        </button>
        <button
          disabled={!valid}
          onClick={() => onSave({ id: initial?.id || uid(), name: name.trim(), coachId: coachId || null, vehicleType: vehicleType || "" })}
          className="px-3 py-1.5 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:hover:bg-brand-600 flex items-center gap-1.5"
        >
          <IconCheck size={15} /> שמור
        </button>
      </div>
    </div>
  );
}

function TeamRosterList({ items, coaches, usageCount, onSave, onDelete, onMove, canEdit }) {
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
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-brand-600 text-white hover:bg-brand-700"
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
        <div className="p-6 text-center text-stone-600 text-sm">אין עדיין קבוצות רשומות.</div>
      ) : (
        <div className="divide-y divide-stone-100">
          {items.map((item, idx) => {
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
                      {item.coachId && <div className="text-xs text-stone-600">מאמן: {coachName(item.coachId)}</div>}
                    </div>
                    {canEdit && inUse > 0 && <span className="text-xs text-stone-600">{inUse} אימונים</span>}
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="flex flex-col -my-1">
                          <button
                            onClick={() => onMove(item.id, "up")}
                            disabled={idx === 0}
                            className="p-0.5 rounded hover:bg-stone-100 text-stone-500 disabled:opacity-30 disabled:hover:bg-transparent"
                            aria-label="הזז למעלה"
                            title="הזז למעלה"
                          >
                            <IconChevronUp size={14} />
                          </button>
                          <button
                            onClick={() => onMove(item.id, "down")}
                            disabled={idx === items.length - 1}
                            className="p-0.5 rounded hover:bg-stone-100 text-stone-500 disabled:opacity-30 disabled:hover:bg-transparent"
                            aria-label="הזז למטה"
                            title="הזז למטה"
                          >
                            <IconChevronDown size={14} />
                          </button>
                        </div>
                        <button onClick={() => setEditingId(item.id)} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" aria-label="ערוך">
                          <IconPencil size={14} />
                        </button>
                        <button
                          onClick={() => onDelete(item.id, inUse)}
                          className={`p-1.5 rounded-lg ${
                            inUse > 0 ? "text-stone-300 cursor-not-allowed" : "hover:bg-red-50 text-stone-600 hover:text-red-600"
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

export function RostersView({ data, save, canEdit, currentEmail }) {
  const [blockedMsg, setBlockedMsg] = useState(null);

  // One-time convenience for a club whose halls are already named "… מקורה": tick them all
  // at once instead of opening seven records. It only ever ADDS the flag — it never clears
  // one — so a hall marked by hand cannot be undone by pressing this.
  const unmarkedIndoor = (data.halls || []).filter((h) => looksIndoor(h) && !h.indoor);
  const markIndoorByName = () => {
    save({
      ...data,
      halls: (data.halls || []).map((h) => (looksIndoor(h) && !h.indoor ? { ...h, indoor: true } : h)),
    });
  };
  const indoorHelper = unmarkedIndoor.length ? (
    <button
      onClick={markIndoorByName}
      title={unmarkedIndoor.map((h) => h.name).join(", ")}
      className="px-2.5 py-1 text-xs rounded-lg border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"
    >
      סמן {unmarkedIndoor.length} אולמות כמקורה לפי השם
    </button>
  ) : null;

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
  const handleMoveTeam = (id, dir) => {
    const idx = data.teams.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= data.teams.length) return;
    const next = [...data.teams];
    [next[idx], next[swap]] = [next[swap], next[idx]];
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
          <button onClick={() => setBlockedMsg(null)} aria-label="סגור הודעה">
            <IconX size={14} />
          </button>
        </div>
      )}
      <div className={`grid gap-4 ${canEdit ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <TeamRosterList items={data.teams} coaches={data.coaches} usageCount={teamUsage} onSave={handleSaveTeam} onDelete={handleDeleteTeam} onMove={handleMoveTeam} canEdit={canEdit} />
        {/* Alphabetical, not entry order: with two dozen coaches, "where did I type it"
            is not a way to find a name. Display only — the stored array keeps its order,
            and every row still edits and deletes by id. Teams are left alone; their order
            is chosen by hand with the up/down arrows and means something. */}
        <RosterList title="מאמנים" icon={<IconUserPlus size={16} />} items={sortByName(data.coaches)} label="מאמן" usageCount={coachUsage} onSave={handleSaveCoach} onDelete={handleDeleteCoach} canEdit={canEdit} withPhone withEmail withBirthDate withParallelGroups />
        {/* Halls are maintained by managers — which court a session sits in is decided on
            the scheduling screen, not here. A coach reading this screen wants teams and
            who trains them, so the card is left out of their copy of it entirely and the
            grid closes to two columns. This hides a screen area, not data: see the note
            on ADMIN_ONLY_TABS in App.jsx. */}
        {canEdit && (
          <RosterList title="אולמות" icon={<IconBuilding size={16} />} items={data.halls} label="אולם" usageCount={hallUsage} onSave={handleSaveHall} onDelete={handleDeleteHall} canEdit={canEdit} withIndoor headerExtra={indoorHelper} />
        )}
      </div>

      {/* Managers only, and not because the data is secret — a coach can read the club
          document either way. It is a list of everyone's addresses, and there is nothing
          a coach can do with it. */}
      {canEdit && <AccessCard data={data} save={save} currentEmail={currentEmail} />}
    </div>
  );
}
