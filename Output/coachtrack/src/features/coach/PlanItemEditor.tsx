/**
 * שורת תרגיל בטופס בניית התוכנית: יעד, הנחיות, סדר והסרה.
 *
 * **היעד מגיע לכאן כבר מלא** — `draftFromExercise` טוען אותו מ-
 * `defaultTargets.cadets_13_15` של התרגיל (CLAUDE.md → בניית תוכנית). ההצעה
 * המקורית ממשיכה להיות מוצגת מתחת לשדה גם אחרי שהמאמן דרס אותה, כדי שיהיה
 * לו למה לחזור.
 *
 * הקומפוננטה לא מחשבת ולא שומרת — היא מדווחת שינוי כלפי מעלה.
 */

import { Button } from '../../components/ui/Button';
import { TextAreaField } from '../../components/ui/TextArea';
import { TextField } from '../../components/ui/TextField';
import { PLAN_NOTES_MAX_LENGTH, MAX_TARGET } from '../../lib/plans';
import type { PlanDraftItem } from '../../lib/plans';
import { t } from '../../i18n/he';
import type { TranslationKey } from '../../i18n/he';

interface PlanItemEditorProps {
  item: PlanDraftItem;
  index: number;
  total: number;
  /** ההצעה מהקטלוג, אם יש. מוצגת כתזכורת — לא כערך. */
  suggestion: number | null;
  error?: TranslationKey;
  onChange: (item: PlanDraftItem) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}

export function PlanItemEditor({
  item,
  index,
  total,
  suggestion,
  error,
  onChange,
  onRemove,
  onMove,
}: PlanItemEditorProps) {
  const unitLabel = t(`units.${item.unit}` as TranslationKey);
  const fieldId = `plan-item-${item.exerciseId}`;

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold text-slate-900">{item.exerciseName}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {t('coach.plan.editor.position', { index: index + 1, total })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            fullWidth={false}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            {t('coach.plan.editor.moveUp')}
          </Button>
          <Button
            variant="secondary"
            fullWidth={false}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            {t('coach.plan.editor.moveDown')}
          </Button>
          <Button variant="ghost" fullWidth={false} onClick={onRemove}>
            {t('coach.plan.editor.remove')}
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <TextField
          id={`${fieldId}-target`}
          label={t('coach.plan.editor.target', { unit: unitLabel })}
          // inputMode מספרי: מקלדת הטלפון נפתחת על ספרות (כלל 2 — מובייל-פירסט).
          inputMode="numeric"
          type="number"
          min={1}
          max={MAX_TARGET}
          value={item.target}
          onChange={(event) => onChange({ ...item, target: event.target.value })}
          error={error ? t(error, { max: MAX_TARGET }) : null}
          hint={
            suggestion === null
              ? t('coach.plan.editor.noSuggestion')
              : t('coach.plan.editor.targetSuggestion', { target: suggestion })
          }
        />

        <TextAreaField
          id={`${fieldId}-notes`}
          label={t('coach.plan.editor.notes')}
          hint={t('coach.plan.editor.notesHint')}
          rows={3}
          maxLength={PLAN_NOTES_MAX_LENGTH}
          value={item.notes}
          onChange={(event) => onChange({ ...item, notes: event.target.value })}
        />
      </div>
    </li>
  );
}
