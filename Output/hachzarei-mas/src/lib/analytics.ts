import type { FormSlug, TierId } from '@shared/types/questionnaire';

/**
 * עטיפה דקה ל-GA4 ול-Meta Pixel.
 *
 * שני הכללים היחידים שחשובים כאן:
 *   1. `lead_submit` נשלח עם `value` מדורג לפי מדרג, לא כהמרה בינארית (§7.2).
 *      בלי זה האלגוריתם לומד להביא לידים זולים — שהם בדיוק לידי C.
 *   2. ה-`value` נלקח מה-tier ש**השרת** החזיר. חישוב הלקוח לא נאמן,
 *      ואם הפיקסל מדווח לפיו — החישוב מחדש בשרת חסר משמעות.
 */

type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (command: string, ...args: unknown[]) => void;
    fbq?: (command: string, ...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function ga(event: string, params: Params): void {
  window.gtag?.('event', event, params);
}

export function trackQuizStart(formSlug: FormSlug): void {
  ga('quiz_start', { form_slug: formSlug });
}

export function trackQuizStep(
  formSlug: FormSlug,
  stepIndex: number,
  questionId: string,
  answerId: string
): void {
  ga('quiz_step', {
    form_slug: formSlug,
    step_index: stepIndex,
    question_id: questionId,
    answer_id: answerId,
  });
}

/**
 * הגולש נחסם בשער קשיח.
 *
 * ⚠️ האירוע החשוב ביותר בדף מס שבח. בלעדיו אי אפשר להבדיל בין
 * "הטירגוט מביא אנשים שלא מכרו נכס" לבין "הדף לא ממיר" — ובדף
 * שכל מטרתו סינון, זו ההבחנה היחידה שמשנה. ראה §7.1 באפיון.
 */
export function trackHardGateExit(
  formSlug: FormSlug,
  questionId: string,
  answerId: string
): void {
  ga('hard_gate_exit', {
    form_slug: formSlug,
    question_id: questionId,
    answer_id: answerId,
  });
}

export function trackQuizAbandon(formSlug: FormSlug, lastStepIndex: number): void {
  ga('quiz_abandon', { form_slug: formSlug, last_step_index: lastStepIndex });
}

export function trackLeadCaptureView(formSlug: FormSlug): void {
  ga('lead_capture_view', { form_slug: formSlug });
}

/** ⚠️ tier ו-value חייבים להגיע מתשובת השרת, לא מחישוב הלקוח */
export function trackLeadSubmit(formSlug: FormSlug, tier: TierId, value: number): void {
  ga('lead_submit', { form_slug: formSlug, tier, value, currency: 'ILS' });
  window.fbq?.('track', 'Lead', { content_name: formSlug, tier, value, currency: 'ILS' });
}

export function trackWhatsappClick(formSlug: FormSlug, tier: TierId): void {
  ga('whatsapp_click', { form_slug: formSlug, tier });
}
