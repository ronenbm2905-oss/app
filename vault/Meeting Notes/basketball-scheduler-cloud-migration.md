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
- **Deploy ל-Firebase Hosting טרם בוצע** — האפליקציה רצה מקומית (`npm run dev`) מול Firebase ענן,
  אבל אין עדיין URL ציבורי קבוע. השלב הבא: `firebase deploy`.
- קובץ `.env` קיים רק במחשב הבית — במחשב המשרד צריך ליצור אותו ידנית (לא עובר דרך git).
- ייבוא xlsx מהאיגוד אומת דרך העברת קוד נאמנה בלבד, לא עם קובץ אמיתי (לא היה קובץ דגימה בסשן).
- זיהוי בית/חוץ בפורמט החדש מקודד לפי מילות-מפתח "קרית אונו" (מהמקור) — יצטרך התאמה למועדון אחר.

פרטי הפרויקט של המשתמש: Firebase project `basketball-schedule-f0f57`, מסמך `clubs/main`,
admin = `ronenbm2905@gmail.com`.

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

### 2026-07-11 — הקמת Firebase + תיקון באג טעינה במצב ענן [shipped]
- **What was done:** ליוויתי את המשתמש בהקמת Firebase מלאה (project `basketball-schedule-f0f57`:
  Firestore ב-eur3 production mode, Auth Google, רישום Web app, כללי אבטחה פורסמו, מסמך
  `clubs/main` עם admin). נוצר `.env` עם המפתחות + עודכן `.firebaserc`. האפליקציה עברה למצב ענן.
- **Bug fixed:** במצב ענn ה-`onSnapshot` ב-`useClubData` נרשם ב-mount עם deps `[]` — כלומר
  **לפני** שההתחברות הושלמה (request.auth=null) → הכללים חסמו → "טעינת הנתונים נכשלה", וללא
  re-subscribe אחרי login. תוקן: ה-effect ממתין ל-`user` ותלוי ב-`user?.uid`, כך שנרשם רק כשמחובר
  ומתחבר-מחדש אחרי login. אומת בדפדפן: אין באנר שגיאה, admin מזוהה, כפתורי עריכה מופיעים, נתונים נטענים.
- **Decisions:** מפתחות Firebase Web נשמרו ב-`.env` (הם ציבוריים ממילא; ההגנה האמיתית = firestore.rules).
- **Notes / Caveats:** התיקון ב-`useClubData.js` עדיין לא עבר commit/push — צריך לפני deploy ולפני
  pull במחשב המשרד.
- **Related:** [[basketball-scheduler-cloud-migration#2026-07-11]], [[push-workflow]]
