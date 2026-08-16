import { Car } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Button from "./ui/Button.jsx";

export function LoginPage({ onSignIn, error }) {
  const { t, toggleLang } = useI18n();
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
