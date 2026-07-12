# Basketball Scheduler — המרה לאפליקציית ענן

## Overview
המרה של `scheduler_1.html` (אפליקציית React בקובץ בודד, localStorage בלבד) לאפליקציית ענן
מלאה תחת `Output/basketball-scheduler/`. הסטאק: **Vite + React 18 + Tailwind v3 + lucide-react +
SheetJS + Firebase (Firestore/Auth/Hosting)**, JavaScript (לא TS). הכלי מנהל מערכת שעות של מועדון
כדורסל: קבוצות/מאמנים/אולמות, אימונים, אילוצים, ייבוא משחקים מהאיגוד (xlsx), לוח שבועי להדפסה/PDF,
ותצוגת מאמן. מבוסס על מפרט `basketball_spec_v2.docx` (14 סעיפים). עיקרון: **המרה, לא כתיבה מחדש** —
כל הלוגיקה הועברה מהמקור ואורגנה למבנה הקבצים של סעיף 11 במפרט.

מאפיין מפתח שנבחר: **fallback מקומי** — אם אין Firebase config, האפליקציה רצה במצב localStorage
(כולם "admin"); ברגע שמוגדר `.env` עם מפתחות → מצב ענן עם `onSnapshot`, כניסת Google, והרשאות
מנהל/מאמן לפי מערך `admins` במסמך `clubs/main`.

## Open Questions
- הקמת Firebase (יצירת פרויקט, הפעלת Firestore/Auth/Hosting, deploy, יצירת admin ראשון) נותרה
  למשתמש — אימות מלא של מסלול הענן (Google login, סנכרון רב-מכשירי, הרשאות) טרם בוצע בפועל.
- ייבוא xlsx מהאיגוד אומת דרך העברת קוד נאמנה בלבד, לא עם קובץ אמיתי (לא היה קובץ דגימה בסשן).
- זיהוי בית/חוץ בפורמט החדש מקודד לפי מילות-מפתח "קרית אונו" (מהמקור) — יצטרך התאמה למועדון אחר.

## Session Log

### 2026-07-11 — המרת המונוליט לאפליקציית ענן [shipped]
- **What was done:** נבנתה `Output/basketball-scheduler/` מלאה. פירוק `scheduler_1.html` (2275 שורות)
  ל-`constants.js`, `utils/` (dates, colors, conflicts, csv, games), `hooks/` (useAuth, useClubData),
  `components/` (ui/Select+Pill+icons, LoginPage, SessionForm, ManagerView, ConstraintsView,
  RostersView, GamesView, WeeklyScheduleView, CoachView), `App.jsx`, `firebase.js`, `i18n.js`.
  נוספו `firestore.rules`, `firebase.json`, `.firebaserc`, `.env.example`, `.gitignore`, `README.md`
  עם מדריך הקמה בעברית.
- **Decisions:**
  - **fallback מקומי** (במקום Firebase-only) — כדי שהמשתמש (לא-טכני, אין לו עדיין Firebase) יוכל
    להשתמש ולבדוק מיד. `useClubData` בוחר מימוש לפי `isFirebaseConfigured`; ה-effect של הענן מוגן
    כדי לא לקרוס עם `db=null`.
  - אייקונים: `lucide-react` (לפי המפרט) במקום ה-inline SVG של המקור, דרך מודול `ui/icons.jsx`
    שממפה לשמות המקוריים (IconPlus וכו') — מזעור שינויים בהעברה.
  - `EMPTY` במקום `SAMPLE` בטעינה ראשונה — כלי ניהול אמיתי לא צריך קבוצות דמו.
  - שופרו שני באגים לטנטיים מהמקור: ייבוא CSV שמר `{...data, ...next}` (המקור דרס games/mapping);
    הוספת/מחיקת משחק ידני קוראת ל-`syncGamesToSessions` (המקור סנכרן משחקים ל-sessions רק בייבוא xlsx).
  - `canEdit` (=isAdmin) מועבר לכל view; במצב קריאה מוסתרים כפתורי הוספה/עריכה/מחיקה + באנר "צפייה בלבד".
- **Verification:** `npm run build` עבר (אזהרת chunk צפויה — firebase+xlsx). `npm run dev` + דפדפן,
  מצב מקומי עם נתוני-בדיקה: אומתו end-to-end כל 6 הטאבים — ניהול (2 התנגשויות + 2 הפרות אילוץ, מיון,
  pills), לוח שבועי (grid קבוצות עם תאריכים מחושבים + דוח אולם כרונולוגי), תצוגת מאמן (אימונים+אולמות+
  הפרות), משחקים (מצב ריק), קבוצות ואילוצים (רינדור). אפס שגיאות קונסול. localStorage שרד רענון.
- **Notes / Caveats:** מסלול Firebase עצמו לא נבדק בפועל (דורש פרויקט של המשתמש) — ראה Open Questions.
- **Related:** [[agent-omer]], [[dir-output]], [[skill-obsidian-vault-workflow]]
