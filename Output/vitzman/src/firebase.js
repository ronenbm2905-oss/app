// ============================================================================
// firebase.js — שכבת הענן, אופציונלית.
//
// בלי `.env` האפליקציה רצה במצב מקומי (localStorage) וזה מספיק לחלוטין לעבודה
// של אדם אחד עם 131 הבניינים. Firebase נדרש רק ליציאה מהדפדפן הבודד ולריבוי
// משתמשים. ראה skill `firebase-app`.
//
// ⚠ `firebase deploy` **חסום ל-Claude** ועובר דרך רונן — ראה `DEPLOY.md`.
//
// ⚠ מפתחות ה-Web האלה **פומביים במהותם** — הם מוטמעים ב-build ונשלחים לכל
// דפדפן. זו אינה תקלה: ההגנה האמיתית היא `firestore.rules` ורשימת המורשים,
// לא הסתרת המפתח. לכן `.env` מחוץ ל-git מטעמי היגיינה, לא כאמצעי אבטחה.
// ============================================================================

import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from "firebase/auth";

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * ⚠ `__CLOUD_ENABLED__` הוא `false` **רק בבנייה העצמאית**, שבה Firebase מוחלף
 * ב-stub. בלי התנאי הזה, קיומו של `.env` היה מפעיל את מסלול הענן גם שם —
 * ו-`initializeApp` של ה-stub זורק, כלומר מסך לבן בלי הודעה.
 */
export const isFirebaseConfigured = __CLOUD_ENABLED__ && Boolean(cfg.apiKey && cfg.projectId);
export const firebaseConfig = cfg;

/** מזהה הארגון. ארגון אחד — ויצמן. הנתיב מוכן לשני, אם אי־פעם יהיה. */
export const ORG_ID = import.meta.env.VITE_ORG_ID || "vitzman";

const app = isFirebaseConfigured ? initializeApp(cfg) : null;

/**
 * ⚠ **מטמון מקומי מתמיד — לא נוחות, אלא תקציב קריאות.**
 *
 * טעינה מלאה היא ~3,300 מסמכים (2,715 חוזים לבדם). בלי מטמון, כל רענון של כל
 * משתמש הוא 3,300 קריאות מול מכסה של 50,000 ליום — שני אנשים שעובדים ברצינות
 * היו נוגעים בתקרה. עם `persistentLocalCache` הטעינה הראשונה משלמת את המחיר,
 * ואחריה מגיעים רק ההפרשים.
 *
 * `persistentMultipleTabManager` — כי לשונית שנייה של אותה מערכת היא מצב רגיל,
 * ובלעדיו השנייה נופלת על נעילת המטמון.
 */
export const db = app
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  : null;

export const auth = app ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();

// ההתחברות שורדת סגירת דפדפן. בלי זה כל פתיחה דורשת אישור Google מחדש —
// תלונה מוכרת מ-basketball-scheduler.
if (auth) setPersistence(auth, browserLocalPersistence).catch(() => {});
