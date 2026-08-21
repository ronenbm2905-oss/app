/**
 * חלון הדיווח (PRD §7.2ב) — התצוגה בלבד. אין כאן Firestore ואין `Date.now()`:
 * הרגע הנוכחי מגיע כ-prop, וכל כתיבה היא callback שמחזיר האם הצליחה.
 *
 * ## ארבע החלטות שנראות קטנות ואינן
 *
 * 1. **דיאלוג האישור לערך חריג הוא מסך בתוך החלון, לא `window.confirm`.**
 *    `confirm` חוסם את ה-thread, נראה שונה בכל דפדפן, ואי אפשר לרנדר אותו
 *    בטסט. כאן הוא מצב (`confirming`) שמחליף את גוף הטופס, ולכן גם נבדק.
 *
 * 2. **כפתורי הקיצור מוסיפים, לא קובעים.** `+25` על שדה שיש בו 50 נותן 75.
 *    זה מה שמתאים לשימוש האמיתי: השחקן סופר סדרות, לא מקליד סכום סופי.
 *
 * 3. **בורר התאריך הוא `select` ולא `input[type=date]`.** בורר התאריך המובנה
 *    פותח לוח שנה שלם ומזמין בחירה של תאריך מחוץ לחלון, שתיחסם בכלל אחר כך.
 *    שמונה אפשרויות קבועות (היום ועד 7 ימים אחורה) הן בדיוק מה שמותר.
 *
 * 4. **ההערה מלווה בטקסט עזר מגביל.** לא קישוט: שדה טקסט חופשי של קטין הוא
 *    דגל M1 בסקירת עדי (21.8.2026) — "כאב לי הברך" הוא מידע רפואי, ולפי
 *    תיקון 13 הוא עלול להעלות את כל המאגר לרמת אבטחה בינונית. עד להכרעה,
 *    השדה נבנה כפי שה-PRD מבקש, עם הנחיה עובדתית מה לא לכתוב בו.
 */

