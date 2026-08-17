import { Car } from "lucide-react";
import { useI18n } from "../../hooks/useI18n.jsx";

// כרטיס מסך-מלא לפני שיש ארגון: כניסה, צירוף לארגון, אין-גישה, הקמה.
// אותה מסגרת בכל ארבעתם, כדי שהמעבר ביניהם לא ייראה כמו אפליקציה אחרת.
export function AuthShell({ children, footer = null, wide = false }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-start justify-center bg-slate-50 p-4 sm:items-center">
      <div className={`w-full ${wide ? "max-w-lg" : "max-w-sm"} rounded-md border border-slate-200 bg-white p-6 shadow-sm`}>
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-brand-600 text-white">
            <Car size={20} />
          </span>
          <div>
            <h1 className="text-base font-semibold text-slate-900">{t("app.title")}</h1>
            <p className="text-xs text-slate-500">{t("app.subtitle")}</p>
          </div>
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
}

export default AuthShell;
