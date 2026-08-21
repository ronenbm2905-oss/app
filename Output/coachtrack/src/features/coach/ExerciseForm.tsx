/**
 * טופס תרגיל — יצירה של תרגיל מועדון ועריכה של תרגיל קיים.
 *
 * אותו טופס לשני המצבים כי השדות זהים; מה שמשתנה הוא הכותרת, תווית הכפתור,
 * ומה נעשה עם הערכים. שני טפסים נפרדים היו נסדקים זה מזה בשדה הראשון שיתווסף.
 *
 * הקטגוריה היא שדה טקסט עם `datalist` ולא בורר סגור: הקטגוריות מגיעות מהמסד
 * (הקטלוג מגדיר שבע), אבל מאמן שרוצה קטגוריה משלו לא צריך לחכות לגרסה הבאה.
 *
 * הקומפוננטה לא נוגעת ב-Firestore — היא מקבלת `onSubmit` ומחזירה ערכים.
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/Select';
import { TextAreaField } from '../../components/ui/TextArea';
import { TextField } from '../../components/ui/TextField';
import {
  EMPTY_EXERCISE_FORM,
  UNITS,
  isExerciseFormValid,
  validateExerciseForm,
} from '../../lib/exercises';
import type { ExerciseFormErrors, ExerciseFormValues } from '../../lib/exercises';
import { t } from '../../i18n/he';
import type { TranslationKey } from '../../i18n/he';
import type { Unit } from '../../types/types';

interface ExerciseFormProps {
  mode: 'create' | 'edit';
  /** ערכי פתיחה — בעריכה, התרגיל הקיים. */
  initialValues?: ExerciseFormValues;
  /** קטגוריות קיימות, להשלמה אוטומטית. */
  categories: string[];
  /** שמות תרגילים תפוסים (בעריכה — בלי השם הנוכחי). */
  takenNames: string[];
  /** מזהה ייחודי לשדות, כדי ששני טפסים באותו מסך לא יתנגשו ב-id. */
  idPrefix: string;
  onSubmit: (values: ExerciseFormValues) => Promise<boolean>;
  onClose: () => void;
}

export function ExerciseForm({
  mode,
  initialValues = EMPTY_EXERCISE_FORM,
  categories,
  takenNames,
  idPrefix,
  onSubmit,
  onClose,
}: ExerciseFormProps) {
  const [values, setValues] = useState<ExerciseFormValues>(initialValues);
  const [errors, setErrors] = useState<ExerciseFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const listId = `${idPrefix}-categories`;

  function update<K extends keyof ExerciseFormValues>(field: K, value: ExerciseFormValues[K]) {
    setValues((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validateExerciseForm(values, takenNames);
    setErrors(nextErrors);
    if (!isExerciseFormValid(nextErrors)) return;

    setSubmitting(true);
    const saved = await onSubmit(values);
    setSubmitting(false);

    if (saved && mode === 'create') {
      setValues(EMPTY_EXERCISE_FORM);
      setErrors({});
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">
          {mode === 'create'
            ? t('coach.exercises.form.createTitle')
            : t('coach.exercises.form.editTitle')}
        </h2>
        <Button variant="ghost" fullWidth={false} onClick={onClose}>
          {t('common.cancel')}
        </Button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          id={`${idPrefix}-name`}
          label={t('coach.exercises.form.name')}
          value={values.name}
          onChange={(event) => update('name', event.target.value)}
          error={errors.name ? t(errors.name) : null}
          required
        />

        <div>
          <TextField
            id={`${idPrefix}-category`}
            label={t('coach.exercises.form.category')}
            hint={t('coach.exercises.form.categoryHint')}
            value={values.category}
            onChange={(event) => update('category', event.target.value)}
            error={errors.category ? t(errors.category) : null}
            list={listId}
            required
          />
          <datalist id={listId}>
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </div>

        <SelectField
          id={`${idPrefix}-unit`}
          label={t('coach.exercises.form.unit')}
          value={values.unit}
          onChange={(event) => update('unit', event.target.value as Unit)}
        >
          {UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {t(`units.${unit}` as TranslationKey)}
            </option>
          ))}
        </SelectField>

        <TextAreaField
          id={`${idPrefix}-description`}
          label={t('coach.exercises.form.description')}
          hint={t('coach.exercises.form.descriptionHint')}
          value={values.description}
          onChange={(event) => update('description', event.target.value)}
          error={errors.description ? t(errors.description) : null}
        />

        <TextField
          id={`${idPrefix}-target`}
          label={t('coach.exercises.form.target')}
          hint={t('coach.exercises.form.targetHint')}
          value={values.target}
          onChange={(event) => update('target', event.target.value)}
          error={errors.target ? t(errors.target) : null}
          inputMode="numeric"
          latin
        />

        <Button type="submit" busy={submitting}>
          {submitting
            ? t('coach.exercises.form.submitting')
            : mode === 'create'
              ? t('coach.exercises.form.submitCreate')
              : t('coach.exercises.form.submitEdit')}
        </Button>
      </form>
    </section>
  );
}
