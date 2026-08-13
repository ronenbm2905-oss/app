import { useState } from "react";
import { Menu, X, Globe } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import { href } from "../utils/routes.js";
import { brandParts, brandIsPlaceholder } from "../brand.js";
import { contactFor } from "../utils/defaults.js";
import { whatsappHref, generalMessage } from "../utils/whatsapp.js";
import { WhatsAppGlyph } from "./ui/WhatsAppButton.jsx";

const NAV = [
  { key: "home", to: () => href.home() },
  { key: "catalog", to: () => href.catalog() },
  { key: "diamonds", to: () => href.diamonds() },
  { key: "about", to: () => href.about() },
  { key: "contact", to: () => href.contact() },
];

// ה-wordmark. `ls .4em` של השפה הוא מנגנון לטיני — בעברית הוא הורס את המילה.
// עברית max .12em ב-18–20px משקל 300; הצמד הלטיני שומר .30em.
// הסיומת עברה מ-`gold-600` ל-`muted` — תקציב זהב + ניגודיות.
function BrandMark({ settings, lang }) {
  const { main, suffix } = brandParts(settings, lang);
  const en = lang === "en";
  return (
    <span className="flex items-baseline gap-2">
      <span
        className={`text-titleLg font-light text-ink ${en ? "tracking-wordmarkEn uppercase" : "tracking-wordmarkHe"}`}
      >
        {main}
      </span>
      <span
        className={`text-eyebrow text-muted ${en ? "tracking-enLabel uppercase" : "tracking-heLabel"}`}
      >
        {suffix}
      </span>
    </span>
  );
}

export default function AppShell({ settings, route, children }) {
  const { t, lang, toggleLang } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const contact = contactFor(settings);
  const waHref = whatsappHref(contact.whatsapp, generalMessage(t));

  const isActive = (key) => route?.name === key || (key === "home" && route?.name === "home");

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:bg-surface focus:px-4 focus:py-2"
      >
        {t("common.skipToContent")}
      </a>

      {/* רקע `paper` **אטום**. `bg-ivory/95 backdrop-blur` ירד: שקיפות+טשטוש
          הופכים את הניגודיות לבלתי-צפויה מעל תוכן נגלל. */}
      <header className="sticky top-0 z-40 border-b border-line bg-paper">
        <div className="container-page flex h-[60px] items-center justify-between gap-3 lg:h-[72px]">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
              className="inline-flex h-11 w-11 items-center justify-center text-ink md:hidden"
            >
              {menuOpen ? (
                <X size={22} strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Menu size={22} strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>

            <nav aria-label={t("nav.main")} className="hidden md:block">
              <ul className="flex items-center gap-7">
                {NAV.map((item) => (
                  <li key={item.key}>
                    <a
                      href={item.to()}
                      aria-current={isActive(item.key) ? "page" : undefined}
                      className={`inline-flex min-h-11 items-center text-meta transition-colors duration-hover hover:text-ink ${
                        // פריט פעיל: ink + קו תחתון ink. לא `text-rose-700`.
                        isActive(item.key) ? "border-b border-ink text-ink" : "text-ink-80"
                      }`}
                    >
                      {t(`nav.${item.key}`)}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <a href={href.home()} className="shrink-0" aria-label={t("nav.home")}>
            <BrandMark settings={settings} lang={lang} />
          </a>

          <button
            type="button"
            onClick={toggleLang}
            aria-label={t("nav.langToggleAria")}
            className="inline-flex min-h-11 items-center gap-2 text-ink-80 hover:text-ink"
          >
            <Globe size={18} strokeWidth={1.5} aria-hidden="true" />
            <span className="text-meta">{t("nav.langToggle")}</span>
          </button>
        </div>

        {menuOpen ? (
          <nav id="mobile-nav" aria-label={t("nav.main")} className="border-t border-line bg-surface md:hidden">
            <ul className="container-page">
              {NAV.map((item) => (
                <li key={item.key} className="border-b border-line last:border-b-0">
                  <a
                    href={item.to()}
                    onClick={() => setMenuOpen(false)}
                    aria-current={isActive(item.key) ? "page" : undefined}
                    className={`flex min-h-[52px] items-center text-bodyLg ${
                      isActive(item.key) ? "font-medium text-ink" : "text-ink-80"
                    }`}
                  >
                    {t(`nav.${item.key}`)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <Footer settings={settings} contact={contact} />

      {/* FAB וואטסאפ — O5.7: שם נגיש, לא אייקון בלבד, ונגיש במקלדת.
          מילוי `ink` (לא ירוק), radius pill — יוצא הדופן המותר, גובה 48px,
          **תווית מילולית תמיד גלויה**. מוסתר כשאין מספר. */}
      {waHref ? (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="on-ink fixed bottom-4 end-4 z-30 inline-flex min-h-12 items-center gap-2 rounded-pill bg-ink px-5 text-paper transition-colors duration-hover hover:bg-ink-80"
        >
          <WhatsAppGlyph size={20} />
          <span className="text-button font-medium">{t("contact.whatsappFab")}</span>
        </a>
      ) : null}
    </div>
  );
}

function Footer({ settings, contact }) {
  const { t, lang } = useI18n();
  const { main, suffix } = brandParts(settings, lang);
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-line bg-alt lg:mt-24">
      <div className="container-page py-12 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr_1fr] lg:gap-10">
          <div>
            <BrandMark settings={settings} lang={lang} />
            {/* 🟠 A9 — השם עדיין placeholder. `.flag` על רקע `alt`, לא ענבר. */}
            {brandIsPlaceholder(settings) ? (
              <p className="flag mt-4 max-w-xs text-meta font-semibold text-ink">
                {t("admin.brandPlaceholderWarn")}
              </p>
            ) : null}
          </div>

          <div>
            <h2 className="eyebrow mb-4">{t("contact.title")}</h2>
            <ul className="text-spec leading-loose text-ink-80">
              {contact.publicEmail ? (
                <li>
                  <a className="link-ink" href={`mailto:${contact.publicEmail}`}>
                    {contact.publicEmail}
                  </a>
                </li>
              ) : null}
              {contact.phone ? (
                <li>
                  <a className="link-ink num" href={`tel:${contact.phone}`}>
                    {contact.phone}
                  </a>
                </li>
              ) : null}
              {contact.instagram ? (
                <li>
                  <a className="link-ink" href={contact.instagram} target="_blank" rel="noopener noreferrer">
                    {t("contact.instagram")}
                  </a>
                </li>
              ) : null}
              {contact.facebook ? (
                <li>
                  <a className="link-ink" href={contact.facebook} target="_blank" rel="noopener noreferrer">
                    {t("contact.facebook")}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>

          <div>
            <h2 className="eyebrow mb-4">{t("legal.privacyTitle")}</h2>
            {/* הלינקים המשפטיים — קו תחתון **קבוע**, לא רק ב-hover. */}
            <ul className="text-spec leading-loose text-ink-80">
              <li>
                <a className="link-ink" href={href.privacy()}>
                  {t("legal.privacyTitle")}
                </a>
              </li>
              <li>
                <a className="link-ink" href={href.accessibility()}>
                  {t("legal.accessibilityTitle")}
                </a>
              </li>
            </ul>
            {/* A5.2 — נאמר פעם אחת, גלובלית, בנוסף לכל מחיר. */}
            <p className="mt-4 text-meta text-muted">{t("legal.priceVat")}</p>
          </div>
        </div>

        <p className="mt-12 border-t border-line pt-5 text-meta text-muted">
          © {year} {main} {suffix} · {t("legal.rights")}
        </p>
      </div>
    </footer>
  );
}

export { BrandMark };
