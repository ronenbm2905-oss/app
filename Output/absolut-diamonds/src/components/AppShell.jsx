import { useState } from "react";
import { Menu, X, MessageCircle, Globe } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import { href } from "../utils/routes.js";
import { brandParts, brandIsPlaceholder } from "../brand.js";
import { contactFor } from "../utils/defaults.js";
import { whatsappHref, generalMessage } from "../utils/whatsapp.js";
import Button from "./ui/Button.jsx";

const NAV = [
  { key: "home", to: () => href.home() },
  { key: "catalog", to: () => href.catalog() },
  { key: "diamonds", to: () => href.diamonds() },
  { key: "about", to: () => href.about() },
  { key: "contact", to: () => href.contact() },
];

function BrandMark({ settings, lang }) {
  const { main, suffix } = brandParts(settings, lang);
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="brand-mark text-xl font-semibold text-ink">{main}</span>
      <span className="text-sm tracking-brand text-gold-600">{suffix}</span>
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
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow"
      >
        {t("common.skipToContent")}
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-ivory/95 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between gap-3">
          <a href={href.home()} className="shrink-0" aria-label={t("nav.home")}>
            <BrandMark settings={settings} lang={lang} />
          </a>

          <nav aria-label={t("nav.main")} className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => (
                <li key={item.key}>
                  <a
                    href={item.to()}
                    aria-current={isActive(item.key) ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center rounded-lg px-3 transition-colors hover:bg-sand ${
                      isActive(item.key) ? "font-semibold text-rose-700" : "text-ink"
                    }`}
                  >
                    {t(`nav.${item.key}`)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleLang}
              aria-label={t("nav.langToggleAria")}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 hover:bg-sand"
            >
              <Globe size={18} aria-hidden="true" />
              <span className="text-sm">{t("nav.langToggle")}</span>
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-sand md:hidden"
            >
              {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav id="mobile-nav" aria-label={t("nav.main")} className="border-t border-line bg-ivory md:hidden">
            <ul className="container-page py-2">
              {NAV.map((item) => (
                <li key={item.key}>
                  <a
                    href={item.to()}
                    onClick={() => setMenuOpen(false)}
                    aria-current={isActive(item.key) ? "page" : undefined}
                    className={`flex min-h-12 items-center rounded-lg px-2 ${
                      isActive(item.key) ? "font-semibold text-rose-700" : "text-ink"
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

      {/* כפתור וואטסאפ צף — O5.7: שם נגיש, לא אייקון בלבד, ונגיש במקלדת.
          מוסתר כשאין מספר, במקום כפתור שבור. */}
      {waHref ? (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-4 end-4 z-30 inline-flex min-h-14 items-center gap-2 rounded-full bg-[#128C7E] px-5 text-white shadow-lg hover:bg-[#0F6F64]"
        >
          <MessageCircle size={22} aria-hidden="true" />
          <span className="font-medium">{t("contact.whatsappFab")}</span>
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
    <footer className="mt-16 border-t border-line bg-white">
      <div className="container-page py-10">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <BrandMark settings={settings} lang={lang} />
            {/* 🟠 A9 — השם עדיין placeholder. הבאנר גלוי לצוות, לא ללקוח קצה
                בייצור — אבל כל עוד הדגל דלוק, מוטב שהוא ייראה. */}
            {brandIsPlaceholder(settings) ? (
              <p className="mt-2 max-w-xs rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {t("admin.brandPlaceholderWarn")}
              </p>
            ) : null}
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold">{t("contact.title")}</h2>
            <ul className="space-y-1 text-sm">
              {contact.publicEmail ? (
                <li>
                  <a className="underline hover:text-rose-700" href={`mailto:${contact.publicEmail}`}>
                    {contact.publicEmail}
                  </a>
                </li>
              ) : null}
              {contact.phone ? (
                <li>
                  <a className="num underline hover:text-rose-700" href={`tel:${contact.phone}`}>
                    {contact.phone}
                  </a>
                </li>
              ) : null}
              {contact.instagram ? (
                <li>
                  <a
                    className="underline hover:text-rose-700"
                    href={contact.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("contact.instagram")}
                  </a>
                </li>
              ) : null}
              {contact.facebook ? (
                <li>
                  <a
                    className="underline hover:text-rose-700"
                    href={contact.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("contact.facebook")}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold">{t("legal.privacyTitle")}</h2>
            <ul className="space-y-1 text-sm">
              <li>
                <a className="underline hover:text-rose-700" href={href.privacy()}>
                  {t("legal.privacyTitle")}
                </a>
              </li>
              <li>
                <a className="underline hover:text-rose-700" href={href.accessibility()}>
                  {t("legal.accessibilityTitle")}
                </a>
              </li>
            </ul>
            {/* A5.2 — נאמר פעם אחת, גלובלית, בנוסף לכל מחיר. */}
            <p className="mt-3 text-sm text-muted">{t("legal.priceVat")}</p>
          </div>
        </div>

        <p className="mt-8 border-t border-line pt-4 text-sm text-muted">
          © {year} {main} {suffix} · {t("legal.rights")}
        </p>
      </div>
    </footer>
  );
}

export { BrandMark };
