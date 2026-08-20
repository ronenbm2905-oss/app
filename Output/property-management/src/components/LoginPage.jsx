import { useState } from "react";
import { useI18n } from "../hooks/useI18n.jsx";
import { Button } from "./ui/Button.jsx";
import { IconGlobe, IconLang } from "./ui/icons.jsx";
import { PrivacyPolicy } from "./PrivacyPolicy.jsx";

// מסך כניסה — מוצג רק במצב ענן (Firebase מוגדר). במצב מקומי לא מגיעים לכאן.
export function LoginPage({ signIn, signingIn }) {
  const { t, toggleLang } = useI18n();
  const [privacy, setPrivacy] = useState(false);
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-brand-600">
            <IconGlobe size={28} />
            <span className="text-xl font-bold text-navy">{t("app.title")}</span>
          </div>
          <button
            onClick={toggleLang}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-ink-body hover:bg-surface-sunk"
          >
            <IconLang size={16} />
            {t("nav.language")}
          </button>
        </div>
        <p className="mb-6 text-sm text-ink-body">{t("app.subtitle")}</p>
        <Button onClick={signIn} disabled={signingIn} className="w-full">
          {signingIn ? t("auth.signingIn") : t("auth.signInGoogle")}
        </Button>
        <p className="mt-4 text-xs text-ink-muted">
          {t("auth.privacyNote")}{" "}
          <button onClick={() => setPrivacy(true)} className="font-medium text-brand-600 hover:underline">
            {t("privacy.link")}
          </button>
        </p>
      </div>
      {privacy && <PrivacyPolicy onClose={() => setPrivacy(false)} />}
    </div>
  );
}
