/**
 * ספריית התרגילים — התצוגה בלבד.
 *
 * הרשימה מגיעה כ-`LibraryEntry[]`: הקטלוג אחרי שהעותקים הפרטיים של המאמן
 * הוחלפו בו (ראה `lib/exercises.ts` → `buildExerciseLibrary`). המסך לא מחשב
 * מי מסתיר את מי — הוא רק מציג `origin` ומרכיב לפיו את הכפתורים.
 *
 * החיפוש והסינון לפי קטגוריה נעשים **בצד הלקוח** על הרשימה הממוזגת. זה לא
 * קיצור דרך: הספרייה מורכבת משתי שאילתות נפרדות (קטלוג + התרגילים של המאמן,
 * ראה `hooks/useExerciseLibrary.ts`), ושאילתת חיפוש שלישית הייתה גם דורשת
 * אינדקסים וגם לא יודעת לחפש טקסט חופשי בעברית. 30 תרגילים בזיכרון הם כלום.
 */

import { useMemo, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/Select';
import { TextField } from '../../components/ui/TextField';
import {
  exerciseCategories,
  exerciseToFormValues,
  libraryExercises,
  matchesExerciseFilter,
} from '../../lib/exercises';
import type { ExerciseFormValues, LibraryEntry } from '../../lib/exercises';
import type { Feedback } from '../../lib/feedback';
import type { LoadStatus } from '../../hooks/loadStatus';
import { t } from '../../i18n/he';
import { ExerciseCard } from './ExerciseCard';
import { ExerciseForm } from './ExerciseForm';

export interface ExerciseLibraryViewProps {
  status: LoadStatus;
  entries: LibraryEntry[];
  onCreate: (values: ExerciseFormValues) => Promise<boolean>;
  /**
   * שמירת עריכה. מקבלת את הכרטיס כדי שהשכבה שמעל תדע אם זה עדכון של מסמך קיים
   * (`mine` / `edited`) או יצירת עותק פרטי חדש (`catalog`).
   */
  onSave: (entry: LibraryEntry, values: ExerciseFormValues) => Promise<boolean>;
  onRevert: (entry: LibraryEntry) => Promise<boolean>;
  onSetActive: (entry: LibraryEntry, active: boolean) => Promise<boolean>;
  busyId: string | null;
  feedback: Feedback | null;
}

export function ExerciseLibraryView({
  status,
  entries,
  onCreate,
  onSave,
  onRevert,
  onSetActive,
  busyId,
  feedback,
}: ExerciseLibraryViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const exercises = useMemo(() => libraryExercises(entries), [entries]);
  const categories = useMemo(() => exerciseCategories(exercises), [exercises]);
  const shown = useMemo(
    () =>
      entries.filter((entry) =>
        matchesExerciseFilter(entry.exercise, {
          term: searchTerm,
          category: category || null,
        }),
      ),
    [entries, searchTerm, category],
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
          {t('coach.exercises.count', { shown: shown.length, total: entries.length })}
        </p>
      </div>

      <p className="text-xs text-slate-500">{t('coach.exercises.privateEdits')}</p>

      {entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          {t('coach.exercises.empty')}
        </p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-slate-500">{t('coach.exercises.noResults')}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((entry) =>
            editingId === entry.exercise.id ? (
              <li key={entry.exercise.id}>
                <ExerciseForm
                  mode={entry.origin === 'catalog' ? 'override' : 'edit'}
                  idPrefix={`exercise-edit-${entry.exercise.id}`}
                  initialValues={exerciseToFormValues(entry.exercise)}
                  categories={categories}
                  takenNames={names.filter((name) => name !== entry.exercise.name)}
                  onSubmit={async (values) => {
                    const saved = await onSave(entry, values);
                    if (saved) setEditingId(null);
                    return saved;
                  }}
                  onClose={() => setEditingId(null)}
                />
              </li>
            ) : (
              <ExerciseCard
                key={entry.exercise.id}
                entry={entry}
                onEdit={() => setEditingId(entry.exercise.id)}
                onRevert={onRevert}
                onSetActive={onSetActive}
                busy={busyId === entry.exercise.id}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}
