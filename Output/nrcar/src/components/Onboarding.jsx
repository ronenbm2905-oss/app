import { useState } from "react";
import { Bell, Siren, ShieldCheck, Phone, FileText } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Button from "./ui/Button.jsx";
import { Card } from "./ui/Card.jsx";

// ============================================================================
// Onboarding — **מסך אחד, כפתור אחד.**
// אין "דלג", אין "אחר כך", אין נקודות עמוד: הכפתור מוביל ישירות למסך הוספת
// הרכב, כי המסך הריק הראשון ממילא אומר את אותו הדבר.
//
// ============================================================================
// ★ **"תרגול חירום"** — המסך השני, ובו הנוסח של עדי (6.3).
//
// זה לא נספח משפטי אלא מוצר טוב: מראים למשתמש את מסך החירום **בשקט, לפני
// שהוא צריך אותו**, ובאותו מסך בדיוק אומרים לו את האמת על עוצמת ההגנה.
//
// חובת היידוע המורחבת בתיקון 13 חלה על **אמצעי האבטחה כפי שהם**. אסור
// שהמשתמש יבין "המסמכים שלי נעולים באפליקציה" כשבפועל הם נעולים במכשיר.
// שלושת המשפטים כאן מבצעים את חובת השקיפות **בנקודה שבה היא באמת נקראת**,
// במקום בקובץ מדיניות שאיש לא פותח.
//
// ⚠️ אל תרככו ואל תקצרו את שלושת המשפטים. במיוחד לא את השני.
// ============================================================================

function EmergencyDrill({ onContinue }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col justify-center bg-canvas px-4 py-8">
      <div className="mx-auto w-full max-w-app space-y-6">
        <div className="space-y-3 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-danger-600">
            <Siren size={32} className="text-white" aria-hidden="true" />
          </span>
          <h1 className="text-balance text-2xl font-bold text-ink-strong">{t("onboarding.drill.title")}</h1>
          <p className="mx-auto max-w-prose text-lg text-ink">{t("onboarding.drill.body")}</p>
        </div>

        {/* הדמיה שקטה של המסך האמיתי — מספר רישוי גדול, ביטוח, חיוג. */}
        <Card className="space-y-3 p-4 text-center" aria-hidden="true">
          <p className="num text-3xl font-bold text-ink-strong">12-345-67</p>
          <p className="flex items-center justify-center gap-2 text-lg text-ink">
            <Phone size={24} className="text-brand-600" aria-hidden="true" />
            {t("emergency.call.insurer")}
          </p>
          <p className="flex items-center justify-center gap-2 text-lg text-ink">
            <FileText size={24} className="text-brand-600" aria-hidden="true" />
            {t("emergency.doc.vehicleLicence")}
          </p>
        </Card>

        <Card className="space-y-2 border-2 border-warn-600 bg-warn-50 p-4">
          <p className="text-xl font-semibold text-warn-700">{t("onboarding.drill.noticeTitle")}</p>
          <p className="max-w-prose text-lg text-ink">{t("onboarding.drill.notice1")}</p>
          <p className="max-w-prose text-lg font-semibold text-ink">{t("onboarding.drill.notice2")}</p>
          <p className="max-w-prose text-lg text-ink">{t("onboarding.drill.notice3")}</p>
        </Card>

        <Button variant="primary" onClick={onContinue}>
          {t("onboarding.drill.cta")}
        </Button>
      </div>
    </div>
  );
}

export function Onboarding({ onStart }) {
  const { t } = useI18n();
  const [step, setStep] = useState("intro");

  if (step === "drill") return <EmergencyDrill onContinue={onStart} />;

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-canvas px-4 py-8">
      <div className="mx-auto w-full max-w-app space-y-6">
        <img src="./icons/icon-192.png" alt="" aria-hidden="true" className="mx-auto h-20 w-20 rounded-2xl" />

        <div className="space-y-3 text-center">
          <h1 className="text-balance text-2xl font-bold text-ink-strong">{t("onboarding.title")}</h1>
          <p className="mx-auto max-w-prose text-lg text-ink">{t("onboarding.sub")}</p>
        </div>

        <ul className="space-y-4">
          <li className="flex items-start gap-3">
            <Bell size={24} className="mt-1 shrink-0 text-brand-600" aria-hidden="true" />
            <span className="max-w-prose text-lg text-ink">{t("onboarding.why")}</span>
          </li>
          <li className="flex items-start gap-3">
            <Siren size={24} className="mt-1 shrink-0 text-danger-600" aria-hidden="true" />
            <span className="max-w-prose text-lg text-ink">{t("onboarding.emergency")}</span>
          </li>
          <li className="flex items-start gap-3">
            <ShieldCheck size={24} className="mt-1 shrink-0 text-ok-600" aria-hidden="true" />
            <span className="max-w-prose text-lg text-ink-muted">{t("onboarding.privacyNote")}</span>
          </li>
        </ul>

        <Button variant="primary" onClick={() => setStep("drill")}>
          {t("onboarding.cta")}
        </Button>
      </div>
    </div>
  );
}

export default Onboarding;
