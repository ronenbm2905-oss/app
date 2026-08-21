/**
 * חלון עריכת דיווח בידי המאמן (TASKS שלב 5ג) — התצוגה בלבד.
 *
 * ## למה זה לא `ReportDialog` של השחקן
 *
 * ההבדל היחיד שחשוב הוא **בורר התאריך**, והוא מספיק כדי להצדיק חלון נפרד:
 * `firestore.rules` מתירים למאמן לערוך דיווח בן חודשיים רק כל עוד `date` לא
 * משתנה. בורר שמציע 8 ימים אחורה בלבד היה מכריח את המאמן להזיז את תאריך
 * הביצוע כדי לתקן כמות — כלומר, תיקון של מספר היה מעביר דיווח לשבוע אחר
 * ומשנה למפרע שני אחוזים שבועיים. לכן `coachDateOptions` מוסיפה את התאריך
 * המקורי לרשימה, ו-`validateCoachEntryDraft` מכירה בו כחוקי.
 *
 * ## מה **לא** נמצא כאן, בכוונה
 *
 * • **אין כפתורי קיצור (+25 / +50).** הם נועדו לשחקן שסופר סדרות; המאמן מתקן
 *   מספר שכבר קיים, ותוספת עליו היא בדיוק הטעות שלא רוצים.
 * • **אין דיאלוג "האם התכוונת ל-X?"** — הוא נועד לתפוס טעות הקלדה של ילד
 *   שמדווח, ולא לחקור מאמן שמתקן ביודעין. הוולידציות עצמן (מספר חיובי, תקרה,
 *   אורך הערה) נשארות, והן מראה של הכלל.
 * • **אין עריכת "בעלות".** שחקן, קבוצה וארגון נעולים בכלל ולא מוצגים בכלל.
 */

import { useEffect, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/Select';
import { TextAreaField } from '../../components/ui/TextArea';
import { TextField } from '../../components/ui/TextField';
import { formatIsraeliDate } from '../../lib/dates';
import type { DayKey } from '../../lib/dates';
import {
  MAX_BACKDATE_DAYS,
  MAX_ENTRY_AMOUNT,
  NOTE_MAX_LENGTH,
  coachDateOptions,
  entryInstantForDay,
  isEntryDraftValid,
  validateCoachEntryDraft,
  type EntryDraft,
  type EntryDraftErrors,
} from '../../lib/entries';
import { t } from '../../i18n/he';
import type { Unit } from '../../types/types';

const NO_ERRORS: EntryDraftErrors = {};

export interface CoachEntryDialogProps {
  playerName: string;
  exerciseName: string;
  unit: Unit;
  /** התאריך שהדיווח נשמר איתו — תמיד אפשרות חוקית. */
  originalDayKey: DayKey;
  initialDraft: EntryDraft;
  now: Date;
  busy: boolean;
  /** שגיאה מהשרת, כבר מתורגמת. */
  error: string | null;
  /** מחזיר true כשהשמירה הצליחה — אז החלון נסגר. */
  onSubmit: (draft: EntryDraft) => Promise<boolean>;
  onClose: () => void;
}

/** תווית התאריך. אותן מחרוזות של מסך השחקן — אותו מושג, אותו טקסט. */
function dateLabel(daysAgo: number, dayKey: DayKey, originalDayKey: DayKey): string {
  if (dayKey === originalDayKey && daysAgo > MAX_BACKDATE_DAYS) {
    return t('coach.player.edit.dateOriginal', {
      date: formatIsraeliDate(entryInstantForDay(dayKey)),
    });
  }
  if (daysAgo === 0) return t('player.report.today');
  if (daysAgo === 1) return t('player.report.yesterday');
  if (daysAgo === 2) return t('player.report.twoDaysAgo');
  return t('player.report.daysAgo', { count: daysAgo });
}

export function CoachEntryDialog({
  playerName,
  exerciseName,
  unit,
  originalDayKey,
  initialDraft,
  now,
  busy,
  error,
  onSubmit,
  onClose,
}: CoachEntryDialogProps) {
  const [draft, setDraft] = useState<EntryDraft>(initialDraft);
  const [errors, setErrors] = useState<EntryDraftErrors>(NO_ERRORS);

  const unitLabel = t(`units.${unit}`);
  const options = coachDateOptions(now, originalDayKey);
  const titleId = 'coach-entry-dialog-title';

  // חלון שאי אפשר לסגור בלי עכבר הוא מלכודת נגישות — אותה החלטה כמו בחלון השחקן.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const patch = (changes: Partial<EntryDraft>) => {
    setDraft((previous) => ({ ...previous, ...changes }));
  };

  const submit = async () => {
    const found = validateCoachEntryDraft(draft, now, originalDayKey);
    setErrors(found);
    if (!isEntryDraftValid(found)) return;

    const saved = await onSubmit(draft);
    if (saved) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-slate-900">
              {t('coach.player.edit.title', { name: playerName })}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {t('coach.player.edit.exerciseLine', { exercise: exerciseName })}
            </p>
          </div>

          <Button
            variant="ghost"
            fullWidth={false}
            onClick={onClose}
            aria-label={t('coach.player.edit.close')}
          >
            {t('common.close')}
          </Button>
        </div>

        <div className="mt-4 space-y-4">
          <TextField
            id="coach-entry-amount"
            label={t('coach.player.edit.amount', { unit: unitLabel })}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            latin
            value={draft.amount}
            onChange={(event) => patch({ amount: event.target.value })}
            error={errors.amount ? t(errors.amount, { max: MAX_ENTRY_AMOUNT }) : null}
          />

          <SelectField
            id="coach-entry-date"
            label={t('coach.player.edit.date')}
            value={draft.dayKey}
            onChange={(event) => patch({ dayKey: event.target.value })}
            error={errors.date ? t(errors.date, { days: MAX_BACKDATE_DAYS }) : null}
            hint={t('coach.player.edit.dateHint', { days: MAX_BACKDATE_DAYS })}
          >
            {options.map((option) => (
              <option key={option.dayKey} value={option.dayKey}>
                {dateLabel(option.daysAgo, option.dayKey, originalDayKey)}
              </option>
            ))}
          </SelectField>

          <p className="text-xs text-slate-500">
            {t('coach.player.edit.dateChosen', {
              date: formatIsraeliDate(entryInstantForDay(draft.dayKey)),
            })}
          </p>

          <TextAreaField
            id="coach-entry-note"
            rows={3}
            label={t('coach.player.edit.note')}
            maxLength={NOTE_MAX_LENGTH}
            value={draft.note}
            onChange={(event) => patch({ note: event.target.value })}
            error={errors.note ? t(errors.note, { max: NOTE_MAX_LENGTH }) : null}
            hint={t('coach.player.edit.noteHint')}
          />

          {error ? <Alert tone="error">{error}</Alert> : null}

          <Button onClick={() => void submit()} busy={busy}>
            {busy ? t('coach.player.edit.submitting') : t('coach.player.edit.submit')}
          </Button>
        </div>
      </div>
    </div>
  );
}
