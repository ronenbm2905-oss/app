import type {
  FormSlug,
  LeadData,
  QuestionId,
  SubmissionMeta,
  SubmitLeadResponse,
} from '@shared/types/questionnaire';

/**
 * שליחת הליד.
 *
 * הנתיב הוא יחסי (`/api/submit-lead`) ומנותב ב-`firebase.json` אל ה-Cloud
 * Function — כך הבקשה נשארת same-origin ואין CORS בכלל.
 */
const ENDPOINT = import.meta.env.VITE_SUBMIT_LEAD_URL ?? '/api/submit-lead';

export function collectMeta(startedAt: number): SubmissionMeta {
  const params = new URLSearchParams(window.location.search);
  const get = (k: string) => params.get(k) ?? undefined;

  return {
    utm_source: get('utm_source'),
    utm_medium: get('utm_medium'),
    utm_campaign: get('utm_campaign'),
    utm_content: get('utm_content'),
    utm_term: get('utm_term'),
    gclid: get('gclid'),
    fbclid: get('fbclid'),
    referrer: document.referrer || undefined,
    landingPath: window.location.pathname,
    userAgent: navigator.userAgent,
    timeOnPageMs: Date.now() - startedAt,
  };
}

export async function submitLead(payload: {
  formSlug: FormSlug;
  answers: Record<QuestionId, string>;
  lead: LeadData;
  meta: SubmissionMeta;
  website: string;
}): Promise<SubmitLeadResponse> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as SubmitLeadResponse;

  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? `submit failed (${response.status})`);
  }
  return data;
}
