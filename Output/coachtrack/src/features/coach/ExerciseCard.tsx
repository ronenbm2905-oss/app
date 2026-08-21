/**
 * כרטיס תרגיל בספרייה: שם, קטגוריה, יחידה, הנחיות ביצוע, ויעד מוצע.
 *
 * שני סוגי תרגילים בכרטיס אחד, וההבדל ביניהם גלוי:
 * - **קטלוג** (scope: 'global') — לקריאה בלבד. אין כפתור עריכה, ומוצג הסבר קצר
 *   למה. זו לא בחירת UI: firestore.rules מתירים למאמן לעדכן תרגילים של הארגון
 *   בלבד, ולכן כפתור עריכה כאן היה מוביל ישר ל"אין הרשאה".
 * - **של המועדון** (scope: 'org') — ניתן לעריכה ולהשבתה.
 *
 * אין מחיקה — כלל 5. תרגיל מיותר מסומן active: false ונשאר בהיסטוריה של
 * תוכניות שכבר השתמשו בו.
 */

import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { suggestedTarget } from '../../lib/exercises';
import { t } from '../../i18n/he';
import type { TranslationKey } from '../../i18n/he';
import type { ExerciseDoc } from '../../types/types';

interface ExerciseCardProps {
  exercise: ExerciseDoc;
  /** האם התרגיל שייך לארגון של המאמן — מראה של firestore.rules. */
  canEdit: boolean;
  onEdit: (exercise: ExerciseDoc) => void;
  onSetActive: (exercise: ExerciseDoc, active: boolean) => Promise<boolean>;
  busy: boolean;
}

export function ExerciseCard({
  exercise,
  canEdit,
  onEdit,
  onSetActive,
  busy,
}: ExerciseCardProps) {
  const target = suggestedTarget(exercise);
  const unitLabel = t(`units.${exercise.unit}` as TranslationKey);

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`text-base font-semibold ${
              exercise.active ? 'text-slate-900' : 'text-slate-400'
            }`}
          >
            {exercise.name}
          </p>

          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone="neutral">{exercise.category}</Badge>
            <Badge tone="muted">{unitLabel}</Badge>
            <Badge tone={exercise.scope === 'org' ? 'accent' : 'muted'}>
              {exercise.scope === 'org'
                ? t('coach.exercises.orgBadge')
                : t('coach.exercises.globalBadge')}
            </Badge>
            {exercise.active ? null : (
              <Badge tone="warning">{t('coach.exercises.inactiveBadge')}</Badge>
            )}
          </div>
        </div>

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" fullWidth={false} onClick={() => onEdit(exercise)}>
              {t('coach.exercises.actions.edit')}
            </Button>
            <Button
              variant="secondary"
              fullWidth={false}
              busy={busy}
              onClick={() => void onSetActive(exercise, !exercise.active)}
            >
              {exercise.active
                ? t('coach.exercises.actions.deactivate')
                : t('coach.exercises.actions.activate')}
            </Button>
          </div>
        ) : null}
      </div>

      <p className="mt-3 whitespace-pre-line text-sm text-slate-600">
        {exercise.description || t('coach.exercises.noDescription')}
      </p>

      {target === null ? null : (
        <p className="mt-2 text-sm text-slate-500">
          {t('coach.exercises.targetSuggestion', { target, unit: unitLabel })}
        </p>
      )}
    </li>
  );
}
