import { forwardRef } from 'react';
import type { Question } from '@shared/types/questionnaire';
import { Button } from '@/components/ui/Button';

interface Props {
  question: Question;
  selected?: string;
  onSelect: (answerId: string) => void;
  /** רמת הכותרת — h1 במסך שאלה ייעודי, h2 כשהשאלה יושבת בתוך ה-Hero */
  headingLevel?: 'h1' | 'h2';
}

/**
 * שאלה בודדת. אותו רכיב משרת את ה-Hero ואת מסכי השאלון.
 *
 * הכותרת מקבלת `tabIndex={-1}` כדי שהמנוע יוכל להעביר אליה פוקוס אחרי
 * כל מעבר — בלי זה קורא מסך נשאר על הכפתור שנעלם (§8.5).
 */
export const QuestionCard = forwardRef<HTMLHeadingElement, Props>(function QuestionCard(
  { question, selected, onSelect, headingLevel = 'h1' },
  ref
) {
  const Heading = headingLevel;

  return (
    <div>
      <Heading ref={ref} tabIndex={-1} className="text-xl font-bold leading-snug sm:text-2xl">
        {question.title}
      </Heading>

      {question.subtitle && <p className="mt-2 text-muted">{question.subtitle}</p>}

      {/*
        WCAG 3.2.2 (On Input): מעבר אוטומטי הוא שינוי הקשר, והקריטריון
        מתקיים באחת משתיים — או שאין שינוי, או **שהמשתמש הוזהר לפניו**.
        ההשהיה, הפוקוס וכפתור החזרה מפחיתים נזק אבל לא מקיימים את הקריטריון;
        השורה הזו כן. היא מוקראת כחלק מתיאור קבוצת האפשרויות, ולכן קורא
        מסך שומע אותה **לפני** כל בחירה — גם למי שנחת ישר על מסך שאלה.
        הגרסה הנראית לעין יושבת ב-Hero, פעם אחת.
      */}
      <p id={`${question.id}-advance`} className="sr-only">
        בחירת תשובה מעבירה אוטומטית לשאלה הבאה. אפשר לחזור לשאלה הקודמת בכל שלב.
      </p>

      <div
        role="group"
        aria-label={question.title}
        aria-describedby={`${question.id}-advance`}
        className="mt-5 grid gap-3"
      >
        {question.options.map((option) => (
          <Button
            key={option.id}
            variant="choice"
            selected={selected === option.id}
            aria-pressed={selected === option.id}
            onClick={() => onSelect(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
});
