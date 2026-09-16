import { usePushNotifications } from "../hooks/usePushNotifications";
import { IconAlert, IconCheck } from "./ui/icons";

// Turning on a phone notification — and telling the truth about the device it runs on.
//
// The explanation sits ABOVE the button, not behind a link, because the browser's own
// permission dialog is not notice: it says "this site wants to send notifications" and
// nothing about what is stored or by whom. Privacy policy §2ז is the full text; this is
// what a person actually reads before deciding.
//
// The iPhone line is the load-bearing one. Web Push on iOS works only in a home-screen
// installed PWA — in plain Safari the API does not exist. Without this, the tap does
// nothing visible, the coach assumes it worked, and next week reads silence as "nothing
// changed". That is the single failure this whole component is shaped around.
export function PushToggle({ coachId, coachName, email }) {
  const { support, enabled, busy, status, enable, disable, sendTest, available } =
    usePushNotifications({ coachId, email });

  if (!available || !coachId) return null;

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3" dir="rtl">
      <div>
        <h3 className="text-sm font-semibold text-stone-800">התראה בטלפון על שינוי בלו״ז שלך</h3>
        <p className="text-xs text-stone-600 mt-1">
          כדי לשלוח אותה, המערכת תשמור <span className="font-medium">מזהה טכני של המכשיר הזה</span>{" "}
          לצד השם והדוא״ל שלך. ההתראה מציגה יום, שעה ואולם —{" "}
          <span className="font-medium">בלי שמות שחקנים ובלי טקסט חופשי</span>.
        </p>
        <p className="text-xs text-stone-600 mt-1">
          אפשר לכבות כאן בכל רגע, והמזהה יימחק. ההפעלה היא בחירה ואינה דרישה של המועדון,
          וההתראה <span className="font-medium">אינה מחליפה</span> את ההודעה הרשמית של המועדון.
        </p>
      </div>

      {support.reason === "ios-needs-install" && (
        <div className="text-xs rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-2.5 flex items-start gap-1.5">
          <IconAlert size={13} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold">באייפון צריך קודם להוסיף את המערכת למסך הבית:</span>{" "}
            כפתור השיתוף <span className="font-medium">↑</span> ← "הוסף למסך הבית" ← לפתוח משם
            ולחזור לכאן. בספארי רגיל ההתראות לא יגיעו כלל.
          </span>
        </div>
      )}

      {support.reason === "unsupported" && (
        <div className="text-xs rounded-lg border border-stone-300 bg-stone-50 text-stone-700 p-2.5">
          הדפדפן הזה אינו תומך בהתראות. נסה/י מהטלפון, או מדפדפן אחר.
        </div>
      )}

      {support.ok && (
        <div className="flex items-center gap-2 flex-wrap">
          {enabled ? (
            <>
              <span className="text-sm text-emerald-700 font-medium flex items-center gap-1">
                <IconCheck size={15} /> ההתראות פועלות במכשיר הזה
              </span>
              <button
                onClick={sendTest}
                disabled={busy}
                className="px-3 py-1.5 text-xs rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-40"
              >
                שלח לי התראת בדיקה
              </button>
              <button
                onClick={disable}
                disabled={busy}
                className="px-3 py-1.5 text-xs rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                {busy ? "מכבה..." : "כבה במכשיר הזה"}
              </button>
            </>
          ) : (
            <button
              onClick={enable}
              disabled={busy}
              className="px-4 py-2 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
            >
              {busy ? "מפעיל..." : "קבל התראות במכשיר הזה"}
            </button>
          )}
        </div>
      )}

      {/* The outcome is TEXT, announced — not a colour and not an icon. A coach who cannot
          see the difference between a green tick and a red one still has to learn whether
          the button worked. (SC 1.4.1, and M5 of gate #11 for the same reason.) */}
      <p role="status" aria-live="polite" className="text-xs text-stone-600 min-h-[1rem]">
        {status}
      </p>
    </div>
  );
}
