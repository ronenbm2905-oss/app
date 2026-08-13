import { useI18n } from "../hooks/useI18n.jsx";
import { SectionTitle, Notice } from "../components/ui/Bits.jsx";
import { legalFor, contactFor } from "../utils/defaults.js";

// ============================================================================
// LegalPage — מדיניות פרטיות / הצהרת נגישות.
//
// 🔴 **הנוסח לא נכתב כאן ולא ע"י מפתח.** הוא נשלף מ-`settings.legal`, ועד
// שהוא מוזן — המסך מציג באנר טיוטה מפורש. זה הלקח מהבאסקטבול: הצהרה
// מתפרסמת רק אחרי שהתיקונים בוצעו בפועל, לא לפני.
//
// L1/L2 בסקירה: שני המסמכים מצריכים עו"ד רשומה לפני עלייה לאוויר.
// ============================================================================

export default function LegalPage({ settings, doc }) {
  const { t, lang } = useI18n();
  const legal = legalFor(settings, lang);
  const contact = contactFor(settings);

  const title = doc === "accessibility" ? t("legal.accessibilityTitle") : t("legal.privacyTitle");
  const body = doc === "accessibility" ? legal.accessibility : legal.privacy;

  return (
    <div className="container-page py-10">
      <div className="max-w-3xl">
        <SectionTitle>{title}</SectionTitle>

        {!body ? (
          <>
            <Notice tone="danger">{t("legal.draftBanner")}</Notice>
            <p className="mt-4 text-muted">{t("legal.draftBody")}</p>
          </>
        ) : (
          <div className="whitespace-pre-line leading-relaxed">{body}</div>
        )}

        {/* O5.9 — רכז נגישות: שם, מייל וטלפון. בלעדיו ההצהרה אינה שלמה. */}
        {doc === "accessibility" && contact.accessibilityContactName ? (
          <div className="mt-8 card p-5">
            <h2 className="text-lg font-semibold">{contact.accessibilityContactName}</h2>
            {contact.accessibilityContactEmail ? (
              <p className="num mt-1">{contact.accessibilityContactEmail}</p>
            ) : null}
            {contact.accessibilityContactPhone ? (
              <p className="num">{contact.accessibilityContactPhone}</p>
            ) : null}
          </div>
        ) : null}

        <p className="mt-8 text-sm text-muted num">v{legal.policyVersion}</p>
      </div>
    </div>
  );
}
