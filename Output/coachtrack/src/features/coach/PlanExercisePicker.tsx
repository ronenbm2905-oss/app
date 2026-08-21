/**
 * בחירת תרגיל מהספרייה לתוך התוכנית.
 *
 * אותה ספרייה של מסך "ספריית תרגילים" (קטלוג גלובלי + תרגילי המועדון, ממוזגים
 * ב-`useExerciseLibrary`), עם אותו חיפוש וסינון בצד הלקוח. מה שנוסף כאן:
 *
 * - **תרגילים מושבתים לא מוצעים.** אין `where('active','==',true)` בשאילתה
 *   (שוויון שני = אינדקס מורכב), ולכן הסינון נעשה כאן.
 * - **תרגיל שכבר בתוכנית מסומן ולא ניתן להוספה** — פריט כפול היה נראה לשחקן
 *   כשני תרגילים זהים, ו-`validatePlanDraft` ממילא חוסם אותו.
 */

import { useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/Select';
import { TextField } from '../../components/ui/TextField';
import { exerciseCategories, filterExercises, suggestedTarget } from '../../lib/exercises';
import { t } from '../../i18n/he';
import type { TranslationKey } from '../../i18n/he';
import type { ExerciseDoc } from '../../types/types';

interface PlanExercisePickerProps {
  exercises: ExerciseDoc[];
  /** מזהי התרגילים שכבר בתוכנית. */
  chosenIds: string[];
  onAdd: (exercise: ExerciseDoc) => void;
  onClose: () => void;
}

export function PlanExercisePicker({
  exercises,
  chosenIds,
  onAdd,
  onClose,
}: PlanExercisePickerProps) {
  const [term, setTerm] = useState('');
  const [category, setCategory] = useState('');

  const available = useMemo(() => exercises.filter((exercise) => exercise.active), [exercises]);
  const categories = useMemo(() => exerciseCategories(available), [available]);
  const shown = useMemo(
    () => filterExercises(available, { term, category: category || null }),
    [available, term, category],
  );

  const chosen = new Set(chosenIds);

  return (
    <section className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">
          {t('coach.plan.editor.addTitle')}
        </h2>
        <Button variant="ghost" fullWidth={false} onClick={onClose}>
          {t('coach.plan.editor.addClose')}
        </Button>
      </div>

      <div className="mt-3 space-y-3">
        <TextField
          id="plan-picker-search"
          label={t('coach.exercises.searchLabel')}
          placeholder={t('coach.exercises.searchPlaceholder')}
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
        />

        <SelectField
          id="plan-picker-category"
          label={t('coach.exercises.categoryLabel')}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">{t('coach.exercises.allCategories')}</option>
          {categories.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </SelectField>

        <p className="text-sm text-slate-500">
          {t('coach.exercises.count', { shown: shown.length, total: available.length })}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{t('coach.exercises.noResults')}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {shown.map((exercise) => {
            const target = suggestedTarget(exercise);
            const unitLabel = t(`units.${exercise.unit}` as TranslationKey);
            const already = chosen.has(exercise.id);

            return (
              <li
                key={exercise.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{exercise.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge tone="neutral">{exercise.category}</Badge>
                    <Badge tone="muted">{unitLabel}</Badge>
                    {target === null ? null : (
                      <Badge tone="muted">
                        {t('coach.exercises.targetSuggestion', { target, unit: unitLabel })}
                      </Badge>
                    )}
                  </div>
                </div>

                {already ? (
                  <Badge tone="accent">{t('coach.plan.editor.alreadyAdded')}</Badge>
                ) : (
                  <Button variant="secondary" fullWidth={false} onClick={() => onAdd(exercise)}>
                    {t('coach.plan.editor.add')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
