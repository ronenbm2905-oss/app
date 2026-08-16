import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";
import { getStorage, connectStorageEmulator } from "firebase/storage";

// מפתחות Web ציבוריים ממילא — ההגנה האמיתית היא firestore.rules / storage.rules.
// optional chaining על import.meta.env: ב-Vite הוא מוזרק; ב-Node (smoke test)
// הוא undefined → cfg ריק → isFirebaseConfigured=false (מצב מקומי), בלי קריסה.
const env = import.meta.env ?? {};
const cfg = {
  apiKey: env.VITE_FB_API_KEY,
  authDomain: env.VITE_FB_AUTH_DOMAIN,
  projectId: env.VITE_FB_PROJECT_ID,
  storageBucket: env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FB_SENDER_ID,
  appId: env.VITE_FB_APP_ID,
};

// כשאין config → האפליקציה רצה במצב localStorage (fallback מקומי).
export const isFirebaseConfigured = Boolean(cfg.apiKey && cfg.projectId);

const app = isFirebaseConfigured ? initializeApp(cfg) : null;
export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;
export const storage = app && cfg.storageBucket ? getStorage(app) : null;
export const googleProvider = new GoogleAuthProvider();

// ============================================================================
// מצב אמולטור — **פיתוח בלבד**. `__FLEET_DEV_EMULATOR__` מוזרק בזמן build
// (vite.config.js) ומוגדר `true` רק ב-`vite serve` עם VITE_FB_USE_EMULATOR=1.
// בכל `npm run build` הוא `false` **מילולי**: ב-bundle זה מתקמפל ל-
// `NL=!1, isEmulator=!!NL` — כלומר הדגל כבוי בוודאות, ולא בדיקה שתלויה
// בסביבת הריצה. (המינימייזר משאיר את הבלוק המת עצמו; זה גודל, לא סיכון.)
//
// למה זה קיים: מסלול הענן (התחברות → אין ארגון → הקמה → נתונים חיים) לא
// היה ניתן לבדיקה בדפדפן בלי לגעת בפרויקט אמיתי — ובדיוק שם התחבא באג
// הפרודקשן של 16.8. הפעלה:
//   $env:VITE_FB_USE_EMULATOR="1" ; npm run dev
// (אין צורך ב-.env.local — שהוא הדרך המהירה ביותר לשלוח בטעות build בלי ענן.)
// ============================================================================
// eslint-disable-next-line no-undef
const DEV_EMULATOR = typeof __FLEET_DEV_EMULATOR__ !== "undefined" && __FLEET_DEV_EMULATOR__;
export const isEmulator = Boolean(DEV_EMULATOR && isFirebaseConfigured);

if (isEmulator && app) {
  const host = env.VITE_FB_EMULATOR_HOST || "127.0.0.1";
  console.warn(`[fleet] מצב אמולטור — כל הנתונים מקומיים (${host})`);
  connectFirestoreEmulator(db, host, 8080);
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  if (storage) connectStorageEmulator(storage, host, 9199);
}
