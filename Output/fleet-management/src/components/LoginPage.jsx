import { useState } from "react";
import { Car } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Button from "./ui/Button.jsx";

export function LoginPage({ onSignIn, onSignInFresh, onSignInEmail, isEmulator = false, error }) {
  const { t, toggleLang } = useI18n();
  const [devEmail, setDevEmail] = useState("");
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-brand-600 text-white">
            <Car size={20} />
          </span>
          <div>
            <h1 className="text-base font-semibold text-slate-900">{t("app.title")}</h1>
            <p className="text-xs text-slate-500">{t("app.subtitle")}</p>
          </div>
        </div>
        <h2 className="text-sm font-semibold text-slate-800">{t("auth.signInTitle")}</h2>
        <p className="mt-1 text-xs text-slate-500">{t("auth.signInSub")}</p>
        {error && (
          <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {t(error)}
          </p>
        )}
        <Button className="mt-4 w-full" size="lg" onClick={onSignIn}>
          {t("auth.signInGoogle")}
        </Button>
        {/* פיתוח מול אמולטור בלבד — לא קיים בבנייה לפרודקשן (ראה firebase.js). */}
        {isEmulator && (
          <div className="mt-2 space-y-2 rounded border border-dashed border-amber-400 bg-amber-50 p-2">
            <button
              type="button"
              onClick={onSignInFresh}
              className="w-full rounded border border-amber-300 bg-white px-3 py-2 text-xs text-amber-900"
            >
              אמולטור: כניסה כמשתמש חדש (אנונימי)
            </button>
            {/* כניסה עם **מייל מאומת** — הזרימה של פרוסה 2. בלי זה אי אפשר
                לבדוק בדפדפן את קישור הנהג בלי חשבון Google אמיתי לכל נהג. */}
            <input
              dir="ltr"
              type="email"
              data-testid="emu-email"
              value={devEmail}
              onChange={(e) => setDevEmail(e.target.value)}
              placeholder="driver@example.com"
              aria-label="אמולטור: כתובת מייל"
              className="w-full rounded border border-amber-300 px-2 py-1.5 text-xs"
            />
            <button
              type="button"
              data-testid="emu-signin"
              onClick={() => onSignInEmail?.(devEmail)}
              className="w-full rounded border border-amber-300 bg-white px-3 py-2 text-xs text-amber-900"
            >
              אמולטור: כניסה עם המייל הזה (מאומת)
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={toggleLang}
          className="mt-3 w-full text-center text-xs text-slate-500 hover:text-slate-700"
        >
          {t("nav.language")}
        </button>
      </div>
    </div>
  );
}

export default LoginPage;
