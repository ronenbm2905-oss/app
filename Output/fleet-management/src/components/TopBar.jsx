import {
  Car,
  Gauge,
  Receipt,
  Users,
  Settings,
  LogOut,
  Languages,
  Upload,
  ClipboardCheck,
} from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";

const NAV = [
  { id: "dashboard", key: "nav.dashboard", Icon: Gauge },
  { id: "vehicles", key: "nav.vehicles", Icon: Car },
  { id: "fines", key: "nav.fines", Icon: Receipt },
  { id: "drivers", key: "nav.drivers", Icon: Users },
  { id: "import", key: "importx.nav", Icon: Upload },
  // מסך 7 — מוצג בניווט רק כשיש מה לאמת, או כשעומדים עליו.
  { id: "review", key: "reviewx.nav", Icon: ClipboardCheck, onlyWhenCount: true },
  { id: "settings", key: "nav.settings", Icon: Settings },
];

export function TopBar({ view, onNavigate, orgName, isLocal, onSignOut, alertCount, reviewCount = 0 }) {
  const { t, toggleLang } = useI18n();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-brand-600 text-white">
            <Car size={18} />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900">{orgName || t("app.title")}</div>
            <div className="text-[11px] text-slate-500">{t("app.subtitle")}</div>
          </div>
        </div>

        <nav className="order-3 -mx-1 flex w-full items-center gap-1 overflow-x-auto sm:order-none sm:mx-0 sm:w-auto">
          {NAV.filter((n) => !n.onlyWhenCount || reviewCount > 0 || view === n.id).map(({ id, key, Icon }) => {
            const active = view === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded px-2.5 py-1.5 text-sm transition ${
                  active
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon size={15} />
                {t(key)}
                {id === "dashboard" && alertCount > 0 && (
                  <span className="num rounded-full bg-red-100 px-1.5 text-[11px] font-semibold text-red-700">
                    {alertCount}
                  </span>
                )}
                {id === "review" && reviewCount > 0 && (
                  <span className="num rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">
                    {reviewCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="ms-auto flex items-center gap-2">
          {isLocal && (
            <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              {t("common.demoBadge")}
            </span>
          )}
          <button
            type="button"
            onClick={toggleLang}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
          >
            <Languages size={14} />
            {t("nav.language")}
          </button>
          {!isLocal && (
            <button
              type="button"
              onClick={onSignOut}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              <LogOut size={14} />
              {t("nav.signOut")}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default TopBar;
