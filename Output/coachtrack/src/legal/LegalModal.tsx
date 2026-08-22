/**
 * מודאל להצגת מסמך משפטי.
 *
 * המסמכים יושבים כקבצי `.md` תחת `content/` ונטענים דרך `?raw` של Vite —
 * כלומר הם נצרבים ל-build כטקסט, בלי בקשת רשת ובלי תלות בהתחברות. זה מה
 * שמאפשר לפתוח את מדיניות הפרטיות **גם ממסך ההתחברות**, לפני שיש משתמש
 * ולפני שנמסר מידע כלשהו — וזו בדיוק דרישת חוסם B3 בסקירת עדי (21.8.2026).
 *
 * ⚠️ **החלפת נוסח = החלפת קובץ `.md` בלבד.** אין לגעת בקוד הזה כשעדי מוסרת
 * נוסח חדש, ואין לערוך את הניסוח שלה כדי שייראה טוב יותר על המסך.
 *
 * רישום המסמכים עצמו יושב ב-`docs.ts`, כדי שהקובץ הזה ייצא קומפוננטה בלבד.
 */

import { useEffect } from 'react';
import { Markdown } from './Markdown';
import { LEGAL_DOCS } from './docs';
import type { LegalDocId } from './docs';
import { Button } from '../components/ui/Button';
import { t } from '../i18n/he';

interface LegalModalProps {
  docId: LegalDocId;
  onClose: () => void;
}

export function LegalModal({ docId, onClose }: LegalModalProps) {
  const doc = LEGAL_DOCS[docId];

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);

    // מונע גלילה של הרקע מאחורי המודאל בטלפון.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const label = t(doc.labelKey);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-bold text-slate-900">{label}</h2>
          {/* autoFocus ולא ref: `Button` אינו מעביר ref, והמיקוד חייב להיכנס
              למודאל כדי ש-Esc ומקלדת יעבדו מיד. */}
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <Button autoFocus variant="secondary" fullWidth={false} onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>

        <div className="overflow-y-auto px-4 py-4">
          <Markdown source={doc.source} />
        </div>
      </div>
    </div>
  );
}
