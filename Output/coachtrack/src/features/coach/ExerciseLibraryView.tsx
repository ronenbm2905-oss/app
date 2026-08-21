/**
 * ספריית התרגילים — התצוגה בלבד.
 *
 * החיפוש והסינון לפי קטגוריה נעשים **בצד הלקוח** על הרשימה הממוזגת. זה לא קיצור
 * דרך: הספרייה מורכבת משתי שאילתות נפרדות (גלובלי + של הארגון, ראה
 * hooks/useExerciseLibrary.ts), ושאילתת חיפוש שלישית הייתה גם דורשת אינדקסים
 * וגם לא יודעת לחפש טקסט חופשי בעברית. 30 תרגילים בזיכרון הם כלום.
 */

import { useMemo, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/Select';
import { TextField } from '../../components/ui/TextField';
import {
  canCoachEditExercise,
  exerciseCategories,
  exerciseToFormValues,
  filterExercises,
} from '../../lib/exercises';
import type { ExerciseFormValues } from '../../lib/exercises';
import type { Feedback } from '../../lib/feedback';
import type { LoadStatus } from '../../hooks/loadStatus';
import { t } from '../../i18n/he';
import type { ExerciseDoc } from '../../types/types';
import { ExerciseCard } from './ExerciseCard';
import { ExerciseForm } from './ExerciseForm';

export interface ExerciseLibraryViewProps {
  status: LoadStatus;
  exercises: ExerciseDoc[];
  orgId: string;
  onCreate: (values: ExerciseFormValues) => Promise<boolean>;
  onUpdate: (exerciseId: string, values: ExerciseFormValues) => Promise<boolean>;
  onSetActive: (exercise: ExerciseDoc, active: boolean) => Promise<boolean>;
  busyId: string | null;
  feedback: Feedback | null;
}

export function ExerciseLibraryView({
  status,
  exercises,
  orgId,
  onCreate,
  onUpdate,
  onSetActive,
  busyId,
  feedback,
}: ExerciseLibraryViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const categories = useMemo(() => exerciseCategories(exercises), [exercises]);
  const shown = useMemo(
    () => filterExercises(exercises, { term: searchTerm, category: category || null }),
    [exercises, searchTerm, category],
  );
  const names = useMemo(() => exercises.map((exercise) => exercise.name), [exercises]);

  if (status === 'loading') {
    return <p className="text-sm text-slate-500">{t('coach.exercises.loading')}</p>;
  }

  if (status === 'error') {
    return <Alert tone="error">{t('coach.exercises.loadError')}</Alert>;
  }

  return (
    <div className="space-y-4">
      {feedback ? <Alert tone={feedback.tone}>{feedback.text}</Alert> : null}

      {showCreateForm ? (
        <ExerciseForm
          mode="create"
          idPrefix="exercise-new"
          categories={categories}
          takenNames={names}
          onSubmit={onCreate}
          onClose={() => setShowCreateForm(false)}
        />
      ) : (
        <Button onClick={() => setShowCreateForm(true)}>
          {t('coach.exercises.actions.create')}
        </Button>
      )}

      <div className="space-y-3">
        <TextField
          id="exercise-search"
          label={t('coach.exercises.searchLabel')}
          placeholder={t('coach.exercises.searchPlaceholder')}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          type="search"
        />

        <SelectField
          id="exercise-category"
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
          {t('coach.exercises.count', { shown: shown.length, total: exercises.length })}
        </p>
      </div>

      <p className="text-xs text-slate-500">{t('coach.exercises.globalReadOnly')}</p>

      {exercises.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          {t('coach.exercises.empty')}
        </p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-slate-500">{t('coach.exercises.noResults')}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((exercise) =>
            editingId === exercise.id ? (
              <li key={exercise.id}>
                <ExerciseForm
                  mode="edit"
                  idPrefix={`exercise-edit-${exercise.id}`}
                  initialValues={exerciseToFormValues(exercise)}
                  categories={categories}
                  takenNames={names.filter((name) => name !== exercise.name)}
                  onSubmit={async (values) => {
                    const saved = await onUpdate(exercise.id, values);
                    if (saved) setEditingId(null);
                    return saved;
                  }}
                  onClose={() => setEditingId(null)}
                />
              </li>
            ) : (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                canEdit={canCoachEditExercise(exercise, orgId)}
                onEdit={() => setEditingId(exercise.id)}
                onSetActive={onSetActive}
                busy={busyId === exercise.id}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}
