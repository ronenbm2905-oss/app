/**
 * רישום המסמכים המשפטיים.
 *
 * הקבצים נטענים דרך `?raw` של Vite, כלומר הם נצרבים ל-build כטקסט: אין בקשת
 * רשת, אין תלות ב-Firestore, ולכן אפשר לפתוח מסמך **גם ממסך ההתחברות**, לפני
 * שיש משתמש ולפני שנמסר מידע כלשהו. זו דרישת חוסם B3 בסקירת עדי (21.8.2026).
 *
 * ⚠️ **החלפת נוסח = החלפת קובץ `.md` בלבד.** כשעדי מוסרת נוסח סופי — מחליפים
 * את הקובץ תחת `content/` ולא נוגעים בקוד, ובוודאי לא בניסוח.
 *
 * היום יש כאן מסמך אחד. תנאי שימוש והצהרת נגישות ייכנסו כשייכתבו (עדי סימנה
 * אותם 🟠 לפני שלב 7): שורה כאן + קובץ `.md` + מפתח תווית ב-`i18n/he.ts`.
 *
 * הרישום יושב בקובץ נפרד מהמודאל כדי שקובץ הקומפוננטה ייצא קומפוננטות בלבד.
 */

import type { TranslationKey } from '../i18n/he';
import privacyMd from './content/privacy-policy.md?raw';

export type LegalDocId = 'privacy';

export interface LegalDoc {
  /** תווית הכותרת — מפתח במילון, כלל 8. */
  labelKey: TranslationKey;
  source: string;
}

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  privacy: { labelKey: 'auth.signIn.privacyLink', source: privacyMd },
};
