import { useI18n } from "../hooks/useI18n.jsx";
import { PageTitle, Flag } from "../components/ui/Bits.jsx";
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
    <div className="container-page py-10 lg:py-16">
      <div className="max-w-prose">
        <PageTitle>{title}</PageTitle>

        {!body ? (
          <>
            {/* `.flag` ולא באנר צבעוני — אותו מנגנון חומרה כמו בשורת
                הטיפולים וב-disclaimer. role="alert" נשמר. */}
            <Flag role="alert" note={t("legal.draftBody")}>
              {t("legal.draftBanner")}
            </Flag>
          </>
        ) : (
          <div className="whitespace-pre-line text-body text-ink-80">{body}</div>
        )}

        {/* O5.9 — רכז נגישות: שם, מייל וטלפון. בלעדיו ההצהרה אינה שלמה. */}
        {doc === "accessibility" && contact.accessibilityContactName ? (
          <div className="mt-10 border-t border-ink pt-5">
            <h2 className="text-titleLg font-medium">{contact.accessibilityContactName}</h2>
            {contact.accessibilityContactEmail ? (
              <p className="num mt-1 text-spec">{contact.accessibilityContactEmail}</p>
            ) : null}
            {contact.accessibilityContactPhone ? (
              <p className="num text-spec">{contact.accessibilityContactPhone}</p>
            ) : null}
          </div>
        ) : null}

        <p className="num mt-10 text-meta text-muted">v{legal.policyVersion}</p>
      </div>
    </div>
  );
}
