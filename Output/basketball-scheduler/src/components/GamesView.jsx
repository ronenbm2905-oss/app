import { useState, useRef } from "react";
import { uid, formatDateHe } from "../utils/dates";
import { colorFor } from "../utils/colors";
import { parseXlsxToRows, importGamesFile, syncGamesToSessions } from "../utils/games";
import { TransportExport } from "./TransportExport";
import { Select } from "./ui/Select";
import { teamsWithCoach } from "../utils/teams";
import { Pill } from "./ui/Pill";
import {
  IconPlus, IconTrash, IconX, IconCheck, IconRefresh,
  IconTrophy, IconHome, IconArrowRight, IconPencil,
} from "./ui/icons";

// `initial` = an existing game to edit (its fields pre-fill the form); omit to add a new one.
function ManualGameForm({ data, initial, onSave, onCancel }) {
  const editing = !!initial;
  const [teamId, setTeamId] = useState(initial?.teamId || "");
  const [opponent, setOpponent] = useState(initial?.opponent || "");
  const [isHome, setIsHome] = useState(initial ? !!initial.isHome : true);
  // stored dates are DD-MM-YYYY; the <input type=date> needs YYYY-MM-DD
  const [date, setDate] = useState(
    initial?.date ? initial.date.split("-").reverse().join("-") : ""
  );
  const [time, setTime] = useState(initial?.time || "18:00");
  // home games store venue as a hall name → map back to its id; away games store a free-text address
  const [hallId, setHallId] = useState(
    initial && initial.isHome
      ? data.halls.find((h) => h.name === initial.venue)?.id || ""
      : ""
  );
  const [address, setAddress] = useState(
    initial && !initial.isHome ? initial.venue || "" : ""
  ); // free-text venue for away games
  const [league, setLeague] = useState(initial?.league || "");

  const valid = teamId && opponent.trim() && date && time;

  return (
    <div className="bg-white rounded-xl border border-stone-300 p-4 space-y-3" dir="rtl">
      <h3 className="text-sm font-semibold text-stone-700">{editing ? "עריכת משחק" : "הוספת משחק ידני"}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-stone-500 mb-1 block">קבוצה</label>
          {/* With the coach's name attached: "נערים א" and "נערים ב" are hard to tell
              apart in a list, and picking the wrong one puts a game on the wrong team. */}
          <Select
            value={teamId}
            onChange={setTeamId}
            options={teamsWithCoach(data.teams, data.coaches)}
            placeholder="בחר קבוצה"
          />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">יריב</label>
          <input
            type="text"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="שם הקבוצה היריבה"
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            dir="rtl"
          />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">בית / חוץ</label>
          <Select
            value={isHome ? "home" : "away"}
            onChange={(v) => setIsHome(v === "home")}
            options={[{ id: "home", name: "משחק בית" }, { id: "away", name: "משחק חוץ" }]}
            placeholder="בחר"
          />
        </div>
        {isHome ? (
          <div>
            <label className="text-xs text-stone-500 mb-1 block">אולם</label>
            <Select value={hallId} onChange={setHallId} options={data.halls} placeholder="בחר אולם (אופציונלי)" />
          </div>
        ) : (
          <div>
            <label className="text-xs text-stone-500 mb-1 block">כתובת המשחק</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="כתובת האולם היריב (להסעות)"
              className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              dir="rtl"
            />
          </div>
        )}
        <div>
          <label className="text-xs text-stone-500 mb-1 block">תאריך</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block">שעה</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-stone-500 mb-1 block">ליגה (אופציונלי)</label>
          <input
            type="text"
            value={league}
            onChange={(e) => setLeague(e.target.value)}
            placeholder="שם הליגה"
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            dir="rtl"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50">
          ביטול
        </button>
        <button
          disabled={!valid}
          onClick={() =>
            onSave({
              federationCode: initial?.federationCode || `manual-${uid()}`,
              teamId,
              opponent: opponent.trim(),
              isHome,
              date: date.split("-").reverse().join("-"), // YYYY-MM-DD -> DD-MM-YYYY
              time,
              venue: isHome
                ? hallId
                  ? data.halls.find((h) => h.id === hallId)?.name || ""
                  : ""
                : address.trim(),
              league: league.trim(),
              round: initial?.round || "",
              weekDay: "",
              ourScore: initial?.ourScore ?? null,
              theirScore: initial?.theirScore ?? null,
              manual: true,
            })
          }
          className="px-3 py-1.5 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 flex items-center gap-1.5"
        >
          <IconCheck size={15} /> שמור משחק
        </button>
      </div>
    </div>
  );
}

