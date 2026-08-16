// ============================================================================
// firebase.js — אתחול הענן לקונסולה של משה.
//
// עיקרון ה-fallback המקומי: בלי `.env` האפליקציה רצה על localStorage
// (משתמש בודד = בעלים), כדי שאפשר יהיה לבדוק אותה מיד בלי להקים פרויקט.
// עם `.env` — מצב ענן עם onSnapshot, כניסת Google והרשאות אמיתיות.
//
// 🔴 הערה שספציפית לפרויקט הזה: המצב המקומי הוא **מצב בדיקה בלבד**.
//    אסור להזין בו ליד של אדם אמיתי — localStorage אינו מאגר מאובטח,
//    ועדי אסרה ליד אמיתי עד שהשער נפתח. הקונסולה מציגה על כך באנר קבוע.
// ============================================================================

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const cfg = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

export const isFirebaseConfigured = Boolean(cfg.apiKey && cfg.projectId);

const app = isFirebaseConfigured ? initializeApp(cfg) : null;

// ---------------------------------------------------------------------------
// App Check (עדי R-5)
//
// ⚠️ שתי נקודות שקל להתבלבל בהן:
//   1. **האכיפה מוגדרת בקונסולה של Firebase, לא כאן ולא ב-rules.**
//      הקוד כאן רק *משיג* טוקן. Console → App Check → Firestore → Enforce
//      הוא מה שגורם לשרת *לדרוש* אותו. פריט DoD שעדי מאמתת בצילום מסך.
//   2. בפיתוח מקומי צריך debug token, אחרת reCAPTCHA ייכשל על localhost.
// ---------------------------------------------------------------------------
const siteKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
const debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;

if (app && siteKey) {
  if (debugToken) {
    // eslint-disable-next-line no-undef
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  }
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.error("[firebase] אתחול App Check נכשל:", err);
  }
} else if (app) {
  console.warn(
    "[firebase] ⚠️ App Check אינו מוגדר (חסר VITE_APPCHECK_SITE_KEY). " +
      "זהו חוסם go-live — עדי R-5."
  );
}

export const appCheckConfigured = Boolean(app && siteKey);

export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;
export const functions = app ? getFunctions(app, "europe-west1") : null;
export const googleProvider = new GoogleAuthProvider();
