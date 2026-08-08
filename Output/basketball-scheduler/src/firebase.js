// Firebase initialization. Reads config from Vite env vars (VITE_FIREBASE_*).
// If the config is missing (no .env yet), db/auth are exported as null and the app
// runs in LOCAL MODE (localStorage) — see src/hooks/useClubData.js.
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Consider Firebase "configured" only when the essential keys are present.
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

let db = null;
let auth = null;
let googleProvider = null;

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
}

// Fallback club document id, used when the URL does not name one (the bare "/" route).
// The club is otherwise resolved at RUNTIME from the path (/c/<slug>), so a single
// build serves every club — see src/utils/clubId.js.
export const DEFAULT_CLUB_ID = import.meta.env.VITE_CLUB_ID || "main";

export { db, auth, googleProvider };
