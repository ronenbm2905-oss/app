/**
 * CoachTrack — אתחול Firebase
 *
 * האפליקציה היא Firebase-only: אין מצב מקומי ואין fallback ל-localStorage.
 * הקונפיג נקרא ממשתני סביבה בזמן ה-build (`import.meta.env.VITE_FIREBASE_*`),
 * מתוך `.env.local` שלא נכנס לגיט. ראה `.env.example`.
 *
 * ⚠️ המפתחות האלה ציבוריים לפי עיצוב — הם נצרבים לתוך ה-bundle של הדפדפן.
 *    ההגנה האמיתית היא `firestore.rules`, לא הסתרת המפתח.
 *
 * ⚠️ כל שינוי ב-.env.local מחייב build מחדש — Vite צורב את הערכים בזמן הבנייה.
 *
 * שימוש: `import { db, firebaseAuth } from '@/lib/firebase'` (או נתיב יחסי).
 * הקובץ נטען בעצלתיים — מודול שלא מייבא אותו לא ידרוש קונפיג.
 */

import { initializeApp, getApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

type EnvKey = (typeof ENV_KEYS)[number];

const env = import.meta.env as unknown as Record<EnvKey, string | undefined>;

/** מחזירה את שמות משתני הסביבה החסרים. ריק = הקונפיג שלם. */
export function missingFirebaseEnvVars(): EnvKey[] {
  return ENV_KEYS.filter((key) => !env[key]);
}

function readConfig(): FirebaseOptions {
  const missing = missingFirebaseEnvVars();
  if (missing.length > 0) {
    throw new Error(
      `חסרים משתני סביבה של Firebase: ${missing.join(', ')}. ` +
        'צור קובץ .env.local בשורש הפרויקט לפי .env.example, והרץ מחדש את שרת הפיתוח.',
    );
  }

  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
}

/**
 * הקונפיג עצמו, לשימוש חוזר.
 *
 * ה-**אינסטנס המשני** ב-`lib/adminClient.ts` צריך בדיוק את אותו אובייקט
 * (`initializeApp(config, 'admin')`), ולכן הוא נחשף כפונקציה ולא כקבוע:
 * כך הבדיקה של משתני הסביבה נשארת עצלה ורצה רק כשבאמת יוצרים אפליקציה.
 */
export function getFirebaseConfig(): FirebaseOptions {
  return readConfig();
}

/** אינסטנס Firebase הראשי. (אינסטנס משני ליצירת משתמשים — שלב 2, `lib/adminClient.ts`.) */
export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(readConfig());

export const firebaseAuth = getAuth(firebaseApp);

export const db = getFirestore(firebaseApp);
