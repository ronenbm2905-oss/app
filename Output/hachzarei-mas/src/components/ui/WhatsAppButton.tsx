import { site, whatsappLink } from '@shared/config/site';
import type { FormSlug, TierId } from '@shared/types/questionnaire';
import { trackWhatsappClick } from '@/lib/analytics';

interface Props {
  formSlug: FormSlug;
  tier: TierId;
  label: string;
}

export function WhatsAppButton({ formSlug, tier, label }: Props) {
  return (
    <a
      href={whatsappLink(formSlug)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackWhatsappClick(formSlug, tier)}
      className="inline-flex w-full min-h-touch items-center justify-center gap-2 rounded-xl bg-whatsapp px-5 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
        <path d="M17.5 14.4c-.3-.2-1.7-.9-2-1s-.5-.2-.7.1-.8 1-.9 1.2-.3.2-.6.1a8 8 0 0 1-2.4-1.5 9 9 0 0 1-1.6-2c-.2-.3 0-.5.1-.6l.5-.6.3-.5v-.5l-.9-2.1c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1a11.4 11.4 0 0 0 4.4 3.9c1.6.6 1.9.5 2.3.5s1.7-.7 1.9-1.4.2-1.2.2-1.3zM12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2z" />
      </svg>
      {label}
    </a>
  );
}

export function PhoneLink() {
  return (
    <a href={`tel:${site.phone.replace(/-/g, '')}`} className="font-semibold text-brand">
      {site.phone}
    </a>
  );
}
