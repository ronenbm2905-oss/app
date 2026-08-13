import { MessageCircle, Mail, Phone } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import LeadForm from "../components/LeadForm.jsx";
import Button from "../components/ui/Button.jsx";
import { SectionTitle, Notice } from "../components/ui/Bits.jsx";
import { contactFor } from "../utils/defaults.js";
import { whatsappHref, generalMessage } from "../utils/whatsapp.js";

export default function ContactPage({ settings, submitLead }) {
  const { t } = useI18n();
  const contact = contactFor(settings);
  const waHref = whatsappHref(contact.whatsapp, generalMessage(t));

  return (
    <div className="container-page py-10">
      <SectionTitle sub={t("contact.subtitle")}>{t("contact.title")}</SectionTitle>

      <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
        <div className="max-w-2xl">
          <LeadForm onSubmit={submitLead} source="contactForm" />
        </div>

        <aside className="space-y-4">
          {waHref ? (
            <div>
              <Button
                as="a"
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                variant="whatsapp"
                size="lg"
                className="w-full"
              >
                <MessageCircle size={20} aria-hidden="true" />
                {t("contact.whatsapp")}
              </Button>
              {/* A7.5 — העברה לצד שלישי, נאמר ליד הכפתור ולא רק במדיניות. */}
              <p className="mt-2 text-sm text-muted">{t("whatsapp.metaNotice")}</p>
            </div>
          ) : (
            <Notice tone="warn">{t("whatsapp.unavailable")}</Notice>
          )}

          <ul className="card divide-y divide-line">
            {contact.publicEmail ? (
              <li>
                <a
                  className="flex min-h-12 items-center gap-3 px-4 hover:bg-sand"
                  href={`mailto:${contact.publicEmail}`}
                >
                  <Mail size={18} aria-hidden="true" />
                  <span className="num">{contact.publicEmail}</span>
                </a>
              </li>
            ) : null}
            {contact.phone ? (
              <li>
                <a className="flex min-h-12 items-center gap-3 px-4 hover:bg-sand" href={`tel:${contact.phone}`}>
                  <Phone size={18} aria-hidden="true" />
                  <span className="num">{contact.phone}</span>
                </a>
              </li>
            ) : null}
          </ul>

          {contact.legalEntityName ? (
            <p className="text-sm text-muted">
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
