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
- **⚠️ פער חי (28.7):** תיקוני השער המשפטי (allowlist rules + מסמכי פרטיות + נגישות) **בנויים
  מקומית אבל לא עברו commit/deploy** → הגרסה ה**חיה** עדיין עם `allow read: if request.auth != null`,
  כלומר כל משתמש-גימייל מחובר קורא את כל הנתונים. לסגירה: commit+push → build → `firebase deploy`
  (rules+hosting) → הוספת כתובות ל-`members[]`/`admins[]` ב-`clubs/main`. deploy חסום ל-Claude.
- קובץ `.env` קיים רק במחשב הבית — במחשב המשרד צריך ליצור אותו ידנית (לא עובר דרך git).
  לכל build/deploy עתידי מהמשרד צריך את ה-`.env` שם.
- deploy עתידי: `firebase deploy` נחסם ל-Claude ע"י ה-auto-mode classifier (פעולת פרסום) —
  המשתמש מריץ ידנית דרך `cmd /c "npx firebase-tools deploy ..."` (PowerShell חוסם סקריפטים).
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

### 2026-07-11 — Deploy ל-Firebase Hosting — האפליקציה חיה [shipped]
- **What was done:** push של התיקון+פיצ'ר (commit 4e98545). התקנת firebase-tools 15.24.0,
  `npm run build`, והמשתמש התחבר (`npx firebase-tools login`) והריץ `firebase deploy`. האתר עלה.
- **URL חי:** https://basketball-schedule-f0f57.web.app (אומת בדפדפן — נטען, מסך כניסת Google, ללא שגיאות).
- **Notes / Caveats:** `firebase deploy` דרך ה-Bash של Claude נחסם ע"י ה-classifier → המשתמש הריץ
  ידנית ב-cmd. PowerShith חוסם `npx.ps1` (execution policy) → פתרנו עם `cmd /c "..."` / cmd ישיר.
  config של Firebase Web מוטמע ב-build (VITE_* מ-.env בזמן build) — build חדש נדרש לכל שינוי config.
- **Related:** [[push-workflow]], [[dir-output]]

### 2026-07-23 — תיקוני שער משפטי (עדי): הרשאות + פרטיות + נגישות [built, ממתין ל-deploy]
נועם ביצע את כל תיקוני הקוד לדגלים שעדי סימנה ב-[[basketball-scheduler-legal-review]]
(המשתמש אישר תיקון מלא). הטקסט המשפטי נוסח ע"י עדי — נועם חיווט בלבד, לא ניסח.
- **B1 (חוסם) — כלל קריאה פרוץ ב-`firestore.rules`:** הוחלף `allow read: if request.auth != null`
  במודל **allowlist**: הקריאה מוגבלת ל-`admins` (עורכים) **או** `members` (צופים). מי שאינו
  באף רשימה — אין לו גישה כלל. הרול נכתב עם helpers `isAdmin()`/`isMember()` ובדיקת קיום שדה
  (`'admins' in resource.data`) כדי לא לקרוס על מסמכים ישנים. הכתיבה נשארה admin-only. נוסף
  `members: []` ל-`EMPTY` ב-`constants.js`. ב-`useClubData` הודעת השגיאה במקרה `permission-denied`
  מפנה את המשתמש לבקש הוספה לרשימת המורשים (במקום "טעינת הנתונים נכשלה" גנרי).
