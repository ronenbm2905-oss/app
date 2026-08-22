/**
 * שני מקומות שבהם המשתמש מגיע למדיניות הפרטיות — וזה בכוונה שניים.
 *
 * • `SignInPrivacyNotice` — מסך ההתחברות. ⚖️ זו הנקודה היחידה שבה **הילד** עומד
 *   מול המערכת **לפני** שהוא מוסר מידע, ולכן היידוע חייב להיות שם ולא רק בפנים.
 *   חוסם B3 בסקירת עדי (21.8.2026).
 * • `LegalFooter` — בתחתית האפליקציה המחוברת, כדי שהמסמך יהיה נגיש גם אחרי
 *   הכניסה ולא רק ברגע שקל לדלג עליו.
 *
 * הטקסטים כולם מ-`i18n/he.ts` (ניסוח עדי), ותוכן המסמך מגיע מקובץ `.md`.
 */

import { useState } from 'react';
import { LegalModal } from './LegalModal';
import type { LegalDocId } from './docs';
import { t } from '../i18n/he';

/** כפתור־קישור שפותח מסמך. נראה כמו קישור, מתנהג ככפתור (אין לאן לנווט). */
export function LegalLink({ docId, className = '' }: { docId: LegalDocId; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          'rounded underline underline-offset-2',
          'hover:text-slate-900 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-slate-900',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {t('auth.signIn.privacyLink')}
      </button>
      {open ? <LegalModal docId={docId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** היידוע במסך ההתחברות: משפט בשפה של בן 13, ומתחתיו הקישור למסמך המלא. */
export function SignInPrivacyNotice() {
  return (
    <div className="space-y-1">
      <p>{t('auth.signIn.privacyNotice')}</p>
      <LegalLink docId="privacy" />
    </div>
  );
}

/** תחתית האפליקציה המחוברת. */
export function LegalFooter() {
  return (
    <footer className="mx-auto max-w-3xl px-4 pb-8 text-center text-xs text-slate-600">
      <LegalLink docId="privacy" />
    </footer>
  );
}
