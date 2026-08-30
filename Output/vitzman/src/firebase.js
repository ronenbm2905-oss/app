// ============================================================================
// firebase.js — שכבת הענן, אופציונלית.
//
// בלי `.env` האפליקציה רצה במצב מקומי (localStorage) וזה מספיק לחלוטין לעבודה
// עם 131 הבניינים. Firebase נדרש רק ליציאה מהדפדפן הבודד ולריבוי משתמשים.
// ראה skill `firebase-app`. `firebase deploy` חסום ל-Claude ועובר דרך רונן.
// ============================================================================

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(cfg.apiKey && cfg.projectId);
export const firebaseConfig = cfg;
