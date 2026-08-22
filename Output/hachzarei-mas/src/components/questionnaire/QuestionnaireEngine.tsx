import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  LeadData,
  QuestionId,
  QuestionnaireConfig,
  ScoreResult,
  TierId,
} from '@shared/types/questionnaire';
import { calculateScore, isDisqualifying, tierById } from '@shared/lib/scoring';
import { collectMeta, submitLead } from '@/lib/api';
import { clearProgress, loadProgress, saveProgress } from '@/lib/storage';
import {
  trackHardGateExit,
  trackLeadCaptureView,
  trackLeadSubmit,
  trackQuizAbandon,
  trackQuizStart,
  trackQuizStep,
} from '@/lib/analytics';
import { HeroSection } from './HeroSection';
import { QuestionScreen } from './QuestionScreen';
import { LeadCaptureScreen } from './LeadCaptureScreen';
import { ResultScreen } from './ResultScreen';
import { SecondaryFieldsScreen } from './SecondaryFieldsScreen';
import { FAQ } from '@/components/ui/FAQ';
import { Footer } from '@/components/ui/Footer';

type Status = 'hero' | 'questions' | 'lead-capture' | 'result' | 'secondary';

interface Props {
  config: QuestionnaireConfig;
}

/**
 * מעבר מסך — הופעה בלבד, ב-CSS.
 *
 * שתי סיבות שזה לא framer-motion:
 *   1. **משקל.** המדידה: 112KB גולמי / 37KB gzip — שליש מכל ה-JS של האתר,
 *      עבור fade אחד של 200ms. היעד הוא Lighthouse Performance ≥ 90 במובייל
 *      **עם** הפיקסלים דלוקים, וזה תקציב שאין לבזבז על אנימציה שה-CSS עושה.
 *   2. **עמידות.** אנימציות JS רצות על requestAnimationFrame, שקופא בטאב
 *      שאינו גלוי. עם `AnimatePresence mode="wait"` זה אומר שגולש שבחר
 *      תשובה ומיד עבר לאפליקציה אחרת חוזר למסך תקוע. ל-CSS אין את הבעיה,
 *      והמפתח (key) לבדו מספיק כדי שהאנימציה תרוץ מחדש בכל מסך.
 *
 * ההעדפה prefers-reduced-motion מכובדת ב-index.css.
 */

