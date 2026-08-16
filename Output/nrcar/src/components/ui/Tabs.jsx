import { useI18n } from "../../hooks/useI18n.jsx";

// ============================================================================
// Tabs — תתי-לשוניות **בתוך** מסך (דף הרכב: משימות / מסמכים / פרטים).
//
// ⚠️ ההבחנה שחשוב לשמור עליה: **כאן** `role="tablist"` נכון, כי התוכן מתחלף
// באותו עמוד. בניווט התחתון הוא **שגוי** — שם עוברים בין מסכים, וזה
// `<nav>` + `<a>` + `aria-current`. קורא מסך צריך לדעת את ההבדל.
//
// 4.1.2 (שם/תפקיד/ערך) הוא הכשל מספר 1 באפליקציית React, ותתי-הלשוניות הן
// אחד משלושת המקומות המובהקים שלו. לכן: aria-selected, aria-controls,
// id מקושר, ו-tabIndex שמוציא מהטאב-סדר את מה שלא נבחר.
// ============================================================================

export function Tabs({ items, value, onChange, idPrefix = "tab" }) {
  const { t } = useI18n();
  return (
    <div
      role="tablist"
      aria-label={t("vehicle.tabs.aria")}
      className="flex gap-2 overflow-hidden rounded-xl border border-line bg-surface p-1"
    >
      {items.map((item) => {
        const selected = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`${idPrefix}-${item.key}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${item.key}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.key)}
            className={`min-h-12 flex-1 rounded-xl px-3 text-lg font-semibold transition
              ${selected ? "bg-brand-600 text-white" : "bg-transparent text-ink-soft hover:bg-brand-50"}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ tabKey, value, idPrefix = "tab", children }) {
  if (tabKey !== value) return null;
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${tabKey}`}
      aria-labelledby={`${idPrefix}-${tabKey}`}
      tabIndex={0}
      className="space-y-4"
    >
      {children}
    </div>
  );
}

export default Tabs;
