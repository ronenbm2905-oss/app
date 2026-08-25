/**
 * כרטיס תרגיל בספרייה: שם, קטגוריה, יחידה, הנחיות ביצוע, ויעד מוצע.
 *
 * שלושה מצבים בכרטיס אחד, וההבדל ביניהם גלוי (`ExerciseOrigin`):
 *
 * - **קטלוג** (`catalog`) — תרגיל מהקטלוג שהמאמן לא נגע בו. יש כפתור עריכה,
 *   אבל השמירה לא תיגע במסמך הגלובלי אלא תיצור **עותק פרטי**. אין השבתה:
 *   המסמך אינו שלו, ו-`firestore.rules` יחסמו כל כתיבה עליו.
 * - **נערך** (`edited`) — העותק הפרטי, מוצג **במקום** תרגיל הקטלוג. תג "נערך",
 *   עריכה רגילה, וכפתור "חזרה למקור" שמבטל את העותק ומחזיר את המקור.
 * - **שלי** (`mine`) — תרגיל שהמאמן יצר בעצמו. עריכה והשבתה/הפעלה.
 *
 * אין מחיקה — כלל 5. גם "חזרה למקור" היא `active: false` על העותק, לא מחיקה,
 * ולכן היא הפיכה: עריכה חוזרת מחזירה את אותו מסמך לחיים.
 */

import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { suggestedTarget } from '../../lib/exercises';
import type { LibraryEntry } from '../../lib/exercises';
import { t } from '../../i18n/he';
import type { TranslationKey } from '../../i18n/he';

interface ExerciseCardProps {
  entry: LibraryEntry;
  onEdit: (entry: LibraryEntry) => void;
  /** רק ל-`edited` — ביטול העותק והחזרת תרגיל הקטלוג. */
  onRevert: (entry: LibraryEntry) => Promise<boolean>;
  /** רק ל-`mine` — השבתה או הפעלה מחדש. */
  onSetActive: (entry: LibraryEntry, active: boolean) => Promise<boolean>;
  busy: boolean;
}

export function ExerciseCard({
  entry,
  onEdit,
  onRevert,
  onSetActive,
  busy,
}: ExerciseCardProps) {
  const { exercise, origin } = entry;
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
            {origin === 'mine' ? (
              <Badge tone="accent">{t('coach.exercises.mineBadge')}</Badge>
            ) : (
              <Badge tone="muted">{t('coach.exercises.globalBadge')}</Badge>
            )}
            {origin === 'edited' ? (
              <Badge tone="accent">{t('coach.exercises.editedBadge')}</Badge>
            ) : null}
            {exercise.active ? null : (
              <Badge tone="warning">{t('coach.exercises.inactiveBadge')}</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" fullWidth={false} onClick={() => onEdit(entry)}>
            {t('coach.exercises.actions.edit')}
          </Button>

          {origin === 'edited' ? (
            <Button
              variant="secondary"
              fullWidth={false}
              busy={busy}
              onClick={() => void onRevert(entry)}
            >
              {t('coach.exercises.actions.revert')}
            </Button>
          ) : null}

          {origin === 'mine' ? (
            <Button
              variant="secondary"
              fullWidth={false}
              busy={busy}
              onClick={() => void onSetActive(entry, !exercise.active)}
            >
              {exercise.active
                ? t('coach.exercises.actions.deactivate')
                : t('coach.exercises.actions.activate')}
            </Button>
          ) : null}
        </div>
      </div>

      <p className="mt-3 whitespace-pre-line text-sm text-slate-600">
        {exercise.description || t('coach.exercises.noDescription')}
      </p>

      {target === null ? null : (
        <p className="mt-2 text-sm text-slate-500">
          {t('coach.exercises.targetSuggestion', { target, unit: unitLabel })}
        </p>
      )}

      {origin === 'edited' ? (
        <p className="mt-2 text-xs text-slate-500">{t('coach.exercises.editedNote')}</p>
      ) : null}
    </li>
  );
}
