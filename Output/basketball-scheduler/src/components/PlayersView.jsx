import { useState, useRef } from "react";
import { progressCountFor } from "../utils/playerProgress";
import { uid } from "../utils/dates";
import { colorFor } from "../utils/colors";
import {
  parsePlayersRows,
  importPlayersForTeam,
  readPlayersFile,
  downloadPlayersTemplate,
} from "../utils/players";
import { Select } from "./ui/Select";
import { teamsWithCoach } from "../utils/teams";
import {
  IconPlus, IconTrash, IconPencil, IconCheck, IconX,
  IconUsers, IconUpload, IconDownload, IconAlert,
} from "./ui/icons";

// "DD-MM-YYYY" / "DD/MM/YYYY" -> "YYYY-MM-DD" (for <input type="date">).
const toInputDate = (dmy) => {
  if (!dmy) return "";
  const m = String(dmy).match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dmy)) return dmy;
  return "";
};
// "YYYY-MM-DD" -> "DD-MM-YYYY" (storage format, shared with Excel import).
const fromInputDate = (iso) => (iso ? iso.split("-").reverse().join("-") : "");

const EMPTY_PLAYER = {
  name: "", phone: "", birthDate: "", shirtSize: "", pantsSize: "", sweaterSize: "", jerseyNumber: "",
};

