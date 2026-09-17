import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, CLUB_ID, isFirebaseConfigured } from "../firebase";
import { DAYS } from "../constants";
import clubLogo from "../assets/club-logo.jpg";

// The page a parent opens from the team's WhatsApp group.
//
// It is rendered BEFORE the login gate and it never touches the club document — see
// `utils/teamBoard.js` for why that is the whole point rather than an optimisation. It
// reads exactly one document, the one built for this team, and that document contains no
// person's data at all.
//
// Everything here assumes a phone held in one hand, because that is where it will be read.

const fmtWeek = (iso) => {
  if (!iso) return "";
  const a = new Date(iso + "T00:00:00");
  const b = new Date(a);
  b.setDate(b.getDate() + 6);
  const d = (x) => `${x.getDate()}.${x.getMonth() + 1}`;
  return `${d(a)} – ${d(b)}`;
};

const fmtUpdated = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1} בשעה ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
};

function Row({ row }) {
  const time = [row.start, row.end].filter(Boolean).join("–");
  const struck = row.cancelled ? "line-through opacity-60" : "";
  return (
    <div className={`rounded-lg border p-2.5 ${row.cancelled ? "border-stone-200 bg-stone-50" : "border-stone-200 bg-white"}`}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={`font-semibold text-stone-800 ${struck}`}>{time}</span>
        {row.kind === "game" ? (
          <span className={`text-sm text-stone-700 ${struck}`}>
            🏀 {row.home ? "משחק בית" : "משחק חוץ"}
            {row.opponent ? ` · ${row.opponent}` : ""}
          </span>
        ) : (
          <span className={`text-sm text-stone-700 ${struck}`}>{row.type || "אימון"}</span>
        )}
        {/* A cancellation is the most important word on the line, so it is a word and not a
            colour — the same rule the rest of the app follows. */}
        {row.cancelled && <span className="text-xs font-semibold text-red-700">מבוטל</span>}
      </div>
      {row.where && <div className={`text-sm text-stone-600 mt-0.5 ${struck}`}>{row.where}</div>}
      {row.assembly && !row.cancelled && (
        <div className="text-sm text-amber-800 mt-1 font-medium">🚌 התייצבות {row.assembly}</div>
      )}
    </div>
  );
}

export function TeamBoardPage({ token }) {
  const [board, setBoard] = useState(null);
  const [state, setState] = useState("loading");
  const [weekIdx, setWeekIdx] = useState(0);

  // Saving this page to a phone's home screen, and having it open THIS board.
  //
  // The club's manifest declares `start_url: "/"`, so a parent who added the page would get
  // an icon that opens the club's login screen instead of their team's board — the one
  // place they cannot go. Removing the manifest link is what fixes it: with no start_url to
  // obey, both iOS and Android use the page that is open, which is exactly this board.
  //
  // The title is set too, because it is what the icon is labelled with.
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    if (link) link.remove();
    return () => {
      // Put it back if this page is ever rendered inside the app rather than on its own.
      if (link && !document.querySelector('link[rel="manifest"]')) document.head.appendChild(link);
    };
  }, []);

  useEffect(() => {
    if (!board?.teamName) return;
    document.title = board.teamName;
    const apple = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (apple) apple.setAttribute("content", board.teamName);
  }, [board?.teamName]);
  useEffect(() => {
    let cancelled = false;
    if (!isFirebaseConfigured) { setState("error"); return; }
    (async () => {
      try {
        const snap = await getDoc(doc(db, "clubs", CLUB_ID, "boards", token));
        if (cancelled) return;
        if (!snap.exists()) { setState("missing"); return; }
        setBoard(snap.data());
        setState("ok");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (state === "loading") {
    return <div className="p-6 text-center text-stone-500 text-sm" dir="rtl">טוען…</div>;
  }
  // A link that was replaced and a link that was mistyped fail the same way, and the person
  // holding it can do nothing about either. So it says what to do, not what went wrong.
  if (state !== "ok") {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6" dir="rtl">
        <div className="bg-white rounded-xl border border-stone-200 p-6 max-w-sm text-center space-y-2">
          <div className="text-lg font-semibold text-stone-800">הקישור אינו פעיל</div>
          <p className="text-sm text-stone-600">
            ייתכן שהוחלף בקישור חדש. בקשו מהמאמן/ת את הקישור העדכני בקבוצת הוואטסאפ.
          </p>
        </div>
      </div>
    );
  }

  const weeks = Object.keys(board.weeks || {}).sort();
  const week = weeks[Math.min(weekIdx, Math.max(weeks.length - 1, 0))] || "";
  const rows = (board.weeks || {})[week] || [];
  const byDay = DAYS.map((d) => ({ day: d, items: rows.filter((r) => r.day === d) })).filter(
    (g) => g.items.length > 0
  );
  const message = board.message?.text ? board.message : null;

  return (
    <div className="min-h-screen bg-stone-100" dir="rtl">
      <div className="max-w-md mx-auto p-3 space-y-3">
        <div className="bg-white rounded-xl border border-stone-200 p-3 flex items-center gap-3">
          <img src={clubLogo} alt="" className="w-11 h-11 rounded-lg object-cover" />
          <div>
            <div className="font-semibold text-stone-800 leading-tight">{board.teamName}</div>
            <div className="text-xs text-stone-500">עירוני קריית אונו — כדורסל</div>
          </div>
        </div>

        {message && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3">
            <div className="text-xs font-semibold text-amber-900 mb-1">
              📣 הודעת המאמן{message.author ? ` · ${message.author}` : ""}
            </div>
            <div className="text-sm text-amber-900 whitespace-pre-wrap">{message.text}</div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-stone-200 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setWeekIdx((i) => Math.max(0, i - 1))}
              disabled={weekIdx <= 0}
              className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-600 disabled:opacity-30"
            >
              ‹ קודם
            </button>
            <span className="text-sm font-medium text-stone-700">{fmtWeek(week)}</span>
            <button
              onClick={() => setWeekIdx((i) => Math.min(weeks.length - 1, i + 1))}
              disabled={weekIdx >= weeks.length - 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-600 disabled:opacity-30"
            >
              הבא ›
            </button>
          </div>

          {byDay.length === 0 ? (
            <p className="text-sm text-stone-500 text-center py-4">אין אימונים או משחקים בשבוע הזה.</p>
          ) : (
            byDay.map((g) => (
              <div key={g.day} className="space-y-1.5">
                <div className="text-sm font-semibold text-stone-500">{g.day}</div>
                {g.items.map((r, i) => <Row key={`${g.day}-${i}`} row={r} />)}
              </div>
            ))
          )}
        </div>

        {/* Reliance, and the same sentence the push notification carries. A parent who drove
            somewhere on the strength of this page has to know what it is and what it is not. */}
        <div className="text-xs text-stone-500 text-center space-y-1 pb-4">
          <div>עודכן: {fmtUpdated(board.updatedAt)}</div>
          <div>זו תצוגה בלבד ואינה מחליפה את ההודעה הרשמית של המועדון.</div>
        </div>
      </div>
    </div>
  );
}
