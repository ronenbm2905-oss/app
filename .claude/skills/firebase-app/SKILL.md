---
name: firebase-app
description: >-
  מחזור החיים המלא של Firebase לאפליקציית Vite+React: הקמה (Firestore / Auth
  Google / rules / .env), תבנית onSnapshot בטוחה-לתזמון (נרשמת רק אחרי login),
  build, ומעקף ה-deploy (firebase deploy נחסם ל-Claude). משמש את נועם. הפעל כשיש
  שכבת ענן/מסד נתונים/התחברות. לשלד האפליקציה עצמו — ראה `vite-react-scaffold`.
---

# firebase-app — מחזור החיים של Firebase

הסקיל אורז את כל מה שנלמד בכאב בפרויקט ה-Basketball Scheduler, כדי שלא נגלה שוב
את אותם דברים בכל אפליקציה.

## עיקרון: fallback מקומי

`firebase.js` מייצא `isFirebaseConfigured` (בדיקה אם משתני `VITE_*` קיימים). כשאין
config — האפליקציה רצה ב-localStorage (משתמש בודד = admin); כשיש `.env` — עוברת
לענן. כך משתמש לא-טכני יכול לבדוק מיד, לפני הקמת Firebase.

```js
// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

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
export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();
```

## הבאג הכי חשוב — תזמון ה-onSnapshot

**התסמין:** במצב ענן מופיע "טעינת הנתונים נכשלה", ואחרי login הנתונים לא נטענים.

**הסיבה:** ה-`onSnapshot` נרשם ב-mount עם deps `[]` — כלומר **לפני** שההתחברות
הושלמה (`request.auth = null`) → כללי האבטחה חוסמים, ואין re-subscribe אחרי login.

**התיקון:** ה-effect **תלוי ב-`user?.uid`** ונרשם רק כשיש user — כך הוא ממתין
ל-login ומתחבר-מחדש אחריו.

```js
// בתוך useData(user) — צד הענן
useEffect(() => {
  if (!isFirebaseConfigured || !user) return;        // ← ממתין ל-login
  const ref = doc(db, "clubs", "main");
  const unsub = onSnapshot(ref,
    (snap) => { setData(snap.exists() ? snap.data() : EMPTY); setLoading(false); },
    (err) => { console.error(err); setLoading(false); /* באנר שגיאה */ });
  return unsub;
}, [user?.uid]);                                     // ← לא [] !
```

## הרשאות — ב-rules, לא בקליינט

`canEdit`/`isAdmin` בקליינט זה רק UX. ההגנה האמיתית ב-`firestore.rules`, לפי מערך
`admins` במסמך. הקליינט מסתיר כפתורים; ה-rules אוכפים.

```
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /clubs/{id} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.auth.token.email in resource.data.admins;
    }
  }
}
```

## הקמה (מלווים את המשתמש)

1. צור פרויקט ב-Firebase Console; Firestore ב-**production mode** (region קרוב).
2. Authentication → הפעל **Google**.
3. רשום **Web app** → העתק את ה-config למשתני `VITE_*` ב-`.env`.
4. פרסם `firestore.rules`; צור מסמך `clubs/main` עם מערך `admins` (המייל של המשתמש).
5. `.env` **לעולם לא ב-git** (`.gitignore`). מפתחות ה-Web ציבוריים ממילא — ההגנה
   האמיתית היא ה-rules.

## build ו-deploy — אתה מכין, המשתמש מריץ

`firebase deploy` **נחסם ל-Claude** (auto-mode classifier — פעולת פרסום), ו-
PowerShell חוסם `npx.ps1`. לכן:

```bash
npm run build                                        # זה מותר לך
# ה-deploy — המשתמש מריץ ידנית ב-cmd:
cmd /c "npx firebase-tools deploy --only hosting,firestore:rules"
```

## Caveats שחוזרים

- **config מוטמע ב-build:** `VITE_*` נקראים בזמן build → כל שינוי config דורש
  `npm run build` מחדש.
- **`.env` לא עובר ב-git:** בכל מחשב חדש צריך ליצור אותו ידנית מ-`.env.example`.
- **מסלול הענן לא נבדק בלי פרויקט אמיתי** — סמן זאת מפורשות בדיווח ל-QA.
