import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";

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
