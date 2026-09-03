import { Button } from "./ui/Button.jsx";
import { IconBuilding, IconWarning, IconUsers } from "./ui/icons.jsx";

/**
 * שלושת המסכים שלפני הנתונים, במקום אחד — כי הם שלושה **מצבים של אותה שאלה**
 * ("מותר לך להיכנס?") ולא שלושה מסכים.
 *
 * ⚠ ההבחנה שקובעת: **"מחובר" אינו "מורשה".** משתמש שהתחבר עם Google ואינו
 * ברשימה חייב לראות הסבר ברור ולא מסך ריק שנראה כמו תקלה — אחרת הוא ינסה שוב,
 * יחשוב שהמערכת שבורה, ויתקשר.
 */
export default function SignInScreen({ state, email, onSignIn, onSignOut, error, localFileWarning = "" }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card w-full max-w-md p-8 text-center">
        <IconBuilding className="mx-auto h-10 w-10 text-slate-400" />
        <h1 className="mt-3 text-xl font-semibold">ויצמן — ניהול תקציב בניינים</h1>

        {state === "loading" && (
          <p className="mt-6 text-sm text-slate-500">בודק הרשאות…</p>
        )}

        {state === "signedOut" && (
          <>
            <p className="mt-2 text-sm text-slate-500">
              המערכת פתוחה לחברי הצוות בלבד. התחבר כדי להמשיך.
            </p>
            {localFileWarning && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-right text-sm text-amber-900">
                <IconWarning className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{localFileWarning}</span>
              </div>
            )}
            <Button variant="primary" className="mx-auto mt-6" onClick={onSignIn}>
              התחברות עם Google
            </Button>
          </>
        )}

        {state === "denied" && (
          <>
            <div className="mt-6 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-right text-sm text-amber-900">
              <IconWarning className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <b>החשבון {email} אינו ברשימת המורשים.</b>
                <p className="mt-1">
                  זו אינה תקלה — הגישה למערכת ניתנת לפי כתובת מייל. בקש מרונן
                  להוסיף אותך במסך ״ניהול״, ואז התחבר שוב.
                </p>
              </div>
            </div>
            <Button className="mx-auto mt-4" onClick={onSignOut}>התחברות עם חשבון אחר</Button>
          </>
        )}

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <IconUsers className="h-3.5 w-3.5" /> כל חברי הצוות רואים את אותה תמונה
        </p>
      </div>
    </div>
  );
}
