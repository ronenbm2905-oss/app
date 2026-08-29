// ============================================================================
// firebase.ts — אתחול Firebase, ו**הדבר היחיד בקליינט שקורא קונפיג**.
//
// ---------------------------------------------------------------------------
// ★★ העיקרון שלא זז: בלי `.env` — הכול עובד
// ---------------------------------------------------------------------------
// `isFirebaseConfigured` הוא `false` כשאין משתני סביבה, ואז האפליקציה רצה
// **בדיוק כמו קודם**: fixtures מקומיים, `localStorage`, בלי גוגל ובלי ענן.
//
// זו לא נוחות פיתוח. שתי סיבות ממשיות:
//  1. **ההדגמה שרונן מראה לדורית לא נשברת.** היא רצה על נתוני דוגמה, בלי
//     חשבון, בלי חיבור, ובלי שום דבר להגדיר.
//  2. **אפשר לבדוק את כל הלוגיקה בלי פרויקט ענן.** מסלול שדורש deploy כדי
//     להריץ אותו הוא מסלול שנבדק פעם אחת.
//
// ---------------------------------------------------------------------------
// ★ ומה שבכל זאת נבדק כאן: **שמות המשתנים**
// ---------------------------------------------------------------------------
// `scripts/check-order-source.mjs` מתיר `import.meta.env` **בקובץ הזה בלבד,
// ורק לשמות שברשימה** (`ALLOWED_ENV_VARS`). משתנה בשם `VITE_ORDER_QUERY` או
// `VITE_ORDER_SENDER` מפיל את ה-build — גם כאן.
//
// ההבחנה היא הלב של B12: **מפתח Firebase אינו היקף קריאה; שאילתה כן.**
// היקף הקריאה קבוע ב-`ORDER_SOURCE_QUERY` ואינו ניתן לעריכה מהקונפיג, וזה
// מה שמחזיק את המשפט "רק מחברת התשלומים" במסך ההסבר.
//
// ---------------------------------------------------------------------------
// המפתחות ציבוריים, וזה בסדר
// ---------------------------------------------------------------------------
// `VITE_*` מוטמעים בחבילה שנשלחת לדפדפן, ולכן הם גלויים לכל מי שפותח את
// כלי הפיתוח. זה נכון לכל אפליקציית Firebase, וזו לא פרצה: **ההגנה האמיתית
// היא `firestore.rules`**, שנבדקים ב-`rules-tests/` מול אמולטור.
//
// מה ש**כן** סוד — `GOOGLE_OAUTH_CLIENT_SECRET` ו-`TOKEN_ENC_KEY` — אינו
// כאן ואינו יכול להיות כאן: הוא יושב ב-Secret Manager ונקרא רק בצד השרת.
// ============================================================================

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFunctions, type Functions } from 'firebase/functions';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** ★ האזור של ה-Functions. חייב להתאים ל-`setGlobalOptions` בצד השרת. */
const region = import.meta.env.VITE_FUNCTIONS_REGION || 'me-west1';

/**
 * ★★ המתג.
 *
 * שלושה מפתחות ולא אחד: `.env` חלקי הוא מצב אמיתי (מישהו העתיק חצי מהקונסולה),
 * והוא הגרוע משני העולמות — האפליקציה מנסה להתחבר, נכשלת, ומציגה שגיאה
 * במקום פשוט לרוץ מקומית.
 */
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let functions: Functions | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(config);
  db = getFirestore(app);
  auth = getAuth(app);
  functions = getFunctions(app, region);
  googleProvider = new GoogleAuthProvider();
  // ⚠️ **ובכוונה בלי `addScope`.**
  //
  // זו הנקודה שבה שתי הזרימות היו מתמזגות בשקט: שורה אחת
  // `googleProvider.addScope('...gmail.readonly')` הייתה הופכת את מסך
  // ההתחברות למסך ההרשאה — כלומר דורית הייתה מאשרת גישה לכל התיבה בזמן
  // שהיא חושבת שהיא נכנסת לכלי.
  //
  // ההרשאה נשארת בזרימה נפרדת בצד השרת (`googleAuthStart`), אחרי מסך
  // ההסבר. ראה `functions/src/lib/oauthFlow.ts` ו-`shared/lib/googleScopes.ts`.
}

export { app, db, auth, functions, googleProvider, region };
