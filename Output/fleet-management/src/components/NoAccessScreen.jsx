import { ShieldAlert, MailWarning } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import AuthShell from "./ui/AuthShell.jsx";
import Button from "./ui/Button.jsx";

// ============================================================================
// NoAccessScreen — "אין לך הרשאה. פנה למנהל המערכת."
//
// ⚠️ זה **התיקון המרכזי** של באג 17.8. עד עכשיו מי שהתחבר ולא היה מורשה קיבל
// מסך **הקמה ראשונית**, ואם היה משלים אותו היה נוצר ארגון שני נפרד עם אפס
// רכבים — בלי שאף אחד יבין מה קרה. זה בדיוק מה שקיבלה מנהלת הכספים כשהמשתמש
// שלח לה את הקישור.
//
// אין כאן שום דרך להקים ארגון. במודל ה-allowlist מזהה הארגון קבוע בזמן build,
// והדרך היחידה להיכנס היא שמנהל מערכת יוסיף את המייל — ולכן זה מה שהמסך אומר.
// (התקנה חדשה, שבה עוד אין מסמך ארגון ומזהה הארגון הוא ה-uid של המשתמש עצמו,
// מקבלת status 'bootstrap' ואת ה-onboarding — לא את המסך הזה.)
// ============================================================================
export function NoAccessScreen({ user, emailVerified = true, onSignOut, onRetry, isError = false }) {
  const { t, toggleLang } = useI18n();

  return (
    <AuthShell
      footer={
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <button type="button" onClick={onSignOut} className="text-xs text-slate-500 hover:text-slate-700">
            {t("nav.signOut")}
          </button>
          <button type="button" onClick={toggleLang} className="text-xs text-slate-500 hover:text-slate-700">
            {t("nav.language")}
          </button>
        </div>
      }
    >
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <ShieldAlert size={20} />
      </span>
      <h2 className="text-base font-semibold text-slate-900">
        {isError ? t("noAccess.errorTitle") : t("noAccess.title")}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {isError ? t("noAccess.errorBody") : t("noAccess.body")}
      </p>

      {/* הכתובת שאיתה נכנס — כדי שיוכל להקריא אותה למנהל המערכת, ושהמנהל
          יוסיף בדיוק אותה. טעות הקלדה כאן היא הדבר שהכי קל לפספס. */}
      <p className="num mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700" dir="ltr">
        {user?.email || user?.uid || "—"}
      </p>

      {!emailVerified && (
        <p className="mt-3 flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <MailWarning size={14} className="mt-0.5 shrink-0" />
          {t("noAccess.unverified")}
        </p>
      )}

      <Button className="mt-4 w-full" variant="secondary" onClick={onRetry}>
        {t("noAccess.recheck")}
      </Button>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{t("noAccess.hint")}</p>
    </AuthShell>
  );
}

export default NoAccessScreen;
