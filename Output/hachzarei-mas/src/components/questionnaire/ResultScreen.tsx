import { forwardRef } from 'react';
import type { QuestionnaireConfig, ScoreResult } from '@shared/types/questionnaire';
import { WhatsAppButton, PhoneLink } from '@/components/ui/WhatsAppButton';
import { feeDisclosure } from '@shared/config/site';
import { Button } from '@/components/ui/Button';

interface Props {
  config: QuestionnaireConfig;
  result: ScoreResult;
  /** האם הגולש סימן את צ'קבוקס ההסכמה לדיוור */
  consent: boolean;
  /** מוצג אחרי שליחה מוצלחת, רק כשיש שדות secondary */
  onContinue?: () => void;
}

export const ResultScreen = forwardRef<HTMLHeadingElement, Props>(function ResultScreen(
  { config, result, consent, onContinue },
  ref
) {
  const { tier, disqualifiedBy } = result;

  // מי שנחסם בשער לא "קיבל ציון נמוך" — הוא ענה שאלה אחת ולעיתים גם לא
  // מסר פרטים. הנוסח הכללי של מדרג C פשוט לא נכון עובדתית עבורו (§4.2, §5.3).
  const headline = disqualifiedBy?.headline ?? tier.headline;
  const body = disqualifiedBy?.reason ?? tier.body;
  const showCta = tier.ctaType !== 'none' && !disqualifiedBy;

  return (
    <section className="mx-auto w-full max-w-2xl px-5 py-14">
      {/* ⚠️ exposeScoreToVisitor=false בשני הדפים — אין כאן ציון, אחוז או סכום */}
      <h1 ref={ref} tabIndex={-1} className="text-2xl font-bold leading-snug sm:text-3xl">
        {headline}
      </h1>

      <p className="mt-4 text-lg leading-relaxed text-muted">{body}</p>

      {/* מוצג רק למי שסימן הסכמה — אחרת זו הבטחת דיוור למי שאסור לדוור לו (§9.3) */}
      {consent && tier.consentNote && !disqualifiedBy && (
        <p className="mt-3 leading-relaxed text-muted">{tier.consentNote}</p>
      )}

      {showCta && (
        <div className="mt-8 space-y-3">
          <WhatsAppButton
            formSlug={config.slug}
            tier={tier.id}
            label={tier.ctaLabel ?? 'דבר איתנו בוואטסאפ'}
          />
          {tier.ctaNote && <p className="text-sm leading-relaxed text-muted">{tier.ctaNote}</p>}

          {/* גילוי שכר הטרחה — גלוי, לא מאחורי אקורדיון. ח-3 בשער המשפטי */}
          <p className="text-sm leading-relaxed text-muted">{feeDisclosure}</p>
        </div>
      )}

      {onContinue && (
        <div className="mt-8 rounded-2xl border border-line bg-surface p-5">
          <p className="font-semibold">כמה פרטים נוספים יזרזו את הטיפול</p>
          <p className="mt-1 text-sm text-muted">
            הפנייה שלך כבר נשלחה. זה לא חובה, וזה חוסך שאלות בשיחה.
          </p>
          <div className="mt-4">
            <Button onClick={onContinue}>להשלמת הפרטים</Button>
          </div>
        </div>
      )}

      <p className="mt-10 text-sm text-muted">
        מעדיף לדבר? <PhoneLink />
      </p>
    </section>
  );
});
