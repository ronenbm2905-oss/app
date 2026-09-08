import { useState, useRef } from "react";
import { progressKeysFor } from "../utils/playerProgress";
import { exportPlayersXlsx, exportSizesXlsx } from "../utils/playerExport";
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

export function PlayersView({ data, save, canEdit, progress, removeProgress, progressReady }) {
  const [deleting, setDeleting] = useState(false);
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

  // "Don't know" is not "none", and both deletions ask this first.
  //
  // The guard below counts notes in a map that is empty in two very different situations:
  // nothing was ever written, and the listen failed. `progressCountFor` cannot tell them
  // apart — by design, so that a broken read never crashes a display — which makes the
  // question belong here, at the one caller that acts on the answer irreversibly.
  const knowsAboutProgress = () => {
    if (progressReady) return true;
    window.alert(
      "רשימת ההערכות עדיין נטענת, או שטעינתה נכשלה. רענן/י את הדף ונסה/י שוב — " +
      "אי אפשר למחוק שחקן/ית בלי לדעת אם נכתבה עליו/ה הערכת התקדמות."
    );
    return false;
  };

  // Removing a player removes the notes written about them, in that order.
  //
  // The block that used to sit here was the wrong shape. It refused the deletion and told
  // the manager to remove the notes first — but nothing in the app can remove a note, so
  // "first" meant the Firebase console, and in practice a child with one note written
  // about them could not be taken off the roster at all.
  //
  // The reasoning behind the refusal was still right, and it is what decides the ORDER
  // here: a note is filed under the player's id and deliberately carries no name, so a
  // note that outlives its roster entry cannot be linked back to the child — and a
  // parent's request to see or delete it could no longer be answered. So the notes go
  // first and the roster entry second, and if the notes fail to delete, nothing else
  // happens. The one outcome that must never occur is a surviving note with no owner.
  const confirmWithNotes = (n, head) =>
    window.confirm(
      n === 0
        ? head
        : head +
          (n === 1
            ? "\n\nנכתבה עליו/ה הערכת התקדמות אחת, והמחיקה תמחק גם אותה — לצמיתות.\n"
            : `\n\nנכתבו ${n} הערכות התקדמות, והמחיקה תמחק גם אותן — לצמיתות.\n`) +
          "זה הסדר הנכון: הערכה שנשארת אחרי שהשם הוסר אינה ניתנת לקישור חזרה לשחקן/ית, " +
          "ולא נוכל לענות עליה לבקשת עיון או מחיקה של הורה."
    );

  // Offline, deleteDoc's promise never settles: the write applies to the local cache, the
  // notes vanish from the screen, and the player is never removed — with nothing on screen
  // saying so. A manager who pressed again would be shown "0 notes", because the map had
  // already updated locally. So the buttons go quiet until it resolves.
  const dropNotes = async (keys) => {
    if (keys.length === 0) return true;
    try {
      await removeProgress(keys);
      return true;
    } catch {
      window.alert("מחיקת ההערכות נכשלה, ולכן לא נמחק דבר. בדוק/בדקי את החיבור ונסה/י שוב.");
      return false;
    }
  };

  const handleDelete = async (id) => {
    if (deleting || !knowsAboutProgress()) return;
    const keys = progressKeysFor(progress, id);
    // No confirmation existed here at all, while deleting a coach or a hall has always
    // asked. One misplaced tap removed a child's record with nothing in between.
    const who = players.find((pl) => pl.id === id);
    // Named, because the roster is a dense table with a bin icon on every row and the
    // squad-wide delete already had to name what it was about to remove.
    if (!confirmWithNotes(keys.length, `למחוק את ${who?.name || "השחקן/ית"} מהרשימה?`)) return;
    setDeleting(true);
    const ok = await dropNotes(keys);
    setDeleting(false);
    if (!ok) return;
    save({ ...data, players: players.filter((pl) => pl.id !== id) });
  };

  // Undoing a mis-aimed import.
  //
  // An import is thirty names at once, and the way it goes wrong is always the same: the
  // squad picker was left on the previous team. Taking that back one row at a time is not
  // a real option, so the whole roster of ONE squad comes out in a single action.
  //
  // The confirmation names the squad and the count rather than asking "are you sure",
  // because choosing the wrong squad is the exact mistake being undone here — the number
  // and the name are what tell the manager whether this is the list they meant. Notes are
  // counted across the whole squad and deleted with it, on the same rule as above; here it
  // matters more, not less, because one action can sever thirty links at once.
  const handleClearTeam = async () => {
    if (deleting || !knowsAboutProgress()) return;
    const keys = progressKeysFor(progress, teamPlayers.map((pl) => pl.id));
    const head =
      teamPlayers.length === 1
        ? `למחוק את השחקן/ית היחיד/ה בקבוצת "${teamName}"?

הפעולה אינה הפיכה. אם הרשימה יובאה בטעות לקבוצה הזו — זו הדרך לבטל אותה.`
        : `למחוק את כל ${teamPlayers.length} השחקנים מקבוצת "${teamName}"?

הפעולה אינה הפיכה. אם הרשימה יובאה בטעות לקבוצה הזו — זו הדרך לבטל אותה.`;
    if (!confirmWithNotes(keys.length, head)) return;
    setDeleting(true);
    const ok = await dropNotes(keys);
    setDeleting(false);
    if (!ok) return;
    const removed = teamPlayers.length;
    save({ ...data, players: players.filter((pl) => pl.teamId !== teamId) });
    setEditing(null);
    setMsg({
      type: "success",
      text:
        (removed === 1
          ? `נמחק שחקן/ית אחד/ת מקבוצת "${teamName}"`
          : `נמחקו ${removed} שחקנים מקבוצת "${teamName}"`) +
        (keys.length === 0
          ? "."
          : keys.length === 1
            ? ", ונמחקה גם הערכת התקדמות אחת."
            : `, ונמחקו גם ${keys.length} הערכות התקדמות.`),
    });
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
            {/* Both exports cover EVERY squad, not the one on screen — a uniform order and
                a club roster are both club-wide, and a per-team file would be assembled by
                hand from six downloads. The labels say so; the tooltips repeat it. */}
            {players.length > 0 && (
              <>
                <button
                  onClick={() => exportPlayersXlsx(players, data.teams)}
                  title="כל הקבוצות · שם, מספר, טלפון, תאריך לידה ומידות — לשימוש פנימי"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-50"
                >
                  <IconDownload size={15} /> ייצוא כל השחקנים
                </button>
                <button
                  onClick={() => exportSizesXlsx(players, data.teams)}
                  title="כל הקבוצות · שם, מספר ומידות בלבד — בלי טלפון ובלי תאריך לידה"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-50"
                >
                  <IconDownload size={15} /> מידות להזמנה
                </button>
              </>
            )}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
            <button onClick={() => setEditing("new")} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700">
              <IconPlus size={15} /> הוסף שחקן
            </button>
            {/* Only offered when there is a list to undo. */}
            {teamPlayers.length > 0 && (
              <button
                onClick={handleClearTeam}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-white border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-40"
                title={`מחיקת כל ${teamPlayers.length} השחקנים מקבוצת "${teamName}"`}
              >
                <IconTrash size={15} /> {deleting ? "מוחק..." : "מחק את כל הרשימה"}
              </button>
            )}
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
                            <button onClick={() => handleDelete(p.id)} disabled={deleting} className="p-1.5 rounded-lg hover:bg-red-50 text-stone-600 hover:text-red-600 disabled:opacity-40" aria-label="מחק">
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
