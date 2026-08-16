import { ArrowRight } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import BottomNav from "./BottomNav.jsx";

// ============================================================================
// AppShell — מעטפת האפליקציה. מקור: itai §6.0.
//
//   header 64px  ·  main max-w-app + .app-main  ·  nav 76px
//
// ⚠️ `.app-main` חובה על כל מסך גוללי — הוא מפנה מקום לסרגל הניווט הקבוע
// ול-safe-area של האייפון. בלעדיו הכפתור האחרון מוסתר מתחת לניווט; זו
// התקלה הקלאסית.
//
// אין כפתור המבורגר ואין תפריט נסתר: חמישה יעדים, כולם גלויים למטה.
// ============================================================================

export function AppShell({ routeName, title, onBack, children, hideNav = false }) {
  const { t } = useI18n();
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-20 h-[64px] border-b border-line-soft bg-surface">
        <div className="mx-auto flex h-full max-w-app items-center gap-3 px-4">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl px-2 text-lg font-medium text-brand-600"
            >
              <ArrowRight size={24} className="icon-flip" aria-hidden="true" />
              {t("nav.back")}
            </button>
          ) : (
            <img src="./icons/icon-192.png" alt="" aria-hidden="true" className="h-8 w-8 rounded-lg" />
          )}
          <span className="text-xl font-bold text-ink-strong">{title || t("app.name")}</span>
        </div>
      </header>

      <main className="app-main mx-auto w-full max-w-app space-y-6 px-4 pt-4">{children}</main>

      {!hideNav && <BottomNav routeName={routeName} />}
    </div>
  );
}

export default AppShell;