function PlayerForm({ initial, jerseyTaken, onSave, onCancel }) {
  const [p, setP] = useState(initial || EMPTY_PLAYER);
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });

  const name = p.name.trim();
  const jersey = String(p.jerseyNumber).trim();
  const dup = jersey && jerseyTaken(jersey);
  const valid = name.length > 0 && !dup;

  const field = (label, key, type = "text", extra = {}) => (
    <div>
      <label className="text-xs text-stone-500 mb-1 block">{label}</label>
      <input
        type={type}
        value={type === "date" ? toInputDate(p[key]) : p[key]}
        onChange={
          type === "date"
            ? (e) => setP({ ...p, [key]: fromInputDate(e.target.value) })
            : set(key)
        }
        className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        dir={type === "text" ? "rtl" : "ltr"}
        {...extra}
      />
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-stone-300 p-4 space-y-3" dir="rtl">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {field("שם", "name", "text", { autoFocus: true, placeholder: "שם מלא" })}
        {field("טלפון", "phone", "text", { placeholder: "050-0000000", inputMode: "tel" })}
        {field("תאריך לידה", "birthDate", "date")}
        {field("מידת חולצה", "shirtSize", "text", { placeholder: "10 / M" })}
        {field("מידת מכנס", "pantsSize", "text", { placeholder: "10 / M" })}
        {field("מידת פוטר", "sweaterSize", "text", { placeholder: "10 / M" })}
        {field("מספר גופייה", "jerseyNumber", "text", { inputMode: "numeric", placeholder: "7" })}
      </div>
      {dup && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <IconAlert size={13} /> מספר גופייה {jersey} כבר תפוס בקבוצה הזו.
        </p>
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
              name,
              phone: p.phone.trim(),
              birthDate: p.birthDate,
              shirtSize: p.shirtSize.trim(),
              pantsSize: p.pantsSize.trim(),
              sweaterSize: p.sweaterSize.trim(),
              jerseyNumber: jersey,
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

export function PlayersView({ data, save, canEdit, progress }) {
  const players = data.players || [];
  const [teamId, setTeamId] = useState(data.teams[0]?.id || "");
  const [editing, setEditing] = useState(null); // player id | "new" | null
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);

  const team = data.teams.find((t) => t.id === teamId);
  const teamName = team?.name || "";
  const teamPlayers = players
    .filter((p) => p.teamId === teamId)
    .sort((a, b) => (Number(a.jerseyNumber) || 999) - (Number(b.jerseyNumber) || 999));

  // Is a jersey number already used by another player in this team?
  const jerseyTakenBy = (jersey, exceptId) =>
    teamPlayers.some((p) => p.id !== exceptId && p.jerseyNumber && p.jerseyNumber === jersey);

  const handleSavePlayer = (player) => {
    const exists = players.some((p) => p.id === player.id);
    const next = exists
      ? players.map((p) => (p.id === player.id ? { ...player, teamId } : p))
      : [...players, { ...player, teamId }];
    save({ ...data, players: next });
    setEditing(null);
  };

  // A player may not be removed while a progress note about them survives.
  //
  // The note is filed under the player's id and deliberately does not carry their name, so
  // taking the roster entry away severs the only link between the record and the child —
  // and from that moment a parent's request to see or delete what was written cannot be
  // answered at all. The same guard already protects coaches and halls from being deleted
  // out from under their records; it was simply never applied to players.
  const handleDelete = (id) => {
    const n = progressCountFor(progress, id);
    if (n > 0) {
      window.alert(
        `לשחקן/ית זה/זו ${n === 1 ? "הערכת התקדמות אחת" : `${n} הערכות התקדמות`}. יש למחוק אותן תחילה — ` +
        "לאחר ההסרה מהרשימה לא ניתן לקשר בין הרשומות לבין השחקן/ית, ולא נוכל לענות על בקשת עיון או מחיקה של הורה."
      );
      return;
    }
    // No confirmation existed here at all, while deleting a coach or a hall has always
    // asked. One misplaced tap removed a child's record with nothing in between.
    if (!window.confirm("למחוק את השחקן/ית מהרשימה?")) return;
    save({ ...data, players: players.filter((p) => p.id !== id) });
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!teamId) {
      setMsg({ type: "error", text: "בחר קבוצה לפני ייבוא." });
      return;
    }
    let rows;
    try {
      rows = await readPlayersFile(file);
    } catch {
      setMsg({ type: "error", text: "שגיאה בקריאת הקובץ. ודא שמדובר בקובץ xlsx תקין." });
      return;
    }
    const parsed = parsePlayersRows(rows);
    if (parsed.length === 0) {
      setMsg({ type: "error", text: 'לא נמצאו שחקנים בקובץ. ודא שיש שורת כותרת עם העמודה "שם".' });
      return;
    }
    const { nextPlayers, added, skipped } = importPlayersForTeam(parsed, teamId, players);
    save({ ...data, players: nextPlayers });
    setMsg({
      type: "success",
      text: `יובאו ${added} שחקנים לקבוצת "${teamName}".${
        skipped > 0 ? ` (${skipped} דולגו — כפילות שם/טלפון או מספר גופייה תפוס)` : ""
      }`,
    });
  };

  if (data.teams.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-600 text-sm" dir="rtl">
        הוסף קבוצות קודם במסך "קבוצות ואולמות", ואז אפשר יהיה לנהל את רשימת השחקנים.
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-stone-600">קבוצה:</span>
          {/* Coach named alongside, same as the games form: this picker decides whose
              roster you are editing, and the team names alone look alike in a list. */}
          <Select
            value={teamId}
            onChange={(v) => { setTeamId(v); setEditing(null); }}
            options={teamsWithCoach(data.teams, data.coaches)}
            placeholder="בחר קבוצה"
            className="w-64"
          />
        </div>
        {canEdit && teamId && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => downloadPlayersTemplate(teamName)} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-50">
              <IconDownload size={15} /> תבנית אקסל
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-50">
              <IconUpload size={15} /> ייבוא מאקסל
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
            <button onClick={() => setEditing("new")} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700">
              <IconPlus size={15} /> הוסף שחקן
            </button>
          </div>
        )}
      </div>

      {msg && (
        <div className={`text-xs rounded-lg p-2.5 flex items-center justify-between ${msg.type === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} aria-label="סגור הודעה">
            <IconX size={14} />
          </button>
        </div>
      )}

      {canEdit && editing === "new" && (
        <PlayerForm jerseyTaken={(j) => jerseyTakenBy(j, null)} onSave={handleSavePlayer} onCancel={() => setEditing(null)} />
      )}

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorFor(teamId, data.teams.map((t) => t.id)) }} />
          <IconUsers size={16} className="text-stone-600" />
          <h2 className="text-base font-semibold text-stone-800">{teamName || "—"}</h2>
          <span className="text-xs text-stone-500">· {teamPlayers.length} שחקנים</span>
        </div>

        {teamPlayers.length === 0 ? (
          <div className="p-8 text-center text-stone-600 text-sm">
            {canEdit ? "אין עדיין שחקנים בקבוצה זו. ייבא מאקסל או הוסף ידנית." : "אין עדיין שחקנים בקבוצה זו."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[720px]">
              <thead>
                <tr className="bg-stone-50 text-xs font-semibold text-stone-600">
                  <th className="border-b border-stone-200 px-3 py-2 text-center w-14">גופייה</th>
                  <th className="border-b border-stone-200 px-3 py-2 text-right">שם</th>
                  <th className="border-b border-stone-200 px-3 py-2 text-right">טלפון</th>
                  <th className="border-b border-stone-200 px-3 py-2 text-center">תאריך לידה</th>
                  <th className="border-b border-stone-200 px-3 py-2 text-center">חולצה</th>
                  <th className="border-b border-stone-200 px-3 py-2 text-center">מכנס</th>
                  <th className="border-b border-stone-200 px-3 py-2 text-center">פוטר</th>
                  {canEdit && <th className="border-b border-stone-200 px-3 py-2 w-20" />}
                </tr>
              </thead>
              <tbody>
                {teamPlayers.map((p) =>
                  canEdit && editing === p.id ? (
                    <tr key={p.id}>
                      <td colSpan={8} className="p-3 bg-stone-50">
                        <PlayerForm
                          initial={p}
                          jerseyTaken={(j) => jerseyTakenBy(j, p.id)}
                          onSave={handleSavePlayer}
                          onCancel={() => setEditing(null)}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id} className="hover:bg-stone-50">
                      <td className="border-b border-stone-100 px-3 py-2.5 text-center tabular-nums font-semibold text-stone-800">{p.jerseyNumber || "—"}</td>
                      <td className="border-b border-stone-100 px-3 py-2.5 font-medium text-stone-800">{p.name}</td>
                      <td className="border-b border-stone-100 px-3 py-2.5 text-stone-700" dir="ltr" style={{ textAlign: "right" }}>{p.phone || "—"}</td>
                      <td className="border-b border-stone-100 px-3 py-2.5 text-center tabular-nums text-stone-700">{p.birthDate || "—"}</td>
                      <td className="border-b border-stone-100 px-3 py-2.5 text-center text-stone-700">{p.shirtSize || "—"}</td>
                      <td className="border-b border-stone-100 px-3 py-2.5 text-center text-stone-700">{p.pantsSize || "—"}</td>
                      <td className="border-b border-stone-100 px-3 py-2.5 text-center text-stone-700">{p.sweaterSize || "—"}</td>
                      {canEdit && (
                        <td className="border-b border-stone-100 px-3 py-2.5">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => setEditing(p.id)} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" aria-label="ערוך">
                              <IconPencil size={14} />
                            </button>
                            <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-stone-600 hover:text-red-600" aria-label="מחק">
                              <IconTrash size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
