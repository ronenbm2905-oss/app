import { LogIn } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Button from "./ui/Button.jsx";
import { Notice } from "./ui/Card.jsx";

// ============================================================================
// LoginPage — כניסה עם Google בלבד. "בלי סיסמה לזכור."
//
// ⚠️ Sign in with Apple אינו נדרש ל-PWA, ולכן הוא מחוץ לפרוסה 1 — אבל הוא
// **שער קשיח של App Store** ברגע ש-Capacitor עולה (פרוסה 3). מסומן כאן כדי
// שלא יתגלה בהגשה.
// ============================================================================

export function LoginPage({ onSignIn, loading, error }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas px-4">
      <div className="w-full max-w-app space-y-6 text-center">
        <img src="./icons/icon-192.png" alt="" aria-hidden="true" className="mx-auto h-20 w-20 rounded-2xl" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-ink-strong">{t("auth.title")}</h1>
          <p className="text-lg text-ink-muted">{t("auth.sub")}</p>
        </div>

        {error && (
          <Notice tone="warn" title={t("auth.error")}>
            <Button variant="primary" onClick={onSignIn}>
              {t("auth.error.cta")}
            </Button>
          </Notice>
        )}

        <Button
          variant="primary"
          onClick={onSignIn}
          loading={loading}
          loadingLabel={t("loading.signIn")}
        >
          <LogIn size={24} aria-hidden="true" />
          {t("auth.google")}
        </Button>

        <p className="mx-auto max-w-prose text-base text-ink-muted">{t("onboarding.privacyNote")}</p>
      </div>
    </div>
  );
}

export default LoginPage;