- **B2 (חוסם) — יידוע פרטיות + מסמכים משפטיים:** שלושת המסמכים (`privacy-policy.md`,
  `terms-of-use.md`, `accessibility-statement.md`) הועתקו מ-`adi/Outputs/` אל
  `src/legal/content/` (כדי שהאפליקציה תישאר self-contained) ומוצגים דרך **מודאל** —
  `src/legal/Markdown.jsx` (רנדרר MD→JSX מינימלי ובטוח, ללא שינוי ניסוח), `LegalModal.jsx`,
  ו-`LegalFooter.jsx` (שורת "מדיניות פרטיות · תנאי שימוש · הצהרת נגישות" עם `·` ב-`aria-hidden`).
  הפוטר הוטמע גם ב-`LoginPage` וגם בתחתית `App.jsx`. מתחת לכפתור ההתחברות נוספה שורת יידוע
  הפרטיות המדויקת של עדי. placeholders `[[ ]]` נשארו גלויים למילוי הלקוח; גם הערות הטיוטה של
  עדי מוצגות נאמנה כ-callouts (הטיוטה טעונה אישור עו"ד לפני פרסום).
- **M2 (חובה) — ניגודיות:** כל `text-stone-400` (≈2.5:1, נכשל AA) הוחלף ב-`text-stone-600`
  בכל הקומפוננטות + טקסט `text-stone-300` קריא ("טרם נקבע") ל-`stone-500`. הפוטר החדש לא
  משתמש ב-stone-400 כלל.
- **R1 (נדרש) — aria/סמנטיקה:** נוספו `aria-label` לכפתורי אייקון שחסרו (מחיקת משחק, סגירת
  הודעות ×). טאבים ראשיים ב-`App.jsx` קיבלו `role="tablist"/"tab"/"tabpanel"` + `aria-selected`
  + `aria-controls`/`aria-labelledby`. מפרידי ה-`·` בפוטר `aria-hidden`.
- **סדר קריטי (אזהרת עדי):** M2+R1 בוצעו **לפני** חיווט הצהרת הנגישות — ההצהרה מצהירה על
  4.5:1 ו-aria-labels, ולכן חייבת להיות מדויקת. אומת ש-`index.html` הוא `lang="he" dir="rtl"`.
- **Verification:** `npm run build` עבר נקי (1553 מודולים; אזהרת chunk צפויה — firebase). `npm run dev`
  עלה, ואומת ש-`?raw` של קבצי ה-MD עובר transform ומוטמע. אין כלי דפדפן ב-toolset של נועם → QA
  ויזואלי מלא (פתיחת מודאלים, טאבים בקורא-מסך, מסך login במצב ענן) ממתין לבדיקת המשתמש.
- **Notes / Caveats:** (1) שינוי ה-rules דורש פרסום מחדש: `firebase deploy --only firestore:rules`.
  (2) **צופים קיימים ייחסמו** עד שכתובותיהם יתווספו ל-`members` ב-`clubs/main` — README עודכן עם
  ההוראה. (3) build חדש + deploy hosting נדרשים לתצוגת הפוטר/המסמכים. (4) `firebase deploy` עדיין
  נחסם ל-Claude → המשתמש מריץ ידנית, **אחרי** אישור שער של עדי.
- **Related:** [[basketball-scheduler-legal-gate]], [[team-expansion-adi-legal]], [[push-workflow]]

### 2026-07-28 — בריף סטטוס + שאלת בקרת-גישה של המשתמש [debug]
- **What was done:** המשתמש ביקש בריף סטטוס ושאל "כל מי שמקבל את הקישור ויש לו גימייל יכול
  להיכנס ולראות את האימונים — מה אפשר לעשות?". בדקתי את המצב בפועל: `git show HEAD:firestore.rules`
  (החי) מול קובץ העבודה. **ממצא מרכזי:** הגרסה ה**חיה/deployed** (commit 4e98545) עדיין עם
  `allow read: if request.auth != null` → כל משתמש-גימייל מחובר קורא הכול. זה בדיוק הכשל שהמשתמש זיהה.
- **Decisions:** הפתרון כבר קיים ולא צריך פיתוח חדש — מודל ה-allowlist (`isAdmin() || isMember()`)
  שנועם בנה בסשן 23.7 יושב בקובץ העבודה אבל **טרם עבר commit/deploy**. ההמלצה למשתמש: לפרסם את
  התיקון הקיים (commit+push → build → deploy rules+hosting) ולנהל את הגישה דרך `members[]`/`admins[]`.
- **Notes / Caveats:** לא בוצע commit/deploy בסשן זה — רק אבחון + הצעת מסלול. ממתין לאישור המשתמש
  להתחיל. עדי כבר שחררה את השער ל-🟡 (אושר עם תיקונים חובה), כך שאין חסם משפטי חדש ל-deploy.
- **Related:** [[basketball-scheduler-legal-gate]], [[push-workflow]]
