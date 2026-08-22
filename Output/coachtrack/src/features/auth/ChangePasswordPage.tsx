/**
 * מסך "החלף סיסמה" — נכפה כש-`mustChangePassword === true`.
 *
 * אחרי ההחלפה מתעדכן `users/{uid}.mustChangePassword` ל-false. זהו עדכון-עצמי
 * של שדה לא-רגיש, ולכן ה-rules מתירים אותו (חסומים רק role/orgId/teamIds/active).
 * ה-`onSnapshot` ב-AuthProvider קולט את השינוי, והראוטר משחרר את המשתמש למסך שלו —
 * אין כאן ניווט ידני.
 *
 * אין כפתור "אולי אחר כך": כל עוד הדגל דלוק, זה המסך היחיד שהמשתמש רואה.
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { useAuth } from '../../hooks/useAuth';
import { PASSWORD_MIN_LENGTH, authErrorKey, validateNewPassword } from '../../lib/auth';
import { t } from '../../i18n/he';
import type { TranslationKey } from '../../i18n/he';
import { AuthLayout } from './AuthLayout';
import { LegalLink } from '../../legal/PrivacyNotice';

export function ChangePasswordPage() {
  const { profile, changePassword, signOut } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const validationKey = validateNewPassword(password, confirmation);
    if (validationKey) {
      setErrorKey(validationKey);
      return;
    }

    setErrorKey(null);
    setSubmitting(true);
    try {
      await changePassword(password);
      // המסך יוחלף מאליו ברגע שה-snapshot יחזיר mustChangePassword: false.
    } catch (error) {
      setErrorKey(authErrorKey(error));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={t('auth.changePassword.title')}
      subtitle={
        profile ? t('auth.session.signedInAs', { name: profile.displayName }) : undefined
      }
      footer={
        <div className="space-y-3">
          <p>{t('auth.changePassword.keepItSafe')}</p>
          <LegalLink docId="privacy" />
        </div>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Alert tone="info">{t('auth.changePassword.forcedNotice')}</Alert>

        <TextField
          id="new-password"
          type="password"
          label={t('auth.changePassword.newPassword')}
          hint={t('auth.changePassword.hint', { min: PASSWORD_MIN_LENGTH })}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          latin
          required
        />

        <TextField
          id="confirm-password"
          type="password"
          label={t('auth.changePassword.confirmPassword')}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="new-password"
          latin
          required
        />

        {errorKey ? <Alert tone="error">{t(errorKey)}</Alert> : null}

        <Button type="submit" busy={submitting}>
          {submitting ? t('auth.changePassword.submitting') : t('auth.changePassword.submit')}
        </Button>

        {/* מוצא יחיד מהמסך: להתנתק. שימושי כשהחלפת הסיסמה דורשת התחברות מחדש. */}
        <Button type="button" variant="ghost" onClick={() => void signOut()}>
          {t('common.signOut')}
        </Button>
      </form>
    </AuthLayout>
  );
}
