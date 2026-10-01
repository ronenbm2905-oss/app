import { useState } from "react";
import { draftToGame, replaceGame, applyMove, classify } from "../utils/cupScan";
import { matchHall } from "../utils/halls";
import { syncGamesToSessions } from "../utils/games";
import { IconAlert, IconCheck, IconX } from "./ui/icons";
import { DAYS } from "../constants";

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
  // Clearing a hand-typed address is a decision, so it is a checkbox and not a side effect.
  const [clearAddr, setClearAddr] = useState({});

  if (!scan) return null;

  // RE-SORTED HERE, AGAINST THE CLUB AS IT IS NOW — the stored lists are only a source of
  // drafts.
  //
  // The scan document is written at 03:00 and the banner shows the most recent UNRESOLVED
  // one, which can be days old. Between the scan and the click a fixture can be added,
  // cancelled, imported or edited, and the lists would still describe the club as it was.
  // The first version of the move detection made this acute: after a deploy the stored
  // document still filed a moved fixture under "new", and approving it would have created a
  // duplicate. Classifying here closes the deploy window, the stale proposal, a manual edit
  // made since, and any future drift — all four, with one call.
  const drafts = [
    ...(scan.fresh || []),
    ...(scan.possible || []).map((p) => p.draft),
    ...(scan.moved || []).map((m) => m.draft),
  ].filter(Boolean);
  const sorted = classify(drafts, data.games || [], { today: new Date() });
  const fresh = sorted.fresh;
  const possible = sorted.possible;
  const moved = sorted.moved;
  if (fresh.length === 0 && possible.length === 0 && moved.length === 0) return null;

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
      // The live record, for the same reason as above — this one is older debt, same line.
      String(g.federationCode) === String(old.federationCode) ? replaceGame(draft, g) : g
    );
    save({ ...data, games: nextGames, sessions: syncGamesToSessions(nextGames, { ...data, games: nextGames }) });
    setMsg(`הוחלף: ${draft.date} · ${draft.opponent}${old.teamId ? ` · ${teamName(old.teamId)}` : ""}`);
  };

  // The fixture is ours already and the federation moved it. Not an addition and not a
  // replacement — the record stays, with its own code, and only the date and hour change.
  // See `applyMove` for why taking the cup code here would make the next weekly import
  // report this fixture as cancelled.
  // Where the fixture is PLAYED, when the federation moved it there. `venue` is text; the
  // board, the transport sheet and the parents' page read `hallId` for a home fixture and
  // `addressOverride` for an away one. Keeping both is right when only the clock moved and
  // wrong when the hall did — so the screen asks, and only then are they written.
  const move = (draft, old, opts = {}) => {
    const nextGames = (data.games || []).map((g) =>
      // `g`, THE LIVE RECORD — never `old`, which is the copy frozen into the scan document
      // at 03:00 and may be days stale. `applyMove` spreads what it is given, so passing the
      // snapshot would write it back over everything done since: a driver, an address, a
      // squad, a score. The worst case is a fixture CANCELLED since the scan — the snapshot
      // carries no `cancelled`, so it would quietly return to the board and the coach would
      // be told it moved.
      String(g.federationCode) === String(old.federationCode) ? applyMove(g, draft, DAYS, opts) : g
    );
    save({ ...data, games: nextGames, sessions: syncGamesToSessions(nextGames, { ...data, games: nextGames }) });
    setMsg(`עודכן: ${draft.opponent} · ${old.date} ← ${draft.date} ${draft.time}`);
  };

  // Did the federation move it somewhere else, as opposed to only moving the clock?
  const placeMoved = (draft, old) =>
    String(draft?.venue || "").trim() !== "" &&
    String(draft.venue).trim() !== String(old?.venue || "").trim();

  const movedDone = (old, draft) =>
    (data.games || []).some(
      (g) => String(g.federationCode) === String(old.federationCode) && String(g.date) === String(draft.date)
    );

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

      {/* FIRST, above new fixtures and above the ambiguous ones. A moved fixture is the only
          kind here that is already on somebody's calendar — a squad, a hall booking, parents
          who have been told a date. It is also the one a manager can act on without a single
          decision to make, so leaving it below two sections of choices buries the easy one. */}
      {moved.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-sky-800">
            האיגוד הזיז משחק שכבר יש אצלך
          </div>
          {moved.map(({ draft, existing, by }) => (
            <div key={draft.federationCode} className="border border-sky-300 bg-sky-50 rounded-lg p-2.5 space-y-2">
              <div className="text-sm text-stone-800">
                {existing.opponent}
                {existing.teamId ? ` · ${teamName(existing.teamId)}` : ""}
                {existing.league ? ` · ${existing.league}` : ""}
              </div>
              {/* The new date leads and the old one is named as such — never an arrow between
                  them. An arrow has no direction the bidi algorithm must respect, and on a
                  phone it came out backwards, which made the sentence say the opposite. */}
              <div className="text-sm text-sky-900 font-medium">
                {draft.date} · {draft.time} <span className="font-normal text-sky-800">(במקום {existing.date} · {existing.time || "--:--"})</span>
              </div>
              {draft.venue && draft.venue !== existing.venue && (
                <div className="text-xs text-sky-900">
                  {draft.venue} <span className="text-sky-800">(במקום {existing.venue || "—"})</span>
                </div>
              )}
              {/* HOW the match was made, said out loud. A match by id is the same fixture
                  beyond doubt; a match by competition, opponent and side is an inference, and
                  the person pressing the button is the only one who can confirm it. */}
              {by === "fixture" && (
                <div className="text-xs text-sky-900 bg-white/70 rounded-lg px-2 py-1.5">
                  זוהה לפי <span className="font-medium">המפעל, היריבה וצד המגרש</span> — לא לפי קוד
                  המשחק. ודא/י שזה אותו משחק לפני העדכון.
                </div>
              )}
              {/* THE PLACE, when it moved. `venue` is text; where people actually drive is the
                  hall for a home fixture and the address typed by hand for an away one. */}
              {placeMoved(draft, existing) && (
                <div className="text-xs text-sky-900 space-y-1.5">
                  {draft.isHome ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>האולם זז — בחר/י את האולם החדש:</span>
                      <HallPick draft={draft} />
                    </div>
                  ) : existing.addressOverride ? (
                    <label className="flex items-start gap-1.5">
                      <input
                        type="checkbox"
                        checked={Boolean(clearAddr[draft.federationCode])}
                        onChange={(e) =>
                          setClearAddr((p) => ({ ...p, [draft.federationCode]: e.target.checked }))
                        }
                        className="mt-0.5"
                      />
                      <span>
                        הזנת כתובת ידנית (<span className="font-medium">{existing.addressOverride}</span>) והיא
                        גוברת על מה שהאיגוד פרסם. לנקות אותה ולהשתמש בכתובת החדשה?
                      </span>
                    </label>
                  ) : null}
                </div>
              )}
              {movedDone(existing, draft) ? (
                <div className="text-xs text-emerald-700 flex items-center gap-1">
                  <IconCheck size={13} /> עודכן בלוח
                </div>
              ) : (
                <button
                  onClick={() =>
                    move(draft, existing, {
                      ...(placeMoved(draft, existing) && draft.isHome
                        ? { hallId: pickedHall[draft.federationCode] ?? matchHall(draft.venue, data.halls) }
                        : {}),
                      clearAddressOverride: Boolean(clearAddr[draft.federationCode]),
                    })
                  }
                  title="הקבוצה, הנהג והתוצאה נשמרים. מתעדכנים התאריך, השעה, היום והמיקום שהאיגוד פרסם"
                  className="px-3 py-1.5 text-xs rounded-lg bg-sky-700 text-white hover:bg-sky-800"
                >
                  עדכון המועד
                </button>
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
