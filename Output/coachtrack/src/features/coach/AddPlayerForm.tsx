/**
 * טופס הוספת שחקן.
 *
 * ⚠️ **ארבעה שדות, ובכוונה רק הם** (כלל 7 — מזעור נתונים): שם תצוגה, שם משתמש,
 * סיסמה ראשונית, והקבוצה שנבחרה במסך. אין ת.ז., טלפון, תאריך לידה או תמונה —
 * גם לא כשדה "אופציונלי". המשתמשים הם קטינים, ומה שלא נאסף לא יכול לדלוף.
 * מי שמוסיף כאן שדה — מפר כלל, לא מוסיף פיצ'ר.
 *
 * ## שער ההסכמה
 *
 * ⚖️ בסקירת השער של עדי (21.8.2026, חלק ה'1) נפסלה התזכורת הקודמת: "ודא
 * שהתקבלה" הוא ניסוח רופף, ו**תזכורת שאיש אינו מתעד אינה ראיה להסכמה**. לכן יש
 * כאן שני דברים שונים, ולא אחד:
 *
 * 1. **הודעה** (`consentReminder`) — מה הכלל: הסכמה מראש ובכתב, על טופס המועדון.
 * 2. **תיבת סימון חוסמת** (`consentConfirm`) — אישור אקטיבי של המאמן ברגע
 *    היצירה. בלעדיה **כפתור היצירה חסום**, וגם `handleSubmit` עוצר. שתי החסימות
 *    מכוונות: הכפתור המושבת מונע גם submit בלחיצת Enter, והבדיקה בקוד היא הגבול
 *    האמיתי.
 *
 * האישור **אינו נשמר למסד** (ראה `validateParentConsent` ב-`lib/players.ts`),
 * והוא מתאפס אחרי כל יצירה — כל שחקן דורש אישור משלו.
 *
 * הקומפוננטה טהורה מבחינת נתונים: היא לא מכירה את Firestore ולא את Auth,
 * ומדווחת החוצה דרך `onSubmit` בלבד. לכן אפשר לרנדר אותה בטסט.
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { CheckboxField } from '../../components/ui/Checkbox';
import { TextField } from '../../components/ui/TextField';
import { PASSWORD_MIN_LENGTH } from '../../lib/auth';
import {
  generateInitialPassword,
  isPlayerFormValid,
  validateNewPlayer,
  validateParentConsent,
} from '../../lib/players';
import type { NewPlayerFormErrors, NewPlayerFormValues } from '../../lib/players';
import { t } from '../../i18n/he';

const EMPTY_FORM: NewPlayerFormValues = { displayName: '', username: '', password: '' };

interface AddPlayerFormProps {
  /** שם הקבוצה שאליה יצורף השחקן — מוצג כדי שלא תהיה הפתעה. */
  teamName: string;
  /** שמות המשתמש שכבר קיימים בארגון, לבדיקת כפילות לפני שליחה. */
  takenUsernames: string[];
  /** מחזירה true אם השחקן נוצר. במקרה כזה הטופס מתרוקן. */
  onSubmit: (values: NewPlayerFormValues) => Promise<boolean>;
  onClose: () => void;
}

export function AddPlayerForm({
  teamName,
  takenUsernames,
  onSubmit,
  onClose,
}: AddPlayerFormProps) {
  const [values, setValues] = useState<NewPlayerFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<NewPlayerFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  /** אישור הסכמת ההורה. מצב מקומי בלבד — אינו נשלח ל-`onSubmit` ואינו נשמר. */
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  const consentErrorKey = validateParentConsent(consentConfirmed);

  function update(field: keyof NewPlayerFormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    // הגבול האמיתי. הכפתור המושבת הוא נוחות, זו הבדיקה.
    if (consentErrorKey) return;

    const nextErrors = validateNewPlayer(values, takenUsernames);
    setErrors(nextErrors);
    if (!isPlayerFormValid(nextErrors)) return;

    setSubmitting(true);
    const created = await onSubmit(values);
    setSubmitting(false);

    if (created) {
      setValues(EMPTY_FORM);
      setErrors({});
      // כל שחקן דורש אישור הסכמה משלו.
      setConsentConfirmed(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{t('coach.team.add.title')}</h2>
        <Button variant="ghost" fullWidth={false} onClick={onClose}>
          {t('coach.team.add.close')}
        </Button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Alert tone="info">{t('coach.team.add.consentReminder')}</Alert>

        <TextField
          id="player-display-name"
          label={t('coach.team.add.displayName')}
          hint={t('coach.team.add.displayNameHint')}
          value={values.displayName}
          onChange={(event) => update('displayName', event.target.value)}
          error={errors.displayName ? t(errors.displayName) : null}
          autoComplete="off"
          required
        />

        <TextField
          id="player-username"
          label={t('coach.team.add.username')}
          hint={t('coach.team.add.usernameHint')}
          value={values.username}
          onChange={(event) => update('username', event.target.value)}
          error={errors.username ? t(errors.username) : null}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          latin
          required
        />

        <div className="space-y-2">
          <TextField
            id="player-password"
            label={t('coach.team.add.password')}
            hint={t('coach.team.add.passwordHint', { min: PASSWORD_MIN_LENGTH })}
            value={values.password}
            onChange={(event) => update('password', event.target.value)}
            error={errors.password ? t(errors.password) : null}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            latin
            required
          />
          <Button
            variant="secondary"
            fullWidth={false}
            onClick={() => update('password', generateInitialPassword())}
          >
            {t('coach.team.add.generatePassword')}
          </Button>
        </div>

        <p className="text-xs text-slate-500">{t('coach.team.add.minimalDataNotice')}</p>
        <p className="text-sm text-slate-600">
          {t('coach.team.add.teamNotice', { team: teamName })}
        </p>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <CheckboxField
            id="player-consent"
            checked={consentConfirmed}
            onChange={(event) => setConsentConfirmed(event.target.checked)}
            label={t('coach.team.add.consentConfirm')}
            // מוצג כל עוד התיבה לא סומנה — זה גם ההסבר למה הכפתור חסום.
            hint={consentErrorKey ? t(consentErrorKey) : undefined}
            required
          />
        </div>

        <Button type="submit" busy={submitting} disabled={Boolean(consentErrorKey)}>
          {submitting ? t('coach.team.add.submitting') : t('coach.team.add.submit')}
        </Button>
      </form>
    </section>
  );
}
