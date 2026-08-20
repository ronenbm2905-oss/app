/**
 * מסך התחברות — שם משתמש וסיסמה.
 *
 * המשתמש לא רואה אימייל בשום מקום; ההמרה ל-`<username>@coachtrack.local`
 * קורית ב-`lib/auth.ts` ואינה מוזכרת בממשק.
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { useAuth } from '../../hooks/useAuth';
import { authErrorKey, isValidUsername, normalizeUsername } from '../../lib/auth';
import { t } from '../../i18n/he';
import type { TranslationKey } from '../../i18n/he';
import { AuthLayout } from './AuthLayout';

export function SignInPage() {
  const { signIn } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrorKey, setFieldErrorKey] = useState<TranslationKey | null>(null);
  const [formErrorKey, setFormErrorKey] = useState<TranslationKey | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setFieldErrorKey(null);
    setFormErrorKey(null);

    const cleanUsername = normalizeUsername(username);
    if (!cleanUsername) {
      setFieldErrorKey('auth.errors.missingUsername');
      return;
    }
    if (!isValidUsername(cleanUsername)) {
      setFieldErrorKey('auth.errors.invalidUsername');
      return;
    }
    if (!password) {
      setFormErrorKey('auth.errors.missingPassword');
      return;
    }

    setSubmitting(true);
    try {
      await signIn(cleanUsername, password);
      // אין ניווט כאן: ה-AuthProvider יעדכן את המצב, והראוטר ישלח למסך הנכון.
    } catch (error) {
      setFormErrorKey(authErrorKey(error));
      setPassword('');
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={t('auth.signIn.title')}
      subtitle={t('auth.signIn.subtitle')}
      footer={t('auth.signIn.forgotHelp')}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          id="username"
          label={t('auth.signIn.username')}
          placeholder={t('auth.signIn.usernamePlaceholder')}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          error={fieldErrorKey ? t(fieldErrorKey) : null}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          latin
          required
        />

        <TextField
          id="password"
          type="password"
          label={t('auth.signIn.password')}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          latin
          required
        />

        {formErrorKey ? <Alert tone="error">{t(formErrorKey)}</Alert> : null}

        <Button type="submit" busy={submitting}>
          {submitting ? t('auth.signIn.submitting') : t('auth.signIn.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
