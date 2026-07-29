---
name: vite-react-scaffold
description: >-
  שלד אפליקציה קנוני ל-Vite + React 18 + Tailwind (JavaScript, לא TS) — מבנה
  תיקיות, RTL + i18n, ותבנית ה-hook לנתונים עם fallback-מקומי (localStorage)
  שמתחלף אוטומטית ל-Firestore כשיש config. משמש את נועם (מפתח האפליקציות). הפעל
  בתחילת כל אפליקציה חדשה, במקום להמציא מבנה מאפס. ל-Firebase עצמו — ראה
  `firebase-app`.
---

# vite-react-scaffold — שלד אפליקציה קנוני

הסקיל הזה נותן לנועם נקודת פתיחה **זהה בכל אפליקציה**, כדי לצבור מומחיות באותו כלי
ולא להמציא מבנה בכל פעם. הבסיס נלקח מפרויקט ה-Basketball Scheduler שהוכיח את עצמו.

## עיקרון: המרה, לא כתיבה מחדש

אם ממירים קוד קיים (מונוליט/HTML) — מעבירים את הלוגיקה **נאמנה** ומארגנים אותה
למבנה למטה. מתקנים באגים לטנטיים רק כשמזהים אותם במפורש, ומתעדים כל תיקון.

## מבנה התיקיות (קבוע)

```
Output/<slug>/
├── package.json  vite.config.js  tailwind.config.js  postcss.config.js
├── index.html                 # dir="rtl" lang="he"
├── .gitignore                 # כולל .env
├── .env.example  README.md
└── src/
    ├── main.jsx  App.jsx
    ├── index.css              # @tailwind base/components/utilities
    ├── constants.js           # קבועים, EMPTY state (לא SAMPLE)
    ├── i18n.js                # מילון עברית + t()
    ├── firebase.js            # ראה skill firebase-app
    ├── utils/                 # פונקציות טהורות: dates, conflicts, csv, ...
    ├── hooks/                 # useAuth, useData (ראה למטה)
    └── components/
        ├── ui/                # רכיבים משותפים: Select, Pill, icons
        └── <Feature>View.jsx  # מסך לכל תחום
```

## עקרונות מבנה

1. **קובץ בודד ענק = ריח רע.** מפרקים לרכיבים קטנים; לוגיקה ל-`hooks/`, פונקציות
   טהורות ל-`utils/`, קבועים ל-`constants.js`.
2. **`EMPTY` ולא `SAMPLE`** בטעינה ראשונה — כלי ניהול אמיתי לא צריך נתוני דמו.
3. **`canEdit` מועבר לכל view** — במצב קריאה מסתירים כפתורי עריכה + באנר "צפייה בלבד".
4. **אייקונים** דרך מודול `ui/icons.jsx` שממפה שמות (IconPlus וכו') — מזעור שינויים
   בהמרה, ומקור אחד להחלפה (למשל ל-`lucide-react`).

## index.html — RTL מהיסוד

```html
<!doctype html>
<html lang="he" dir="rtl">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title><!-- שם --></title></head>
  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>
```

## תבנית ה-hook לנתונים — הלב של השלד

`hooks/useData.js` בוחר מימוש לפי `isFirebaseConfigured` (מיוצא מ-`firebase.js`).
כך האפליקציה רצה **מיד** במצב מקומי (משתמש בודד = admin), ובלי שינוי קוד עוברת
לענן ברגע שיש `.env`. הפרטים המלאים של צד ה-Firestore — ב-skill `firebase-app`.

```js
import { useState, useEffect } from "react";
import { isFirebaseConfigured } from "../firebase";
import { EMPTY } from "../constants";

export function useData(user) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  // --- מצב מקומי: localStorage, ללא ענן ---
  useEffect(() => {
    if (isFirebaseConfigured) return;               // הענן מטופל ב-effect הנפרד
    const raw = localStorage.getItem("appData");
    setData(raw ? JSON.parse(raw) : EMPTY);
    setLoading(false);
  }, []);

  const save = (next) => {
    setData(next);
    if (!isFirebaseConfigured) localStorage.setItem("appData", JSON.stringify(next));
    // else: כתיבה ל-Firestore — ראה firebase-app
  };

  // --- מצב ענן (onSnapshot) חי ב-firebase-app; תלוי ב-user?.uid ---
  return { data, save, loading, canEdit: true };
}
```

## תלויות (package.json)

```json
{
  "scripts": { "dev": "vite", "build": "vite build", "preview": "vite preview" },
  "dependencies": { "react": "^18", "react-dom": "^18", "lucide-react": "^0.4",
    "firebase": "^10" },
  "devDependencies": { "vite": "^5", "@vitejs/plugin-react": "^4",
    "tailwindcss": "^3", "postcss": "^8", "autoprefixer": "^10" }
}
```

## QA לפני מסירה

`npm run build` עובר, `npm run dev` + דפדפן, אימות end-to-end של המסכים (כניסה,
קריאה, כתיבה, הרשאות), אפס שגיאות קונסול, ו-state ששורד רענון. `build` לבדו ≠ QA.
