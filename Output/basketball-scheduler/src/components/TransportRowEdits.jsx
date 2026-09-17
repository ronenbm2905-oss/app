import { useState } from "react";
import { departureFor, withDeparture, departBeforeOf } from "../utils/transport";
import { syncGamesToSessions } from "../utils/games";
import { IconAlert } from "./ui/icons";

// Changing ONE trip, when the club's standing rule does not fit it.
//
// The number above this — gather N minutes before tip-off — is right most weeks and wrong
// some. A long drive, a coach who wants the squad there early, a bus that can only come
// later. Before this the only way to move one trip was to change the number for every trip,
// which also moved every other squad's departure without anyone meaning to.
//
// The address sits here too, because it is the other thing that changes late and the person
// fixing it is looking at this sheet — not at the games screen where the field lives.
export function TransportRowEdits({ data, save, awayGames }) {
  const [msg, setMsg] = useState("");
  const departBefore = departBeforeOf(data);
  if (!awayGames || awayGames.length === 0) return null;

  const teamName = (id) => (data.teams || []).find((t) => t.id === id)?.name || "";

  const setDeparture = (game, at) => {
    const nextGames = withDeparture(data.games || [], game.federationCode, at);
    save({ ...data, games: nextGames });
    setMsg(at ? `${teamName(game.teamId)} — יציאה ב-${at}.` : `${teamName(game.teamId)} — חזר לחישוב לפי ${departBefore} דק'.`);
  };

  const setAddress = (game, address) => {
    const nextGames = (data.games || []).map((g) =>
      String(g.federationCode) === String(game.federationCode) ? { ...g, addressOverride: address.trim() } : g
    );
    // The board carries the address in a game row's note, so it is rebuilt with the games.
    save({ ...data, games: nextGames, sessions: syncGamesToSessions(nextGames, { ...data, games: nextGames }) });
    setMsg(`${teamName(game.teamId)} — הכתובת עודכנה.`);
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-3 space-y-2" dir="rtl">
      <div>
        <h4 className="text-sm font-semibold text-stone-800">שינוי להסעה בודדת</h4>
        <p className="text-xs text-stone-600 mt-0.5">
          שעת יציאה או כתובת שהשתנו למשחק אחד — בלי להזיז את כל השאר.
          שדה יציאה ריק חוזר לחישוב לפי {departBefore} דק' לפני המשחק.
        </p>
      </div>

      {awayGames.map((g) => {
        const d = departureFor(g, departBefore);
        return (
          <div key={g.federationCode} className="border border-stone-200 rounded-lg p-2.5 space-y-2">
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="font-medium text-stone-800">{teamName(g.teamId)}</span>
              <span className="text-stone-600">{g.date} · משחק {g.time}</span>
              <span className="text-stone-700">נגד {g.opponent}</span>
            </div>

            {/* A fixture that moved after someone set a departure by hand. The manual time is
                NOT used — a sheet saying 15:00 for a game now at 20:00 is worse than none —
                and the reason is said here rather than left as a silent fallback. */}
            {d.stale && (
              <div className="text-xs rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-2 flex items-start gap-1.5">
                <IconAlert size={13} className="mt-0.5 shrink-0" />
                <span>
                  שעת המשחק השתנתה מאז שקבעת יציאה ידנית, ולכן חזרנו לחישוב הרגיל. קבע/י שוב אם צריך.
                </span>
              </div>
            )}

            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <label className="text-xs text-stone-500 mb-1 block">שעת יציאה</label>
                <input
                  type="time"
                  defaultValue={d.manual ? d.time : ""}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v !== (d.manual ? d.time : "")) setDeparture(g, v);
                  }}
                  className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
                />
                <div className="text-[11px] text-stone-500 mt-0.5">
                  {d.manual ? "נקבע ידנית" : `לפי החישוב: ${d.time || "—"}`}
                </div>
              </div>

              <div className="flex-1 min-w-[12rem]">
                <label className="text-xs text-stone-500 mb-1 block">כתובת</label>
                <input
                  type="text"
                  defaultValue={g.addressOverride || g.venue || ""}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v.trim() !== String(g.addressOverride || g.venue || "").trim()) setAddress(g, v);
                  }}
                  placeholder="כתובת האולם היריב"
                  className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
                  dir="rtl"
                />
              </div>
            </div>
          </div>
        );
      })}

      <p role="status" aria-live="polite" className="text-xs text-stone-700 min-h-[1rem]">{msg}</p>
    </div>
  );
}
