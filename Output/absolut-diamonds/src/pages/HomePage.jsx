import { MessageCircle } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import ModelCard from "../components/ModelCard.jsx";
import LeadForm from "../components/LeadForm.jsx";
import Button from "../components/ui/Button.jsx";
import SmartImage from "../components/ui/SmartImage.jsx";
import { SectionTitle, EmptyState, Notice } from "../components/ui/Bits.jsx";
import DiamondShape from "../components/ui/DiamondShape.jsx";
import { href } from "../utils/routes.js";
import { contentFor, contactFor } from "../utils/defaults.js";
import { whatsappHref, generalMessage } from "../utils/whatsapp.js";
import { CATEGORIES } from "../constants.js";

export default function HomePage({ models, diamonds, settings, submitLead }) {
  const { t, lang } = useI18n();
  const content = contentFor(settings, lang);
  const contact = contactFor(settings);
  const waHref = whatsappHref(contact.whatsapp, generalMessage(t));

  const featured = models.filter((m) => m.featured).slice(0, 6);
  const faq = (content.faq || []).slice(0, 3);

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden border-b border-line bg-sand">
        {content.heroImage ? (
          <>
            <SmartImage src={content.heroImage} alt="" className="absolute inset-0 h-full w-full" priority />
            {/* O5.1 — scrim אטום מתחת לטקסט. טקסט מעל תמונה עמוסה בלי זה
                נכשל בניגודיות, וזה בדיוק הסיכון של רקע דמשק/שיש. */}
            <div className="absolute inset-0 bg-ink/60" aria-hidden="true" />
          </>
        ) : null}

        <div className={`container-page relative py-16 sm:py-24 ${content.heroImage ? "text-white" : ""}`}>
          <div className="max-w-2xl">
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{content.heroTitle}</h1>
            <p className={`mt-4 text-lg ${content.heroImage ? "text-white/90" : "text-muted"}`}>
              {content.heroSubtitle}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button as="a" href={href.catalog()} size="lg">
                {t("home.heroCtaCatalog")}
              </Button>
              {waHref ? (
                <Button as="a" href={waHref} target="_blank" rel="noopener noreferrer" variant="whatsapp" size="lg">
                  <MessageCircle size={20} aria-hidden="true" />
                  {t("home.heroCtaWhatsapp")}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- איך זה עובד ---------------- */}
      <section className="container-page py-14" aria-labelledby="how-title">
        <SectionTitle id="how-title">{t("home.howTitle")}</SectionTitle>
        <ol className="grid gap-6 sm:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <li key={n} className="card p-5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-600 font-semibold text-white num">
                {n}
              </span>
              <h3 className="mt-3 text-lg font-semibold">{t(`home.howStep${n}Title`)}</h3>
              <p className="mt-1 text-muted">{t(`home.howStep${n}Body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------- קטגוריות ---------------- */}
      <section className="container-page py-6" aria-labelledby="cat-title">
        <SectionTitle id="cat-title" sub={t("home.categoriesSub")}>
          {t("home.categoriesTitle")}
        </SectionTitle>
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <li key={c}>
              <a
                href={href.catalog({ category: c })}
                className="card flex flex-col items-center gap-3 p-6 text-center transition-shadow hover:shadow-lg"
              >
                <DiamondShape shape="round" className="h-12 w-12" />
                <span className="text-lg font-medium">{t(`taxonomy.category.${c}`)}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------- דגמים נבחרים ---------------- */}
      <section className="container-page py-14" aria-labelledby="featured-title">
        <SectionTitle id="featured-title" sub={t("home.featuredSub")}>
          {t("home.featuredTitle")}
        </SectionTitle>
        {featured.length === 0 ? (
          <EmptyState title={t("home.empty")} />
        ) : (
          <>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((m) => (
                <li key={m.id}>
                  <ModelCard model={m} diamonds={diamonds} />
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Button as="a" href={href.catalog()} variant="secondary">
                {t("home.featuredCta")}
              </Button>
            </div>
          </>
        )}
      </section>

      {/* ---------------- מלאי יהלומים ---------------- */}
      <section className="border-y border-line bg-white py-14">
        <div className="container-page flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{t("home.diamondsTeaserTitle")}</h2>
            <p className="mt-1 text-muted">{t("home.diamondsTeaserSub", { count: diamonds.length })}</p>
          </div>
          <Button as="a" href={href.diamonds()}>
            {t("home.diamondsTeaserCta")}
          </Button>
        </div>
      </section>

      {/* ---------------- סיפור ---------------- */}
      <section className="container-page py-14" aria-labelledby="story-title">
        <div className="max-w-3xl">
          <SectionTitle id="story-title">{content.storyTitle}</SectionTitle>
          <p className="whitespace-pre-line leading-relaxed">{content.storyBody}</p>
          <Button as="a" href={href.about()} variant="ghost" className="mt-4">
            {t("home.storyCta")}
          </Button>
        </div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section className="container-page py-6" aria-labelledby="faq-title">
        <SectionTitle id="faq-title">{t("home.faqTitle")}</SectionTitle>
        <dl className="max-w-3xl space-y-4">
          {faq.map((item, i) => (
            <div key={i} className="card p-5">
              <dt className="font-semibold">{item.q}</dt>
              <dd className="mt-2 leading-relaxed text-muted">{item.a}</dd>
            </div>
          ))}
        </dl>
        <Button as="a" href={href.about()} variant="ghost" className="mt-4">
          {t("home.faqCta")}
        </Button>
      </section>

      {/* ---------------- יצירת קשר ---------------- */}
      <section className="container-page py-14" aria-labelledby="contact-title">
        <div className="max-w-2xl">
          <SectionTitle id="contact-title" sub={t("home.contactSub")}>
            {t("home.contactTitle")}
          </SectionTitle>
          {!contact.whatsapp ? (
            <Notice tone="warn" className="mb-4">
              {t("whatsapp.unavailable")}
            </Notice>
          ) : null}
          <LeadForm onSubmit={submitLead} source="contactForm" />
        </div>
      </section>
    </>
  );
}
