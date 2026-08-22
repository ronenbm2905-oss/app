/**
 * הערות המאמן על שחקן (PRD §7.3ג) — התצוגה בלבד.
 *
 * ## הדגל המשפטי, ואיך הוא נראה על המסך
 *
 * ⚠️ עדי סימנה את השדה הזה כדגל **החמור ביותר** ב-M1 (סקירת 21.8.2026):
 * "הערכת אישיות שנערכה מטעם גורם מקצועי באשר לקווי אופי" היא מידע רגיש לפי
 * תיקון 13, ומאמן הוא בדיוק גורם כזה. ההכרעה טרם נפלה, ולכן השדה נבנה כפי
 * שה-PRD מבקש — עם **אותו טיפול בדיוק שניתן לשדה ההערה של השחקן**:
 *
 * • **טקסט עזר עובדתי שמגביל מה נכתב.** ⚖️ הניסוח הוא של עדי, מילה במילה
 *   (`notesPrivacyHint`, חלק ה'4 בסקירה) — הוא החליף ניסוח שנועם כתב. זה מיתון
 *   אמיתי ולא כיסוי: מה שלא נכתב לא יכול לדלוף. **אין לשפר ואין לרכך.**
 * • **אורך מוגבל** (`COACH_NOTE_MAX_LENGTH`), שנאכף גם ב-`firestore.rules`.
 *   400 תווים מספיקים לתזכורת מקצועית ולא מספיקים לתיק אישי.
 * • **שורת פרטיות מפורשת** — שהמאמן יידע, בכל פעם שהוא כותב, מי רואה את זה.
 *
 * ההערה **אינה נראית לשחקן**, וזה נאכף בכלל ולא בממשק: היא יושבת ב-
 * `teams/{teamId}/notes/{playerUid}` שהשחקן אינו רשאי לקרוא. ראה
 * `lib/coachNotes.ts` ו-`firestore.rules`.
 *
 * ## המנגנון הקטן שקל לפספס
 *
 * המסך מאזין חי ל-`onSnapshot`, כלומר הטקסט השמור עשוי להתחלף תוך כדי הקלדה
 * (מאמן שני, טאב אחר). הטיוטה **לא נדרסת** כשיש בה שינוי שלא נשמר — אחרת
 * משפט שנכתב לאט היה נמחק באמצע.
 */

import { useEffect, useRef, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextAreaField } from '../../components/ui/TextArea';
import { formatIsraeliDate } from '../../lib/dates';
import { COACH_NOTE_MAX_LENGTH, isCoachNoteDirty, validateCoachNote } from '../../lib/coachNotes';
import type { LoadStatus } from '../../hooks/loadStatus';
import { t } from '../../i18n/he';

export interface CoachNotePanelProps {
  status: LoadStatus;
  /** הטקסט השמור, מהמאזין. */
  savedText: string;
  updatedAt: Date | null;
  busy: boolean;
  /** שגיאת שמירה, כבר מתורגמת. */
  error: string | null;
  /** מוצג אחרי שמירה מוצלחת. */
  saved: boolean;
  onSave: (text: string) => void;
}

export function CoachNotePanel({
  status,
  savedText,
  updatedAt,
  busy,
  error,
  saved,
  onSave,
}: CoachNotePanelProps) {
  const [draft, setDraft] = useState(savedText);
  // מה שהמסד החזיר בפעם האחרונה. ref ולא state — הוא לא משפיע על הרינדור.
  const baselineRef = useRef(savedText);

  useEffect(() => {
    setDraft((current) => (isCoachNoteDirty(baselineRef.current, current) ? current : savedText));
    baselineRef.current = savedText;
  }, [savedText]);

  const validationKey = validateCoachNote(draft);
  const dirty = isCoachNoteDirty(savedText, draft);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-bold text-slate-900">{t('coach.player.note.title')}</h2>

      <p className="mt-1 text-xs text-slate-500">{t('coach.player.note.privacy')}</p>

      {status === 'loading' ? (
        <p className="mt-3 text-sm text-slate-500">{t('coach.player.note.loading')}</p>
      ) : status === 'error' ? (
        <div className="mt-3">
          <Alert tone="error">{t('coach.player.note.loadError')}</Alert>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <TextAreaField
            id="coach-note"
            rows={4}
            label={t('coach.player.note.title')}
            placeholder={t('coach.player.note.placeholder')}
            maxLength={COACH_NOTE_MAX_LENGTH}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            error={validationKey ? t(validationKey, { max: COACH_NOTE_MAX_LENGTH }) : null}
            hint={
              <>
                <span className="block">{t('coach.player.note.notesPrivacyHint')}</span>
                <span className="mt-1 block">
                  {t('coach.player.note.writingHint', { max: COACH_NOTE_MAX_LENGTH })}
                </span>
              </>
            }
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400">
              {t('coach.player.note.counter', {
                used: draft.length,
                max: COACH_NOTE_MAX_LENGTH,
              })}
            </span>
            {updatedAt ? (
              <span className="text-xs text-slate-400">
                {t('coach.player.note.savedAt', { date: formatIsraeliDate(updatedAt) })}
              </span>
            ) : null}
          </div>

          {error ? <Alert tone="error">{error}</Alert> : null}
          {saved && !dirty ? <Alert tone="success">{t('coach.player.note.saved')}</Alert> : null}

          <Button
            onClick={() => onSave(draft)}
            busy={busy}
            disabled={!dirty || Boolean(validationKey)}
          >
            {busy ? t('coach.player.note.saving') : t('coach.player.note.save')}
          </Button>

          <p className="text-xs text-slate-400">{t('coach.player.note.clearHint')}</p>
        </div>
      )}
    </section>
  );
}