// Imported games are owned by the federation file, so only their address is hand-editable.
// The value is stored as `addressOverride`, which survives re-import (see importGamesFile).
function ImportedAddressForm({ game, onSave, onCancel }) {
  const [address, setAddress] = useState(game.addressOverride || game.venue || "");
  return (
    <div className="bg-white rounded-xl border border-stone-300 p-4 space-y-3" dir="rtl">
      <h3 className="text-sm font-semibold text-stone-700">עריכת כתובת — נגד {game.opponent}</h3>
      <p className="text-xs text-stone-500">
        כתובת ידנית למשחק חוץ מיובא. תישמר גם אחרי ייבוא/סנכרון מחדש של קובץ האיגוד.
      </p>
      <div>
        <label className="text-xs text-stone-500 mb-1 block">כתובת המשחק</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="כתובת האולם היריב (להסעות)"
          className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          dir="rtl"
          autoFocus
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50">
          ביטול
        </button>
        <button
          onClick={() => onSave(address.trim())}
          className="px-3 py-1.5 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 flex items-center gap-1.5"
        >
          <IconCheck size={15} /> שמור כתובת
        </button>
      </div>
    </div>
  );
}

export function GamesView({ data, save, canEdit, weekStart, setWeekStart }) {
  const [subTab, setSubTab] = useState("games"); // "games" | "mapping"
  const [importMsg, setImportMsg] = useState(null);
  const [filterTeam, setFilterTeam] = useState("");
  const [filterType, setFilterType] = useState(""); // "home"|"away"|""
  const [addingGame, setAddingGame] = useState(false);
  const [editingCode, setEditingCode] = useState(null); // federationCode of the manual game being edited
  const fileInputRef = useRef(null);

  const games = data.games || [];
  const mapping = data.gameMapping || [];

  const codesFor = (teamId) => mapping.find((m) => m.teamId === teamId)?.federationCodes || [];
  const teamName = (id) => data.teams.find((t) => t.id === id)?.name || id;
  const coachNameOf = (id) => data.coaches.find((c) => c.id === id)?.name || "";

  const [editingTeamId, setEditingTeamId] = useState(null);
  const [codeInput, setCodeInput] = useState("");

  const saveCodes = (teamId, codesRaw) => {
    const codes = codesRaw.split(/[\s,،]+/).map((s) => s.trim()).filter(Boolean);
    const existing = mapping.find((m) => m.teamId === teamId);
    const next = existing
      ? mapping.map((m) => (m.teamId === teamId ? { ...m, federationCodes: codes } : m))
      : [...mapping, { teamId, federationCodes: codes }];
    save({ ...data, gameMapping: next });
    setEditingTeamId(null);
    setCodeInput("");
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const buf = await file.arrayBuffer();
    let rawRows;
    try {
      rawRows = parseXlsxToRows(buf);
    } catch {
      setImportMsg({ type: "error", text: "שגיאה בקריאת הקובץ. וודא שמדובר בקובץ xlsx תקין." });
      return;
    }

    const result = importGamesFile(rawRows, data);
    if (result.error === "no-mapping") {
      setImportMsg({
        type: "error",
        text: "לא הגדרת עדיין מיפוי קודים. עבור לטאב 'מיפוי קבוצות' והגדר את מספרי הקבוצה לכל קבוצה.",
      });
      return;
    }
    if (result.error === "no-home-keywords") {
      setImportMsg({
        type: "error",
        text: "לא הגדרת את שמות המועדון כפי שהם מופיעים בקובץ האיגוד, ובלעדיהם כל משחק יסומן כמשחק חוץ. עבור להגדרות → זיהוי משחקי בית והזן את הווריאציות.",
      });
      return;
    }

    const { nextGames, nextSessions, added, updated, skipped } = result;
    save({ ...data, games: nextGames, sessions: nextSessions });
    setImportMsg({
      type: "success",
      text: `סנכרון הושלם: ${added} משחקים חדשים נוספו, ${updated} עודכנו.${
        skipped > 0 ? ` (${skipped} שורות סוננו - לא מהמועדון)` : ""
      } כל המשחקים עודכנו בלוח האימונים.`,
    });
  };

  const filtered = games.filter(
    (g) =>
      (!filterTeam || g.teamId === filterTeam) &&
      (!filterType || (filterType === "home" ? g.isHome : !g.isHome))
  );

  const gameResult = (g) => {
    if (g.ourScore === null || g.theirScore === null) return null;
    if (g.ourScore > g.theirScore) return "win";
    if (g.ourScore < g.theirScore) return "loss";
    return "draw";
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex gap-1 bg-stone-200/50 rounded-lg p-1 w-fit">
        <button
          onClick={() => setSubTab("games")}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            subTab === "games" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
          }`}
        >
          לוח משחקים
        </button>
        {canEdit && (
          <button
            onClick={() => setSubTab("mapping")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              subTab === "mapping" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
            }`}
          >
            מיפוי קבוצות
          </button>
        )}
      </div>

      {canEdit && subTab === "mapping" && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            <strong>הסבר:</strong> לכל קבוצה פנימית שלך יש <strong>מספר קבוצה</strong> — המספר שמופיע בעמודה הראשונה ("מספר קבוצה") בקובץ האקסל מהאיגוד. אם לאותה קבוצה יש כמה מספרים (ליגות שונות), הפרד אותם בפסיקים.
            <br />
            לדוגמה: קטסל ב בנות = <strong>11758</strong> | נוער ארצית = <strong>3368</strong>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            {data.teams.length === 0 ? (
              <div className="p-6 text-center text-stone-600 text-sm">הוסף קבוצות קודם במסך "קבוצות ואולמות".</div>
            ) : (
              <div className="divide-y divide-stone-100">
                {data.teams.map((team) => {
                  const codes = codesFor(team.id);
                  const isEditing = editingTeamId === team.id;
                  return (
                    <div key={team.id} className="px-4 py-3">
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorFor(team.id, data.teams.map((t) => t.id)) }} />
                            <span className="text-sm font-medium text-stone-700">{team.name}</span>
                            {team.coachId && <span className="text-xs text-stone-500">· {coachNameOf(team.coachId)}</span>}
                          </div>
                          <input
                            type="text"
                            value={codeInput}
                            onChange={(e) => setCodeInput(e.target.value)}
                            placeholder="מספרי קבוצה, מופרדים בפסיק. לדוגמה: 11758, 3368"
                            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            dir="ltr"
                            autoFocus
                          />
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => { setEditingTeamId(null); setCodeInput(""); }} className="px-3 py-1.5 text-xs rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50">
                              ביטול
                            </button>
                            <button onClick={() => saveCodes(team.id, codeInput)} className="px-3 py-1.5 text-xs rounded-lg bg-brand-600 text-white hover:bg-brand-700 flex items-center gap-1">
                              <IconCheck size={13} /> שמור
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorFor(team.id, data.teams.map((t) => t.id)) }} />
                          <div className="flex-1">
                            <div className="text-sm text-stone-700">{team.name}</div>
                            {team.coachId && <div className="text-xs text-stone-500">מאמן: {coachNameOf(team.coachId)}</div>}
                          </div>
                          {codes.length > 0 ? (
                            <div className="flex gap-1 flex-wrap">
                              {codes.map((c) => (
                                <span key={c} className="px-2 py-0.5 bg-stone-100 text-stone-600 text-xs rounded font-mono">{c}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-stone-600 italic">לא הוגדר</span>
                          )}
                          <button onClick={() => { setEditingTeamId(team.id); setCodeInput(codes.join(", ")); }} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" aria-label="ערוך">
                            <IconPlus size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === "games" && (
        <div className="space-y-4">
          {canEdit && (
            <TransportExport data={data} weekStart={weekStart} setWeekStart={setWeekStart} />
          )}
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              {canEdit && (
                <>
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-50">
                    <IconRefresh size={15} /> ייבוא / סנכרון קובץ מהאיגוד
                  </button>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
                  {games.filter((g) => !g.manual).length > 0 && (
                    <button
                      onClick={() => {
                        const manualOnly = games.filter((g) => g.manual);
                        const sessionsWithoutGames = (data.sessions || []).filter((s) => !s.fromGame);
                        save({ ...data, games: manualOnly, sessions: sessionsWithoutGames });
                        setImportMsg({ type: "success", text: "כל משחקי הייבוא נמחקו." });
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <IconTrash size={15} /> נקה ייבוא
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={filterTeam} onChange={setFilterTeam} options={data.teams} placeholder="כל הקבוצות" className="w-40" />
              <Select value={filterType} onChange={setFilterType} options={[{ id: "home", name: "משחק בית" }, { id: "away", name: "משחק חוץ" }]} placeholder="בית / חוץ" className="w-36" />
              {canEdit && (
                <button onClick={() => setAddingGame((g) => !g)} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700">
                  <IconPlus size={15} /> משחק ידני
                </button>
              )}
            </div>
          </div>

          {canEdit && addingGame && (
            <ManualGameForm
              data={data}
              onSave={(game) => {
                const nextGames = [...games, game];
                save({ ...data, games: nextGames, sessions: syncGamesToSessions(nextGames, data) });
                setAddingGame(false);
              }}
              onCancel={() => setAddingGame(false)}
            />
          )}

          {importMsg && (
            <div className={`text-xs rounded-lg p-2.5 flex items-center justify-between ${importMsg.type === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
              <span>{importMsg.text}</span>
              <button onClick={() => setImportMsg(null)} aria-label="סגור הודעה">
                <IconX size={14} />
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <IconTrophy size={28} className="mx-auto text-stone-300" />
                <p className="text-stone-600 text-sm">
                  {games.length === 0
                    ? canEdit
                      ? "אין עדיין משחקים. ייבא קובץ מהאיגוד או הוסף משחק ידני."
                      : "אין עדיין משחקים."
                    : "אין משחקים שמתאימים לסינון."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {filtered.map((g, i) => {
                  const result = gameResult(g);
                  const resultColor = result === "win" ? "#16A34A" : result === "loss" ? "#DC2626" : "#CA8A04";
                  if (canEdit && editingCode === g.federationCode && (g.manual || !g.isHome)) {
                    const saveGame = (game) => {
                      const nextGames = games.map((x) =>
                        x.federationCode === game.federationCode ? game : x
                      );
                      save({ ...data, games: nextGames, sessions: syncGamesToSessions(nextGames, data) });
                      setEditingCode(null);
                    };
                    return (
                      <div key={g.federationCode || i} className="p-3">
                        {g.manual ? (
                          <ManualGameForm
                            data={data}
                            initial={g}
                            onSave={saveGame}
                            onCancel={() => setEditingCode(null)}
                          />
                        ) : (
                          <ImportedAddressForm
                            game={g}
                            onSave={(addr) => saveGame({ ...g, addressOverride: addr })}
                            onCancel={() => setEditingCode(null)}
                          />
                        )}
                      </div>
                    );
                  }
                  return (
                    <div key={g.federationCode || i} className="flex items-center gap-3 px-4 py-3 flex-wrap">
                      <div className="w-28 shrink-0">
                        <div className="text-xs font-medium text-stone-700">{formatDateHe(g.date)}</div>
                        <div className="text-xs text-stone-600">{g.time}</div>
                      </div>
                      <Pill color={colorFor(g.teamId, data.teams.map((t) => t.id))}>{teamName(g.teamId)}</Pill>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${g.isHome ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
                        {g.isHome ? (<><IconHome size={11} /> בית</>) : (<><IconArrowRight size={11} /> חוץ</>)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-stone-700 truncate">נגד: {g.opponent}</div>
                        <div className="text-xs text-stone-600 truncate">
                          {g.addressOverride || g.venue}
                          {g.addressOverride && <span className="text-stone-400"> (כתובת ידנית)</span>}
                        </div>
                      </div>
                      <div className="hidden sm:block text-right shrink-0">
                        <div className="text-xs text-stone-500 truncate max-w-32">{g.league}</div>
                        {g.round !== "" && g.round !== 0 && <div className="text-xs text-stone-600">מחזור {g.round}</div>}
                      </div>
                      {result !== null ? (
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-bold tabular-nums" style={{ color: resultColor }}>
                            {g.ourScore}:{g.theirScore}
                          </div>
                          <div className="text-xs font-medium" style={{ color: resultColor }}>
                            {result === "win" ? "ניצחון" : result === "loss" ? "הפסד" : "תיקו"}
                          </div>
                        </div>
                      ) : (
                        <div className="shrink-0 text-xs text-stone-500">טרם נקבע</div>
                      )}
                      {canEdit && g.manual && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setEditingCode(g.federationCode)}
                            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
                            aria-label="ערוך משחק"
                          >
                            <IconPencil size={14} />
                          </button>
                          <button
                            onClick={() => {
                              const nextGames = games.filter((_, j) => j !== games.indexOf(g));
                              save({ ...data, games: nextGames, sessions: syncGamesToSessions(nextGames, data) });
                            }}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-stone-500 hover:text-red-600"
                            aria-label="מחק משחק"
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                      )}
                      {canEdit && !g.manual && !g.isHome && (
                        <button
                          onClick={() => setEditingCode(g.federationCode)}
                          className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 shrink-0"
                          aria-label="ערוך כתובת"
                          title="ערוך כתובת (להסעות)"
                        >
                          <IconPencil size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {filtered.length > 0 && (
            <div className="text-xs text-stone-600 text-left">
              {filtered.length} משחקים{filterTeam || filterType ? " (מסוננים)" : ""}
              {games.length !== filtered.length ? ` מתוך ${games.length}` : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
