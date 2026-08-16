import { LogIn, ShieldCheck } from "lucide-react";
import { t } from "../i18n";
import { Banner } from "./ui/Banner";

export function LoginView({ onLogin, error }) {
  return (
    <div className="mx-auto max-w-md py-20">
      <div className="rounded-xl border border-paper-line bg-paper-card p-6 shadow-sm">
        <ShieldCheck className="h-7 w-7 text-accent" aria-hidden="true" />
        <h1 className="mt-3 text-xl font-semibold text-ink">{t("signInTitle")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t("signInBody")}</p>

        <button
          type="button"
          onClick={onLogin}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <LogIn className="h-4 w-4" aria-hidden="true" />
          {t("signIn")}
        </button>

        {error && (
          <div className="mt-4">
            <Banner tone="danger" title={t("loadFailed")}>
              {String(error.message || error)}
            </Banner>
          </div>
        )}
      </div>
    </div>
  );
}
