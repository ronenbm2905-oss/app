import { useState } from "react";
import { departureFor, withDeparture, departBeforeOf } from "../utils/transport";
import { syncGamesToSessions } from "../utils/games";
import { IconAlert, IconPencil } from "./ui/icons";

// Changing ONE trip, when the club's standing rule does not fit it.
//
// The number above this — gather N minutes before tip-off — is right most weeks and wrong
// some. A long drive, a coach who wants the squad there early, a bus that can only come
// later. Before this, the only way to move one trip was to change the number for every
// trip, which also moved every other squad's departure without anyone meaning to.
//
// CLOSED BY DEFAULT, and that is the whole shape of this component. A week with two away
// games made an always-open list look harmless; a week with fifteen would have put a wall
// of form fields above the sheet the manager actually came here to send. Editing a trip is
// the exception — the rule is that nothing needs changing — so the exception asks first.
//
// What does NOT hide: a trip whose fixture moved after someone set a departure by hand. A
// warning behind a collapsed panel is a warning nobody reads.
export function TransportRowEdits({ data, save, awayGames }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState("");
  const [msg, setMsg] = useState("");

  const departBefore = departBeforeOf(data);
  if (!awayGames || awayGames.length === 0) return null;

  const teamName = (id) => (data.teams || []).find((t) => t.id === id)?.name || "";
  const states = awayGames.map((g) => ({ game: g, d: departureFor(g, departBefore) }));
  const changed = states.filter((s) => s.d.manual).length;
  const stale = states.filter((s) => s.d.stale);

  const setDeparture = (game, at) => {
    save({ ...data, games: withDeparture(data.games || [], game.federationCode, at) });
    setMsg(
      at
        ? `${teamName(game.teamId)} — יציאה ב-${at}.`
        : `${teamName(game.teamId)} — חזר לחישוב לפי ${departBefore} דק'.`
    );
  };

  const setAddress = (game, address) => {
    const nextGames = (data.games || []).map((g) =>
      String(g.federationCode) === String(game.federationCode)
        ? { ...g, addressOverride: address.trim() }
        : g
    );
    // The board carries the address in the game row's note, so it is rebuilt with the games.
    save({ ...data, games: nextGames, sessions: syncGamesToSessions(nextGames, { ...data, games: nextGames }) });
    setMsg(`${teamName(game.teamId)} — הכתובת עודכנה.`);
  };

  return (
    <div className="space-y-2" dir="rtl">
      {/* Out of the panel on purpose — see above. */}
      {stale.length > 0 && (
        <div className="text-xs rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-2.5 flex items-start gap-1.5">
          <IconAlert size={13} className="mt-0.5 shrink-0" />
          <span>
            {stale.length === 1
              ? `שעת המשחק של ${teamName(stale[0].game.teamId)} השתנתה מאז שנקבעה יציאה ידנית`
              : `${stale.length} משחקים זזו מאז שנקבעה להם יציאה ידנית`}
            {" "}— חזרנו לחישוב הרגיל. פתחו את השינויים וקבעו שוב אם צריך.
          </span>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 text-sm rounded-lg border border-stone-200 bg-white px-3 py-2 hover:bg-stone-50"
      >
        <span className="flex items-center gap-1.5 text-stone-700">
          <IconPencil size={14} className="text-stone-500" />
          שינוי שעת יציאה או כתובת לנסיעה בודדת
        </span>
        <span className="text-xs text-stone-500">
          {changed > 0 ? `${changed} שונו ידנית · ` : ""}
          {open ? "סגור" : "פתח"}
        </span>
      </button>

      {open && (
        <div className="bg-white rounded-xl border border-stone-200 p-3 space-y-1.5">
          <p className="text-xs text-stone-600">
            שדה יציאה ריק חוזר לחישוב לפי {departBefore} דק' לפני המשחק.
          </p>

          {states.map(({ game: g, d }) => {
            const isOpen = editing === g.federationCode;
            return (
              <div key={g.federationCode} className="border border-stone-200 rounded-lg px-2.5 py-2">
                {/* One line per trip, so fifteen of them stay a list and not a form. */}
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="font-medium text-stone-800">{teamName(g.teamId)}</span>
                  <span className="text-stone-500 text-xs">{g.date} · משחק {g.time}</span>
                  <span className="text-stone-700 text-xs flex-1 min-w-[6rem]">נגד {g.opponent}</span>
                  <span className={`text-xs ${d.manual ? "text-indigo-700 font-medium" : "text-stone-500"}`}>
                    יציאה {d.time || "—"}{d.manual ? " (ידני)" : ""}
                  </span>
                  <button
                    onClick={() => setEditing(isOpen ? "" : g.federationCode)}
                    className="px-2 py-1 text-xs rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50"
                  >
                    {isOpen ? "סגור" : "שנה"}
                  </button>
                </div>

                {isOpen && (
                  <div className="flex items-end gap-2 flex-wrap pt-2">
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
                )}
              </div>
            );
          })}

          <p role="status" aria-live="polite" className="text-xs text-stone-700 min-h-[1rem]">{msg}</p>
        </div>
      )}
    </div>
  );
}
