import { useRef } from 'react';
import type { Question, QuestionnaireConfig } from '@shared/types/questionnaire';
import { QuestionCard } from './QuestionCard';
import { TrustBar } from '@/components/ui/TrustBar';

interface Props {
  config: QuestionnaireConfig;
  heroQuestions: Question[];
  answers: Record<string, string>;
  onSelect: (questionId: string, answerId: string) => void;
}

/**
 * מסך 0.
 *
 * כותרת, תת-כותרת, ומיד מתחתן שאלות ה-`showInHero` — **בלי שום שדה אישי**.
 * הרעיון: הגולש מתחיל לענות לפני שביקשנו ממנו משהו (§4.1).
 */
export function HeroSection({ config, heroQuestions, answers, onSelect }: Props) {
  const cardRefs = useRef<Array<HTMLHeadingElement | null>>([]);

  function handleSelect(index: number, questionId: string, answerId: string) {
    onSelect(questionId, answerId);
    // מעבר רך לשאלה הבאה בתוך ה-Hero. השאלה האחרונה מעבירה לשאלון עצמו
    // — וזה כבר באחריות המנוע.
    const next = cardRefs.current[index + 1];
    if (next) {
      window.setTimeout(() => {
        next.scrollIntoView({ behavior: 'smooth', block: 'center' });
        next.focus({ preventScroll: true });
      }, 250);
    }
  }

  return (
    <header className="mx-auto w-full max-w-2xl px-5 pb-10 pt-10 sm:pt-16">
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{config.heroHeadline}</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">{config.heroSubline}</p>

      <div className="mt-8">
        <TrustBar />
      </div>

      {/* WCAG 3.2.2 — האזהרה הנראית. הגרסה לקורא מסך יושבת ב-QuestionCard */}
      <p className="mt-10 text-sm text-muted">
        השאלון קצר, ובחירת תשובה מעבירה אוטומטית לשאלה הבאה. אפשר לחזור לשאלה
        קודמת בכל שלב, ולא נבקש ממך פרטים אישיים עד סוף השאלון.
      </p>

      <div className="mt-6 space-y-10">
        {heroQuestions.map((question, index) => (
          <div
            key={question.id}
            className="rounded-2xl border border-line bg-surface p-5 sm:p-6"
          >
            <QuestionCard
              ref={(el) => {
                cardRefs.current[index] = el;
              }}
              question={question}
              headingLevel="h2"
              selected={answers[question.id]}
              onSelect={(answerId) => handleSelect(index, question.id, answerId)}
            />
          </div>
        ))}
      </div>
    </header>
  );
}
