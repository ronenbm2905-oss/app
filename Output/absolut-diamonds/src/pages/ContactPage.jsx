import { Mail, Phone } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import LeadForm from "../components/LeadForm.jsx";
import WhatsAppButton from "../components/ui/WhatsAppButton.jsx";
import { PageTitle, Flag } from "../components/ui/Bits.jsx";
import { contactFor } from "../utils/defaults.js";
import { whatsappHref, generalMessage } from "../utils/whatsapp.js";

export default function ContactPage({ settings, submitLead }) {
  const { t } = useI18n();
  const contact = contactFor(settings);
  const waHref = whatsappHref(contact.whatsapp, generalMessage(t));

  return (
    <div className="container-page py-10 lg:py-16">
      <PageTitle sub={t("contact.subtitle")}>{t("contact.title")}</PageTitle>

      <div className="grid gap-12 lg:grid-cols-[1fr_20rem]">
        <div className="max-w-2xl">
          <LeadForm onSubmit={submitLead} source="contactForm" />
        </div>

        <aside className="space-y-6">
          {waHref ? (
            <div>
              <WhatsAppButton href={waHref} size="lg" className="w-full">
                {t("contact.whatsapp")}
              </WhatsAppButton>
              {/* A7.5 — העברה לצד שלישי, נאמר ליד הכפתור ולא רק במדיניות. */}
              <p className="mt-3 text-meta text-muted">{t("whatsapp.metaNotice")}</p>
            </div>
          ) : (
            <Flag>{t("whatsapp.unavailable")}</Flag>
          )}

          <ul className="border-t border-line">
            {contact.publicEmail ? (
              <li className="border-b border-line">
                <a
                  className="flex min-h-12 items-center gap-3 text-spec text-ink hover:text-ink-80"
                  href={`mailto:${contact.publicEmail}`}
                >
                  <Mail size={18} strokeWidth={1.5} aria-hidden="true" />
                  <span className="num">{contact.publicEmail}</span>
                </a>
              </li>
            ) : null}
            {contact.phone ? (
              <li className="border-b border-line">
                <a
                  className="flex min-h-12 items-center gap-3 text-spec text-ink hover:text-ink-80"
                  href={`tel:${contact.phone}`}
                >
                  <Phone size={18} strokeWidth={1.5} aria-hidden="true" />
                  <span className="num">{contact.phone}</span>
                </a>
              </li>
            ) : null}
          </ul>

          {contact.legalEntityName ? (
            <p className="text-meta text-muted">
              {contact.legalEntityName}
              {contact.legalEntityId ? ` · ${contact.legalEntityId}` : ""}
              {contact.legalEntityAddress ? ` · ${contact.legalEntityAddress}` : ""}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