import { useEffect, useRef, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/Select';
import { TextAreaField } from '../../components/ui/TextArea';
import { TextField } from '../../components/ui/TextField';
import { formatIsraeliDate } from '../../lib/dates';
import {
  MAX_BACKDATE_DAYS,
  MAX_ENTRY_AMOUNT,
  NOTE_MAX_LENGTH,
  dateOptions,
  isEntryDraftValid,
  isOutlierAmount,
  parseAmount,
  quickAddValues,
  validateEntryDraft,
  type EntryDraft,
  entryInstantForDay,
  type EntryDraftErrors,
} from '../../lib/entries';
import { t } from '../../i18n/he';
import type { Unit } from '../../types/types';

const NO_ERRORS: EntryDraftErrors = {};

export interface ReportDialogProps {
  mode: 'create' | 'edit';
  exerciseName: string;
  unit: Unit;
  /** היעד השבועי, או null כשהתרגיל אינו בתוכנית של אותו שבוע. */
  target: number | null;
  /** הטיוטה ההתחלתית — ריקה ביצירה, מהדיווח בעריכה. */
  initialDraft: EntryDraft;
  now: Date;
  busy: boolean;
  /** שגיאה שהגיעה מהשרת, כבר מתורגמת. */
  error: string | null;
  /** מחזיר true כשהשמירה הצליחה — אז החלון נסגר. */
  onSubmit: (draft: EntryDraft) => Promise<boolean>;
  onClose: () => void;
}

/** תווית התאריך: "היום" / "אתמול" / "לפני N ימים". */
function dateLabel(daysAgo: number): string {
  if (daysAgo === 0) return t('player.report.today');
  if (daysAgo === 1) return t('player.report.yesterday');
  // צורת הזוגי בעברית: 'לפני יומיים', לא 'לפני 2 ימים'.
  if (daysAgo === 2) return t('player.report.twoDaysAgo');
  return t('player.report.daysAgo', { count: daysAgo });
}

export function ReportDialog({
  mode,
  exerciseName,
  unit,
  target,
  initialDraft,
  now,
  busy,
  error,
  onSubmit,
  onClose,
}: ReportDialogProps) {
  const [draft, setDraft] = useState<EntryDraft>(initialDraft);
  const [errors, setErrors] = useState<EntryDraftErrors>(NO_ERRORS);
  const [confirming, setConfirming] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const unitLabel = t(`units.${unit}`);
  const options = dateOptions(now);
  const quickValues = target ? quickAddValues(target) : [];
  const amount = parseAmount(draft.amount);
  const titleId = 'report-dialog-title';

  // פוקוס לשדה הכמות: זה השדה היחיד שחייב מילוי, והמקלדת המספרית נפתחת מיד.
  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  // Escape סוגר. מקלדת פיזית היא לא המסלול העיקרי כאן, אבל חלון שאי אפשר
  // לסגור בלי עכבר הוא מלכודת נגישות.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const patch = (changes: Partial<EntryDraft>) => {
    setDraft((previous) => ({ ...previous, ...changes }));
    setConfirming(false);
  };

  const addQuick = (value: number) => {
    const current = parseAmount(draft.amount) ?? 0;
    patch({ amount: String(current + value) });
    amountRef.current?.focus();
  };

  const submit = async () => {
    const found = validateEntryDraft(draft, now);
    setErrors(found);
    if (!isEntryDraftValid(found)) return;

    const value = parseAmount(draft.amount);
    if (value === null) return;

    // הגנת טעות ההקלדה: פעם אחת בלבד, ורק כשיש יעד להשוות אליו.
    if (!confirming && target && isOutlierAmount(value, target)) {
      setConfirming(true);
      return;
    }

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
              {t(mode === 'edit' ? 'player.report.editTitle' : 'player.report.title', {
                exercise: exerciseName,
              })}
            </h2>
            {target ? (
              <p className="mt-0.5 text-sm text-slate-500">
                {t('player.report.targetLine', { target, unit: unitLabel })}
              </p>
            ) : null}
          </div>

          <Button variant="ghost" fullWidth={false} onClick={onClose} aria-label={t('player.report.close')}>
            {t('common.close')}
          </Button>
        </div>

        {confirming ? (
          <div className="mt-4 space-y-4">
            <Alert tone="error">
              <p className="font-semibold">{t('player.report.outlier.title')}</p>
              <p className="mt-1">
                {t('player.report.outlier.body', {
                  amount: amount ?? 0,
                  unit: unitLabel,
                  target: target ?? 0,
                })}
              </p>
            </Alert>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => void submit()} busy={busy}>
                {t('player.report.outlier.confirm')}
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                {t('player.report.outlier.back')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <TextField
              id="report-amount"
              ref={amountRef}
              label={t('player.report.amount', { unit: unitLabel })}
              placeholder={t('player.report.amountPlaceholder')}
              // inputMode פותח מקלדת מספרית בטלפון; type=text מונע את חצי
              // הגלגלת ואת הגלילה שמשנה ערך בטעות ב-type=number.
              type="text"
              inputMode="numeric"
              autoComplete="off"
              latin
              value={draft.amount}
              onChange={(event) => patch({ amount: event.target.value })}
              error={errors.amount ? t(errors.amount, { max: MAX_ENTRY_AMOUNT }) : null}
            />

            {quickValues.length > 0 ? (
              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700">
                  {t('player.report.quickAdd')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {quickValues.map((value) => (
                    <Button
                      key={value}
                      variant="secondary"
                      fullWidth={false}
                      onClick={() => addQuick(value)}
                    >
                      {t('player.report.quickAddValue', { value })}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            <SelectField
              id="report-date"
              label={t('player.report.date')}
              value={draft.dayKey}
              onChange={(event) => patch({ dayKey: event.target.value })}
              error={errors.date ? t(errors.date, { days: MAX_BACKDATE_DAYS }) : null}
              hint={t('player.report.dateHint', { days: MAX_BACKDATE_DAYS })}
            >
              {options.map((option) => (
                <option key={option.dayKey} value={option.dayKey}>
                  {dateLabel(option.daysAgo)}
                </option>
              ))}
            </SelectField>

            <p className="text-xs text-slate-500">
              {t('player.report.dateChosen', {
                date: formatIsraeliDate(entryInstantForDay(draft.dayKey)),
              })}
            </p>

            <TextAreaField
              id="report-note"
              rows={3}
              label={t('player.report.noteLabel')}
              placeholder={t('player.report.notePlaceholder')}
              maxLength={NOTE_MAX_LENGTH}
              value={draft.note}
              onChange={(event) => patch({ note: event.target.value })}
              error={errors.note ? t(errors.note, { max: NOTE_MAX_LENGTH }) : null}
              hint={t('player.report.noteHint')}
            />

            {error ? <Alert tone="error">{error}</Alert> : null}

            <Button onClick={() => void submit()} busy={busy}>
              {busy
                ? t('player.report.submitting')
                : t(mode === 'edit' ? 'player.report.submitEdit' : 'player.report.submit')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
