import { useState } from "react";
import { draftToGame, replaceGame } from "../utils/cupScan";
import { matchHall } from "../utils/halls";
import { syncGamesToSessions } from "../utils/games";
import { IconAlert, IconCheck, IconX } from "./ui/icons";

// What the cup scan found — and the one thing it is not allowed to do on its own.
//
// Every fixture here needs a TEAM, and the scanner deliberately does not guess one. The
// federation's name for this club carries a coach or a sponsor ("עירוני ק. אונו יורם",
// "עירוני קרית אונו ברק"), not the club's own squad names, so a rule matching them would be
// right most of the time — and a fixture filed under the wrong squad is worse than a fixture
// nobody knew about: it appears on someone's board, and they turn up.
//
// So the choice is a dropdown, the fixture is added only when it is made, and nothing that
// is already in the club is ever touched.
export function CupScanBanner({ scan, data, save, resolveScan }) {
  const [picked, setPicked] = useState({});
  // The hall, for HOME fixtures only. Pre-filled from the venue the federation published —
  // which is not spelled the way the club spells it, so the match runs through the rename
  // table — and still a dropdown, because a guess about where a game is played is the kind
  // that sends a squad to the wrong building.
  const [pickedHall, setPickedHall] = useState({});
  const [msg, setMsg] = useState("");

  if (!scan) return null;
  const fresh = scan.fresh || [];
  const possible = scan.possible || [];
  if (fresh.length === 0 && possible.length === 0) return null;

  const teamName = (id) => (data.teams || []).find((t) => t.id === id)?.name || "";

  const add = (draft) => {
    const teamId = picked[draft.federationCode] || "";
    if (!teamId) { setMsg("בחר/י קבוצה לפני ההוספה."); return; }
    // The fixture is appended and the board rebuilt from the games — the same path a
    // federation import takes, so the hours report, transport and calendar see an ordinary
    // game and have no idea this scanner exists.
    const hallId = draft.isHome ? pickedHall[draft.federationCode] ?? matchHall(draft.venue, data.halls) : "";
    const nextGames = [...(data.games || []), draftToGame(draft, teamId, hallId)];
    save({ ...data, games: nextGames, sessions: syncGamesToSessions(nextGames, { ...data, games: nextGames }) });
    setMsg(`נוסף: ${draft.opponent} · ${draft.date} · ${teamName(teamId)}`);
  };

  // Replacing, which is a different act from adding and had to be said out loud: adding
  // leaves TWO games on one date. This swaps the record in place and keeps everything the
  // manager owns — the squad, a nudged block, a typed address, the driver, a recorded score.
  const replace = (draft, old) => {
    const nextGames = (data.games || []).map((g) =>
      String(g.federationCode) === String(old.federationCode) ? replaceGame(draft, old) : g
    );
    save({ ...data, games: nextGames, sessions: syncGamesToSessions(nextGames, { ...data, games: nextGames }) });
    setMsg(`הוחלף: ${draft.date} · ${draft.opponent}${old.teamId ? ` · ${teamName(old.teamId)}` : ""}`);
  };

  const already = (code) => (data.games || []).some((g) => String(g.federationCode) === String(code));

  const TeamPick = ({ draft }) => (
    <select
      value={picked[draft.federationCode] || ""}
      onChange={(e) => setPicked((p) => ({ ...p, [draft.federationCode]: e.target.value }))}
      className="text-xs rounded-lg border border-stone-300 p-1.5 bg-white"
    >
      <option value="">בחר/י קבוצה…</option>
      {(data.teams || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  );

  const HallPick = ({ draft }) => {
    const value = pickedHall[draft.federationCode] ?? matchHall(draft.venue, data.halls);
    return (
      <select
        value={value}
        onChange={(e) => setPickedHall((h) => ({ ...h, [draft.federationCode]: e.target.value }))}
        className="text-xs rounded-lg border border-stone-300 p-1.5 bg-white"
      >
        <option value="">בחר/י אולם…</option>
        {(data.halls || []).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
      </select>
    );
  };

  const Fixture = ({ draft }) => (
    <div className="flex items-center gap-2 flex-wrap text-sm">
      <span className="font-medium text-stone-800">{draft.date}</span>
      <span className="text-stone-600">{draft.time}</span>
      <span className={draft.isHome ? "text-emerald-700" : "text-sky-700"}>
        {draft.isHome ? "בית" : "חוץ"}
      </span>
      <span className="text-stone-800">{draft.opponent}</span>
      {draft.league && <span className="text-xs text-stone-500">· {draft.league}</span>}
      {draft.venue && <span className="text-xs text-stone-500">· {draft.venue}</span>}
    </div>
  );

  return (
    <div className="bg-white border border-sky-300 rounded-xl p-4 space-y-3" dir="rtl">
      <div className="flex items-start gap-2">
        <IconAlert size={16} className="mt-0.5 text-sky-700 shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-stone-800">משחקי גביע באתר האיגוד</h3>
          <p className="text-xs text-stone-600 mt-0.5">
            נסרקו {scan.competitions} מפעלים ({scan.fixturesSeen} משחקים). אלה אינם בקובץ האקסל
            השבועי — הם מתפרסמים בנפרד, עמוד לכל שכבת גיל.
          </p>
        </div>
        <button
          onClick={() => resolveScan(scan.id, "נסגר")}
          aria-label="סגור"
          className="text-stone-400 hover:text-stone-600"
        >
          <IconX size={15} />
        </button>
      </div>

      {fresh.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-stone-700">אין אצלך משחק בתאריך הזה</div>
          {fresh.map((d) => (
            <div key={d.federationCode} className="border border-stone-200 rounded-lg p-2.5 space-y-2">
              <Fixture draft={d} />
              {already(d.federationCode) ? (
                <div className="text-xs text-emerald-700 flex items-center gap-1">
                  <IconCheck size={13} /> נוסף ללוח
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <TeamPick draft={d} />
                  {d.isHome && <HallPick draft={d} />}
                  <button
                    onClick={() => add(d)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-brand-600 text-white hover:bg-brand-700"
                  >
                    הוסף ללוח
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {possible.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-amber-800">
            כבר יש אצלך משחק באותו תאריך — תחליט/י
          </div>
          {/* Shown side by side rather than merged. "מכבי ראשל״צ איציק" and "מכבי ראשון לציון"
              are the same fixture and share no word; no rule can match them, and a person
              needs one glance. */}
          {possible.map(({ draft, existing }) => (
            <div key={draft.federationCode} className="border border-amber-300 bg-amber-50 rounded-lg p-2.5 space-y-2">
              <div className="text-xs text-amber-900 font-medium">באתר האיגוד:</div>
              <Fixture draft={draft} />
              <div className="text-xs text-amber-900 font-medium pt-1">אצלך כבר רשום:</div>
              {(existing || []).map((g, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-stone-700">
                    {g.date} · {g.time || "--:--"} · {g.isHome ? "בית" : "חוץ"} · {g.opponent}
                    {g.teamId ? ` · ${teamName(g.teamId)}` : ""}
                  </span>
                  {!already(draft.federationCode) && (
                    <button
                      onClick={() => replace(draft, g)}
                      title="הקבוצה, השעה שקבעת, הכתובת והנהג נשמרים"
                      className="px-2.5 py-1 text-xs rounded-lg bg-amber-600 text-white hover:bg-amber-700"
                    >
                      החלף בזה של האיגוד
                    </button>
                  )}
                </div>
              ))}
              {already(draft.federationCode) ? (
                <div className="text-xs text-emerald-700 flex items-center gap-1">
                  <IconCheck size={13} /> נוסף ללוח
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <TeamPick draft={draft} />
                  {draft.isHome && <HallPick draft={draft} />}
                  <button
                    onClick={() => add(draft)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-amber-500 text-amber-800 bg-white hover:bg-amber-100"
                  >
                    זה משחק אחר — הוסף בנוסף
                  </button>
                  <span className="text-xs text-amber-800">או השאר כמו שהוא — שתי הרשומות יישארו.</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap pt-1">
        <button
          onClick={() => resolveScan(scan.id, "טופל")}
          className="px-3 py-1.5 text-xs rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50"
        >
          סיימתי עם הרשימה הזו
        </button>
        <p role="status" aria-live="polite" className="text-xs text-stone-700">{msg}</p>
      </div>
    </div>
  );
}
