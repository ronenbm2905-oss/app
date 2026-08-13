import { useI18n } from "../hooks/useI18n.jsx";
import Button from "../components/ui/Button.jsx";
import { SectionTitle } from "../components/ui/Bits.jsx";
import { contentFor } from "../utils/defaults.js";
import { href } from "../utils/routes.js";

// אודות + FAQ.
// ⚠️ A2.6 — דף ה-FAQ אינו רק תוכן שיווקי: הסבר הוגן ומאוזן על ההבדל בין
// טבעי למעבדה, כולל **פער הערך**, הוא ההפחתה הזולה ביותר לטענת הטעיה.
// לכן הוא נערך מ-`settings` ולא נכתב בקוד — הצוות חייב לשלוט בו.
export default function AboutPage({ settings }) {
  const { t, lang } = useI18n();
  const content = contentFor(settings, lang);

  return (
    <div className="container-page py-10">
      <div className="max-w-3xl">
        <SectionTitle>{t("about.title")}</SectionTitle>
        <h2 className="text-2xl font-semibold">{content.storyTitle}</h2>
        <p className="mt-3 whitespace-pre-line leading-relaxed">{content.storyBody}</p>
      </div>

      <section className="mt-12 max-w-3xl" aria-labelledby="faq-title">
        <h2 id="faq-title" className="mb-6 text-2xl font-semibold sm:text-3xl">
          {t("about.faqTitle")}
        </h2>
        <dl className="space-y-4">
          {(content.faq || []).map((item, i) => (
            <div key={i} className="card p-5">
              <dt className="font-semibold">{item.q}</dt>
              <dd className="mt-2 whitespace-pre-line leading-relaxed text-muted">{item.a}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8">
          <p className="mb-3 text-muted">{t("about.contactCta")}</p>
          <Button as="a" href={href.contact()}>
            {t("contact.title")}
          </Button>
        </div>
      </section>
    </div>
  );
}
