import { Home, Car, FileText, Siren, Settings } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";

// ============================================================================
// BottomNav — מקור: itai §6.0 + PRD §9.2.
//
// **חמישה פריטים בדיוק, אייקון *ועוד* טקסט תמיד.** זה גם מה שמבטל מבנית את
// כשל ה-aria-label על כפתורי אייקון — הכשל שחזר בכל פרויקט קודם.
//
// `<nav>` + `<a href="#/…">` + `aria-current` — **לא** `role="tab"`.
// טאבים הם תוכן שמתחלף בתוך אותו עמוד; זה ניווט בין מסכים, וקורא מסך צריך
// לדעת את ההבדל. (role="tab" שמור לתתי-הלשוניות בתוך דף הרכב.)
//
// אייקון החירום **תמיד אדום**, גם כשאינו פעיל — הוא צריך להימצא במבט אחד
// בשעת לחץ. וזו גם הסיבה שאדום לא משמש לשום דבר אחר באפליקציה.
// ============================================================================

const ITEMS = [
  { key: "home", path: "/", icon: Home, danger: false },
  { key: "vehicles", path: "/vehicles", icon: Car, danger: false },
  { key: "docs", path: "/docs", icon: FileText, danger: false },
  { key: "emergency", path: "/emergency", icon: Siren, danger: true },
  { key: "settings", path: "/settings", icon: Settings, danger: false },
];

// איזה מסלול "מאיר" איזה פריט ניווט.
const ACTIVE_FOR = {
  home: ["home"],
  vehicles: ["vehicles", "vehicle", "vehicleNew", "task", "taskNew"],
  docs: ["docs"],
  emergency: ["emergency"],
  settings: ["settings", "accessibility", "notice"],
};

export function BottomNav({ routeName }) {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t("nav.main.aria")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line-soft bg-surface shadow-nav"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="mx-auto grid max-w-app grid-cols-5">
        {ITEMS.map(({ key, path, icon: Icon, danger }) => {
          const active = (ACTIVE_FOR[key] || []).includes(routeName);
          const color = danger ? "text-danger-600" : active ? "text-brand-600" : "text-ink-muted";
          return (
            <li key={key}>
              <a
                href={`#${path}`}
                aria-current={active ? "page" : undefined}
                aria-label={t(`${`nav.${key}`}.aria`)}
                className={`relative flex min-h-[76px] flex-col items-center justify-center gap-1 px-1 ${color}`}
              >
                {/* הפס העליון + aria-current — הסימן שאינו צבע (1.4.1) */}
                {active && (
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-2 top-0 h-1 rounded-b ${danger ? "bg-danger-600" : "bg-brand-600"}`}
                  />
                )}
                <Icon size={28} aria-hidden="true" />
                <span className={`text-sm ${active ? "font-semibold" : "font-medium"}`}>
                  {t(`nav.${key}`)}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default BottomNav;
