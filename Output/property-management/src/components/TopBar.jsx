import { useI18n } from "../hooks/useI18n.jsx";
import { IconHome, IconWallet, IconWrench, IconGlobe, IconLang, IconLogout, IconCalendar } from "./ui/icons.jsx";

// סרגל עליון עם ניווט ראשי + החלפת שפה. מובייל-פירסט: אייקונים + טקסט מוסתר בקטן.
export function TopBar({ view, onNavigate, onToggleLang, isLocal, onSignOut }) {
  const { t } = useI18n();
  const items = [
    { key: "lobby", label: t("nav.lobby"), icon: <IconHome size={18} /> },
    { key: "financial", label: t("nav.financial"), icon: <IconWallet size={18} /> },
    { key: "maintenance", label: t("nav.maintenance"), icon: <IconWrench size={18} /> },
    { key: "reminders", label: t("nav.reminders"), icon: <IconCalendar size={18} /> },
  ];
  return (
    <header className="sticky top-0 z-40 bg-navy text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
        <div className="flex items-center gap-1.5 font-bold text-white">
          <span className="text-accent"><IconGlobe size={22} /></span>
          <span className="hidden text-sm sm:inline">{t("app.title")}</span>
        </div>

        <nav className="flex items-center gap-1" aria-label="main">
          {items.map((it) => (
            <button
              key={it.key}
              onClick={() => onNavigate(it.key)}
              aria-current={view === it.key ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-sm font-medium transition ${
                view === it.key ? "bg-white/10 text-white" : "text-onnavy-muted hover:bg-white/10 hover:text-white"
              }`}
            >
              {it.icon}
              <span className="hidden sm:inline">{it.label}</span>
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <button onClick={onToggleLang} className="inline-flex items-center gap-1 rounded-sm px-2 py-1.5 text-sm text-onnavy-muted transition hover:bg-white/10 hover:text-white" aria-label={t("nav.language")}>
            <IconLang size={16} />
            <span className="hidden sm:inline">{t("nav.language")}</span>
          </button>
          {!isLocal && (
            <button onClick={onSignOut} className="inline-flex items-center gap-1 rounded-sm px-2 py-1.5 text-sm text-onnavy-muted transition hover:bg-white/10 hover:text-white" aria-label={t("nav.signOut")}>
              <IconLogout size={16} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
