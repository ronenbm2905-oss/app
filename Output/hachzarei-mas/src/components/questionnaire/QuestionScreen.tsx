import { forwardRef } from 'react';
import type { Question } from '@shared/types/questionnaire';
import { QuestionCard } from './QuestionCard';
import { ProgressBar } from './ProgressBar';
import { Button } from '@/components/ui/Button';

interface Props {
  question: Question;
  stepNumber: number;
  totalSteps: number;
  selected?: string;
  onSelect: (answerId: string) => void;
  onBack: () => void;
}

/**
 * מסך שאלה בודדת. שאלה = מסך, בלי גלילה פנימית (§8.1).
 *
 * אין כפתור "המשך" — המעבר אוטומטי. אבל "חזור" קבוע במיקומו ובולט,
 * כי לקהל 60+ טעות לחיצה במעבר אוטומטי היא לחיצה שאי אפשר לתקן (§8.5).
 */
export const QuestionScreen = forwardRef<HTMLHeadingElement, Props>(function QuestionScreen(
  { question, stepNumber, totalSteps, selected, onSelect, onBack },
  ref
) {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-10">
      <ProgressBar current={stepNumber} total={totalSteps} />

      <QuestionCard ref={ref} question={question} selected={selected} onSelect={onSelect} />

      <div>
        <Button variant="ghost" onClick={onBack}>
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-current">
            <path d="m7 10 6-6 1.4 1.4L9.8 10l4.6 4.6L13 16z" />
          </svg>
          חזור לשאלה הקודמת
        </Button>
      </div>
    </section>
  );
});
