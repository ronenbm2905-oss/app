import { useI18n } from "../hooks/useI18n.jsx";
import { Card, Notice } from "./ui/Card.jsx";

// ============================================================================
// AccessibilityScreen — הצהרת נגישות.
//
// **מסלול חובה, לא nice-to-have.** תקנה 35 לתקנות שוויון זכויות (התאמות
// נגישות לשירות) חלה על שירות לציבור, והתקן הוא ת"י 5568 ברמה AA.
// והממצא שסותר את האינטואיציה: **הפטור ממחזור פוטר מהנגשה — לא מההצהרה.**
// גם עסק בלי הכנסות חייב לפרסם בדרך נגישה את דרכי ההתקשרות לקבלת שירות
// לאדם עם מוגבלות.
//
// ⚠️ הנוסח המשפטי המלא ופרטי רכז הנגישות הם של עדי (⚖️ L1) + פעולה עסקית
// של המשתמש, ולכן המסך מצהיר במפורש שהוא בהכנה. **הצהרה שמקדימה את המימוש
// היא מצג שווא** — זה הלקח מהבאסקטבול, ואנחנו לא חוזרים עליו.
// ============================================================================

export function AccessibilityScreen() {
  const { t } = useI18n();
  return (
    <>
      <h1 className="text-2xl font-bold text-ink-strong">{t("accessibility.title")}</h1>
      <p className="max-w-prose text-lg text-ink">{t("accessibility.standard")}</p>

      <Card className="space-y-3 p-4">
        <h2 className="text-xl font-semibold text-ink">{t("accessibility.knownLimits.title")}</h2>
        {/* המגבלה האמיתית, ובצדה ההפחתה: כרטיס החירום הוא טקסט-תחילה, ולכן
            שדות המפתח נגישים לקורא מסך גם כשהסריקה איננה. */}
        <p className="max-w-prose text-lg text-ink">{t("accessibility.knownLimits.docs")}</p>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-xl font-semibold text-ink">{t("accessibility.contact.title")}</h2>
        <Notice tone="info" title={t("accessibility.pending.title")}>
          <p>{t("accessibility.pending.body")}</p>
        </Notice>
      </Card>
    </>
  );
}

export default AccessibilityScreen;