export function QuestionnaireEngine({ config }: Props) {
  const heroQuestions = useMemo(
    () => config.questions.filter((q) => q.showInHero),
    [config]
  );
  const stepQuestions = useMemo(
    () => config.questions.filter((q) => !q.showInHero),
    [config]
  );

  const [answers, setAnswers] = useState<Record<QuestionId, string>>({});
  const [status, setStatus] = useState<Status>('hero');
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [consent, setConsent] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * מראה תמידית ל-answers.
   *
   * ה-state לבדו לא מספיק: בכל בחירה אנחנו גם **קוראים** את התשובות
   * (כדי להחליט אם כל שאלות ה-Hero נענו, ומה לשמור ב-sessionStorage),
   * ו-`answers` בתוך handler הוא ה-snapshot של הרנדור שבו ה-handler נוצר.
   * שתי בחירות באותו batch של React היו דורסות זו את זו.
   */
  const answersRef = useRef<Record<QuestionId, string>>({});
  const startedAt = useRef<number>(Date.now());
  const startTracked = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const statusRef = useRef<Status>('hero');
  const stepRef = useRef(0);

  statusRef.current = status;
  stepRef.current = step;

  // ── שחזור התקדמות אחרי רענון (תשובות בלבד — לא PII) ──
  useEffect(() => {
    const saved = loadProgress(config.slug);
    if (!saved || Object.keys(saved.answers).length === 0) return;

    startedAt.current = saved.startedAt;
    answersRef.current = saved.answers;
    setAnswers(saved.answers);
    startTracked.current = true;

    // נחסם בשער לפני הרענון — חוזרים ישר לתוצאה
    const gated = config.questions.find(
      (q) => saved.answers[q.id] && isDisqualifying(q.id, saved.answers[q.id], config)
    );
    if (gated) {
      setResult(calculateScore(saved.answers, config));
      setStatus('result');
      return;
    }

    if (!heroQuestions.every((q) => saved.answers[q.id])) return; // עדיין ב-Hero

    const nextStep = stepQuestions.findIndex((q) => !saved.answers[q.id]);
    if (nextStep === -1) {
      setStatus('lead-capture');
    } else {
      setStep(nextStep);
      setStatus('questions');
    }
  }, [config, heroQuestions, stepQuestions]);

  // ── פוקוס עובר לכותרת בכל מעבר מסך (WCAG 3.2.2 — §8.5) ──
  useEffect(() => {
    if (status === 'hero') return;
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [status, step]);

  useEffect(() => {
    if (status === 'lead-capture') trackLeadCaptureView(config.slug);
  }, [status, config.slug]);

  // ── נטישה באמצע השאלון ──
  useEffect(() => {
    function onPageHide() {
      const s = statusRef.current;
      if (s === 'hero' || s === 'questions') {
        trackQuizAbandon(config.slug, s === 'hero' ? 0 : stepRef.current + 1);
      }
    }
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [config.slug]);

  const persist = useCallback(
    (next: Record<QuestionId, string>) => {
      saveProgress(config.slug, { answers: next, startedAt: startedAt.current });
    },
    [config.slug]
  );

  const closeGate = useCallback(
    (next: Record<QuestionId, string>, questionId: string, answerId: string) => {
      trackHardGateExit(config.slug, questionId, answerId);
      setResult(calculateScore(next, config));
      setStatus('result');
    },
    [config]
  );

  const recordAnswer = useCallback(
    (questionId: string, answerId: string): Record<QuestionId, string> => {
      if (!startTracked.current) {
        startTracked.current = true;
        trackQuizStart(config.slug);
      }
      const globalIndex = config.questions.findIndex((q) => q.id === questionId);
      trackQuizStep(config.slug, globalIndex + 1, questionId, answerId);

      const next = { ...answersRef.current, [questionId]: answerId };
      answersRef.current = next;
      setAnswers(next);
      persist(next);
      return next;
    },
    [config, persist]
  );

  function handleHeroSelect(questionId: string, answerId: string) {
    const next = recordAnswer(questionId, answerId);

    if (isDisqualifying(questionId, answerId, config)) {
      closeGate(next, questionId, answerId);
      return;
    }

    // כל שאלות ה-Hero נענו → עוברים לשאלון עצמו
    if (heroQuestions.every((q) => next[q.id])) {
      window.setTimeout(() => {
        setStep(0);
        setStatus(stepQuestions.length > 0 ? 'questions' : 'lead-capture');
      }, 250);
    }
  }

  function handleStepSelect(answerId: string) {
    const question = stepQuestions[step];
    const next = recordAnswer(question.id, answerId);

    if (isDisqualifying(question.id, answerId, config)) {
      closeGate(next, question.id, answerId);
      return;
    }

    // השהיה קצרה שבה הבחירה מסומנת, ואז מעבר. אין כפתור "המשך" (§8.5).
    window.setTimeout(() => {
      if (step + 1 < stepQuestions.length) setStep(step + 1);
      else setStatus('lead-capture');
    }, 250);
  }

  function handleBack() {
    if (status === 'lead-capture') {
      setStatus(stepQuestions.length > 0 ? 'questions' : 'hero');
      setStep(Math.max(0, stepQuestions.length - 1));
      return;
    }
    if (step === 0) setStatus('hero');
    else setStep(step - 1);
  }

  async function handleSubmit(lead: LeadData, website: string) {
    setSubmitting(true);
    setError(null);
    setConsent(Boolean(lead.consent));

    try {
      const response = await submitLead({
        formSlug: config.slug,
        answers: answersRef.current,
        lead,
        meta: collectMeta(startedAt.current),
        website,
      });

      // ⚠️ המדרג של **השרת** קובע — גם לתצוגה וגם לפיקסל.
      // אם הפיקסל מדווח לפי חישוב הלקוח, החישוב מחדש בשרת חסר משמעות (§7.2).
      const serverTier = tierById(config, (response.tier ?? 'C') as TierId);
      const local = calculateScore(answersRef.current, config);

      setResult({ ...local, tier: serverTier });
      setSubmissionId(response.submissionId ?? null);
      trackLeadSubmit(config.slug, serverTier.id, serverTier.conversionValue);

      clearProgress(config.slug);
      setStatus('result');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSecondary(extra: Record<string, unknown>) {
    try {
      await fetch('/api/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formSlug: config.slug, submissionId, secondary: extra }),
      });
    } catch (err) {
      console.error(err); // הליד כבר נשמר — כישלון כאן לא פוגע בו
    }
    setStatus('result');
  }

  const offerSecondary =
    config.enableSecondaryFields &&
    submissionId !== null &&
    result !== null &&
    result.tier.id !== 'C';

  // מפתח שמשתנה בכל מעבר מסך — כולל בין שאלה לשאלה
  const screenKey = status === 'questions' ? `q-${step}` : status;

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <div key={screenKey} className="screen-in">
          {status === 'hero' && (
              <HeroSection
                config={config}
                heroQuestions={heroQuestions}
                answers={answers}
                onSelect={handleHeroSelect}
              />
          )}

          {status === 'questions' && (
              <QuestionScreen
                ref={headingRef}
                question={stepQuestions[step]}
                stepNumber={heroQuestions.length + step + 1}
                totalSteps={config.questions.length}
                selected={answers[stepQuestions[step].id]}
                onSelect={handleStepSelect}
                onBack={handleBack}
              />
          )}

          {status === 'lead-capture' && (
              <LeadCaptureScreen
                ref={headingRef}
                config={config}
                submitting={submitting}
                error={error}
                onSubmit={handleSubmit}
                onBack={handleBack}
              />
          )}

          {status === 'result' && result && (
              <ResultScreen
                ref={headingRef}
                config={config}
                result={result}
                consent={consent}
                onContinue={offerSecondary ? () => setStatus('secondary') : undefined}
              />
          )}

          {status === 'secondary' && (
              <SecondaryFieldsScreen
                ref={headingRef}
                config={config}
                onSubmit={handleSecondary}
                onSkip={() => setStatus('result')}
              />
          )}
        </div>

        {status === 'hero' && <FAQ items={config.faq} />}
      </main>

      <Footer />
    </div>
  );
}
