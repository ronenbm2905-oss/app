import { useI18n } from "../hooks/useI18n.jsx";
import ModelCard from "../components/ModelCard.jsx";
import LeadForm from "../components/LeadForm.jsx";
import Button from "../components/ui/Button.jsx";
import WhatsAppButton from "../components/ui/WhatsAppButton.jsx";
import SmartImage from "../components/ui/SmartImage.jsx";
import { SectionTitle, EmptyState, Flag } from "../components/ui/Bits.jsx";
import { href } from "../utils/routes.js";
import { contentFor, contactFor } from "../utils/defaults.js";
import { whatsappHref, generalMessage } from "../utils/whatsapp.js";
import { CATEGORIES } from "../constants.js";

// לטינית לצימוד הדו-לשוני (§2.5, מנגנון 2). קבוע-תצוגה, לא תוכן —
// ולכן הוא כאן ולא ב-i18n: הוא זהה בשתי השפות ומופיע רק לצד עברית.
const CATEGORY_LATIN = {
  rings: "RINGS",
  earrings: "EARRINGS",
  necklaces: "NECKLACES",
  bracelets: "BRACELETS",
};

export default function HomePage({ models, diamonds, settings, submitLead }) {
  const { t, lang } = useI18n();
  const content = contentFor(settings, lang);
  const contact = contactFor(settings);
  const waHref = whatsappHref(contact.whatsapp, generalMessage(t));

  const featured = models.filter((m) => m.featured).slice(0, 6);
  const faq = (content.faq || []).slice(0, 3);

  return (
    <>
      {/* ================= Hero =================
          🔴 **טקסט לא יושב על צילום.** ה-`bg-ink/60` הישן היה שכבת ערפול
          גורפת שהרגה את הצילום ועדיין לא נתנה ודאות ניגודיות.

          רמה A (מובייל, רוב התנועה): תמונה full-bleed ומתחתיה בלוק על
          `paper`. אפס scrim, אפס סיכון, וה-H1 ב-32px נקרא.
          התמונה מוגבלת ל-42vh כדי שה-H1 וה-CTA ייראו בלי גלילה ב-375×667.

          רמה B (דסקטופ): הטקסט בטורים הפנימיים על `paper` — לוח אטום
          בעל קצוות חדים, לא שכבת ערפול. הקומפוזיציה נשארת full-bleed
          והטקסט לא נוגע בפיקסל אחד של צילום. */}
      <section className="border-b border-line">
        <div className="lg:grid lg:grid-cols-12 lg:items-stretch">
          {content.heroImage ? (
            <div className="lg:col-span-7">
              <SmartImage
                src={content.heroImage}
                alt=""
                className="max-h-[42vh] w-full lg:aspect-[16/10] lg:max-h-none lg:h-full"
                sizes="(max-width: 1024px) 100vw, 58vw"
                priority
              />
            </div>
          ) : null}

          <div
            className={`bg-paper ${
              content.heroImage ? "lg:col-span-5" : "lg:col-span-12"
            } flex items-center`}
          >
            <div className="container-page py-10 lg:py-16">
              <div className="max-w-2xl">
                {/* משקל 200 מותר רק מ-44px ומעלה → 300 במובייל, 200 מ-52px. */}
                <h1 className="text-display1 font-light lg:text-display1Lg lg:font-extralight">
                  {content.heroTitle}
                </h1>
                <p className="mt-5 max-w-prose text-body text-ink-80 lg:text-bodyLg">
                  {content.heroSubtitle}
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button as="a" href={href.catalog()} size="lg">
                    {t("home.heroCtaCatalog")}
                  </Button>
                  {waHref ? (
                    <WhatsAppButton href={waHref} size="lg">
                      {t("home.heroCtaWhatsapp")}
                    </WhatsAppButton>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= איך זה עובד =================
          רקע 2 של העמוד (`alt`). כלל שני הרקעים: זה והפוטר. */}
      <section className="bg-alt py-12 lg:py-24" aria-labelledby="how-title">
        <div className="container-page">
          <SectionTitle id="how-title" latin="HOW IT WORKS">
            {t("home.howTitle")}
          </SectionTitle>
          <ol className="grid gap-8 sm:grid-cols-3 sm:gap-6">
            {[1, 2, 3].map((n) => (
              <li key={n} className="border-t border-ink pt-4">
                <span className="micro-en">{`0${n}`}</span>
                <h3 className="mt-2 text-titleLg font-medium">{t(`home.howStep${n}Title`)}</h3>
                {/* muted על alt = 5.14:1 — בדיוק המקום שבו ה-Muted הישן נכשל. */}
                <p className="mt-2 text-meta text-muted">{t(`home.howStep${n}Body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= קטגוריות ================= */}
      <section className="container-page py-12 lg:py-24" aria-labelledby="cat-title">
        <SectionTitle id="cat-title" sub={t("home.categoriesSub")} latin="COLLECTIONS">
          {t("home.categoriesTitle")}
        </SectionTitle>
        {/* אריח צילומי — בלי מסגרת, בלי צל, בלי אייקון במרכז.
            עד שיהיו צילומים: הפס האלכסוני של השפה (SmartImage בלי src). */}
        <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <li key={c}>
              <a href={href.catalog({ category: c })} className="group block">
                <SmartImage
                  src={null}
                  alt=""
                  caption={t("home.categoryImagePending")}
                  className="aspect-square w-full"
                />
                <span className="mt-3 block text-spec font-medium text-ink group-hover:underline">
                  {t(`taxonomy.category.${c}`)}
                </span>
                {lang === "he" ? <span className="micro-en">{CATEGORY_LATIN[c]}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* ================= דגמים נבחרים ================= */}
      <section className="container-page py-12 lg:py-24" aria-labelledby="featured-title">
        <SectionTitle id="featured-title" sub={t("home.featuredSub")} latin="SELECTED">
          {t("home.featuredTitle")}
        </SectionTitle>
        {featured.length === 0 ? (
          <EmptyState title={t("home.empty")} />
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 sm:gap-x-6">
              {featured.map((m) => (
                <li key={m.id}>
                  <ModelCard model={m} diamonds={diamonds} />
                </li>
              ))}
            </ul>
            <div className="mt-10">
              <Button as="a" href={href.catalog()} variant="outline">
                {t("home.featuredCta")}
              </Button>
            </div>
          </>
        )}
      </section>

      {/* ================= מלאי יהלומים ================= */}
      <section className="container-page py-12 lg:py-16">
        <div className="flex flex-col items-start gap-5 border-y border-line py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-section font-medium tracking-heLabel lg:text-sectionLg lg:font-light">
              {t("home.diamondsTeaserTitle")}
            </h2>
            <p className="mt-2 text-meta text-muted">
              {t("home.diamondsTeaserSub", { count: diamonds.length })}
            </p>
          </div>
          <Button as="a" href={href.diamonds()} variant="outline">
            {t("home.diamondsTeaserCta")}
          </Button>
        </div>
      </section>

      {/* ================= סיפור ================= */}
      <section className="container-page py-12 lg:py-24" aria-labelledby="story-title">
        <div className="max-w-prose">
          <SectionTitle id="story-title">{content.storyTitle}</SectionTitle>
          <p className="whitespace-pre-line text-body text-ink-80">{content.storyBody}</p>
          <Button as="a" href={href.about()} variant="link" className="mt-6">
            {t("home.storyCta")}
          </Button>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="container-page py-12 lg:py-16" aria-labelledby="faq-title">
        <SectionTitle id="faq-title">{t("home.faqTitle")}</SectionTitle>
        <dl className="max-w-prose border-t border-line">
          {faq.map((item, i) => (
            <div key={i} className="border-b border-line py-6">
              <dt className="text-title font-medium">{item.q}</dt>
              <dd className="mt-2 text-body text-ink-80">{item.a}</dd>
            </div>
          ))}
        </dl>
        <Button as="a" href={href.about()} variant="link" className="mt-6">
          {t("home.faqCta")}
        </Button>
      </section>

      {/* ================= יצירת קשר ================= */}
      <section className="container-page py-12 lg:py-24" aria-labelledby="contact-title">
        <div className="max-w-2xl">
          <SectionTitle id="contact-title" sub={t("home.contactSub")}>
            {t("home.contactTitle")}
          </SectionTitle>
          {!contact.whatsapp ? <Flag className="mb-6">{t("whatsapp.unavailable")}</Flag> : null}
          <LeadForm onSubmit={submitLead} source="contactForm" />
        </div>
      </section>
    </>
  );
}
