import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, CLUB_ID, isFirebaseConfigured } from "../firebase";
import { DAYS } from "../constants";
import clubLogo from "../assets/club-logo.jpg";
import { buildBoardIcs } from "../utils/teamBoard";
import { normalizePayUrl, payHost } from "../utils/payLink";
import { LegalFooter } from "../legal/LegalFooter";
import { shareOrDownloadBlob } from "../utils/imageExport";
import { useBoardPush } from "../hooks/useBoardPush";

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
  const push = useBoardPush(token);
  const [board, setBoard] = useState(null);
  const [state, setState] = useState("loading");
  const [weekIdx, setWeekIdx] = useState(0);
  const [calMsg, setCalMsg] = useState("");

  // Handed to the phone's own share sheet when there is one, which is what puts it in front
  // of Apple Calendar or Google Calendar without asking the parent to find a file. Falling
  // back to a plain download is what a desktop browser needs.
  const addToCalendar = async () => {
    try {
      const ics = buildBoardIcs(board);
      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      const file = (board.teamName || "team").replace(/[\/:*?"<>|]/g, "") + ".ics";
      await shareOrDownloadBlob(blob, file, board.teamName || "");
      setCalMsg("");
    } catch {
      setCalMsg("לא הצלחנו להכין את הקובץ. נסו שוב.");
    }
  };

  // The manifest is kept OFF this page by index.html, while the head is parsed — by the
  // time React runs, the phone has already read it. What is left to do here is the name
  // under the icon, which iOS reads when the person taps "Add to Home Screen".
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
  // Checked again on the way out, not only on the way in. The board is a document in a
  // database, and "it was validated when it was saved" is an assumption about every past
  // version of the code — not a property of what is being rendered right now.
  const payUrl = normalizePayUrl(board.pay?.url);
  const pay = payUrl ? { url: payUrl, host: payHost(payUrl) } : null;

  return (
    <div className="min-h-screen bg-stone-100" dir="rtl">
      <div className="max-w-md mx-auto p-3 space-y-3">
        <div className="bg-white rounded-xl border border-stone-200 p-3 flex items-center gap-3">
          <img src={clubLogo} alt="" className="w-11 h-11 rounded-lg object-cover" />
          <div>
            {/* An `h1`, because this is the one page in the app a screen reader reaches
                without logging in — and it used to open with an `h3` and no heading above it. */}
            <h1 className="font-semibold text-stone-800 leading-tight">{board.teamName}</h1>
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

        {push.available && push.support.ok && (
          <div className="bg-white rounded-xl border border-stone-200 p-3 space-y-2">
            <div>
              <h3 className="text-sm font-semibold text-stone-800">התראה כשהלו״ז משתנה</h3>
              <p className="text-xs text-stone-600 mt-0.5">
                כדי לשלוח אותה נשמר <span className="font-medium">מזהה טכני של המכשיר הזה בלבד</span> —
                בלי שם, בלי טלפון ובלי חשבון. אפשר לכבות כאן בכל רגע, והמזהה יימחק.
              </p>
            </div>
            {push.enabled ? (
              <button
                onClick={push.disable}
                disabled={push.busy}
                className="w-full px-4 py-2 text-sm rounded-xl border border-red-300 bg-white text-red-700 disabled:opacity-40"
              >
                {push.busy ? "מכבה..." : "כבה התראות במכשיר הזה"}
              </button>
            ) : (
              <button
                onClick={push.enable}
                disabled={push.busy}
                className="w-full px-4 py-2.5 text-sm rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
              >
                {push.busy ? "מפעיל..." : "עדכנו אותי כשיש שינוי"}
              </button>
            )}
            <p role="status" aria-live="polite" className="text-xs text-stone-700 min-h-[1rem]">{push.status}</p>
          </div>
        )}

        {push.available && push.support.reason === "ios-needs-install" && (
          <div className="text-xs rounded-xl border border-amber-300 bg-amber-50 text-amber-900 p-3">
            <span className="font-semibold">רוצים התראה כשהלו״ז משתנה?</span> באייפון צריך קודם
            להוסיף את הדף למסך הבית — כפתור השיתוף ↑ ← "הוסף למסך הבית" — ולפתוח משם.
          </div>
        )}

        <div className="space-y-1">
          <button
            onClick={addToCalendar}
            className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
          >
            הוסף ליומן הטלפון
          </button>
          <p className="text-[11px] text-stone-500 text-center">
            עובד עם יומן Apple ועם Google. אימון שבוטל אינו נכנס ליומן.
          </p>
          <p role="status" aria-live="polite" className="text-[11px] text-red-600 text-center">{calMsg}</p>
        </div>

        {/* The club's payment page, and NOT a payment form.
            The destination is printed under the button, in words, because a link that
            arrived in a WhatsApp group and opens a page asking for money is the shape of
            every scam a parent has been warned about. The club's own message has to be
            checkable, and a host name is the one thing a person can check. */}
        {pay && (
          <div className="bg-white rounded-xl border border-stone-200 p-3 space-y-1.5">
            <a
              href={pay.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-describedby="pay-note"
              className="block w-full text-center px-4 py-2.5 text-sm rounded-xl border border-brand-500 text-brand-600 hover:bg-brand-50"
            >
              תשלום למועדון <span className="text-xs font-normal">(נפתח בחלון חדש)</span>
            </a>
            <p id="pay-note" className="text-[11px] text-stone-500 text-center">
              נפתח באתר <span className="font-medium text-stone-700">{pay.host}</span> — אתר
              התשלומים של <span className="font-medium text-stone-700">קרית אונו – דור העתיד</span>.
              הדף הזה אינו מקבל פרטי אשראי ואינו יודע מי שילם.
            </p>
            {/* An invariant a parent can hold on to. Printing the host is only worth
                something to someone who knows what the host is supposed to be — and this is
                the sentence that makes the rest of the page checkable rather than merely
                reassuring. */}
            <p className="text-[11px] text-stone-500 text-center">
              המועדון לא יבקש בהודעה פרטי אשראי, קוד אימות או העברה לחשבון פרטי. לא מזהים את
              שם האתר? אל תשלמו — התקשרו 054-6696288.
            </p>
          </div>
        )}

        {/* Reliance, and the same sentence the push notification carries. A parent who drove
            somewhere on the strength of this page has to know what it is and what it is not. */}
        <div className="text-xs text-stone-500 text-center space-y-1">
          <div>עודכן: {fmtUpdated(board.updatedAt)}</div>
          <div>זו תצוגה בלבד ואינה מחליפה את ההודעה הרשמית של המועדון.</div>
        </div>

        {/* THE ONLY SCREEN IN THE APP THAT HAD NO LEGAL FOOTER — and the only one open to
            the public. Every other screen sits behind a login, where the footer was never
            the thing that mattered. Here it is: section 11 of the privacy law asks for who
            holds the data and how to reach them, and this page asks a parent to switch on
            notifications and, now, to pay. Who is asking has to be on the page. */}
        <div className="pt-1 pb-4">
          <LegalFooter />
          <p className="text-center text-xs text-stone-500 mt-1">
            קרית אונו – דור העתיד · הכפר 2, קרית אונו · ronenbm2905@gmail.com · 054-6696288
          </p>
        </div>
      </div>
    </div>
  );
}
