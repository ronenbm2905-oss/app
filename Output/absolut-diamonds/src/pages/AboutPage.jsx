import { useI18n } from "../hooks/useI18n.jsx";
import Button from "../components/ui/Button.jsx";
import { PageTitle, SectionTitle } from "../components/ui/Bits.jsx";
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
    <div className="container-page py-10 lg:py-16">
      <div className="max-w-prose">
        <PageTitle>{t("about.title")}</PageTitle>
        <h2 className="text-section font-medium tracking-heLabel lg:text-sectionLg lg:font-light">
          {content.storyTitle}
        </h2>
        <p className="mt-4 whitespace-pre-line text-body text-ink-80">{content.storyBody}</p>
      </div>

      <section className="mt-16 max-w-prose" aria-labelledby="faq-title">
        <SectionTitle id="faq-title" latin="FAQ">
          {t("about.faqTitle")}
        </SectionTitle>
        {/* בלי `.card` — קווי שיער ורווח. */}
        <dl className="border-t border-line">
          {(content.faq || []).map((item, i) => (
            <div key={i} className="border-b border-line py-6">
              <dt className="text-title font-medium">{item.q}</dt>
              <dd className="mt-2 whitespace-pre-line text-body text-ink-80">{item.a}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-10">
          <p className="mb-4 text-meta text-muted">{t("about.contactCta")}</p>
          <Button as="a" href={href.contact()} variant="outline">
            {t("contact.title")}
          </Button>
        </div>
      </section>
    </div>
  );
}
